# Architecture routing

The canonical owner is CarbonLuau D19. This repository must not duplicate its
package parser, module visibility, GUI geometry, clipping or resource accounting.

- [Contributor entry](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/AICONTEXT.md)
- [Tooling baseline](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingBaseline.md)
- [Contract models](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingContracts.md)
- [Foundation A plan and phase routing](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingFoundationA.md)

Links pin the isolated adoption commit while another task works on runtime main;
follow canonical main after that change is integrated. No semantic source is
copied here. `extension/Extension.ts` is the only runtime entry in this bootstrap.

## Language-analysis security amendment

The canonical [D19 decision](https://github.com/gmoddev/CarbonLuau/blob/9c33a98ee123238ee073a819a4938827596e5b25/docs/ToolingLanguageAnalysisSecurity.md)
resolves the partial Foundation A implementation's workspace-code execution
blocker. [Windows/Linux investigation evidence](https://github.com/gmoddev/CarbonLuau/blob/9c33a98ee123238ee073a819a4938827596e5b25/docs/ToolingLanguageAnalysisSecurityEvidence.md)
distinguishes configuration evaluation, restricted type-function evaluation and
pack-owned plugin execution. Use this amendment with the baseline links above;
it supersedes the assumption that all language analysis is non-executing.

Restricted Mode retains parse-only syntax, packaged API information and canonical
project/package/path diagnostics. It never starts luau-lsp. After Workspace Trust,
a qualified tooling supervisor may start the pinned LSP over bounded snapshots,
with type functions intact, owned JSON configuration and the verified require
adapter. Workspace `.config.luau`, `.luaurc`, `.robloxrc`, arbitrary LSP settings
and custom plugins are excluded in both modes. Trust cannot select executable
paths or relax limits. Nothing executes workspace Luau in the extension host.

The selected profile provides process/resource supervision and VM restrictions;
it does not claim a portable OS filesystem/network sandbox. The amendment owns
exact deadlines, memory limits versus soft monitoring, snapshot ancestry checks,
trust transitions, protocol/URI filtering, recovery and platform qualification.

Architecture verdict: **READY TO RESUME TOOLING FOUNDATION A**. Implementation
verdict remains partial/unqualified. The isolated `carbonluau-vscode-a` worktree
contains the uncommitted implementation; preserve its unconditional LSP block
until the replacement controls pass. This branch changes documentation only,
does not enable analysis and does not begin Foundation B or publication.
