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
  Assert.deepEqual(Object.keys(Manifest.contributes), ['languages']);
  Assert.equal(Manifest.contributes.languages[0].id, 'luau');
  Assert.equal(Manifest.browser, undefined);
  Assert.equal(Manifest.dependencies, undefined);
  Assert.ok(Fs.existsSync(Path.join(__dirname, '..', Manifest.main)));
});

for (const Trusted of [false, true]) {
  Test(`activation has no host capabilities (workspace trust=${Trusted})`, () => {
    const Exports = {};
    const Context = Vm.createContext({
      exports: Exports,
      require: () => { throw new Error('Bootstrap must not load host modules'); }
    });
    Vm.runInContext(Fs.readFileSync(Path.join(__dirname, '..', Manifest.main), 'utf8'), Context, { timeout: 1000 });
    Context.Extension = Exports;
    Context.ExtensionContext = Object.freeze({ isTrusted: Trusted });
    Vm.runInContext('Extension.activate(ExtensionContext); Extension.deactivate();', Context, { timeout: 1000 });
    Assert.deepEqual(Object.keys(Exports).sort(), ['activate', 'deactivate']);
  });
}
