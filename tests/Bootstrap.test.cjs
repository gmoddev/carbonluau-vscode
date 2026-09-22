const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Path = require('node:path');
const Vm = require('node:vm');
const { test: Test } = require('node:test');
const Manifest = require('../package.json');
const Strings = require('../package.nls.json');

Test('manifest declares a bounded desktop workspace bootstrap', () => {
  Assert.match(Manifest.name, /^[a-z0-9][a-z0-9-]*$/);
  Assert.match(Manifest.version, /^\d+\.\d+\.\d+$/);
  Assert.equal(Manifest.publisher, 'gmoddev');
  Assert.equal(Manifest.private, true);
  Assert.equal(Manifest.engines.vscode, '^1.95.0');
  Assert.deepEqual(Manifest.extensionKind, ['workspace']);
  Assert.equal(Manifest.capabilities.untrustedWorkspaces.supported, 'limited');
  Assert.equal(Manifest.capabilities.virtualWorkspaces.supported, false);
  for (const Capability of Object.values(Manifest.capabilities)) {
    Assert.ok(Strings[Capability.description.slice(1, -1)]);
  }
  Assert.deepEqual(Manifest.contributes.commands.map(Item => Item.command), ['carbonLuau.previewGui', 'carbonLuau.validateProject', 'carbonLuau.selectScriptingApi', 'carbonLuau.restartTooling', 'carbonLuau.showOutput']);
  Assert.equal(Manifest.contributes.languages[0].id, 'luau');
  Assert.equal(Manifest.browser, undefined);
  Assert.equal(Manifest.dependencies?.['vscode-languageclient'], undefined);
  Assert.ok(Fs.existsSync(Path.join(__dirname, '..', Manifest.main)));
});

for (const Trusted of [false, true]) {
  Test(`static activation, commands, diagnostics and failed-closed LSP (trust=${Trusted})`, async () => {
    const Exports = {}, Commands = new Map(), Problems = new Map(), Logs = [], Requests = [];
    const Disposable = { dispose() {} };
    const Event = () => Disposable;
    const Uri = { fsPath: '/safe/main.luau', path: '/safe/main.luau', toString: () => 'file:///safe/main.luau' };
    const Pack = { ApiVersion: '0.4.0-experimental', PackVersion: 'foundation-b-development', Platform: 'win32-x64', LanguageServerQualified: false };
    let Api = '', Failure = false;
    const Vscode = {
      window: {
        createOutputChannel: () => ({ ...Disposable, appendLine: Text => Logs.push(Text), show() {} }),
        createStatusBarItem: () => ({ ...Disposable, show() {} }),
        activeTextEditor: { document: { uri: Uri } }, showQuickPick: async Items => Items[0]
      },
      StatusBarAlignment: { Right: 1 }, DiagnosticSeverity: { Error: 0, Warning: 1 }, ConfigurationTarget: { Workspace: 2 },
      Range: class { constructor(...Values) { this.Values = Values; } },
      Diagnostic: class { constructor(Range, Message, Severity) { this.range = Range; this.message = Message; this.severity = Severity; } },
      Uri: { joinPath: () => Uri },
      commands: { registerCommand: (Name, Handler) => { Commands.set(Name, Handler); return Disposable; } },
      languages: { createDiagnosticCollection: () => ({ ...Disposable, clear: () => Problems.clear(), set: (Uri, Items) => Problems.set(Uri.toString(), Items) }) },
      workspace: {
        isTrusted: Trusted, getConfiguration: () => ({ get: () => Api, update: async (_Name, Value) => { Api = Value; } }),
        createFileSystemWatcher: () => ({ ...Disposable, onDidChange: Event, onDidCreate: Event, onDidDelete: Event }),
        onDidChangeWorkspaceFolders: Event, onDidOpenTextDocument: Event, onDidChangeTextDocument: Event, onDidChangeConfiguration: Event,
        onDidGrantWorkspaceTrust: Event,
        fs: { createDirectory: async () => {}, writeFile: async () => {} }
      }
    };
    const Tooling = {
      Revision: () => 'sha256:test',
      ToolingClient: class {
        async Request(Method, Params) {
          Requests.push(Method);
          if (Failure) throw new Error('Tooling stopped unexpectedly.');
          if (Method === 'initialize' && Params.ApiVersion !== Pack.ApiVersion) throw new Error('Unknown CarbonLuau scripting API.');
          return { Projects: [{ Kind: 'Standalone' }], Imports: [], Diagnostics: [{ Folder: '0', Path: 'main.luau', Code: 'Require3', Message: 'Dependency is not declared.', Severity: 'Error', Line: 2, Column: 3, EndLine: 2, EndColumn: 4 }] };
        }
        async Stop() {}
      }
    };
    const Imports = {
      vscode: Vscode, './ToolingClient': Tooling, './Pack': { LoadPack: async () => Pack },
      './Snapshot': { SourceKey: (Folder, Path) => Folder + '\0' + Path, Capture: async () => ({ Params: { Folders: [] }, Uris: new Map([['0\0main.luau', Uri]]), Sources: new Map() }) },
      './AnalysisAdapter': { BuildTransform: () => '-- trusted empty adapter' },
      './Metadata': { RegisterMetadata: () => Disposable },
      './Preview': { Preview: class { constructor() { throw new Error('Preview must never start on activation'); } } },
      './PreviewPanel': { PreviewPanel: class { constructor() { throw new Error('Panel must never open on activation'); } } },
      './Language': { Language: class { constructor() { throw new Error('Unqualified language server must never start'); } } }
    };
    const Context = Vm.createContext({ exports: Exports, Buffer, setTimeout: () => 1, clearTimeout: () => {}, require: Name => {
      Assert.ok(Object.hasOwn(Imports, Name), Name); return Imports[Name];
    } });
    Vm.runInContext(Fs.readFileSync(Path.join(__dirname, '..', Manifest.main), 'utf8'), Context, { timeout: 1000 });
    const ExtensionContext = { subscriptions: [], extensionPath: '/official', globalStorageUri: Uri,
      extension: { packageJSON: Manifest }, workspaceState: { get: () => undefined, update: async () => {} } };
    Exports.activate(ExtensionContext);
    await Commands.get('carbonLuau.validateProject')();
    Assert.deepEqual(Requests, ['initialize', 'getMetadata', 'validateProject']);
    Assert.equal(Problems.get(Uri.toString())[0].code, 'Require3');
    Assert.equal(Problems.get(Uri.toString())[0].range.Values[0], 2);
    await Commands.get('carbonLuau.selectScriptingApi')(); Assert.equal(Api, Pack.ApiVersion);
    Failure = true; await Commands.get('carbonLuau.validateProject')();
    Assert.equal(Problems.get(Uri.toString())[0].code, 'ToolingUnavailable');
    Assert.ok(Logs.some(Text => Text.includes('Tooling stopped unexpectedly.')));
    await Exports.deactivate();
  });
}
