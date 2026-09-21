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
  const Document = await Vscode.workspace.openTextDocument(Vscode.Uri.joinPath(Vscode.workspace.workspaceFolders[0].uri, 'init.luau'));
  await Vscode.window.showTextDocument(Document);
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  if (Mode === 'revoke') {
    Assert.equal(Vscode.workspace.isTrusted, false);
    if (AnalysisProcesses()) Assert.equal(AnalysisProcesses().length, 0);
    Stage('complete'); return;
  }
  if (Mode === 'restricted') {
    Assert.equal(Vscode.workspace.isTrusted, false);
    if (AnalysisProcesses()) Assert.equal(AnalysisProcesses().length, 0);
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
  };
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
  await Vscode.commands.executeCommand('workbench.trust.manage'); Stage('revoke');
  await Until(() => !Vscode.workspace.isTrusted, 'trust revocation/reload');
  await Vscode.commands.executeCommand('carbonLuau.validateProject');
  if (AnalysisProcesses()) await Until(() => AnalysisProcesses().length === 0, 'analysis process termination after revocation');
  Stage('complete');
};
