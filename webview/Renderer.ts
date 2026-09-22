import { PreviewNode, RectPx, ToolingPreviewPlan } from '../extension/PreviewTypes';
import { ValidatePlan } from '../extension/PreviewContract';

function Element<K extends keyof HTMLElementTagNameMap>(Document: Document, Tag: K, ClassName = '', Text = ''): HTMLElementTagNameMap[K] {
  const Item = Document.createElement(Tag); Item.className = ClassName; Item.textContent = Text; return Item;
}
function Box(Item: HTMLElement, Rect: RectPx, Origin = { X: 0, Y: 0 }): void {
  // Coordinate conversion only. Negative canonical sizes cannot paint in CSS.
  Object.assign(Item.style, { left: (Rect.X - Origin.X) + 'px', top: (Rect.Y - Origin.Y) + 'px', width: Math.max(0, Rect.Width) + 'px', height: Math.max(0, Rect.Height) + 'px' });
}
function Color(Value: unknown): string { const C = Value as number[]; return 'rgba(' + C.slice(0, 3).map(N => N * 255).join(',') + ',' + C[3] + ')'; }

export class Renderer {
  private Plan?: ToolingPreviewPlan;
  private Nodes = new Map<string, PreviewNode>();
  private Rows = new Map<string, HTMLElement>();
  private Expanded = new Set<string>();
  private Selected?: string;
  private Scroll = new Map<string, { X: number; Y: number }>();
  private Layers = new Map<string, HTMLElement[]>();
  private Highlight?: HTMLElement;
  private readonly Surface: HTMLElement;
  private readonly Tree: HTMLElement;
  private readonly Inspector: HTMLElement;
  private readonly Resources: HTMLElement;
  private readonly Metrics: HTMLElement;
  constructor(private readonly Document: Document) {
    this.Surface = Document.getElementById('surface')!;
    this.Tree = Document.getElementById('hierarchy')!;
    this.Inspector = Document.getElementById('inspector')!;
    this.Resources = Document.getElementById('resources')!;
    this.Metrics = Document.getElementById('metrics')!;
    this.Tree.addEventListener('keydown', Event => this.Key(Event));
  }
  Clear(): void {
    this.Plan = undefined; this.Nodes.clear(); this.Rows.clear(); this.Expanded.clear(); this.Scroll.clear(); this.Layers.clear();
    this.Selected = undefined; this.Highlight = undefined;
    for (const Area of [this.Surface, this.Tree, this.Inspector, this.Resources, this.Metrics]) Area.replaceChildren();
    this.Surface.removeAttribute('data-revision'); this.Surface.removeAttribute('data-selected');
  }
  Render(Value: unknown): void {
    this.Clear();
    const Plan = ValidatePlan(Value), Start = performance.now(); this.Plan = Plan;
    this.Nodes = new Map(Plan.Nodes.map(N => [N.Id, N])); this.Expanded = new Set(this.Nodes.keys());
    this.Surface.style.width = Plan.Viewport.Width + 'px'; this.Surface.style.height = Plan.Viewport.Height + 'px';
    this.Surface.dataset.revision = Plan.ProjectRevision;
    const Paints = Plan.Nodes.flatMap(Node => Node.Paint.map(Paint => ({ Node, Paint }))).sort((A, B) => A.Paint.Order - B.Paint.Order);
    for (const { Node, Paint } of Paints) {
      if (!Paint.Visible || Paint.RectPx.Width <= 0 || Paint.RectPx.Height <= 0) continue;
      const Item = this.PaintBox(Node, Paint.RectPx); Item.classList.add('paint'); Item.dataset.nodeId = Node.Id; Item.dataset.order = String(Paint.Order);
      Item.title = Node.Name + ' · ' + Node.ClassName + ' #' + Node.Id + ' — select to inspect';
      const P = Paint.Properties;
      if (Paint.Kind === 'Container' || Paint.Kind === 'Button' || Paint.Kind === 'ScrollView') Item.style.backgroundColor = Color(P.BackgroundColor);
      if (Paint.Kind === 'Text') {
        Item.classList.add('text-paint'); Item.textContent = P.Text as string;
        Item.style.color = Color(P.TextColor); Item.style.fontSize = Math.max(0, P.FontSize as number) + 'px';
        Item.style.justifyContent = ({ Left: 'flex-start', Center: 'center', Right: 'flex-end' })[P.TextXAlignment as 'Left'];
        Item.style.alignItems = ({ Top: 'flex-start', Center: 'center', Bottom: 'flex-end' })[P.TextYAlignment as 'Top'];
        Item.style.fontFamily = String(P.Font).includes('Mono') ? 'monospace' : 'sans-serif';
        Item.style.fontWeight = String(P.Font).includes('Bold') ? 'bold' : 'normal';
        Item.dataset.font = String(P.Font); Item.title += ' · approximate font rasterization';
      }
      if (Paint.Kind === 'Image') {
        const Source = P.ImageSource as string[];
        if (Source[1] !== 'None') { Item.classList.add('image-placeholder'); Item.textContent = 'IMAGE · ' + Source.slice(1).join(' · '); }
        Item.title += ' · image pixels unavailable'; Item.dataset.image = JSON.stringify(Source);
      }
      Item.addEventListener('click', Event => { Event.stopPropagation(); this.Select(Node.Id); });
      const ScrollOwner = [...(Node.Projected?.DescendantClipOwnerIds ?? [])].reverse().find(Id => this.Nodes.get(Id)?.Scroll);
      const Owner = Node.Scroll ? Node.Id : ScrollOwner;
      if (Owner) Item.addEventListener('wheel', Event => {
        Event.preventDefault(); const Offset = this.Scroll.get(Owner) ?? { X: 0, Y: 0 };
        this.SetScroll(Owner, Offset.X + (Event.shiftKey ? Event.deltaY : Event.deltaX), Offset.Y + (Event.shiftKey ? 0 : Event.deltaY));
      }, { passive: false });
    }
    const PaintMs = performance.now() - Start;
    const TreeStart = performance.now();
    this.BuildTree();
    const TreeMs = performance.now() - TreeStart;
    this.Resources.append(Element(this.Document, 'p', '', 'Canonical resource usage'));
    for (const [Used, Maximum, Label] of [
      ['RetainedObjects', 'MaxObjectsPerScreen', 'Retained objects'],
      ['ProjectedElements', 'MaxProjectedElementsPerScreen', 'Projected elements'],
      ['MaximumArrangedChildren', 'MaxChildrenPerObject', 'Maximum arranged children'],
      ['MaximumClipDepth', 'MaxEffectiveClipDepth', 'Effective clip depth']
    ]) {
      const Row = Element(this.Document, 'div', 'resource-row', Label + ': ' + Plan.Accounting[Used] + ' / ' + Plan.Accounting[Maximum]);
      const Ratio = Number(Plan.Accounting[Used]) / Number(Plan.Accounting[Maximum]);
      if (Ratio >= 0.8) Row.append(Element(this.Document, 'strong', 'resource-warning', Ratio >= 1 ? ' · At limit' : ' · Near limit'));
      const Meter = Element(this.Document, 'meter'); Meter.min = 0; Meter.max = Number(Plan.Accounting[Maximum]); Meter.value = Number(Plan.Accounting[Used]); Meter.setAttribute('aria-label', Label);
      Row.append(Meter); this.Resources.append(Row);
    }
    this.Resources.append(Element(this.Document, 'p', 'muted', 'Canonical estimate: ' + Plan.Accounting.CanonicalProjectionEstimatedBytes + ' bytes. ' + Plan.Accounting.EstimateScope));
    this.Metrics.textContent = 'Paint ' + PaintMs.toFixed(1) + ' ms · hierarchy ' + TreeMs.toFixed(1) + ' ms · ' + Plan.Nodes.length + ' nodes';
    this.Select(Plan.Screen.Id);
  }
  private PaintBox(Node: PreviewNode, Rect: RectPx): HTMLElement {
    const Root = Element(this.Document, 'div', 'paint-layer'); this.Surface.append(Root);
    let Parent = Root, Origin = { X: 0, Y: 0 };
    // Clip-owner chains and rectangles are supplied by Core, not derived from
    // retained parents or ClipsDescendants. Own ScrollView clip applies to contents.
    for (const Id of Node.Projected?.DescendantClipOwnerIds.filter(Id => Id !== Node.Id) ?? []) {
      const Clip = this.Plan!.Clips.find(C => C.OwnerId === Id)!;
      const Wrapper = Element(this.Document, 'div', 'clip'); Wrapper.dataset.clipOwner = Id; Box(Wrapper, Clip.RectPx, Origin); Parent.append(Wrapper);
      Origin = Clip.RectPx; Parent = Wrapper;
      if (this.Nodes.get(Id)?.Scroll) {
        const Layer = Element(this.Document, 'div', 'scroll-layer'); Layer.dataset.scrollOwner = Id; Parent.append(Layer); Parent = Layer;
        const Layers = this.Layers.get(Id) ?? []; Layers.push(Layer); this.Layers.set(Id, Layers);
        const Offset = this.Scroll.get(Id) ?? { X: 0, Y: 0 }; Layer.style.transform = 'translate(' + -Offset.X + 'px,' + -Offset.Y + 'px)';
      }
    }
    const Item = Element(this.Document, 'div', 'paint-box'); Box(Item, Rect, Origin); Parent.append(Item); return Item;
  }
  private BuildTree(): void {
    this.Tree.replaceChildren(); this.Rows.clear();
    const Visit = (Id: string, Level: number): void => {
      const Node = this.Nodes.get(Id)!, Row = Element(this.Document, 'div', 'tree-row');
      Row.setAttribute('role', 'treeitem'); Row.setAttribute('aria-level', String(Level)); Row.dataset.nodeId = Id;
      Row.style.paddingLeft = ((Level - 1) * 12) + 'px'; Row.tabIndex = Id === this.Selected || (!this.Selected && Id === this.Plan?.Screen.Id) ? 0 : -1;
      Row.setAttribute('aria-selected', String(Id === this.Selected));
      if (Node.Children.length) Row.setAttribute('aria-expanded', String(this.Expanded.has(Id)));
      const Toggle = Element(this.Document, 'button', 'tree-toggle', Node.Children.length ? (this.Expanded.has(Id) ? '▾' : '▸') : '·');
      Toggle.tabIndex = -1; Toggle.setAttribute('aria-label', 'Toggle ' + Node.Name); Toggle.disabled = !Node.Children.length;
      Toggle.addEventListener('click', Event => { Event.stopPropagation(); this.Toggle(Id); });
      Row.append(Toggle, Element(this.Document, 'span', '', Node.Name + '  ·  ' + Node.ClassName + ' #' + Id));
      if (Node.Projected === null || !Node.Projected.EffectiveVisible) Row.classList.add('muted');
      Row.addEventListener('click', () => this.Select(Id)); this.Rows.set(Id, Row); this.Tree.append(Row);
      if (this.Expanded.has(Id)) Node.Children.forEach(Child => Visit(Child, Level + 1));
    };
    Visit(this.Plan!.Screen.Id, 1);
  }
  private Toggle(Id: string): void { if (this.Expanded.has(Id)) this.Expanded.delete(Id); else this.Expanded.add(Id); this.BuildTree(); this.Select(Id); this.Rows.get(Id)?.focus(); }
  private Key(Event: KeyboardEvent): void {
    const Id = (Event.target as HTMLElement).closest<HTMLElement>('[role=treeitem]')?.dataset.nodeId;
    if (!Id) return;
    const Node = this.Nodes.get(Id)!, Ids = [...this.Rows.keys()], Index = Ids.indexOf(Id);
    let Next: string | undefined;
    if (Event.key === 'ArrowDown') Next = Ids[Math.min(Ids.length - 1, Index + 1)];
    else if (Event.key === 'ArrowUp') Next = Ids[Math.max(0, Index - 1)];
    else if (Event.key === 'Home') Next = Ids[0];
    else if (Event.key === 'End') Next = Ids.at(-1);
    else if (Event.key === 'ArrowLeft') { if (this.Expanded.has(Id) && Node.Children.length) this.Toggle(Id); else Next = Node.ParentId ?? undefined; }
    else if (Event.key === 'ArrowRight') { if (!this.Expanded.has(Id) && Node.Children.length) this.Toggle(Id); else Next = Node.Children[0]; }
    else if (Event.key === 'Enter' || Event.key === ' ') Next = Id;
    else return;
    Event.preventDefault(); if (Next) { this.Select(Next); this.Rows.get(Next)?.focus(); }
  }
  Select(Id: string): void {
    const Node = this.Nodes.get(Id); if (!Node) return;
    this.Selected = Id; this.Surface.dataset.selected = Id;
    let Parent = Node.ParentId, Changed = false;
    while (Parent) { if (!this.Expanded.has(Parent)) { this.Expanded.add(Parent); Changed = true; } Parent = this.Nodes.get(Parent)!.ParentId; }
    if (Changed) this.BuildTree();
    for (const [Key, Row] of this.Rows) { Row.setAttribute('aria-selected', String(Key === Id)); Row.tabIndex = Key === Id ? 0 : -1; }
    this.Highlight?.closest('.paint-layer')?.remove();
    for (const [Owner, Layers] of this.Layers) this.Layers.set(Owner, Layers.filter(Layer => Layer.isConnected));
    if (Node.Projected?.EffectiveVisible) { this.Highlight = this.PaintBox(Node, Node.Projected.RectPx); this.Highlight.classList.add('selection'); }
    this.Inspector.replaceChildren(Element(this.Document, 'h3', '', Node.Name + ' · ' + Node.ClassName + ' #' + Id));
    const Explain = Element(this.Document, 'p', 'muted', 'Retained values are authored data. Projected values are authoritative Core output. Source navigation unavailable: no creation-site mapping.');
    this.Inspector.append(Explain);
    const Source = Element(this.Document, 'button', '', 'Go to Source'); Source.disabled = true; Source.title = 'Foundation B provides no reliable creation-site mapping'; this.Inspector.append(Source);
    if (Node.Projected?.LayoutOwnerId) {
      const Owner = this.Nodes.get(Node.Projected.LayoutOwnerId);
      this.Inspector.append(Element(this.Document, 'p', 'layout-notice', 'Managed by ' + (Owner?.ClassName ?? 'layout') + ' #' + Node.Projected.LayoutOwnerId + '. Authored Position/Size may differ from the projected rectangle below.'));
    }
    if (Node.Projected) this.Inspector.append(Element(this.Document, 'p', '', 'Effective clip depth: ' + Node.Projected.ClipDepth + ' / ' + this.Plan!.Accounting.MaxEffectiveClipDepth));
    for (const [Title, Value] of [
      ['Projected geometry / visibility / clip / layout owner', Node.Projected], ['Retained values', Node.Retained],
      ['Paint and semantic resources', Node.Paint], ['Fidelity', Node.Fidelity]
    ] as const) {
      const Details = Element(this.Document, 'details'); Details.open = Title !== 'Paint and semantic resources';
      Details.append(Element(this.Document, 'summary', '', Title));
      if (Title === 'Retained values' || (Title === 'Projected geometry / visibility / clip / layout owner' && Node.Projected)) {
        const Table = Element(this.Document, 'dl', 'properties');
        for (const [Key, Property] of Object.entries(Value!)) {
          const Text = Title === 'Retained values' ? (Property as { Encoded: string[] }).Encoded.join(' · ') : JSON.stringify(Property);
          Table.append(Element(this.Document, 'dt', '', Key), Element(this.Document, 'dd', '', Text));
        }
        Details.append(Table);
      } else Details.append(Element(this.Document, 'pre', '', JSON.stringify(Value, null, 2)));
      this.Inspector.append(Details);
    }
    if (Node.Scroll) {
      this.Inspector.append(Element(this.Document, 'p', '', 'Local scroll convenience only. Resets on each plan; never changes CanvasPosition or executes callbacks.'));
      const Offset = this.Scroll.get(Id) ?? { X: 0, Y: 0 };
      for (const Axis of ['X', 'Y'] as const) {
        const Label = Element(this.Document, 'label', '', 'Local ' + Axis + ' ');
        const Input = Element(this.Document, 'input'); Input.type = 'number'; Input.min = '0'; Input.value = String(Offset[Axis]); Input.setAttribute('aria-label', 'Local scroll ' + Axis);
        Input.addEventListener('change', () => { const Current = this.Scroll.get(Id) ?? { X: 0, Y: 0 }; this.SetScroll(Id, Axis === 'X' ? Number(Input.value) : Current.X, Axis === 'Y' ? Number(Input.value) : Current.Y); Input.value = String(this.Scroll.get(Id)![Axis]); });
        Label.append(Input); this.Inspector.append(Label);
      }
    }
  }
  private SetScroll(Id: string, X: number, Y: number): void {
    if (!Number.isFinite(X) || !Number.isFinite(Y)) return;
    const Node = this.Nodes.get(Id)!, S = Node.Scroll!, P = Node.Paint.find(P => P.Kind === 'ScrollView')!.Properties;
    const Offset = {
      X: P.ScrollEnabled && P.ScrollHorizontal ? Math.max(0, Math.min(X, S.ContentRectPx.Width - S.ViewportRectPx.Width)) : 0,
      Y: P.ScrollEnabled && P.ScrollVertical ? Math.max(0, Math.min(Y, S.ContentRectPx.Height - S.ViewportRectPx.Height)) : 0
    };
    this.Scroll.set(Id, Offset);
    for (const Layer of this.Layers.get(Id) ?? []) Layer.style.transform = 'translate(' + -Offset.X + 'px,' + -Offset.Y + 'px)';
    if (this.Selected === Id) this.Select(Id);
  }
}
