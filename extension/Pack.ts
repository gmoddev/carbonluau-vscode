import * as Fs from 'node:fs/promises';
import * as Path from 'node:path';
import { createHash as CreateHash } from 'node:crypto';

export interface Pack {
  Root: string;
  Platform: string;
  PackVersion: string;
  ApiVersion: string;
  Host: string;
  LanguageServer: string;
  Definitions: string;
  Documentation: string;
  LanguageServerQualified: boolean;
  PreviewQualified: boolean;
  ToolingBuildId: string;
  SemanticRevision: string;
}

export async function LoadPack(ExtensionRoot: string): Promise<Pack> {
  const Platform = `${process.platform}-${process.arch}`;
  if (!['win32-x64', 'linux-x64', 'darwin-x64', 'darwin-arm64'].includes(Platform)) throw new Error(`Unsupported CarbonLuau tooling platform ${Platform}.`);
  const Root = Path.join(ExtensionRoot, 'tooling', Platform);
  const Stat = await Fs.lstat(Root);
  if (!Stat.isDirectory() || Stat.isSymbolicLink()) throw new Error('Tooling pack directory is unsafe.');
  const ManifestFile = Path.join(Root, 'pack.json');
  if ((await Fs.lstat(ManifestFile)).isSymbolicLink() || (await Fs.stat(ManifestFile)).size > 65536) throw new Error('Tooling pack manifest is unsafe.');
  const Manifest = JSON.parse(await Fs.readFile(ManifestFile, 'utf8')) as {
    ManifestSchema: number; Platform: string; PackVersion: string; ApiVersion: string;
    Host: string; LanguageServer: string; Definitions: string; Documentation: string;
    Files: Record<string, string>; LanguageServerVersion: string; LanguageServerLuauRevision: string; LanguageServerQualified: boolean;
    AnalysisSecurityPolicyVersion: number; AnalysisProfile: string; AnalysisProxyRevision: number; TransformRevision: number;
    AnalysisContainmentProfile: string; QualifiedAnalysisPlatforms: string[];
    PreviewQualified: boolean; PreviewSecurityPolicyVersion: number; PreviewBridgeVersion: number; PreviewPlanSchema: number;
    PreviewNative: string; PreviewLauncher: string; PreviewContainmentProfile: string; ToolingBuildId: string; SemanticRevision: string;
  };
  if (Manifest.ManifestSchema !== 1 || Manifest.Platform !== Platform ||
      Manifest.PackVersion !== 'foundation-b-development' || !Manifest.Files || Object.keys(Manifest.Files).length > 512) throw new Error('Incompatible CarbonLuau tooling pack.');
  for (const [Name, Digest] of Object.entries(Manifest.Files)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(Name) || Name === '.' || Name === '..' || !/^[0-9a-f]{64}$/.test(Digest)) throw new Error('Unsafe tooling pack file.');
    const File = Path.join(Root, Name);
    const Info = await Fs.lstat(File);
    if (!Info.isFile() || Info.isSymbolicLink() || Info.size > 128 * 1024 * 1024) throw new Error('Unsafe tooling payload.');
    if (CreateHash('sha256').update(await Fs.readFile(File)).digest('hex') !== Digest) throw new Error(`Tooling pack integrity check failed: ${Name}.`);
  }
  const Resolve = (Name: string): string => {
    if (!Object.hasOwn(Manifest.Files, Name)) throw new Error('Tooling pack payload is missing.');
    return Path.join(Root, Name);
  };
  const Profiles: Record<string, string> = { 'win32-x64': 'WindowsJobCommit1GiB-Active1-Suspended-v1', 'linux-x64': 'LinuxAddressSpace2GiB-Rss1GiB-ProcessGroup-v1' };
  const Qualified = Manifest.LanguageServerQualified === true && Array.isArray(Manifest.QualifiedAnalysisPlatforms) && Manifest.QualifiedAnalysisPlatforms.includes(Platform) &&
    Manifest.LanguageServerVersion === '1.70.0' && Manifest.LanguageServerLuauRevision === 'a62362a53ddc9c629b0e29378a84abb4534d8b64' &&
    Manifest.AnalysisSecurityPolicyVersion === 1 && Manifest.AnalysisProfile === 'TrustedSnapshotAnalysis' && Manifest.AnalysisProxyRevision === 1 && Manifest.TransformRevision === 2 &&
    !!Profiles[Platform] && Manifest.AnalysisContainmentProfile === Profiles[Platform];
  const PreviewProfiles: Record<string, string> = { 'win32-x64': 'WindowsJobCommit256MiB-Active1-Suspended-v1', 'linux-x64': 'LinuxData256MiB-AddressSpace2GiB-Rss256MiB-10ms-v1' };
  const PreviewQualified = Manifest.PreviewQualified === true && Manifest.PreviewSecurityPolicyVersion === 1 && Manifest.PreviewBridgeVersion === 1 &&
    Manifest.PreviewPlanSchema === 1 && !!PreviewProfiles[Platform] && Manifest.PreviewContainmentProfile === PreviewProfiles[Platform] &&
    /^sha256:[0-9a-f]{64}$/.test(Manifest.ToolingBuildId) && /^[0-9a-f]{40}$/.test(Manifest.SemanticRevision);
  if (PreviewQualified) { Resolve(Manifest.PreviewNative); Resolve(Manifest.PreviewLauncher); }
  return { Root, Platform, PackVersion: Manifest.PackVersion, ApiVersion: Manifest.ApiVersion,
    Host: Resolve(Manifest.Host), LanguageServer: Resolve(Manifest.LanguageServer),
    Definitions: Resolve(Manifest.Definitions), Documentation: Resolve(Manifest.Documentation), LanguageServerQualified: Qualified,
    PreviewQualified, ToolingBuildId: Manifest.ToolingBuildId, SemanticRevision: Manifest.SemanticRevision };
}

export function CheckLanguageServer(Pack: Pack): void {
  if (!Pack.LanguageServerQualified) throw new Error('Supervised language analysis is not qualified for this tooling pack/platform. Static CarbonLuau validation remains available.');
}
