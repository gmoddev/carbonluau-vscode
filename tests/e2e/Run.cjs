// Run on a dedicated desktop runner or Xvfb. Does not disable Workspace Trust.
const Fs = require('node:fs');
const Path = require('node:path');
const Process = require('node:process');
const { spawn: Spawn } = require('node:child_process');
const { setTimeout: Delay } = require('node:timers/promises');
const { downloadAndUnzipVSCode: Download } = require('@vscode/test-electron');
const Panel = require('./Panel.cjs');
const Root = Path.resolve(__dirname, '../..');
Fs.mkdirSync(Path.join(Root, 'build'), { recursive: true });
const Work = Fs.mkdtempSync(Path.join(Root, 'build/e2e-'));
const Profile = Path.join(Work, 'profile');
const Workspace = Path.join(Work, 'workspace');
const Marker = Path.join(Work, 'phase.json');
const Harness = Path.join(Work, 'harness');

async function ClickTrust(Label) {
  const Targets = await (await globalThis.fetch('http://127.0.0.1:9237/json')).json();
  const Page = Targets.find(Target => Target.type === 'page' && Target.url.includes('workbench'));
  if (!Page) return false;
  const Socket = new globalThis.WebSocket(Page.webSocketDebuggerUrl);
  await new Promise((Resolve, Reject) => { Socket.addEventListener('open', Resolve, { once: true }); Socket.addEventListener('error', Reject, { once: true }); });
  try {
    const Response = new Promise(Resolve => Socket.addEventListener('message', Event => { const Value = JSON.parse(Event.data); if (Value.id === 1) Resolve(Value); }));
    Socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { returnByValue: true,
      expression: `(() => { const Label = ${JSON.stringify(Label)}; const Button = [...document.querySelectorAll('[role="button"]')].find(Item => Item.textContent.trim() === Label || Item.getAttribute('aria-label')?.startsWith(Label + ', Keyboard')); if (!Button) return false; Button.click(); return true; })()` } }));
    return (await Response).result?.result?.value === true;
  } finally { Socket.close(); }
}
async function Run(Mode, Executable) {
  Fs.writeFileSync(Marker, JSON.stringify({ Stage: Mode }));
  const Child = Spawn(Executable, [Workspace, '--no-sandbox', '--disable-gpu', '--disable-updates', '--skip-welcome', '--skip-release-notes',
    '--user-data-dir=' + Profile, '--extensions-dir=' + Path.join(Work, 'extensions'), '--remote-debugging-port=9237',
    '--extensionDevelopmentPath=' + Root, '--extensionDevelopmentPath=' + Harness], {
    env: { ...Process.env, CARBONLUAU_E2E_MARKER: Marker }, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe']
  });
  let Output = '', Exited = false, Code;
  const Exit = new Promise(Resolve => Child.once('exit', Value => { Exited = true; Code = Value; Resolve(Value); }));
  for (const Stream of [Child.stdout, Child.stderr]) Stream.on('data', Value => { Output = (Output + Value).slice(-131072); });
  const End = Date.now() + 240000;
  try {
    while (!Exited && Date.now() < End) {
      const State = JSON.parse(Fs.readFileSync(Marker, 'utf8'));
      if (State.Stage === 'grant' || State.Stage === 'revoke') {
        try { await ClickTrust(State.Stage === 'grant' ? 'Trust' : "Don't Trust"); } catch { /* Workbench may be reloading. */ }
      }
      if (State.Stage === 'panel' && await Panel.Action(State, Work)) Fs.writeFileSync(Marker, JSON.stringify({Stage:'panel-done',Action:State.Action}));
      await Delay(250);
    }
    if (!Exited) { Child.kill(); throw new Error('VS Code E2E timed out.\n' + Output); }
    await Exit;
    if (Code !== 0 || JSON.parse(Fs.readFileSync(Marker, 'utf8')).Stage !== 'complete') throw new Error(`VS Code E2E failed (${Code}).\n${Fs.readFileSync(Marker, 'utf8')}\n${Output}`);
    Process.stdout.write(`[CarbonLuau:E2E] PASS ${Mode}\n`);
  } finally { if (!Exited) Child.kill(); Fs.writeFileSync(Path.join(Work, Mode + '.log'), Output); }
}
async function Main() {
  Fs.mkdirSync(Path.join(Profile, 'User'), { recursive: true }); Fs.mkdirSync(Workspace, { recursive: true });
  Fs.mkdirSync(Harness, { recursive: true });
  Fs.writeFileSync(Path.join(Harness, 'package.json'), JSON.stringify({ name: 'carbonluau-e2e-harness', publisher: 'carbonluau-tests', version: '0.0.0', engines: { vscode: '^1.95.0' }, main: './Harness.cjs', activationEvents: ['onStartupFinished'], capabilities: { untrustedWorkspaces: { supported: true } } }));
  // Avoid --extensionTestsPath: that environment does not preserve normal trust
  // storage across reopen. This companion runs through ordinary activation.
  Fs.writeFileSync(Path.join(Harness, 'Harness.cjs'), `const Vscode = require('vscode'); exports.activate = async () => { try { await require(${JSON.stringify(Path.join(__dirname, 'Suite.cjs'))}).run(); } catch (Error) { require('node:fs').writeFileSync(${JSON.stringify(Marker)}, JSON.stringify({Stage:'failed', Error:String(Error.stack)})); console.error(Error); } await Vscode.commands.executeCommand('workbench.action.quit'); };`);
  Fs.writeFileSync(Path.join(Profile, 'User/settings.json'), JSON.stringify({ 'security.workspace.trust.startupPrompt': 'never', 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'workbench.startupEditor': 'none', 'extensions.autoUpdate': false }));
  Fs.writeFileSync(Path.join(Workspace, 'init.luau'), 'local Players = game:GetService("Players")\nlocal Player = Players:GetPlayers()[1]\nPlayer:GiveItem("wood", 1, GiveItemBehavior.InventoryOnly)\nlocal Value: number = "wrong"\nreturn Value\n');
  Fs.writeFileSync(Path.join(Workspace, '.config.luau'), 'while true do end');
  const Executable = await Download({ version: '1.95.3', cachePath: Path.join(Root, 'build/vscode-cache') });
  await Run('restricted', Executable);
  await Run('reopen', Executable);
}
Main().catch(Error => { Process.stderr.write(String(Error) + '\n'); Process.exitCode = 1; });
