const Assert = require('node:assert/strict');
const Path = require('node:path');
const { test: Test } = require('node:test');
const { ToolingClient, Revision } = require('../dist/ToolingClient');
const Process = require('node:process');
const Fs = require('node:fs');
const Os = require('node:os');
const Crypto = require('node:crypto');
const ChildProcess = require('node:child_process');
const { setTimeout } = require('node:timers');
const Root = Process.env.CARBONLUAU_ANALYSIS_PACK;
const Pack = Root && { Root, Host: Path.join(Root, Process.platform === 'win32' ? 'carbonluau-tooling.exe' : 'carbonluau-tooling'),
  ApiVersion: '0.4.0-experimental', PackVersion: 'foundation-a-development' };

function Snapshot(Files) { return { Folders: [{ Id: '0', Files: Object.entries(Files).map(([Path, Text]) => ({ Path, Text })) }] }; }
async function Session(Files, Work) {
  const Logs = [];
  const Client = new ToolingClient(Pack, Text => Logs.push(Text), 'analysis');
  const Params = Snapshot(Files), Digest = Revision(Params, Pack.ApiVersion, Pack.PackVersion);
  try {
    const Admission = await Client.Request('snapshot', { Trusted: true, Snapshot: Params }, Digest);
    const Analyze = (Operation = 'textDocument/diagnostic', Position) => Client.Request('language', {
      Trusted: true, Folder: '0', Path: 'init.luau', Operation, ...(Position ? { Position } : {})
    }, Digest);
    await Work({ Client, Admission, Analyze, Digest, Params });
  } catch (Error) { Error.message += '\n' + Logs.join('\n'); throw Error; }
  finally { await Client.Stop(); }
}
Test('actual supervisor excludes executable config and workspace settings/plugins', { skip: !Root }, async () => {
  await Session({ 'init.luau': 'return 1', '.config.luau': 'while true do end', '.luaurc': '{"aliases":{"evil":"C:/"}}',
    '.vscode/settings.json': '{"luau-lsp.plugins.enabled":true,"luau-lsp.plugins.paths":["evil.luau"]}', 'evil.luau': 'error("ordinary bodies must not execute")' }, async ({ Admission, Analyze }) => {
    Assert.ok(Admission.Withheld.includes('0\0.config.luau'));
    Assert.ok(!Admission.Admitted.some(Key => Key.includes('.vscode') || Key.includes('.luaurc')));
    Assert.equal((await Analyze()).Value.items.length, 0);
  });
});
Test('actual type function preserves API inference and error reporting', { skip: !Root }, async () => {
  await Session({ 'init.luau': 'type function T() return types.number end\nlocal X: T<> = "wrong"\nreturn X, GiveItemBehavior.InventoryOnly, game:GetService("Players")' }, async ({ Analyze }) => {
    const Result = await Analyze();
    Assert.ok(Result.Value.items.some(Item => /number/.test(Item.message) && /string/.test(Item.message)), JSON.stringify(Result));
    Assert.ok(!Result.Value.items.some(Item => /Unknown global/.test(Item.message)), JSON.stringify(Result));
  });
});
Test('infinite type function is killed at the fixed deadline and cannot replay', { skip: !Root, timeout: 25000 }, async () => {
  await Session({ 'init.luau': 'type function T() while true do end return types.number end\nlocal X: T<> = 1\nreturn X' }, async ({ Analyze }) => {
    const Start = Date.now();
    await Assert.rejects(Analyze(), /deadline/);
    Assert.ok(Date.now() - Start >= 14000 && Date.now() - Start < 17000);
    await Assert.rejects(Analyze(), /Restart Tooling/);
  });
});
Test('type-function heap cap rejects allocation while ordinary analysis recovers', { skip: !Root, timeout: 20000 }, async () => {
  await Session({ 'init.luau': 'type function T() local B = buffer.create(128 * 1024 * 1024) return types.number end\nlocal X: T<> = 1\nreturn X' }, async ({ Analyze }) => {
    const Result = await Analyze();
    Assert.ok(Result.Value.items.some(Item => /memory/.test(Item.message)), JSON.stringify(Result));
  });
  await Session({ 'init.luau': 'return 1' }, async ({ Analyze }) => Assert.equal((await Analyze()).Value.items.length, 0));
});
Test('untrusted request and arbitrary language operations fail closed', { skip: !Root }, async () => {
  const Client = new ToolingClient(Pack, () => {}, 'analysis');
  try { await Assert.rejects(Client.Request('snapshot', { Trusted: false, Snapshot: Snapshot({ 'init.luau': 'return 1' }) }, 'sha256:' + '0'.repeat(64)), /Workspace Trust/); }
  finally { await Client.Stop(); }
  await Session({ 'init.luau': 'return 1' }, async ({ Analyze }) => Assert.rejects(Analyze('workspace/executeCommand'), /not allowed/));
});

