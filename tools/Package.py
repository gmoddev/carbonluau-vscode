"""Build a deterministic, offline VSIX candidate; never publishes or signs."""
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import tempfile
import zipfile

Root = Path(__file__).resolve().parents[1]
Platform = {"Windows": "win32", "Linux": "linux", "Darwin": "darwin"}[platform.system()] + "-" + ("arm64" if platform.machine().lower() in ("arm64", "aarch64") else "x64")
Target = {"win32-x64": "win32-x64", "linux-x64": "linux-x64", "darwin-arm64": "darwin-arm64"}[Platform]
PackRoot = Root / "tooling" / Platform
Pack = json.loads((PackRoot / "pack.json").read_text())
Source = json.loads((Root / "tooling-source.json").read_text())
if Pack["SemanticRevision"] != Source["Revision"] or Pack["ApiVersion"] != Source["ScriptingApi"]:
    raise SystemExit("Canonical source pin / pack mismatch")
if sorted(P.name for P in (Root / "tooling").iterdir() if P.is_dir()) != [Platform]:
    raise SystemExit("Package exactly one platform pack at a time")
for Name, Digest in Pack["Files"].items():
    if hashlib.sha256((PackRoot / Name).read_bytes()).hexdigest() != Digest:
        raise SystemExit("Pack payload hash mismatch: " + Name)
Revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=Root, text=True).strip()
Provenance = {"ExtensionRevision": Revision, "RuntimeRevision": Source["Revision"],
              "ExtensionVersion": json.loads((Root / "package.json").read_text())["version"],
              "Platform": Platform, "Pack": Pack, "Signed": False,
              "Qualification": "StaticOnly" if Platform.startswith("darwin") else "WindowsLinuxExecutionCandidate"}
Output = Root / "dist/release"
Output.mkdir(parents=True, exist_ok=True)
Name = "carbonluau-vscode-" + Provenance["ExtensionVersion"] + "-" + Platform
Artifact = Output / (Name + ".vsix")
ProvenanceBytes = (json.dumps(Provenance, indent=2, sort_keys=True) + "\n").encode()
with tempfile.TemporaryDirectory(prefix="carbonluau-vsix-") as Temporary:
    Raw = Path(Temporary) / "raw.vsix"
    # CI checks first; vsce's standard prepublish hook builds the payload.
    subprocess.run(["node", str(Root / "node_modules/@vscode/vsce/vsce"), "package", "--target", Target,
                    "--no-dependencies", "--no-update-package-json", "--no-git-tag-version",
                    "--skip-license", "--out", str(Raw)], cwd=Root, check=True)
    with zipfile.ZipFile(Raw) as Archive:
        Payload = {Entry.filename: (Archive.read(Entry), Entry.external_attr) for Entry in Archive.infolist() if not Entry.is_dir()}
    if not any(Name.startswith("extension/tooling/" + Platform + "/") for Name in Payload):
        raise SystemExit("VSIX omitted tooling pack")
    for EntryName in Payload:
        if any(Part in (".git", "node_modules", "tests", "build", ".codexlock") for Part in Path(EntryName).parts):
            raise SystemExit("Development file in VSIX: " + EntryName)
    Payload["extension/PROVENANCE.json"] = (ProvenanceBytes, 0o100644 << 16)
    def Write(Destination):
        with zipfile.ZipFile(Destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as Archive:
            for EntryName in sorted(Payload):
                Data, Attributes = Payload[EntryName]
                Entry = zipfile.ZipInfo(EntryName, (2000, 1, 1, 0, 0, 0))
                Entry.create_system = 3
                Entry.external_attr = Attributes
                Archive.writestr(Entry, Data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    Write(Artifact)
    Repeat = Path(Temporary) / "repeat.vsix"
    Write(Repeat)
    if Artifact.read_bytes() != Repeat.read_bytes():
        raise SystemExit("VSIX packaging is not deterministic")
(Output / (Name + ".provenance.json")).write_bytes(ProvenanceBytes)
Digest = hashlib.sha256(Artifact.read_bytes()).hexdigest()
(Output / (Name + ".sha256")).write_text(Digest + "  " + Artifact.name + "\n", encoding="utf-8", newline="\n")
print("[CarbonLuau:Package] PASS deterministic VSIX", Artifact, Digest)
