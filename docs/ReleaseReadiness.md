# Cross-repository development candidate

Status: runtime/editor synchronization qualified at the implementation sources
below; experimental publication is held for the unresolved inventory CI failure.
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

## Committed implementation qualification

Extension implementation `c2d3ac9ad27af3c7fe97447ea73bd1ab91d4649d` passes
[all three platform jobs](https://github.com/gmoddev/carbonluau-vscode/actions/runs/38814564532).
The canonical runtime dependency remains fff095f57cc53b5f4acf3d45e3ba033ba499c319;
the current runtime audit/diagnostic source
`18104098b6fa6b8298787eddff83873dec44a29b` also passes
[runtime/sanitizers](https://github.com/gmoddev/CarbonLuau/actions/runs/38813149842),
[tooling](https://github.com/gmoddev/CarbonLuau/actions/runs/38813149926),
[baseline](https://github.com/gmoddev/CarbonLuau/actions/runs/38813149928) and
[documentation](https://github.com/gmoddev/CarbonLuau/actions/runs/38813149861).
Runtime production, native, generated API, catalog and allowlist inputs have no
changes from the qualified dependency in this synchronization.

| Platform | Unit/security/real-tooling tests | Actual clean installed VSIX | Independent pack and VSIX builds |
|---|---|---|---|
| Windows x64 | 48 PASS, zero skips | Restricted/trusted/reopen/revocation PASS | 2 / 2, identical |
| glibc Linux x64 | 48 PASS, zero skips | Restricted/trusted/reopen/revocation PASS | 2 / 2, identical |
| macOS arm64 static-only | 35 PASS, 13 execution-profile skips | Not claimed | 2 / 2, identical |

Both actual editor suites verify 221 Item fields and two Prefab.Loot fields,
literal/capability hover, misspellings, canonical-name and symbol search, exact
clipboard contents, unchanged source, cancellation on restart, configured old API
rejection/recovery and the existing GUI/process security suite. Each suite uses
VS Code 1.95.3, build 07b4ff1883f94da91f6d698744fc7c3638b59720. The extension's
new example also typechecks through the selected canonical definitions.

The [machine-readable evidence](qualification/ReleaseReadiness-Evidence.json)
contains all three implementation VSIX hashes/build IDs and 41 raw receipt
hashes. Every packaged canonical metadata/definition/symbol file matches its
authoritative runtime source bytes; every pack payload hash is verified.
The catalog remains bounded to 223 rows and one active picker, canceled on source
change, newer search, restart and unload. No runtime memory/resource allowance
changes. The [consolidated readiness report](https://github.com/gmoddev/CarbonLuau/blob/main/docs/CrossRepo-ReleaseReadiness.md)
owns the unchanged physical evidence, inventory blocker and release recommendation.

This documentation/provenance closure changes no implementation. Its exact
committed-source matrix must also pass before final delivery, which supplies both
final tested SHAs and CI links. Implementation artifact hashes in the ledger are
attributed to c2d3ac9; a final closure artifact has a distinct source provenance
and must use its own companion checksum. No mutable main badge substitutes for
matching the workflow headSha.

The first Linux installed-VSIX attempt in
[job 116688009463](https://github.com/gmoddev/carbonluau-vscode/actions/runs/38812226351/job/116688009463)
reaches the catalog picker but the test driver invokes an unavailable VS Code
command, `workbench.action.acceptSelectedQuickOpen`. Raw phase/log artifacts are
retained under `C:/Sandbox/Codex/CrossRepoReadiness20261015/Extension-Linux-Negative`
and the job's vscode-e2e artifact. The corrected driver waits for the actual
focused query result, then sends Enter through its existing test-only loopback
CDP channel. Exact copied-value and unchanged-source assertions remain intact.
Production search requires only normal VS Code Quick Pick selection.

The second Linux attempt, source `34c435bf7c6c846f84982357fad567f1d449dd62`,
[job 116690864455](https://github.com/gmoddev/carbonluau-vscode/actions/runs/38813071605/job/116690864455),
times out at the unchanged 30-second filtered-result assertion. Its driver used
the extension-host `type` command rather than typing into the actual focused
Quick Pick input. The corrected test drives input and Enter through test-only
CDP, verifies visible/focused picker state and exact query/selected label, and
retains bounded catalog-ui.json snapshots. The clipboard and source-preservation
assertions are unchanged. Raw log and phase artifacts remain in
`C:/Sandbox/Codex/CrossRepoReadiness20261015/Extension-Second-Linux-Negative`,
with the raw job log alongside it, SHA256
`25e611f4af221918d94efc4ee0c9b22e57ed4edccdaec26044d642a0fdb3043a`.
The first Windows attempt has the same unavailable-command failure as Linux;
its artifacts are retained in Extension-Windows-Negative. No retry, increased
test deadline or weakened expected catalog result is introduced.

The corrected working source passes both actual Linux VS Code 1.95.3 phases in
an isolated two-CPU/4-GiB container, 2026-10-15T22:01:55Z–22:03:17Z: Restricted
Mode, Trust grant/reopen/revocation, search/value selection, 221/2 completion,
hover/typos, old-API rejection/recovery, picker cancellation, GUI and process
recovery. Development source archive SHA256
`ad2c8e797723a9fa90f9c60a37d560ae66e3bf0beb08fa86daa4830bbc49f6e4`;
raw runner/state/phase/UI/panel receipts are retained at
`C:/Sandbox/Codex/CrossRepoReadiness20261015/rapid-editor-r1` and
`/root/codex/crossrepo-readiness-20261015/rapid-editor-r1`.
This rapid development test truthfully pairs its isolated source pin with the
CI-built runtime candidate 18104098b6fa6b8298787eddff83873dec44a29b. It is not a
final-source installed-VSIX claim; the hosted matrix still must test the committed
extension with its unchanged fff095f qualified tooling dependency. Container exit
is zero, no OOM; the temporary container is removed and eight protected containers
remain unchanged. Distro/editor dependencies are ephemeral RAM-only files, with
no host install or machine policy changes.