Test('source changes, invalid imports and UTF-16 locations preserve canonical mapping', { skip: !Root }, async () => {
  await Session({ 'init.luau': 'local Emoji = "🌱"; local M = require("foo")\nreturn Emoji, M', 'modules/foo.luau': 'return 42' }, async ({ Analyze }) => {
    const Result = await Analyze(); Assert.equal(Result.Value.items.length, 0, JSON.stringify(Result));
    const Hover = await Analyze('textDocument/hover', { line: 1, character: 14 });
    Assert.ok(JSON.stringify(Hover).includes('number'), JSON.stringify(Hover));
  });
  for (const Source of ['return require("../../outside")', 'return require("C:/outside")', 'return require(Name)', 'local R = require; return R("foo")',
    'type T = typeof(require("../../outside"))\nreturn nil', 'type T = () -> (typeof(require("C:/outside")))\nreturn nil']) {
    await Session({ 'init.luau': Source }, async ({ Admission }) => Assert.equal(Admission.Admitted.length, 0));
  }
});

Test('unknown snapshot fields and aggregate file limits cannot relax policy', { skip: !Root }, async () => {
  const Client = new ToolingClient(Pack, () => {}, 'analysis');
  const Params = Snapshot({ 'init.luau': 'return 1' });
  try {
    await Assert.rejects(Client.Request('snapshot', { Trusted: true, Snapshot: Params, Plugins: ['arbitrary.luau'] }, Revision(Params, Pack.ApiVersion, Pack.PackVersion)), /Unknown request field/);
  } finally { await Client.Stop(); }
  const Oversized = { Folders: [0, 1].map(Id => ({ Id: String(Id), Files: Array.from({ length: 1025 }, (_, Index) => ({ Path: `m${Index}.luau`, Text: 'return 1' })) })) };
  const Bounded = new ToolingClient(Pack, () => {}, 'analysis');
  try {
    await Assert.rejects(Bounded.Request('snapshot', { Trusted: true, Snapshot: Oversized }, Revision(Oversized, Pack.ApiVersion, Pack.PackVersion)), /2048 across all folders/);
  } finally { await Bounded.Stop(); }
});

Test('malformed server output and server crash close the analysis session', { skip: !Root || !Process.env.CARBONLUAU_ANALYSIS_FIXTURE }, async () => {
  for (const Mode of ['malformed', 'crash']) {
    const Temp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'carbonluau-fixture-pack-'));
    try {
      Fs.cpSync(Root, Temp, { recursive: true });
      const Name = Mode + (Process.platform === 'win32' ? '.exe' : '');
      Fs.copyFileSync(Process.env.CARBONLUAU_ANALYSIS_FIXTURE, Path.join(Temp, Name)); Fs.chmodSync(Path.join(Temp, Name), 0o755);
      const Manifest = JSON.parse(Fs.readFileSync(Path.join(Temp, 'pack.json'), 'utf8'));
      Manifest.LanguageServer = Name; Manifest.Files[Name] = Crypto.createHash('sha256').update(Fs.readFileSync(Path.join(Temp, Name))).digest('hex');
      Fs.writeFileSync(Path.join(Temp, 'pack.json'), JSON.stringify(Manifest));
      const Client = new ToolingClient({ ...Pack, Root: Temp, Host: Path.join(Temp, Path.basename(Pack.Host)) }, () => {}, 'analysis');
      const Params = Snapshot({ 'init.luau': 'return 1' });
      try { await Assert.rejects(Client.Request('snapshot', { Trusted: true, Snapshot: Params }, Revision(Params, Pack.ApiVersion, Pack.PackVersion))); }
      finally { await Client.Stop(); }
    } finally { await new Promise(Resolve => setTimeout(Resolve, 250)); Fs.rmSync(Temp, { recursive: true }); }
  }
});

