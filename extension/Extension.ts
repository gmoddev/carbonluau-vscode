import * as Vscode from 'vscode';
import { LoadPack, Pack } from './Pack';
import { ToolingClient, Revision } from './ToolingClient';
import { Capture, Snapshot, SourceKey } from './Snapshot';
import { Language } from './Language';
import { RegisterMetadata } from './Metadata';

interface SourceDiagnostic { Folder: string; Path: string; Code: string; Message: string; Severity: string; Line: number; Column: number; EndLine: number; EndColumn: number }
interface Inspection { Diagnostics: SourceDiagnostic[]; Imports: unknown[]; Projects: { Kind: string; PackageId?: string }[] }
let Manager: ProjectManager | undefined;

class ProjectManager {
  private readonly Output = Vscode.window.createOutputChannel('CarbonLuau');
  private readonly Diagnostics = Vscode.languages.createDiagnosticCollection('CarbonLuau');
  private readonly Status = Vscode.window.createStatusBarItem(Vscode.StatusBarAlignment.Right, 20);
  private Host?: ToolingClient;
  private Language?: Language;
  private Pack?: Pack;
  private Metadata?: Vscode.Disposable;
  private SelectedApi = '';
  private Generation = 0;
  private Running?: Promise<void>;
  private Pending = false;
  private Timer?: NodeJS.Timeout;
  private Stopped = false;
  constructor(private readonly Context: Vscode.ExtensionContext) {
    this.Status.command = 'carbonLuau.showOutput'; this.Status.text = 'CarbonLuau: starting'; this.Status.show();
    Context.subscriptions.push(this.Output, this.Diagnostics, this.Status);
  }
  Log(Message: string): void { this.Output.appendLine('[CarbonLuau:Editor] ' + Message.replace(/[\r\n\0]/g, ' ').slice(0, 2048)); }
  ShowOutput(): void { this.Output.show(true); }
  Schedule(): void {
    if (this.Stopped) return;
    ++this.Generation; this.Pending = true; this.Diagnostics.clear(); this.Language?.Invalidate();
    if (!Vscode.workspace.isTrusted) void this.Language?.Stop();
    if (this.Timer) clearTimeout(this.Timer);
    this.Timer = setTimeout(() => { void this.Validate(); }, 250);
  }
  async Validate(): Promise<void> {
    if (this.Stopped) return;
    this.Pending = true;
    if (this.Running) return this.Running;
    this.Running = this.Drain();
    try { await this.Running; } finally { this.Running = undefined; }
  }
  private async Drain(): Promise<void> {
    while (this.Pending && !this.Stopped) {
      this.Pending = false;
      const Generation = this.Generation;
      try {
        if (!this.Host) await this.Start();
        const Snapshot = await Capture();
        const Digest = Revision(Snapshot.Params, this.SelectedApi, this.Pack!.PackVersion);
        const Result = await this.Host!.Request('validateProject', Snapshot.Params, Digest) as Inspection;
        if (Generation !== this.Generation || this.Stopped) continue;
        this.ApplyDiagnostics(Result, Snapshot);
        if (Vscode.workspace.isTrusted && this.Pack!.LanguageServerQualified) {
          this.Language ??= new Language(this.Pack!, Message => this.Log(Message), () => {
            this.Status.text = `CarbonLuau: ${this.SelectedApi}${Vscode.workspace.isTrusted && this.Language?.Ready ? '' : ' (static only)'}`;
          });
          await this.Language.Update(Snapshot);
        } else await this.Language?.Stop();
        this.Status.text = `CarbonLuau: ${this.SelectedApi}${Vscode.workspace.isTrusted && this.Language?.Ready ? '' : ' (static only)'}`;
        this.Status.tooltip = `Package schema 1; ${Result.Projects.length} projects. ${Vscode.workspace.isTrusted ? 'Workspace configuration is excluded from supervised analysis.' : 'Richer Luau analysis is disabled until this workspace is trusted.'}`;
        this.Log(`Validated ${Result.Projects.length} projects; ${Result.Diagnostics.length} diagnostics; ${Result.Imports.length} legal imports. Runtime compiler validation is unavailable.`);
      } catch (Error) {
        const Message = Error instanceof globalThis.Error ? Error.message : String(Error);
        this.Log(Message); this.Status.text = 'CarbonLuau: unavailable'; this.Status.tooltip = Message;
        const Document = Vscode.window.activeTextEditor?.document;
        if (Document && Generation === this.Generation) {
          const Diagnostic = new Vscode.Diagnostic(new Vscode.Range(0, 0, 0, 1), Message.slice(0, 1024), Vscode.DiagnosticSeverity.Error);
          Diagnostic.source = 'CarbonLuau'; Diagnostic.code = 'ToolingUnavailable'; this.Diagnostics.set(Document.uri, [Diagnostic]);
        }
      }
    }
  }
  private async Start(): Promise<void> {
    this.Pack = await LoadPack(this.Context.extensionPath);
    this.SelectedApi = Vscode.workspace.getConfiguration('carbonLuau').get<string>('apiVersion') ||
      this.Context.workspaceState.get<string>('SelectedApi') || this.Pack.ApiVersion;
    const Host = new ToolingClient(this.Pack, Message => this.Log(Message));
    try {
      await Host.Request('initialize', { ExtensionVersion: this.Context.extension.packageJSON.version, ApiVersion: this.SelectedApi,
        PackageSchema: 1, Platform: this.Pack.Platform, PackVersion: this.Pack.PackVersion, Capabilities: ['StaticAnalysis', 'Metadata'] });
      this.Metadata?.dispose(); this.Metadata = RegisterMetadata(await Host.Request('getMetadata', {}));
      this.Host = Host;
    } catch (Error) { await Host.Stop(); throw Error; }
  }
  private ApplyDiagnostics(Result: Inspection, Snapshot: Snapshot): void {
    if (!Array.isArray(Result.Diagnostics) || Result.Diagnostics.length > 256 || !Array.isArray(Result.Imports) || Result.Imports.length > 8192) throw new Error('Invalid tooling diagnostics result.');
    const ByUri = new Map<string, { Uri: Vscode.Uri; Values: Vscode.Diagnostic[] }>();
    for (const Item of Result.Diagnostics) {
      const Uri = Snapshot.Uris.get(SourceKey(Item.Folder, Item.Path));
      if (!Uri) { this.Log(Item.Message); continue; }
      const Range = new Vscode.Range(Item.Line, Item.Column, Item.EndLine, Item.EndColumn);
      const Diagnostic = new Vscode.Diagnostic(Range, Item.Message.slice(0, 1024), Item.Severity === 'Warning' ? Vscode.DiagnosticSeverity.Warning : Vscode.DiagnosticSeverity.Error);
      Diagnostic.source = 'CarbonLuau'; Diagnostic.code = Item.Code;
      const Group = ByUri.get(Uri.toString()) ?? { Uri, Values: [] };
      Group.Values.push(Diagnostic); ByUri.set(Uri.toString(), Group);
    }
    this.Diagnostics.clear();
    for (const Group of ByUri.values()) this.Diagnostics.set(Group.Uri, Group.Values);
  }
  async SelectApi(): Promise<void> {
    try {
      const Pack = this.Pack ?? await LoadPack(this.Context.extensionPath);
      const Selected = await Vscode.window.showQuickPick([Pack.ApiVersion], { title: 'CarbonLuau: Select Scripting API', placeHolder: 'Installed offline API targets' });
      if (Selected) {
        await this.Context.workspaceState.update('SelectedApi', Selected);
        await Vscode.workspace.getConfiguration('carbonLuau').update('apiVersion', Selected, Vscode.ConfigurationTarget.Workspace);
      }
    } catch (Error) { this.Log(String(Error)); }
  }
  async Restart(): Promise<void> {
    ++this.Generation; this.Pending = false;
    await this.Language?.Stop(); this.Language?.dispose(); this.Language = undefined;
    await this.Host?.Stop(); this.Host = undefined;
    if (this.Running) await this.Running;
    this.Schedule();
  }
  async Stop(): Promise<void> {
    this.Stopped = true; ++this.Generation; this.Pending = false;
    if (this.Timer) clearTimeout(this.Timer);
    await this.Language?.Stop(); this.Language?.dispose(); this.Language = undefined;
    await this.Host?.Stop();
    this.Metadata?.dispose(); this.Metadata = undefined;
    if (this.Running) await this.Running;
  }
}

