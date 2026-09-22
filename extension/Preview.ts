import { Pack } from './Pack';
import { Revision, ToolingClient } from './ToolingClient';

export interface Viewport { Width: number; Height: number }
export interface PreviewSelection { ProjectId: string; Entry?: string; ScreenId?: string; Viewport: Viewport }
export interface RectPx { X: number; Y: number; Width: number; Height: number }
export interface PreviewNode {
  Id: string; ParentId: string | null; ClassName: string; Name: string; Children: string[];
  Retained: Record<string, { Kind: string; Encoded: string[] }>;
  Projected: null | { RectPx: RectPx; EffectiveClipRectPx: RectPx; EffectiveVisible: boolean; PaintOrder: number;
    ClipDepth: number; LayoutOwnerId: string | null; DescendantClipOwnerIds: string[]; Interactive: boolean };
  Paint: { Kind: string; RectPx: RectPx; ClipRectPx: RectPx; Visible: boolean; Order: number; Properties: Record<string, unknown>; Fidelity: string }[];
  Fidelity: Record<string, string>; Source: null;
  Scroll?: { ViewportRectPx: RectPx; ContentRectPx: RectPx; OffsetAuthority: 'PresentationLocal'; PreviewLocalIntent: 'InitialTopLeft'; Fidelity: 'ConvenienceOnly' };
}
export interface ToolingPreviewPlan extends PreviewSelection {
  SchemaVersion: 1; ProjectRevision: string; ApiVersion: string; PackVersion: string; SemanticRevision: string; ToolingBuildId: string;
  Screen: { Id: string; Name: string }; AvailableScreens: { Id: string; Name: string }[]; Nodes: PreviewNode[];
  Clips: { OwnerId: string; AncestorOwnerIds: string[]; RectPx: RectPx; EffectiveRectPx: RectPx; Depth: number }[];
  Accounting: Record<string, number | string>;
}
export interface PreviewState { Plan?: ToolingPreviewPlan; Error?: { Code: string; Message: string; Details?: unknown }; Running: boolean }
type Client = Pick<ToolingClient, 'Request' | 'Stop'>;

// Internal Foundation C seam. Canonical geometry and validation stay in Core.
export class Preview {
  private Client?: Client;
  private Generation = 0;
  private Blocked = false;
  private State: PreviewState = { Running: false };
  private Stopping: Promise<void> = Promise.resolve();
  constructor(private readonly Pack: Pack, private readonly Trusted: () => boolean,
    private readonly Log: (Message: string) => void,
    private readonly Factory: () => Client = () => new ToolingClient(Pack, Log, 'preview')) { }
  GetState(): PreviewState { if (!this.Trusted()) this.Invalidate(); return structuredClone(this.State); }
  Invalidate(): void {
    ++this.Generation; this.State = { Running: false };
    const Previous = this.Client; this.Client = undefined;
    if (Previous) this.Stopping = this.Stopping.then(() => Previous.Stop());
    // Keep rejection observed while preserving the failed-reap latch for Request.
    void this.Stopping.catch(Error => this.Log(String(Error)));
  }
  async Stop(): Promise<void> { this.Invalidate(); await this.Stopping; }
  async Request(Snapshot: unknown, Selection: PreviewSelection): Promise<ToolingPreviewPlan> {
    this.Invalidate(); const Generation = this.Generation;
    this.State = { Running: true };
    let Result: ToolingPreviewPlan | undefined, RequestFailure: unknown;
    try {
      await this.Stopping;
      if (this.Blocked) throw Object.assign(new Error('Preview cleanup failed. Use Restart Tooling before executing again.'), { Code: 'PreviewReap' });
      if (!this.Trusted()) throw Object.assign(new Error('GUI preview requires Workspace Trust.'), { Code: 'WorkspaceUntrusted' });
      if (!this.Pack.PreviewQualified) throw Object.assign(new Error('GUI preview is unqualified on this pack/platform; static tooling remains available.'), { Code: 'PreviewUnavailable' });
      if (Generation !== this.Generation) throw new Error('Preview was superseded.');
      const Client = this.Factory(); this.Client = Client;
      const Initialized = await Client.Request('initialize', { ExtensionVersion: '0.0.1', ApiVersion: this.Pack.ApiVersion, PackageSchema: 1,
        Platform: this.Pack.Platform, PackVersion: this.Pack.PackVersion, Capabilities: ['StaticAnalysis', 'Metadata', 'PreviewExecution'] }) as { PreviewPlanSchema: number; Capabilities: string[] };
      if (Initialized.PreviewPlanSchema !== 1 || !Initialized.Capabilities?.includes('PreviewExecution')) throw new Error('Preview protocol compatibility check failed.');
      if (!this.Trusted() || Generation !== this.Generation) throw new Error('Preview trust or source changed.');
      const Params = { ...Selection, Snapshot, ApiVersion: this.Pack.ApiVersion, PackVersion: this.Pack.PackVersion,
        SemanticRevision: this.Pack.SemanticRevision, ToolingBuildId: this.Pack.ToolingBuildId, PreviewPlanSchema: 1, WorkspaceTrusted: true };
      const Digest = Revision(Params, this.Pack.ApiVersion, this.Pack.PackVersion);
      const Plan = await Client.Request('preview', Params, Digest) as ToolingPreviewPlan;
      if (!this.Trusted() || Generation !== this.Generation) throw new Error('Preview response is stale.');
      if (!Plan || Plan.SchemaVersion !== 1 || Plan.ProjectRevision !== Digest || Plan.ApiVersion !== this.Pack.ApiVersion ||
        Plan.PackVersion !== this.Pack.PackVersion || Plan.ToolingBuildId !== this.Pack.ToolingBuildId || Plan.SemanticRevision !== this.Pack.SemanticRevision ||
        Plan.ProjectId !== Selection.ProjectId || Plan.Entry !== (Selection.Entry ?? 'init.luau') ||
        (Selection.ScreenId !== undefined && Plan.Screen?.Id !== Selection.ScreenId) ||
        Plan.Viewport?.Width !== Selection.Viewport.Width || Plan.Viewport?.Height !== Selection.Viewport.Height ||
        !Array.isArray(Plan.Nodes) || !Array.isArray(Plan.Clips) || !Array.isArray(Plan.AvailableScreens) || !Plan.Accounting || !Plan.Screen)
        throw Object.assign(new Error('Preview plan identity or schema mismatch.'), { Code: 'PreviewProtocol' });
      this.State = { Plan: structuredClone(Plan), Running: false };
      Result = structuredClone(Plan);
    } catch (Failure) {
      const Error = Failure as Error & { Code?: string; Details?: unknown };
      if (Error.Code === 'PreviewReap') this.Blocked = true;
      if (Generation === this.Generation) this.State = { Running: false, Error: { Code: Error.Code ?? 'PreviewFailure', Message: String(Error.message).slice(0, 1024), Details: Error.Details } };
      RequestFailure = Failure;
    } finally {
      if (Generation === this.Generation) {
        const Previous = this.Client; this.Client = undefined;
        if (Previous) {
          this.Stopping = this.Stopping.then(() => Previous.Stop());
          try { await this.Stopping; } catch (Failure) { this.State = { Running: false, Error: { Code: 'PreviewReap', Message: String(Failure).slice(0, 1024) } }; RequestFailure = Failure; }
        }
      }
    }
    if (RequestFailure) throw RequestFailure;
    if (Generation !== this.Generation) throw new Error('Preview was superseded during cleanup.');
    if (!this.Trusted()) { this.State = { Running: false }; throw new Error('Preview trust changed during cleanup.'); }
    return Result!;
  }
}
