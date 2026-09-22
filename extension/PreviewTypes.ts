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
