const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Process = require('node:process');
const { setTimeout: Delay } = require('node:timers/promises');
const { execFileSync: Exec } = require('node:child_process');
const Vscode = require('vscode');
const Marker = Process.env.CARBONLUAU_E2E_MARKER;
const Stage = Value => Fs.writeFileSync(Marker, JSON.stringify({ Stage: Value }));
async function Until(Check, Label, Milliseconds = 30000) {
  const End = Date.now() + Milliseconds;
  while (Date.now() < End) { if (await Check()) return; await Delay(100); }
  Assert.fail('Timed out: ' + Label);
}
function AnalysisProcesses() {
  if (Process.platform === 'win32') {
    const Value = Exec('powershell.exe', ['-NoProfile', '-Command', "@(Get-CimInstance Win32_Process -Filter \"Name = 'luau-lsp.exe'\" | Where-Object { $_.ExecutablePath -like '*\\tooling\\win32-x64\\luau-lsp.exe' } | ForEach-Object { $_.ProcessId }) | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true }).trim();
    return Value ? [JSON.parse(Value)].flat() : [];
  }
  if (Process.platform !== 'linux') return undefined;
  return Exec('ps', ['-eo', 'pid,args'], { encoding: 'utf8' }).split('\n').filter(Line => Line.trim().split(/\s+/)[1]?.endsWith('/tooling/linux-x64/luau-lsp')).map(Line => Number(Line.trim().split(/\s+/)[0]));
}
exports.run = async () => {
  const Mode = JSON.parse(Fs.readFileSync(Marker, 'utf8')).Stage;
  const Extension = Vscode.extensions.getExtension('gmoddev.carbonluau-vscode');
  Assert.ok(Extension); await Extension.activate();
  if (Process.env.CARBONLUAU_E2E_INSTALL_ROOT) {
    Assert.ok(Extension.extensionPath.startsWith(Process.env.CARBONLUAU_E2E_INSTALL_ROOT), 'runs installed artifact, not source extension');
    Assert.ok(Fs.existsSync(require('node:path').join(Extension.extensionPath, 'PROVENANCE.json')));
  }
  const Document = await Vscode.workspace.openTextDocument(Vscode.Uri.joinPath(Vscode.workspace.workspaceFolders[0].uri, 'init.luau'));
  await Vscode.window.showTextDocument(Document);
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  const PanelTest = async (Action, Extra = {}) => {
    Fs.writeFileSync(Marker, JSON.stringify({Stage:'panel',Action,Started:Date.now(),...Extra}));
    await Until(() => JSON.parse(Fs.readFileSync(Marker,'utf8')).Stage === 'panel-done', 'real WebView ' + Action);
  };
  if (Mode === 'revoke') {
    Assert.equal(Vscode.workspace.isTrusted, false);
    await Assert.rejects(Extension.exports.RequestPreview({ProjectId: '0/', Viewport: {Width: 1280, Height: 720}}), /trusted workspace/);
    Assert.equal(Extension.exports.GetPreviewState().Plan, undefined);
    await Vscode.commands.executeCommand('carbonLuau.previewGui'); await PanelTest('restricted');
    if (AnalysisProcesses()) Assert.equal(AnalysisProcesses().length, 0);
    Stage('complete'); return;
  }
  if (Mode === 'restricted') {
    Assert.equal(Vscode.workspace.isTrusted, false);
    await Assert.rejects(Extension.exports.RequestPreview({ProjectId: '0/', Viewport: {Width: 1280, Height: 720}}), /trusted workspace/);
    if (AnalysisProcesses()) Assert.equal(AnalysisProcesses().length, 0);
    await Vscode.commands.executeCommand('carbonLuau.previewGui'); await PanelTest('restricted');
    await Vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    const Hovers = await Vscode.commands.executeCommand('vscode.executeHoverProvider', Document.uri, new Vscode.Position(2, 9));
    Assert.ok(Hovers.some(Hover => Hover.contents.some(Content => Content.value?.includes('GiveItem') && /Canonical.*CarbonLuau/.test(Content.value))));
    await Vscode.commands.executeCommand('workbench.trust.manage'); Stage('grant');
    await Until(() => Vscode.workspace.isTrusted, 'actual Workspace Trust grant');
  } else Assert.equal(Vscode.workspace.isTrusted, true);
  await Until(() => Vscode.languages.getDiagnostics(Document.uri).some(Item => Item.source === 'CarbonLuau types' && Item.message.includes('number')), 'type diagnostics');
  const Hovers = await Vscode.commands.executeCommand('vscode.executeHoverProvider', Document.uri, new Vscode.Position(1, 8));
  Assert.ok(Hovers.some(Hover => Hover.contents.some(Content => Content.value?.includes('Player'))));
  const Completion = await Vscode.commands.executeCommand('vscode.executeCompletionItemProvider', Document.uri, new Vscode.Position(2, 7));
  Assert.ok(Completion.items.some(Item => Item.label === 'GiveItem'));
  const Signatures = await Vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', Document.uri, new Vscode.Position(2, 24));
  Assert.ok(Signatures.signatures.some(Item => Item.label.includes('GiveItem')));
  if (Mode === 'restricted') { Stage('complete'); return; }
  if (AnalysisProcesses()) {
    const First = AnalysisProcesses()[0]; Assert.ok(First);
    Process.kill(First, 'SIGKILL'); await Delay(200);
    await Vscode.commands.executeCommand('vscode.executeHoverProvider', Document.uri, new Vscode.Position(1, 8));
    await Until(() => AnalysisProcesses().some(Pid => Pid !== First), 'one bounded crash restart');
    const Second = AnalysisProcesses()[0]; Process.kill(Second, 'SIGKILL'); await Delay(200);
    await Vscode.commands.executeCommand('vscode.executeHoverProvider', Document.uri, new Vscode.Position(1, 8));
    await Delay(1500); Assert.equal(AnalysisProcesses().length, 0);
    await Vscode.commands.executeCommand('carbonLuau.restartTooling');
    await Until(() => AnalysisProcesses().length === 1, 'explicit restart after crash latch');
  }
  const Replace = async Text => {
    const Edit = new Vscode.WorkspaceEdit();
    Edit.replace(Document.uri, new Vscode.Range(Document.positionAt(0), Document.positionAt(Document.getText().length)), Text);
    Assert.equal(await Vscode.workspace.applyEdit(Edit), true); await Document.save();
    // Let asynchronous filesystem save notifications reach the invalidation
    // handler before testing a preview of a stable source revision.
    await Delay(500);
  };
  const GuiSource = 'local Screen = game:GetService("Gui"):Create("ScreenGui")\nScreen:Create("Frame").Size = UDim2.fromScale(0.5, 0.5)';
  const Selection = {ProjectId: '0/', Viewport: {Width: 1280, Height: 720}};
  await Replace(GuiSource); await Vscode.commands.executeCommand('carbonLuau.validateProject');
  const Preview = await Extension.exports.RequestPreview(Selection);
  Assert.equal(Preview.Nodes[1].Projected.RectPx.Width, 640);
  await Replace('while true do end'); await Vscode.commands.executeCommand('carbonLuau.validateProject');
  Assert.equal(Extension.exports.GetPreviewState().Plan, undefined);
  const PreviewFailure = Extension.exports.RequestPreview(Selection).then(() => {throw new Error('Infinite preview succeeded');}, Error => Error);
  const Responsive = Date.now(); await Vscode.commands.getCommands(); await Delay(50);
  Assert.ok(Date.now() - Responsive < 1000, 'Extension host became unresponsive during preview.');
  Assert.ok(await PreviewFailure);
  Assert.equal(Extension.exports.GetPreviewState().Plan, undefined);
  await Replace(GuiSource); await Vscode.commands.executeCommand('carbonLuau.validateProject');
  Assert.equal((await Extension.exports.RequestPreview(Selection)).Nodes.length, 2);
  const PanelSource = 'local Screen = game:GetService("Gui"):Create("ScreenGui")\nlocal Frame = Screen:Create("Frame")\nFrame.Size = UDim2.fromScale(0.5, 0.5)\nFrame.BackgroundColor3 = Color3.new(0.08, 0.18, 0.28)\nlocal Padding = Frame:Create("UIPadding")\nlocal Title = Frame:Create("TextLabel")\nTitle.Size = UDim2.fromOffset(450, 70)\nTitle.Text = "Hello <img src=x onerror=alert(1)>"\nlocal Button = Frame:Create("TextButton")\nButton.Position = UDim2.fromOffset(20, 90)\nButton.Text = "Inspect only"';
  await Replace(PanelSource); const PanelStarted=Date.now(); await Vscode.commands.executeCommand('carbonLuau.previewGui'); await PanelTest('inspect',{Started:PanelStarted}); await PanelTest('viewport'); await PanelTest('custom');
  for (let Iteration=0; Iteration<3; Iteration++) {
    const Started=Date.now(), Expected='Saved title '+Iteration;
    await Replace(PanelSource.replace('Hello <img src=x onerror=alert(1)>',Expected)); await PanelTest('saved',{Started,Expected,Iteration});
  }
  await Replace('local ='); await PanelTest('error');
  await Replace(PanelSource); await PanelTest('recover');
  await Replace('while true do end'); await PanelTest('error');
  await Replace(PanelSource); await PanelTest('recover');
  await Replace('local Screen = game:GetService("Gui"):Create("ScreenGui")\nlocal Parent=Screen\nfor Index=1,127 do if Index==1 or Index==65 then Parent=Screen end local F=Parent:Create("Frame") F.Name="Duplicate" F.Position=UDim2.fromOffset((Index%12)*80,math.floor(Index/12)*40) F.Size=UDim2.fromOffset(70,30) if Index==1 or Index==65 then Parent=F end end'); await PanelTest('near-limit');
  await Vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  await Replace('type function Loop() while true do end return types.number end\nlocal X: Loop<> = 1\nreturn X');
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  const Start = Date.now();
  await Vscode.commands.getCommands(); await Delay(100);
  Assert.ok(Date.now() - Start < 1000, 'Extension host became unresponsive during analysis.');
  if (AnalysisProcesses()) await Until(() => AnalysisProcesses().length === 0, 'analysis deadline reap', 20000);
  else await Delay(17000);
  await Replace('local X: number = "wrong"\nreturn X');
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  if (AnalysisProcesses()) Assert.equal(AnalysisProcesses().length, 0, 'Timeout was automatically replayed.');
  await Vscode.commands.executeCommand('carbonLuau.restartTooling');
  await Until(() => Vscode.languages.getDiagnostics(Document.uri).some(Item => Item.source === 'CarbonLuau types'), 'language recovery after explicit restart');
  // A real trust revocation may reload the extension host. The resumed suite
  // checks Restricted Mode and absence of surviving analysis processes above.
  await Replace(PanelSource); await Vscode.commands.executeCommand('carbonLuau.previewGui'); await PanelTest('recover');
  await Vscode.commands.executeCommand('workbench.trust.manage'); Stage('revoke');
  await Until(() => !Vscode.workspace.isTrusted, 'trust revocation/reload');
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  if (AnalysisProcesses()) await Until(() => AnalysisProcesses().length === 0, 'analysis process termination after revocation');
  Stage('complete');
};
