import { ToolingPreviewPlan, Viewport } from './PreviewTypes';

// Transport/DOM safety limits, not CarbonLuau resource or layout semantics.
function RecordOf(Value: unknown): Record<string, unknown> {
  if (!Value || typeof Value !== 'object' || Array.isArray(Value)) throw new Error('Expected object');
  const Result = Value as Record<string, unknown>;
  if (Object.keys(Result).length > 256 || Object.keys(Result).some(Key => ['__proto__', 'prototype', 'constructor'].includes(Key))) throw new Error('Unsafe object');
  return Result;
}
function Fields(Value: unknown, Required: string[], Optional: string[] = []): Record<string, unknown> {
  const Result = RecordOf(Value);
  if (Required.some(Key => !Object.hasOwn(Result, Key)) || Object.keys(Result).some(Key => !Required.includes(Key) && !Optional.includes(Key))) throw new Error('Unexpected fields');
  return Result;
}
function Text(Value: unknown, Limit = 16384): asserts Value is string { if (typeof Value !== 'string' || Value.length > Limit) throw new Error('Invalid string'); }
function NumberValue(Value: unknown): asserts Value is number { if (typeof Value !== 'number' || !Number.isFinite(Value) || Math.abs(Value) > 1e12) throw new Error('Invalid number'); }
function BooleanValue(Value: unknown): void { if (typeof Value !== 'boolean') throw new Error('Invalid boolean'); }
function List(Value: unknown, Limit = 4096): unknown[] { if (!Array.isArray(Value) || Value.length > Limit) throw new Error('Invalid array'); return Value; }
function Id(Value: unknown): asserts Value is string { Text(Value, 128); if (!Value.length) throw new Error('Empty ID'); }
function Ids(Value: unknown): string[] { const Values = List(Value); Values.forEach(Id); return Values as string[]; }
function Rectangle(Value: unknown): void { const Rect = Fields(Value, ['X', 'Y', 'Width', 'Height']); Object.values(Rect).forEach(NumberValue); }
function Screen(Value: unknown): void { const Item = Fields(Value, ['Id', 'Name']); Id(Item.Id); Text(Item.Name); }
export function IsViewport(Value: unknown): Value is Viewport {
  try { const V = Fields(Value, ['Width', 'Height']); return [V.Width, V.Height].every(N => typeof N === 'number' && Number.isInteger(N) && N >= 1 && N <= 8192); } catch { return false; }
}
function Color(Value: unknown): void { const Parts = List(Value, 4); if (Parts.length !== 4) throw new Error('Invalid color'); Parts.forEach(NumberValue); }
function PaintProperties(Kind: unknown, Value: unknown): void {
  if (Kind === 'Container' || Kind === 'Button') { const P = Fields(Value, ['BackgroundColor']); Color(P.BackgroundColor); }
  else if (Kind === 'ScrollView') { const P = Fields(Value, ['BackgroundColor', 'ScrollHorizontal', 'ScrollVertical', 'ScrollEnabled']); Color(P.BackgroundColor); [P.ScrollHorizontal, P.ScrollVertical, P.ScrollEnabled].forEach(BooleanValue); }
  else if (Kind === 'Text') {
    const P = Fields(Value, ['Text', 'TextColor', 'FontSize', 'TextXAlignment', 'TextYAlignment', 'Font']);
    Text(P.Text); Color(P.TextColor); NumberValue(P.FontSize);
    if (!['Left', 'Center', 'Right'].includes(String(P.TextXAlignment)) || !['Top', 'Center', 'Bottom'].includes(String(P.TextYAlignment))) throw new Error('Invalid alignment');
    Text(P.Font, 128);
  } else if (Kind === 'Image') { const P = Fields(Value, ['ImageSource', 'ImageColor']); List(P.ImageSource, 16).forEach(V => Text(V)); Color(P.ImageColor); }
  else throw new Error('Unsupported paint kind');
}
export function ValidatePlan(Value: unknown): ToolingPreviewPlan {
  // Input has crossed bounded JSON IPC. This second boundary also protects the WebView.
  if (JSON.stringify(Value).length > 8 * 1024 * 1024) throw new Error('Oversized preview plan');
  const P = Fields(Value, ['SchemaVersion', 'ProjectRevision', 'ApiVersion', 'PackVersion', 'SemanticRevision', 'ToolingBuildId', 'ProjectId', 'Entry', 'Viewport', 'Screen', 'AvailableScreens', 'Nodes', 'Clips', 'Accounting']);
  if (P.SchemaVersion !== 1 || !IsViewport(P.Viewport)) throw new Error('Incompatible preview plan');
  ['ProjectRevision', 'ApiVersion', 'PackVersion', 'SemanticRevision', 'ToolingBuildId', 'ProjectId', 'Entry'].forEach(Key => Text(P[Key], 1024));
  Screen(P.Screen); List(P.AvailableScreens, 128).forEach(Screen);
  const Nodes = List(P.Nodes), NodeIds = new Set<string>();
  let DomBudget = 0, EdgeCount = 0;
  for (const Value of Nodes) {
    const N = Fields(Value, ['Id', 'ParentId', 'ClassName', 'Name', 'Children', 'Retained', 'Projected', 'Paint', 'Fidelity', 'Source'], ['Scroll']);
    Id(N.Id); if (NodeIds.has(N.Id)) throw new Error('Duplicate node ID'); NodeIds.add(N.Id);
    if (N.ParentId !== null) Id(N.ParentId);
    Text(N.ClassName, 128); Text(N.Name); Ids(N.Children);
    EdgeCount += (N.Children as string[]).length;
    if (EdgeCount >= Nodes.length) throw new Error('Hierarchy edge budget exceeded');
    if (N.Source !== null) throw new Error('Unsupported source mapping');
    for (const V of Object.values(RecordOf(N.Retained))) { const R = Fields(V, ['Kind', 'Encoded']); Text(R.Kind, 128); List(R.Encoded, 32).forEach(V => Text(V)); }
    Object.values(RecordOf(N.Fidelity)).forEach(V => Text(V, 256));
    if (N.Projected !== null) {
      const R = Fields(N.Projected, ['RectPx', 'EffectiveClipRectPx', 'EffectiveVisible', 'PaintOrder', 'ClipDepth', 'LayoutOwnerId', 'DescendantClipOwnerIds', 'Interactive']);
      Rectangle(R.RectPx); Rectangle(R.EffectiveClipRectPx); BooleanValue(R.EffectiveVisible); BooleanValue(R.Interactive);
      NumberValue(R.PaintOrder); NumberValue(R.ClipDepth); if (R.LayoutOwnerId !== null) Id(R.LayoutOwnerId); Ids(R.DescendantClipOwnerIds);
      if ((R.DescendantClipOwnerIds as string[]).length > 128) throw new Error('Clip transport limit');
    }
    for (const V of List(N.Paint, 64)) { const R = Fields(V, ['Kind', 'RectPx', 'ClipRectPx', 'Visible', 'Order', 'Properties', 'Fidelity']);
      Rectangle(R.RectPx); Rectangle(R.ClipRectPx); BooleanValue(R.Visible); NumberValue(R.Order); Text(R.Fidelity, 256); PaintProperties(R.Kind, R.Properties);
    }
    DomBudget += (N.Paint as unknown[]).length * (1 + ((N.Projected as { DescendantClipOwnerIds: string[] } | null)?.DescendantClipOwnerIds.length ?? 0) * 2);
    if (DomBudget > 32768) throw new Error('DOM transport budget exceeded');
    if (N.Scroll !== undefined) { const R = Fields(N.Scroll, ['ViewportRectPx', 'ContentRectPx', 'OffsetAuthority', 'PreviewLocalIntent', 'Fidelity']); Rectangle(R.ViewportRectPx); Rectangle(R.ContentRectPx);
      if (R.OffsetAuthority !== 'PresentationLocal' || R.PreviewLocalIntent !== 'InitialTopLeft' || R.Fidelity !== 'ConvenienceOnly') throw new Error('Unsupported scrolling contract');
    }
  }
  const ClipIds = new Set<string>();
  for (const V of List(P.Clips)) { const C = Fields(V, ['OwnerId', 'AncestorOwnerIds', 'RectPx', 'EffectiveRectPx', 'Depth']); Id(C.OwnerId);
    if (!NodeIds.has(C.OwnerId) || ClipIds.has(C.OwnerId)) throw new Error('Invalid clip reference'); ClipIds.add(C.OwnerId);
    Ids(C.AncestorOwnerIds); Rectangle(C.RectPx); Rectangle(C.EffectiveRectPx); NumberValue(C.Depth);
  }
  const Plan = Value as ToolingPreviewPlan, ById = new Map(Plan.Nodes.map(N => [N.Id, N]));
  if (!ById.has(Plan.Screen.Id) || ById.get(Plan.Screen.Id)!.ParentId !== null) throw new Error('Invalid screen root');
  // Validate references and bounded traversal; do not derive layout or clip validity.
  const Seen = new Set<string>(), Queue = [{ Id: Plan.Screen.Id, Depth: 0 }];
  while (Queue.length) { const { Id, Depth } = Queue.pop()!, N = ById.get(Id);
    if (Depth > 128) throw new Error('Hierarchy transport depth exceeded');
    if (!N || Seen.has(Id)) throw new Error('Invalid hierarchy'); Seen.add(Id);
    for (const Child of N.Children) { if (ById.get(Child)?.ParentId !== Id) throw new Error('Invalid parent'); Queue.push({ Id: Child, Depth: Depth + 1 }); }
    if (N.Projected?.DescendantClipOwnerIds.some(Id => !ClipIds.has(Id))) throw new Error('Unknown clip');
    if (N.Projected?.LayoutOwnerId && !ById.has(N.Projected.LayoutOwnerId)) throw new Error('Unknown layout owner');
    if (N.Scroll && !N.Paint.some(P => P.Kind === 'ScrollView')) throw new Error('Missing scroll paint');
  }
  if (Seen.size !== Nodes.length || Plan.Clips.some(C => C.AncestorOwnerIds.some(Id => !ClipIds.has(Id)))) throw new Error('Disconnected references');
  const Accounting = RecordOf(P.Accounting);
  for (const V of Object.values(Accounting)) { if (typeof V === 'string') Text(V); else NumberValue(V); }
  for (const Key of ['RetainedObjects', 'MaxObjectsPerScreen', 'ProjectedElements', 'MaxProjectedElementsPerScreen', 'MaximumArrangedChildren', 'MaxChildrenPerObject', 'MaximumClipDepth', 'MaxEffectiveClipDepth', 'CanonicalProjectionEstimatedBytes']) NumberValue(Accounting[Key]);
  Text(Accounting.EstimateScope);
  return Plan;
}

