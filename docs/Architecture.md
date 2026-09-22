# Architecture routing

CarbonLuau D19 owns tooling semantics and security. `tooling-source.json` pins the
canonical implementation used by CI; read that revision's `AICONTEXT.md`,
`docs/ToolingBaseline.md`, `docs/ToolingContracts.md`,
`docs/ToolingFoundationA.md` and `docs/ToolingFoundationACompletion.md`.
This repository contains editor integration, not a second package/module parser.

## Language-analysis security amendment

The accepted [D19 decision](https://github.com/gmoddev/CarbonLuau/blob/9c33a98ee123238ee073a819a4938827596e5b25/docs/ToolingLanguageAnalysisSecurity.md)
and [upstream investigation](https://github.com/gmoddev/CarbonLuau/blob/9c33a98ee123238ee073a819a4938827596e5b25/docs/ToolingLanguageAnalysisSecurityEvidence.md)
distinguish parse-only checks, executable configuration, restricted type
functions and pack-owned transforms. They remain authoritative.

Foundation A uses two separate tooling host instances. Static `--stdio` handles
metadata and bounded canonical project validation. Trusted `--analysis-stdio`
materializes the immutable snapshot, generates the owned transform and supervises
luau-lsp through the native launch boundary. The extension sends only bounded
logical snapshots and allowlisted language operations. It never runs a Luau VM.

Workspace configuration and plugin selection cannot enter either launcher.
The supervisor verifies policy/profile, platform, payload hashes and exact pins;
the extension independently checks compatibility before enabling language
providers. Static functionality remains available when language qualification
is absent. Both sides reject stale revisions. Language output has bounded
frames/depth/queues, source-checked ranges, mapped admitted URIs and no commands,
external links, workspace edits or dynamic registration.

Windows uses a Job assigned before the child resumes: 1 GiB process commit,
one active process, no breakaway, kill on last job handle close. Linux installs
2 GiB address-space limits before exec and monitors 1 GiB RSS every 50 ms;
the child has an owned process group and parent-loss handling. Requests expire
after 15 seconds (initialization 30), plugin execution after 1 second, and type
functions have a 64 MiB VM heap limit. macOS remains static-only and unqualified.
No portable OS filesystem or network isolation is claimed.

The original isolated partial implementation's unconditional launch block is
replaced only for the Windows/Linux qualified profile. Require transformation
now lives in canonical C# tooling, revision 2, using exact source guards and
fully escaped literals. Runtime require semantics are unchanged. Foundation B
receives reusable Core, protocol, metadata, definitions and client services;
its preview worker, VM and plan generation are not implemented by Foundation A.

## Foundation B internal preview seam

Foundation B adds `extension/Preview.ts` and the extension exports
`RequestPreview(Selection)` / `GetPreviewState()` for Foundation C. It captures
the existing logical project snapshot, requires trust and a qualified pack,
requests canonical preview execution over stdio, validates exact plan identity,
and stores a copied plan. Source/API/folder changes and trust/reload clear plans
and end the dedicated coordinator session. No workspace code or GUI layout runs
in JavaScript. Errors clear the old plan; an unreaped process requires Restart
Tooling. No visual command, WebView or mocks are added.

Windows/Linux preview limits are separate from LSP limits: a fresh worker,
1-second execution wall deadline, 64 MiB Luau heap and 256 MiB process profile.
Linux RSS is a sampled watchdog alongside hard DATA limits; neither platform
claims a filesystem/network OS sandbox. macOS remains static-only. See the
selected canonical revision's `docs/ToolingFoundationB.md` and
`tooling/preview-plan.schema.json` for all semantics and qualification.
