import * as Vscode from 'vscode';
import { randomBytes as RandomBytes } from 'node:crypto';
import { IsViewport, ParseMessage, ValidatePlan } from './PreviewContract';
import { PreviewSelection, ToolingPreviewPlan } from './PreviewTypes';

export class PreviewPanel {
  private readonly Panel: Vscode.WebviewPanel;
  private Selection: PreviewSelection;
  private Zoom = 0.5;
  private Plan?: ToolingPreviewPlan;
  private Screens: { Id: string; Name: string }[] = [];
  private Message = 'Preparing fresh preview…';
  private Generation = 0;
  private Closed = false;
  private Timer?: NodeJS.Timeout;
  private Ready = false;
  constructor(private readonly Context: Vscode.ExtensionContext, ProjectId: string,
    private readonly Request: (Selection: PreviewSelection) => Promise<ToolingPreviewPlan>,
    private readonly Cancel: () => void, private readonly ClosedCallback: () => void) {
    const Saved = Context.workspaceState.get<{ Viewport?: unknown; Zoom?: unknown }>('PreviewPreferences');
    this.Selection = { ProjectId, Viewport: IsViewport(Saved?.Viewport) ? Saved.Viewport : { Width: 1280, Height: 720 } };
    if ([0.25, 0.5, 0.75, 1, 1.5, 2].includes(Saved?.Zoom as number)) this.Zoom = Saved!.Zoom as number;
    const Media = Vscode.Uri.joinPath(Context.extensionUri, 'media'), Scripts = Vscode.Uri.joinPath(Context.extensionUri, 'dist', 'webview');
    this.Panel = Vscode.window.createWebviewPanel('carbonLuau.preview', 'CarbonLuau GUI Preview', Vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [Media, Scripts], retainContextWhenHidden: false });
    this.Panel.webview.html = PreviewHtml(this.Panel.webview, Media, Scripts, RandomBytes(24).toString('hex'));
    this.Panel.webview.onDidReceiveMessage(Value => {
      const M = ParseMessage(Value); if (!M || this.Closed) return;
      if (M.Type === 'Ready') { this.Ready = true; this.Send(); return; }
      if (M.Type === 'Zoom') { this.Zoom = M.Zoom; this.Persist(); this.Send(); return; }
      if (M.Type === 'Viewport') { this.Selection = { ...this.Selection, Viewport: M.Viewport }; this.Persist(); }
      if (M.Type === 'Screen') { if (!this.Screens.some(S => S.Id === M.Id)) return; this.Selection = { ...this.Selection, ScreenId: M.Id }; }
      this.Invalidate();
    });
    this.Panel.onDidDispose(() => { this.Closed = true; ++this.Generation; if (this.Timer) clearTimeout(this.Timer); this.Cancel(); this.ClosedCallback(); });
    this.Invalidate();
  }
  Reveal(): void { this.Panel.reveal(); }
  dispose(): void { this.Panel.dispose(); }
  Suspend(Message: string): void {
    if (this.Closed) return;
    ++this.Generation; this.Plan = undefined; this.Screens = []; this.Cancel();
    if (this.Timer) clearTimeout(this.Timer);
    this.Message = Message.slice(0, 2048); this.Send();
  }
  Invalidate(): void {
    if (this.Closed) return;
    this.Suspend('Preparing fresh preview…');
    this.Timer = setTimeout(() => { void this.Refresh(); }, 400);
  }
  private Persist(): void { void this.Context.workspaceState.update('PreviewPreferences', { Viewport: this.Selection.Viewport, Zoom: this.Zoom }); }
  private Send(): void {
    if (!this.Ready || this.Closed) return;
    void this.Panel.webview.postMessage({ Version: 1, Type: 'State', Plan: this.Plan, Screens: this.Screens,
      Message: this.Message, Viewport: this.Selection.Viewport, Zoom: this.Zoom });
  }
  private async Refresh(): Promise<void> {
    const Generation = this.Generation;
    try {
      if (!Vscode.workspace.isTrusted) throw new Error('GUI preview executes Luau in a bounded worker and requires Workspace Trust. Static tooling remains available.');
      const Plan = ValidatePlan(await this.Request(this.Selection));
      if (this.Closed || Generation !== this.Generation || !Vscode.workspace.isTrusted) return;
      this.Plan = Plan; this.Screens = Plan.AvailableScreens;
      this.Message = 'Current · ' + Plan.Screen.Name + ' · ' + Plan.Viewport.Width + ' × ' + Plan.Viewport.Height + ' · ' + Plan.ApiVersion;
    } catch (Failure) {
      if (this.Closed || Generation !== this.Generation) return;
      this.Plan = undefined;
      const Code = (Failure as { Code?: unknown })?.Code;
      this.Message = ('Preview unavailable · ' + (typeof Code === 'string' ? Code.slice(0, 64) + ': ' : '') + (Failure instanceof Error ? Failure.message : String(Failure))).slice(0, 2048);
      const Details = (Failure as { Details?: { Screens?: unknown } })?.Details?.Screens;
      this.Screens = Array.isArray(Details) && Details.length <= 128 && Details.every(S => S && typeof S.Id === 'string' && S.Id.length <= 128 && typeof S.Name === 'string' && S.Name.length <= 16384) ? Details : [];
    }
    this.Send();
  }
}

export function PreviewHtml(Webview: Vscode.Webview, Media: Vscode.Uri, Scripts: Vscode.Uri, Nonce: string): string {
  const Css = Webview.asWebviewUri(Vscode.Uri.joinPath(Media, 'preview.css'));
  const Js = Webview.asWebviewUri(Vscode.Uri.joinPath(Scripts, 'Preview.js'));
  // All substitutions are extension-owned. Workspace text only reaches textContent.
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${Nonce}'; style-src ${Webview.cspSource}; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="${Css}"><title>CarbonLuau GUI Preview</title></head><body>
<header><div class="toolbar"><span class="brand">CARBONLUAU / GUI</span>
<label>Viewport <select id="presets"><option value="">Custom / presets</option><option>1280x720</option><option>1920x1080</option><option>2560x1440</option><option>3440x1440</option></select></label>
<label>W <input id="width" type="number" min="1" max="8192" value="1280"></label><label>H <input id="height" type="number" min="1" max="8192" value="720"></label><button id="apply">Apply</button>
<label>Display zoom <select id="zoom"><option value="0.25">25%</option><option value="0.5" selected>50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
<label>Screen <select id="screens" disabled></select></label><button id="refresh">Refresh</button></div><div id="status" role="status" aria-live="polite">Preparing preview…</div></header>
<main class="workspace"><aside class="tree-side"><h2>Hierarchy</h2><div id="hierarchy" role="tree" aria-label="GUI hierarchy"></div><h2>Resources</h2><div id="resources"></div></aside>
<section class="viewport-area" aria-label="GUI paint surface"><div id="canvas-space"><div id="surface"></div></div></section>
<aside class="inspector-side"><h2>Inspector</h2><div id="inspector">Select a node.</div></aside></main>
<footer>Geometry and resource counts: canonical Core. Text/fonts: approximate. Images: placeholders. Scroll: local convenience.<br>
Selection inspects only; callbacks never run. New plans reset selection and scroll. No Rust server or authenticated client. No script log stream is available.<div id="metrics"></div></footer>
<script nonce="${Nonce}" src="${Js}"></script></body></html>`;
}