export type PreviewMessage = { Version: 1; Type: 'Ready' | 'Refresh' } |
  { Version: 1; Type: 'Viewport'; Viewport: Viewport } | { Version: 1; Type: 'Zoom'; Zoom: number } |
  { Version: 1; Type: 'Screen'; Id: string };
export interface PanelState {
  Version: 1; Type: 'State'; Message: string; Viewport: Viewport; Zoom: number;
  Screens: { Id: string; Name: string }[]; Plan?: ToolingPreviewPlan;
}
export function ParseState(Value: unknown): PanelState | undefined {
  try {
    const M = Fields(Value, ['Version', 'Type', 'Message', 'Viewport', 'Zoom', 'Screens'], ['Plan']);
    if (M.Version !== 1 || M.Type !== 'State' || !IsViewport(M.Viewport) || ![0.25, 0.5, 0.75, 1, 1.5, 2].includes(M.Zoom as number)) return undefined;
    Text(M.Message, 2048); List(M.Screens, 128).forEach(Screen);
    if (M.Plan !== undefined) ValidatePlan(M.Plan);
    return M as unknown as PanelState;
  } catch { return undefined; }
}
export function ParseMessage(Value: unknown): PreviewMessage | undefined {
  try {
    if (JSON.stringify(Value).length > 4096) return undefined;
    const M = RecordOf(Value); if (M.Version !== 1) return undefined;
    if (M.Type === 'Ready' || M.Type === 'Refresh') Fields(M, ['Version', 'Type']);
    else if (M.Type === 'Viewport') { Fields(M, ['Version', 'Type', 'Viewport']); if (!IsViewport(M.Viewport)) return undefined; }
    else if (M.Type === 'Zoom') { Fields(M, ['Version', 'Type', 'Zoom']); if (![0.25, 0.5, 0.75, 1, 1.5, 2].includes(M.Zoom as number)) return undefined; }
    else if (M.Type === 'Screen') { Fields(M, ['Version', 'Type', 'Id']); Id(M.Id); }
    else return undefined;
    return M as PreviewMessage;
  } catch { return undefined; }
}
