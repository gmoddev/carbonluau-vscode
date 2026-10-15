# Cross-repository development candidate

Status: implementation candidate; final-source CI and platform evidence pending.
Canonical dependency: CarbonLuau fff095f57cc53b5f4acf3d45e3ba033ba499c319,
API 0.7.5-experimental. Extension package 0.0.1, tooling profile 0.4.0-rc.1,
protocol/metadata/package/preview schemas 1 and LSP 1.70.0 remain unchanged.
No new package identity, release, tag or publication is authorized here.

The generated metadata, definitions and symbol snapshot are packaged directly
from that revision. There is no independently maintained API/item/prefab list.
Both trust modes support bounded canonical catalog search and reference hover;
Windows/Linux trusted mode adds supervised inference, exact catalog completion
and misspelled-field diagnostics. Search copies a selected constant without
rewriting source. Optional raw-string actions remain absent because lexical
matching cannot prove unshadowed global identity. Historical candidate artifacts
retain their original API. This candidate offers only its bundled exact target.

Qualification requires unit/security/real-tooling checks, independent canonical
pack reassembly, two independent vsce/prepublish builds, deterministic ZIP
normalization and clean installed VSIX tests on actual Windows/Linux VS Code.
macOS arm64 remains static-only; macOS x64 remains unqualified. Reassembly from
identical build outputs does not claim cross-OS or independent-compiler byte identity.

Runtime gameplay adapters and allowlists are unchanged. D4–D9 physical evidence
is retained at the canonical source. The D8 Windows inventory CI failure remains
an explicit release blocker until status/counter evidence establishes a cause;
subsequent green runs do not explain the original compound assertion failure.
The consolidated runtime report will record exact final commits and CI links.

The first Linux installed-VSIX attempt in
[job 116688009463](https://github.com/gmoddev/carbonluau-vscode/actions/runs/38812226351/job/116688009463)
reaches the catalog picker but the test driver invokes an unavailable VS Code
command, `workbench.action.acceptSelectedQuickOpen`. Raw phase/log artifacts are
retained under `C:/Sandbox/Codex/CrossRepoReadiness20261015/Extension-Linux-Negative`
and the job's vscode-e2e artifact. The corrected driver waits for the actual
focused query result, then sends Enter through its existing test-only loopback
CDP channel. Exact copied-value and unchanged-source assertions remain intact.
Production search requires only normal VS Code Quick Pick selection.
