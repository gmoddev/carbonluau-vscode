const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');
const Vm = require('node:vm');
const { setImmediate: Tick } = require('node:timers/promises');
const { test: Test } = require('node:test');
function Fixture(Trusted = true) {
  const Messages = [], Saved = [], Pending = [], Timers = new Map(); let TimerId = 0, Receive, Close, Cancelled = 0, Closed = 0, Options;
  const Panel = { webview: { cspSource: 'vscode-webview://unit', asWebviewUri: U => U, postMessage: async M => { Messages.push(M); return true; },
    onDidReceiveMessage: F => { Receive = F; } }, onDidDispose: F => { Close = F; }, dispose: () => Close(), reveal() {} };
  const Vscode = { Uri: { joinPath: (...Parts) => Parts.join('/') }, ViewColumn: { Active: 1 },
    workspace: { isTrusted: Trusted }, window: { createWebviewPanel: (_Type, _Title, _Column, Value) => { Options = Value; return Panel; } } };
  const Exports = {};
  Vm.runInNewContext(Fs.readFileSync(Path.join(__dirname,'../dist/PreviewPanel.js'),'utf8'), {
    exports: Exports, require: Name => Name === 'vscode' ? Vscode : Name === './PreviewContract' ? require('../dist/PreviewContract') : require(Name),
    setTimeout: F => { Timers.set(++TimerId,F); return TimerId; }, clearTimeout: Id => Timers.delete(Id)
  });
  const Controller = new Exports.PreviewPanel({ extensionUri: '/official', workspaceState: { get: () => undefined, update: async (Key, Value) => Saved.push({Key,Value}) } },
    '0/', Selection => new Promise((Resolve, Reject) => Pending.push({Selection,Resolve,Reject})), () => Cancelled++, () => Closed++);
  const Run = async () => { const All = [...Timers.values()]; Timers.clear(); All.forEach(F=>F()); await Tick(); };
  return { Controller, Panel, Messages, Saved, Pending, Vscode, Run, Receive: M=>Receive(M), Counts:()=>({Cancelled,Closed}), Options:()=>Options };
}
Test('panel trust gate, strict CSP/local roots and path-free messages', async () => {
  const F = Fixture(false); F.Receive({Version:1,Type:'Ready'}); await F.Run();
  Assert.equal(F.Pending.length,0); Assert.match(F.Messages.at(-1).Message,/Workspace Trust/);
  Assert.equal(F.Messages.at(-1).Plan,undefined);
  Assert.deepEqual(Array.from(F.Options().localResourceRoots),['/official/media','/official/dist/webview']);
  Assert.match(F.Panel.webview.html,/default-src 'none'/); Assert.match(F.Panel.webview.html,/connect-src 'none'/);
  Assert.match(F.Panel.webview.html,/script-src 'nonce-[a-f0-9]{48}'/); Assert.doesNotMatch(F.Panel.webview.html,/unsafe-inline|unsafe-eval|command:|https:/);
  const Before=F.Counts().Cancelled;
  for(const Type of ['Execute','OpenFile','Navigate','Select','Plugin']) F.Receive({Version:1,Type,Path:'/secret'});
  F.Receive({Version:1,Type:'Refresh',Path:'/secret'}); Assert.equal(F.Counts().Cancelled,Before);
  F.Controller.dispose(); Assert.equal(F.Counts().Closed,1);
});
Test('panel viewport creates fresh request; zoom persists only preferences; stale failure cannot replace newer state', async () => {
  const F=Fixture(); F.Receive({Version:1,Type:'Ready'}); await F.Run(); Assert.equal(F.Pending.length,1);
  F.Receive({Version:1,Type:'Viewport',Viewport:{Width:1111,Height:777}}); await F.Run(); Assert.equal(F.Pending.length,2);
  Assert.equal(F.Pending[1].Selection.Viewport.Width,1111);
  F.Pending[1].Reject(new Error('latest failure')); await Tick();
  Assert.match(F.Messages.at(-1).Message,/latest failure/);
  F.Pending[0].Reject(new Error('stale failure')); await Tick(); Assert.match(F.Messages.at(-1).Message,/latest failure/);
  F.Receive({Version:1,Type:'Zoom',Zoom:0.75}); await F.Run(); Assert.equal(F.Pending.length,2);
  Assert.deepEqual(Object.keys(F.Saved.at(-1).Value),['Viewport','Zoom']); Assert.equal(F.Saved.at(-1).Value.Zoom,0.75);
  F.Receive({Version:1,Type:'Screen',Id:'unoffered'}); await F.Run(); Assert.equal(F.Pending.length,2);
  F.Controller.Invalidate(); F.Controller.Suspend('Restarting tooling…'); await F.Run(); Assert.equal(F.Pending.length,2);
  Assert.match(F.Messages.at(-1).Message,/Restarting/); Assert.equal(F.Messages.at(-1).Plan,undefined);
  F.Vscode.workspace.isTrusted=false; F.Controller.Invalidate(); await F.Run(); Assert.equal(F.Pending.length,2);
  F.Controller.dispose();
});
