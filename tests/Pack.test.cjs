const Assert = require('node:assert/strict');
const Fs = require('node:fs');
const Os = require('node:os');
const Path = require('node:path');
const Process = require('node:process');
const { createHash: Hash } = require('node:crypto');
const { test: Test } = require('node:test');
const { LoadPack } = require('../dist/Pack');

Test('pack policy mismatch preserves static mode while bad payloads/identities fail closed', async () => {
  const Temp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'carbonluau-pack-check-'));
  const Platform = `${Process.platform}-${Process.arch}`, Root = Path.join(Temp, 'tooling', Platform);
  Fs.mkdirSync(Root, { recursive: true });
  const Files = Object.fromEntries(['host', 'lsp', 'definitions', 'documentation'].map(Name => {
    Fs.writeFileSync(Path.join(Root, Name), Name);
    return [Name, Hash('sha256').update(Name).digest('hex')];
  }));
  const Manifest = { ManifestSchema: 1, Platform, PackVersion: '0.4.0-rc.1', ApiVersion: '0.4.0-experimental',
    Host: 'host', LanguageServer: 'lsp', Definitions: 'definitions', Documentation: 'documentation', Files,
    LanguageServerQualified: true, QualifiedAnalysisPlatforms: [Platform], LanguageServerVersion: '1.70.0',
    LanguageServerLuauRevision: 'a62362a53ddc9c629b0e29378a84abb4534d8b64', AnalysisSecurityPolicyVersion: 1,
    AnalysisProfile: 'TrustedSnapshotAnalysis', AnalysisProxyRevision: 1, TransformRevision: 2,
    AnalysisContainmentProfile: { 'win32-x64': 'WindowsJobCommit1GiB-Active1-Suspended-v1', 'linux-x64': 'LinuxAddressSpace2GiB-Rss1GiB-ProcessGroup-v1' }[Platform] };
  const Save = () => Fs.writeFileSync(Path.join(Root, 'pack.json'), JSON.stringify(Manifest));
  Manifest.SemanticRevision = '2ada473399e752e8d178cce089cc9a7d442f32cf';
  const Pin = () => Fs.writeFileSync(Path.join(Temp, 'tooling-source.json'), JSON.stringify({ Revision: Manifest.SemanticRevision, ScriptingApi: Manifest.ApiVersion }));
  try {
    Pin();
    Save(); Assert.equal((await LoadPack(Temp)).LanguageServerQualified, ['win32-x64', 'linux-x64'].includes(Platform));
    Manifest.AnalysisProxyRevision = 99; Save(); Assert.equal((await LoadPack(Temp)).LanguageServerQualified, false);
    Manifest.PackVersion = 'unknown'; Save(); await Assert.rejects(LoadPack(Temp), /Incompatible/);
    Manifest.PackVersion = '0.4.0-rc.1'; Save();
    Manifest.ApiVersion = '0.7.5-experimental'; Save(); await Assert.rejects(LoadPack(Temp), /Incompatible/);
    Pin(); Assert.equal((await LoadPack(Temp)).ApiVersion, '0.7.5-experimental');
    Manifest.SemanticRevision = '0'.repeat(40); Save(); await Assert.rejects(LoadPack(Temp), /Incompatible/);
    Pin();
    Fs.writeFileSync(Path.join(Root, 'host'), 'replacement'); await Assert.rejects(LoadPack(Temp), /integrity/);
  } finally { Fs.rmSync(Temp, { recursive: true }); }
});
