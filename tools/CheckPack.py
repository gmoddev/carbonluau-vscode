"""Repeat canonical pack assembly in fresh directories; never duplicates its generator."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

Root = Path(__file__).resolve().parents[1]
Canonical = Root / "build/canonical"
Build = Root / "build/tooling"
Packs = list((Root / "tooling").glob("*/pack.json"))
if len(Packs) != 1:
    raise SystemExit("Expected exactly one provisioned platform")
Pack = json.loads(Packs[0].read_text())
Platform = Pack["Platform"]
Windows = Platform == "win32-x64"
Native = Build / "native" / ("Release" if Windows else "")
Preview = Build / "preview-native" / ("Release" if Windows else "")
with tempfile.TemporaryDirectory(prefix="carbonluau-pack-repeat-") as Temporary:
    Command = [sys.executable, str(Canonical / "tools/Provision-ToolingPack.py"),
               "--platform", Platform, "--publish", str(Build / "publish"),
               "--analysis", str(Native / ("carbonluau_analysis.dll" if Windows else "libcarbonluau_analysis.dylib" if Platform.startswith("darwin") else "libcarbonluau_analysis.so")),
               "--launcher", str(Native / ("carbonluau-analysis-launcher.exe" if Windows else "carbonluau-analysis-launcher")),
               "--lsp-archive", str(Build / Pack["UpstreamAssets"][Platform]["Name"]), "--extension", Temporary]
    if Pack["PreviewQualified"]:
        Command += ["--preview-native", str(Preview / Pack["PreviewNative"]), "--preview-launcher", str(Preview / Pack["PreviewLauncher"])]
    subprocess.run(Command, check=True)
    Original = Packs[0].parent
    Repeat = Path(Temporary) / "tooling" / Platform
    def Digests(Directory):
        return {File.name: hashlib.sha256(File.read_bytes()).hexdigest() for File in Directory.iterdir() if File.is_file()}
    if Digests(Original) != Digests(Repeat):
        raise SystemExit("Independent canonical pack assemblies differ")
    Receipt = {"Platform": Platform, "RuntimeRevision": Pack["SemanticRevision"], "Files": Digests(Original), "Method": "fresh canonical assembly from identical qualified build outputs"}
    (Root / "build/pack-reproducibility.json").write_text(json.dumps(Receipt, indent=2) + "\n", encoding="utf-8")
    print("[CarbonLuau:Package] PASS independent tooling pack assembly", Platform)
