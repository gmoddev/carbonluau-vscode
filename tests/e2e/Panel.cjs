const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');

// CDP is a test-driver capability, never shipped in the extension/WebView.
async function Connect(Url) {
  const Socket = new globalThis.WebSocket(Url), Pending = new Map(); let Id = 0;
  await new Promise((Resolve, Reject) => { Socket.addEventListener('open', Resolve, {once:true}); Socket.addEventListener('error', Reject, {once:true}); });
  Socket.addEventListener('message', E => { const V = JSON.parse(E.data); if (Pending.has(V.id)) { Pending.get(V.id)(V); Pending.delete(V.id); } });
  return { Close: () => Socket.close(), Call: async (Method, Params = {}, Session) => {
    const Current = ++Id, Result = new Promise(Resolve => Pending.set(Current, Resolve));
    Socket.send(JSON.stringify({id:Current,method:Method,params:Params,...(Session ? {sessionId:Session} : {})})); return Result;
  }};
}
async function Evaluate(Expression, Screenshot) {
  const Targets = await (await globalThis.fetch('http://127.0.0.1:9237/json')).json();
  const Page = Targets.find(T => T.type === 'page' && T.url.includes('workbench')); if (!Page) return undefined;
  const Cdp = await Connect(Page.webSocketDebuggerUrl);
  try {
    const All = await Cdp.Call('Target.getTargets');
    for (const Target of All.result.targetInfos.filter(T => T.type === 'iframe' || T.type === 'page')) {
      const Attach = await Cdp.Call('Target.attachToTarget', {targetId:Target.targetId,flatten:true}), Session = Attach.result?.sessionId;
      if (!Session) continue;
      const Result = await Cdp.Call('Runtime.evaluate', {expression:`(async () => {
        function Find(D, Depth=0) { if (D.getElementById('surface')) return D; if (Depth > 4) return;
          for (const F of D.querySelectorAll('iframe')) { try { if(F.contentDocument) { const R=Find(F.contentDocument,Depth+1); if(R)return R; } } catch {} } }
        const D=Find(document); if(!D)return null; const W=D.defaultView;
        ${Expression}
      })()`, returnByValue:true,awaitPromise:true,allowUnsafeEvalBlockedByCSP:false}, Session);
      if (Result.result?.exceptionDetails) throw new Error(JSON.stringify(Result.result.exceptionDetails));
      const Value = Result.result?.result?.value;
      if (Value) {
        if (Screenshot) { const Shot = await Cdp.Call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false}); if (Shot.result?.data) Fs.writeFileSync(Screenshot, Buffer.from(Shot.result.data,'base64')); }
        return Value;
      }
    }
  } finally { Cdp.Close(); }
}
exports.Action = async (State, Work) => {
  const Check = `const Surface=D.getElementById('surface'), Status=D.getElementById('status').textContent;
    const Snapshot=()=>({Status,Revision:Surface.dataset.revision,Selected:Surface.dataset.selected,Width:Surface.style.width,
      Rows:D.querySelectorAll('[role=treeitem]').length,Paints:D.querySelectorAll('.paint').length,Metrics:D.getElementById('metrics').textContent,
      Inspector:D.getElementById('inspector').textContent,Zoom:Surface.style.transform});`;
  let R;
  if (State.Action === 'inspect') {
    R = await Evaluate(Check + `
      if(!Surface.dataset.revision || D.querySelectorAll('[role=treeitem]').length < 5)return null;
      const Items=[...D.querySelectorAll('.paint')], Text=Items.find(E=>E.textContent.includes('Hello <img'));
      if(!Text)throw Error('Missing literal hostile text');
      const Start=performance.now(); Text.click(); const Selected=Snapshot(), SelectionMs=performance.now()-Start;
      if(D.querySelector('[aria-selected=true]').dataset.nodeId!==Text.dataset.nodeId)throw Error('Visual/tree selection mismatch');
      const Tree=D.querySelector('[role=treeitem]'); Tree.focus(); Tree.dispatchEvent(new W.KeyboardEvent('keydown',{key:'End',bubbles:true}));
      const Keyboard=Snapshot();
      const Helper=[...D.querySelectorAll('[role=treeitem]')].find(E=>E.textContent.includes('UIPadding')); Helper.click();
      if(D.querySelector('.selection'))throw Error('Helper has a projected highlight');
      const Invalid=D.querySelector('#surface img,#surface script,#hierarchy img,#hierarchy script,#inspector img,#inspector script'); if(Invalid)throw Error('Injected markup');
      const Violations=[]; D.addEventListener('securitypolicyviolation',E=>Violations.push(E.effectiveDirective));
      let NetworkBlocked=false; try { await W.fetch('https://example.invalid/carbonluau-csp-probe'); } catch {NetworkBlocked=true;}
      if(!NetworkBlocked)throw Error('Network was not blocked');
      let EvalBlocked=false; try { W.eval('window.__CarbonLuauInjected = true'); } catch {EvalBlocked=true;}
      if(!EvalBlocked)throw Error('eval was not blocked');
      await new Promise(R=>W.setTimeout(R,30));
      const Zoom=D.getElementById('zoom'); Zoom.value='0.75'; Zoom.dispatchEvent(new W.Event('change'));
      return {...Snapshot(),Selected,Keyboard,SelectionMs,NetworkBlocked,EvalBlocked,Violations};
    `, Path.join(Work,'preview.png'));
    if (!R) return false;
    Assert.ok(R.Selected.Inspector.includes('Hello <img')); Assert.ok(R.Keyboard.Selected);
    Assert.ok(R.NetworkBlocked); Assert.ok(R.Violations.includes('connect-src'));
    R.InitialPanelMs = Date.now() - State.Started;
  } else if (State.Action === 'viewport') {
    R = await Evaluate(Check + `
      if(!Surface.dataset.revision)return null;
      if(!W.__ViewportStarted) { W.__ViewportStarted=performance.now(); W.__PreviousRevision=Surface.dataset.revision;
        const Presets=D.getElementById('presets'); Presets.value='1920x1080'; Presets.dispatchEvent(new W.Event('change')); return null; }
      if(Surface.style.width!=='1920px'||Surface.dataset.revision===W.__PreviousRevision)return null;
      return {...Snapshot(),ElapsedMs:performance.now()-W.__ViewportStarted,FrameWidth:D.querySelector('.paint').style.width};
    `);
    if (!R) return false; Assert.equal(R.Width,'1920px'); Assert.equal(R.FrameWidth,'960px'); Assert.equal(R.Zoom,'scale(0.75)');
  } else if (State.Action === 'custom') {
    R = await Evaluate(Check + `
      if(!Surface.dataset.revision)return null;
      if(!W.__CustomStarted) { W.__CustomStarted=performance.now(); W.__CustomPrevious=Surface.dataset.revision;
        D.getElementById('width').value='1111'; D.getElementById('height').value='777'; D.getElementById('apply').click(); return null; }
      if(Surface.style.width!=='1111px'||Surface.dataset.revision===W.__CustomPrevious)return null;
      return {...Snapshot(),ElapsedMs:performance.now()-W.__CustomStarted,FrameWidth:D.querySelector('.paint').style.width};
    `);
    if (!R) return false; Assert.equal(R.Width,'1111px'); Assert.equal(R.FrameWidth,'555.5px');
  } else if (State.Action === 'near-limit') {
    R = await Evaluate(Check + `if(Status.includes('Preview unavailable'))throw Error(Status); if(D.querySelectorAll('[role=treeitem]').length!==128)return null;
      return {...Snapshot(),Warning:D.getElementById('resources').textContent};`, Path.join(Work,'near-limit.png'));
    if (!R) return false; Assert.equal(R.Rows,128); Assert.match(R.Warning,/At limit/);
  } else if (State.Action === 'saved') {
    R = await Evaluate(Check + `if(!Surface.dataset.revision || !D.body.textContent.includes(${JSON.stringify(State.Expected)}))return null; return Snapshot();`);
    if (!R) return false;
    R.ElapsedMs = Date.now() - State.Started;
  } else if (State.Action === 'error') {
    R = await Evaluate(Check + `if(!Status.includes('Preview unavailable'))return null; return Snapshot();`);
    if (!R) return false; Assert.equal(R.Paints,0); Assert.equal(R.Rows,0); Assert.equal(R.Revision,undefined);
  } else if (State.Action === 'recover') {
    R = await Evaluate(Check + `if(!Surface.dataset.revision || !D.querySelector('.paint'))return null; return Snapshot();`);
    if (!R) return false;
  } else if (State.Action === 'restricted') {
    R = await Evaluate(Check + `if(!Status.includes('Workspace Trust'))return null; return Snapshot();`);
    if (!R) return false; Assert.equal(R.Paints,0);
  } else throw new Error('Unknown panel test');
  Fs.writeFileSync(Path.join(Work, 'panel-' + State.Action + (State.Iteration === undefined ? '' : '-' + State.Iteration) + '.json'), JSON.stringify(R,null,2));
  return true;
};
