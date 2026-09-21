import * as Vscode from 'vscode';
import { Pack, CheckLanguageServer } from './Pack';
import { ToolingClient, Revision } from './ToolingClient';
import { Snapshot } from './Snapshot';

interface Position { line: number; character: number }
interface Range { start: Position; end: Position }
interface Diagnostic { range: Range; message: string; severity?: number; code?: string | number }
interface Completion { label: string; detail?: string; documentation?: unknown; insertText?: string; textEdit?: { range: Range; newText: string } }
interface Signature { label: string; documentation?: unknown; parameters?: { label: string | [number, number]; documentation?: unknown }[] }
const Plain = (Value: unknown): string => typeof Value === 'string' ? Value.slice(0, 65536) : Value && typeof Value === 'object' && 'value' in Value ? String(Value.value).slice(0, 65536) : '';

export class Language implements Vscode.Disposable {
  private Client?: ToolingClient;
  private Snapshot?: Snapshot;
  private Candidate?: Snapshot;
  private Digest = '';
  private Admitted = new Set<string>();
  private Generation = 0;
  private Tail: Promise<unknown> = Promise.resolve();
  private Queued = 0;
  private Failed = false;
  private LastCrashRestart = -Infinity;
  private Recovery?: NodeJS.Timeout;
  private readonly Registrations: Vscode.Disposable[] = [];
  private readonly Diagnostics = Vscode.languages.createDiagnosticCollection('CarbonLuau types');
  get Ready(): boolean { return !!this.Client && !!this.Snapshot && !this.Failed; }
  constructor(private readonly Pack: Pack, private readonly Log: (Text: string) => void, private readonly Changed: () => void = () => {}) {
    const Selector = { language: 'luau', scheme: 'file' };
    this.Registrations.push(this.Diagnostics,
      Vscode.languages.registerHoverProvider(Selector, { provideHover: async (Document, Position, Token) => {
        const Result = await this.Request(Document, 'textDocument/hover', Position, Token) as { contents?: unknown; range?: Range } | undefined;
        if (!Result) return undefined;
        const Text = Array.isArray(Result.contents) ? Result.contents.map(Plain).join('\n') : Plain(Result.contents);
        return Text ? new Vscode.Hover(new Vscode.MarkdownString().appendText(Text), Result.range ? this.Range(Result.range, Document.getText()) : undefined) : undefined;
      } }),
      Vscode.languages.registerCompletionItemProvider(Selector, { provideCompletionItems: async (Document, Position, Token) => {
        const Result = await this.Request(Document, 'textDocument/completion', Position, Token) as { items: Completion[] } | Completion[] | undefined;
        if (!Result) return [];
        const Items = Array.isArray(Result) ? Result : Result.items;
        return Items.slice(0, 256).map(Item => {
          const Completion = new Vscode.CompletionItem(Item.label);
          Completion.detail = Item.detail; Completion.documentation = Plain(Item.documentation);
          Completion.insertText = Item.textEdit?.newText ?? Item.insertText ?? Item.label;
          if (Item.textEdit) Completion.range = this.Range(Item.textEdit.range, Document.getText());
          return Completion;
        });
      } }, '.', ':', '"', "'"),
      Vscode.languages.registerSignatureHelpProvider(Selector, { provideSignatureHelp: async (Document, Position, Token) => {
        const Result = await this.Request(Document, 'textDocument/signatureHelp', Position, Token) as { signatures: Signature[]; activeSignature?: number; activeParameter?: number } | undefined;
        if (!Result) return undefined;
        const Help = new Vscode.SignatureHelp();
        Help.signatures = Result.signatures.slice(0, 256).map(Item => {
          const Signature = new Vscode.SignatureInformation(Item.label, Plain(Item.documentation));
          Signature.parameters = (Item.parameters ?? []).slice(0, 256).map(Parameter => new Vscode.ParameterInformation(Parameter.label, Plain(Parameter.documentation)));
          return Signature;
        });
        Help.activeSignature = Math.max(0, Math.min(Result.activeSignature ?? 0, Help.signatures.length - 1));
        Help.activeParameter = Math.max(0, Result.activeParameter ?? 0); return Help;
      } }, '(', ','),
      Vscode.languages.registerDefinitionProvider(Selector, { provideDefinition: async (Document, Position, Token) => {
        const Result = await this.Request(Document, 'textDocument/definition', Position, Token) as { uri: string; range: Range }[] | { uri: string; range: Range } | undefined;
        if (!Result || !this.Snapshot) return undefined;
        return (Array.isArray(Result) ? Result : [Result]).slice(0, 256).map(Item => {
          const Uri = this.Snapshot!.Uris.get(Item.uri), Source = this.Snapshot!.Sources.get(Item.uri);
          if (!Uri || Source === undefined) throw new Error('Unadmitted language navigation target.');
          return new Vscode.Location(Uri, this.Range(Item.range, Source));
        });
      } }));
  }
  private Range(Value: Range, Source: string): Vscode.Range {
    const Lines = Source.split('\n');
    for (const Position of [Value.start, Value.end]) {
      if (!Number.isSafeInteger(Position.line) || !Number.isSafeInteger(Position.character) || Position.line < 0 || Position.line >= Lines.length || Position.character < 0 || Position.character > Lines[Position.line].length)
        throw new Error('Language response range exceeds admitted source.');
    }
    if (Value.end.line < Value.start.line || Value.end.line === Value.start.line && Value.end.character < Value.start.character) throw new Error('Reversed language range.');
    return new Vscode.Range(Value.start.line, Value.start.character, Value.end.line, Value.end.character);
  }
  private Enqueue<T>(Work: () => Promise<T>): Promise<T | undefined> {
    if (this.Queued >= 16 || this.Failed) return Promise.resolve(undefined);
    ++this.Queued;
    // Failure may happen after this work was queued. Never let a queued snapshot
    // implicitly replay analysis after a timeout/resource/protocol latch.
    const Result = this.Tail.then(() => this.Failed ? undefined : Work()).catch(async Error => {
      this.Failed = true; this.Diagnostics.clear(); this.Log(String(Error)); await this.Client?.Stop(); this.Client = undefined; this.Changed();
      if (Error?.Code === 'AnalysisCrash' && performance.now() - this.LastCrashRestart >= 300000 && Vscode.workspace.isTrusted && (this.Snapshot ?? this.Candidate)) {
        this.LastCrashRestart = performance.now();
        const Snapshot = (this.Snapshot ?? this.Candidate)!, Generation = this.Generation;
        this.Recovery = setTimeout(() => {
          if (Vscode.workspace.isTrusted && Generation === this.Generation) { this.Failed = false; void this.Update(Snapshot); }
        }, 1000);
      }
      return undefined;
    }).finally(() => { --this.Queued; });
    this.Tail = Result; return Result;
  }
  Invalidate(): void { ++this.Generation; this.Diagnostics.clear(); }
  async Update(Snapshot: Snapshot): Promise<void> {
    this.Invalidate(); const Generation = this.Generation;
    if (!Vscode.workspace.isTrusted || !Vscode.workspace.workspaceFolders?.length) { await this.Stop(); return; }
    const Digest = Revision(Snapshot.Params, this.Pack.ApiVersion, this.Pack.PackVersion);
    await this.Enqueue(async () => {
      if (!Vscode.workspace.isTrusted || Generation !== this.Generation) return;
      CheckLanguageServer(this.Pack);
      this.Candidate = Snapshot;
      this.Client ??= new ToolingClient(this.Pack, this.Log, 'analysis');
      const Result = await this.Client.Request('snapshot', { Trusted: Vscode.workspace.isTrusted, Snapshot: Snapshot.Params }, Digest) as { Admitted: string[]; Withheld: string[] };
      if (!Vscode.workspace.isTrusted || Generation !== this.Generation) { await this.Client.Stop(); this.Client = undefined; return; }
      if (!Array.isArray(Result.Admitted) || Result.Admitted.length > 2048 || Result.Admitted.some(Key => !Snapshot.Sources.has(Key))) throw new Error('Invalid analysis admission map.');
      this.Snapshot = Snapshot; this.Digest = Digest; this.Admitted = new Set(Result.Admitted);
      this.Changed();
      if (Result.Withheld.length) this.Log(`${Result.Withheld.length} sources have static diagnostics only because configuration, syntax or require admission excludes executable analysis.`);
    });
    for (const Document of Vscode.workspace.textDocuments) if (Document.languageId === 'luau') void this.Diagnose(Document);
  }
  private async Request(Document: Vscode.TextDocument, Operation: string, Position?: Vscode.Position, Token?: Vscode.CancellationToken): Promise<unknown> {
    const Generation = this.Generation;
    return this.Enqueue(async () => {
      if (!Vscode.workspace.isTrusted) { await this.Stop(); return undefined; }
      if (!this.Client || !this.Snapshot || Generation !== this.Generation || Token?.isCancellationRequested) return undefined;
      const Key = [...this.Snapshot.Uris].find(([, Uri]) => Uri.toString() === Document.uri.toString())?.[0];
      if (!Key || !this.Admitted.has(Key) || this.Snapshot.Sources.get(Key) !== Document.getText()) return undefined;
      const [Folder, Path] = Key.split('\0');
      const Result = await this.Client.Request('language', { Trusted: Vscode.workspace.isTrusted, Operation, Folder, Path,
        ...(Position ? { Position: { line: Position.line, character: Position.character } } : {}) }, this.Digest) as { Value: unknown };
      if (!Vscode.workspace.isTrusted || Generation !== this.Generation || Token?.isCancellationRequested) return undefined;
      return Result.Value;
    });
  }
  async Diagnose(Document: Vscode.TextDocument): Promise<void> {
    const Version = Document.version, Generation = this.Generation;
    const Result = await this.Request(Document, 'textDocument/diagnostic') as { items?: Diagnostic[] } | undefined;
    if (!Result?.items || Document.version !== Version || Generation !== this.Generation || !Vscode.workspace.isTrusted) return;
    try {
      const Values = Result.items.slice(0, 256).map(Item => {
        const Diagnostic = new Vscode.Diagnostic(this.Range(Item.range, Document.getText()), Item.message.slice(0, 4096), Item.severity === 1 ? Vscode.DiagnosticSeverity.Error : Vscode.DiagnosticSeverity.Warning);
        Diagnostic.source = 'CarbonLuau types'; Diagnostic.code = Item.code; return Diagnostic;
      });
      this.Diagnostics.set(Document.uri, Values);
    } catch (Error) { this.Log(String(Error)); await this.Stop(); }
  }
  async Stop(): Promise<void> { this.Invalidate(); if (this.Recovery) clearTimeout(this.Recovery); await this.Client?.Stop(); this.Client = undefined; this.Snapshot = undefined; this.Candidate = undefined; this.Admitted.clear(); this.Changed(); }
  dispose(): void { void this.Stop(); for (const Registration of this.Registrations) Registration.dispose(); }
}
