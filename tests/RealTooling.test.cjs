const Assert = require('node:assert/strict');
const Path = require('node:path');
const Process = require('node:process');
const Fs = require('node:fs');
const { test: Test } = require('node:test');
const { LoadPack } = require('../dist/Pack');
const { ToolingClient, Revision } = require('../dist/ToolingClient');
const Root = Path.resolve(__dirname, '..');
const Available = Fs.existsSync(Path.join(Root, 'tooling', `${Process.platform}-${Process.arch}`, 'pack.json'));

Test('real tooling resolves declared sibling IDs with canonical package visibility', { skip: !Available, timeout: 30000 }, async () => {
  const Pack = await LoadPack(Root);
  const Client = new ToolingClient(Pack, () => {});
  const Analysis = new ToolingClient(Pack, () => {}, 'analysis');
  try {
    await Client.Request('initialize', { ExtensionVersion: '0.0.1', ApiVersion: Pack.ApiVersion, PackageSchema: 1, Platform: Pack.Platform,
      PackVersion: Pack.PackVersion, Capabilities: ['StaticAnalysis', 'Metadata'] });
    const Metadata = await Client.Request('getMetadata', {});
    Assert.ok(Metadata.Catalog.Members.some(Member => Member.Id === 'Player.GiveItem'));
    const Source = 'local Shop = require("@economy")\nlocal Cost: number = Shop.Price\nreturn Cost';
    const Folder = (Id, Values) => ({ Id, Files: Object.entries(Values).map(([Path, Text]) => ({ Path, Text })) });
    const Params = { Folders: [
      Folder('a', { 'addon.json': '{"schema":1,"id":"shop","version":"1.0.0","dependencies":{"required":["economy"]}}', 'init.luau': Source }),
      Folder('b', { 'addon.json': '{"schema":1,"id":"economy","version":"1.0.0","main":"public"}', 'init.luau': '', 'public.luau': 'return {Price = 42}' })
    ] };
    const Result = await Client.Request('resolveProjectGraph', Params, Revision(Params, Pack.ApiVersion, Pack.PackVersion));
    Assert.deepEqual(Result.Diagnostics, []); Assert.equal(Result.Imports.length, 1);
    if (!Pack.LanguageServerQualified) return;
    const Analyze = async () => {
      const Digest = Revision(Params, Pack.ApiVersion, Pack.PackVersion);
      await Analysis.Request('snapshot', { Trusted: true, Snapshot: Params }, Digest);
      return Analysis.Request('language', { Trusted: true, Operation: 'textDocument/diagnostic', Folder: 'a', Path: 'init.luau' }, Digest);
    };
    Assert.equal((await Analyze()).Value.items.length, 0);
    Params.Folders[1].Files.find(File => File.Path === 'public.luau').Text = 'return {Price = "wrong"}';
    Assert.ok((await Analyze()).Value.items.some(Item => /number/.test(Item.message) && /string/.test(Item.message)));
  } finally { await Client.Stop(); await Analysis.Stop(); }
});