Test('native launch controls terminate excessive process memory', { skip: !Root || !Process.env.CARBONLUAU_ANALYSIS_FIXTURE, timeout: 15000 }, async () => {
  const Launcher = Path.join(Root, Process.platform === 'win32' ? 'carbonluau-analysis-launcher.exe' : 'carbonluau-analysis-launcher');
  const Child = ChildProcess.spawn(Launcher, [String(Process.pid), Process.env.CARBONLUAU_ANALYSIS_FIXTURE, 'memory'], { windowsHide: true, shell: false, stdio: 'pipe' });
  const Code = await new Promise((Resolve, Reject) => { Child.once('error', Reject); Child.once('exit', Resolve); });
  Assert.equal(Code, 129);
});

Test('resource controls are already installed at the first child instruction', { skip: !Root || !Process.env.CARBONLUAU_ANALYSIS_FIXTURE }, async () => {
  const Launcher = Path.join(Root, Process.platform === 'win32' ? 'carbonluau-analysis-launcher.exe' : 'carbonluau-analysis-launcher');
  const Child = ChildProcess.spawn(Launcher, [String(Process.pid), Process.env.CARBONLUAU_ANALYSIS_FIXTURE, 'profile'], { windowsHide: true, shell: false, stdio: 'pipe' });
  const Code = await new Promise((Resolve, Reject) => { Child.once('error', Reject); Child.once('exit', Resolve); });
  Assert.equal(Code, 0);
});

Test('ancestor executable configuration blocks launch without evaluating it', { skip: !Root }, async () => {
  const Temp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'carbonluau-config-ancestor-'));
  const Saved = Object.fromEntries(['TEMP', 'TMP', 'TMPDIR'].map(Name => [Name, Process.env[Name]]));
  try {
    Fs.writeFileSync(Path.join(Temp, '.config.luau'), 'while true do end');
    for (const Name of Object.keys(Saved)) Process.env[Name] = Temp;
    await Assert.rejects(Session({ 'init.luau': 'return 1' }, async () => Assert.fail('Unsafe ancestry admitted')), /Unexpected Luau configuration/);
  } finally {
    for (const [Name, Value] of Object.entries(Saved)) { if (Value === undefined) delete Process.env[Name]; else Process.env[Name] = Value; }
    Fs.rmSync(Temp, { recursive: true });
  }
});

Test('launcher termination also terminates the contained native child', { skip: !Root || !Process.env.CARBONLUAU_ANALYSIS_FIXTURE || Process.platform === 'darwin', timeout: 10000 }, async () => {
  const Launcher = Path.join(Root, Process.platform === 'win32' ? 'carbonluau-analysis-launcher.exe' : 'carbonluau-analysis-launcher');
  const Child = ChildProcess.spawn(Launcher, [String(Process.pid), Process.env.CARBONLUAU_ANALYSIS_FIXTURE, 'wait'], { windowsHide: true, shell: false, stdio: 'pipe' });
  const Pid = await new Promise((Resolve, Reject) => { Child.once('error', Reject); Child.stdout.once('data', Value => Resolve(Number(Value.toString().trim()))); });
  Assert.ok(Number.isSafeInteger(Pid) && Pid > 1);
  Child.kill('SIGKILL');
  for (let Attempt = 0; Attempt < 100; ++Attempt) {
    try {
      Process.kill(Pid, 0);
      if (Process.platform === 'linux' && /\) Z /.test(Fs.readFileSync(`/proc/${Pid}/stat`, 'utf8'))) return;
    } catch (Error) { if (Error.code === 'ESRCH' || Error.code === 'ENOENT') return; throw Error; }
    await new Promise(Resolve => setTimeout(Resolve, 50));
  }
  Assert.fail('Contained child survived launcher termination.');
});
