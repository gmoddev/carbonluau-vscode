const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');
const Process = require('node:process');
const { test: Test } = require('node:test');
const { JSDOM } = require('jsdom');
const { Renderer } = require('../build/Renderer.cjs');
const { ValidatePlan, ParseMessage, ParseState } = require('../dist/PreviewContract');
const Canonical = [Process.env.CARBONLUAU_CANONICAL_ROOT, Path.resolve(__dirname, '../build/canonical'), Path.resolve(__dirname, '../../CarbonLuau-tooling-c')].filter(Boolean).find(P => Fs.existsSync(Path.join(P, 'tests/tooling/PreviewGoldens.json')));
Assert.ok(Canonical, 'Canonical Foundation B golden plans must be provisioned.');
const Goldens = JSON.parse(Fs.readFileSync(Path.join(Canonical, 'tests/tooling/PreviewGoldens.json'), 'utf8'));
function Plan(Name) {
  return { SchemaVersion: 1, ProjectRevision: 'sha256:' + 'a'.repeat(64), ApiVersion: '0.4.0-experimental', PackVersion: 'foundation-b-development', SemanticRevision: 'b'.repeat(40),
    ToolingBuildId: 'sha256:' + 'c'.repeat(64), ProjectId: '0/', Entry: 'init.luau', ...globalThis.structuredClone(Goldens.find(G => G.Name === Name).Plan) };
}
function Fixture() {
  const Dom = new JSDOM('<div id="surface"></div><div id="hierarchy"></div><div id="inspector"></div><div id="resources"></div><div id="metrics"></div>');
  const Document = Dom.window.document; return { Dom, Document, View: new Renderer(Document) };
}
for (const Golden of Goldens) Test('paint-only DOM consumes canonical ' + Golden.Name, () => {
  const { Document, View, Dom } = Fixture(), P = Plan(Golden.Name), Before = JSON.stringify(P);
  View.Render(P);
  Assert.equal(Document.querySelectorAll('[role=treeitem]').length, P.Nodes.length);
  const Expected = P.Nodes.flatMap(N => N.Paint.filter(P => P.Visible && P.RectPx.Width > 0 && P.RectPx.Height > 0).map(P => ({ N, P }))).sort((A, B) => A.P.Order - B.P.Order);
  const Items = [...Document.querySelectorAll('.paint')]; Assert.equal(Items.length, Expected.length);
  Items.forEach((Item, Index) => {
    const { N, P: Paint } = Expected[Index]; Assert.equal(Item.dataset.nodeId, N.Id); Assert.equal(Number(Item.dataset.order), Paint.Order);
    Assert.equal(parseFloat(Item.style.width), Paint.RectPx.Width); Assert.equal(parseFloat(Item.style.height), Paint.RectPx.Height);
    // Reconstitute absolute coordinates from CSS parent offsets only for this assertion.
    let X = 0, Y = 0, Parent = Item;
    while (Parent && Parent.id !== 'surface') { X += parseFloat(Parent.style.left) || 0; Y += parseFloat(Parent.style.top) || 0; Parent = Parent.parentElement; }
    Assert.equal(X, Paint.RectPx.X); Assert.equal(Y, Paint.RectPx.Y);
    const Chain = []; Parent = Item.parentElement;
    while (Parent && Parent.id !== 'surface') { if (Parent.dataset.clipOwner) Chain.unshift(Parent.dataset.clipOwner); Parent = Parent.parentElement; }
    Assert.deepEqual(Chain, N.Projected.DescendantClipOwnerIds.filter(Id => Id !== N.Id));
    if (Paint.Kind === 'Text') { Assert.equal(Item.textContent, Paint.Properties.Text); Assert.equal(Item.dataset.font, Paint.Properties.Font); }
  });
  Assert.equal(Document.querySelectorAll('meter').length, 4);
  const Managed = P.Nodes.find(N => N.Projected?.LayoutOwnerId);
  if (Managed) {
    View.Select(Managed.Id);
    Assert.match(Document.getElementById('inspector').textContent, /Managed by UI(Grid|List)Layout/);
    Assert.ok(Document.getElementById('inspector').textContent.includes(Managed.Retained.Position.Encoded.join(' · ')));
  }
  const Hidden = P.Nodes.find(N => N.Projected && !N.Projected.EffectiveVisible);
  if (Hidden) { View.Select(Hidden.Id); Assert.equal(Document.querySelector('.selection'), null); }
  Assert.match(Document.getElementById('resources').textContent, new RegExp(String(P.Accounting.ProjectedElements)));
  Assert.equal(JSON.stringify(P), Before); Dom.window.close();
});
Test('ID selection, helpers, collapse and keyboard navigation are synchronized', () => {
  const { Document, View, Dom } = Fixture(), P = Plan('grid-padding');
  View.Render(P); const Helper = P.Nodes.find(N => N.Projected === null);
  View.Select(Helper.Id); Assert.equal(Document.querySelector('[aria-selected=true]').dataset.nodeId, Helper.Id);
  Assert.equal(Document.querySelector('.selection'), null); Assert.match(Document.getElementById('inspector').textContent, /Retained values/);
  const Paint = Document.querySelector('.paint'); Paint.click(); Assert.equal(Document.querySelector('[aria-selected=true]').dataset.nodeId, Paint.dataset.nodeId);
  const Root = Document.querySelector('[role=treeitem]'); Root.querySelector('button').click(); Assert.equal(Document.querySelectorAll('[role=treeitem]').length, 1);
  Document.querySelector('[role=treeitem]').dispatchEvent(new Dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  Assert.ok(Document.querySelectorAll('[role=treeitem]').length > 1);
  Document.querySelector('[role=treeitem]').dispatchEvent(new Dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  Assert.equal(Document.querySelector('[aria-selected=true]'), [...Document.querySelectorAll('[role=treeitem]')].at(-1)); Dom.window.close();
});
Test('hostile strings remain text; images never create URLs; local scroll resets', () => {
  const { Document, View, Dom } = Fixture(), P = Plan('text-buttons-fonts');
  P.Nodes[1].Name = '<img src=x onerror=alert(1)>\u2028';
  const TextPaint = P.Nodes.flatMap(N => N.Paint).find(P => P.Kind === 'Text'); TextPaint.Properties.Text = '<script>throw 1</script>';
  View.Render(P); Assert.equal(Document.querySelector('img,script,iframe,a'), null); Assert.ok(Document.body.textContent.includes(TextPaint.Properties.Text));
  View.Render(Plan('image-identities')); Assert.equal(Document.querySelector('img,[src],[href]'), null);
  const Scroll = Plan('scrolling'); View.Render(Scroll); const N = Scroll.Nodes.find(N => N.Scroll); View.Select(N.Id);
  const Input = Document.querySelector('input[aria-label="Local scroll Y"]'); Input.value = '50'; Input.dispatchEvent(new Dom.window.Event('change'));
  Assert.ok([...Document.querySelectorAll('.scroll-layer')].some(L => L.style.transform.includes('-50px')));
  View.Render(Scroll); Assert.ok([...Document.querySelectorAll('.scroll-layer')].every(L => L.style.transform === 'translate(0px,0px)'));
  View.Clear(); Assert.equal(Document.querySelector('.paint,[role=treeitem]'), null); Dom.window.close();
});
Test('malformed/oversized plans and arbitrary WebView requests fail closed', () => {
  for (const Mutate of [
    P => { P.Nodes[0].Children.push(P.Nodes[0].Id); },
    P => { P.Nodes[0].ParentId = P.Nodes[0].Id; },
    P => { P.Nodes[1].Id = P.Nodes[0].Id; },
    P => { P.Nodes[1].Projected.RectPx.Width = Infinity; },
    P => { P.Nodes[1].Source = { Path: 'C:/secrets' }; },
    P => { P.Nodes[1].Paint[0].Properties.Url = 'https://example.invalid'; },
    P => { P.Nodes[1].Name = 'x'.repeat(20000); },
    P => { P.Nodes[1].Projected.DescendantClipOwnerIds = ['missing']; },
    P => { P.SchemaVersion = 99; }, P => { P.Extra = 'x'.repeat(8 * 1024 * 1024); }
  ]) { const P = Plan('frame-1280x720'); Mutate(P); Assert.throws(() => ValidatePlan(P)); }
  for (const M of [null, {}, {Version:1,Type:'Execute',Code:'evil'}, {Version:1,Type:'Refresh',Path:'C:/secret'},
    {Version:1,Type:'Viewport',Viewport:{Width:Infinity,Height:720}}, {Version:1,Type:'Zoom',Zoom:999}, {Version:1,Type:'Screen',Id:'x'.repeat(4097)}]) Assert.equal(ParseMessage(M), undefined);
  Assert.deepEqual(ParseMessage({Version:1,Type:'Viewport',Viewport:{Width:1111,Height:777}}), {Version:1,Type:'Viewport',Viewport:{Width:1111,Height:777}});
  const State={Version:1,Type:'State',Message:'Current',Viewport:{Width:1280,Height:720},Zoom:0.5,Screens:[],Plan:Plan('frame-1280x720')};
  Assert.ok(ParseState(State)); Assert.equal(ParseState({...State,Path:'/secret'}),undefined);
  Assert.equal(ParseState({...State,Plan:{...State.Plan,SchemaVersion:2}}),undefined);
});