export function activate(Context: Vscode.ExtensionContext): void {
  Manager = new ProjectManager(Context);
  const Current = Manager;
  for (const [Name, Handler] of [
    ['validateProject', () => Current.Validate()], ['selectScriptingApi', () => Current.SelectApi()],
    ['restartTooling', () => Current.Restart()], ['showOutput', () => Current.ShowOutput()]
  ] as const) Context.subscriptions.push(Vscode.commands.registerCommand('carbonLuau.' + Name, Handler));
  const Watcher = Vscode.workspace.createFileSystemWatcher('**/{addon.json,*.luau,*.claddon}');
  Context.subscriptions.push(Watcher, Watcher.onDidChange(() => Current.Schedule()), Watcher.onDidCreate(() => Current.Schedule()), Watcher.onDidDelete(() => Current.Schedule()),
    Vscode.workspace.onDidChangeWorkspaceFolders(() => Current.Schedule()),
    Vscode.workspace.onDidGrantWorkspaceTrust(() => { void Current.Restart(); }),
    Vscode.workspace.onDidOpenTextDocument(Document => { if (Document.languageId === 'luau') Current.Schedule(); }),
    Vscode.workspace.onDidChangeTextDocument(Event => { if (Event.document.languageId === 'luau' || Event.document.uri.path.endsWith('/addon.json')) Current.Schedule(); }),
    Vscode.workspace.onDidChangeConfiguration(Event => { if (Event.affectsConfiguration('carbonLuau.apiVersion')) void Current.Restart(); }));
  Current.Schedule();
}
export async function deactivate(): Promise<void> { await Manager?.Stop(); Manager = undefined; }
