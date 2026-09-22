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
Tooling. Foundation B itself adds no visual command, WebView or mocks.

Windows/Linux preview limits are separate from LSP limits: a fresh worker,
1-second execution wall deadline, 64 MiB Luau heap and 256 MiB process profile.
Linux RSS is a sampled watchdog alongside hard DATA limits; neither platform
claims a filesystem/network OS sandbox. macOS remains static-only. See the
selected canonical revision's `docs/ToolingFoundationB.md` and
`tooling/preview-plan.schema.json` for all semantics and qualification.

## Foundation C editor consumer

`PreviewPanel` owns the single panel, request cancellation/debounce and harmless
viewport/zoom preferences. It uses canonical static project discovery and the
unchanged Foundation B request path. No runtime/Core/plan-schema changes are
needed. Panel disposal, invalidation and extension shutdown cancel pending work.
Failed requests clear the picture; trust/pack qualification gates stay in both
the editor and canonical host.

`PreviewContract` validates transport structure, numeric finiteness, bounded
strings/arrays, object references, acyclic hierarchy and DOM construction budget.
Those are renderer safety checks, not a second implementation of GUI validity,
resource limits, layout, clip-depth legality or projection costs. Resource
warnings use the plan's counts/limits; 80% is an editor warning threshold only.

The bundled WebView uses absolute Core rectangles, emitted paint order and
explicit clip-owner chains. Nested CSS clip boxes consume supplied rectangles;
coordinate subtraction converts global positions into parent-relative CSS.
No retained UDim, anchor, layout, padding or ZIndex is interpreted. Local scroll
translates descendant paint layers using supplied content/viewport rectangles;
it never changes or returns canonical state. Selection uses IDs and never calls
Luau. Plan replacement resets scroll/selection; zoom does not request execution.

The WebView action schema is version 1: Ready, Refresh, Viewport, Zoom and Screen.
Unknown/extra fields, paths, bad values and messages over 4096 serialized
characters are rejected. Screen IDs must have been offered by the current host
response. Selection stays inside the WebView; no navigation/execute/file/network
message exists. Extension State messages contain preferences, bounded status,
screen choices and an optional validated schema-1 plan. Plans are validated
again on rendering. Transport limits are 8 Mi serialized characters, 4096 nodes,
128 hierarchy levels and 32768 paint/clip DOM units, above current canonical
limits; upstream IPC additionally caps real UTF-8 frames at 8 MiB.

Only packaged media and the bundled browser script are local resource roots.
Scripts require an unpredictable 192-bit nonce; CSP denies connections, images,
fonts, frames, objects, form submission, base-URI changes and eval. Workspace
strings only reach textContent, never HTML or asset URLs. Browser style properties
receive validated numbers or fixed presentation choices. VS Code injects its own
WebView bootstrap; tests inspect workspace-controlled DOM separately.
These controls follow the [official WebView security guidance](https://code.visualstudio.com/api/extension-guides/webview#security).

The browser sandbox/CSP protects the panel; the existing native worker and Luau
VM controls protect preview execution within their documented limits. Neither
child processes nor CSP constitute portable OS filesystem/network sandboxing
for native tooling. Workspace Trust is consent, not containment.

Foundation D can add a separately authorized interaction protocol above this
read-only plan consumer. No mock state, callback execution, production tokens,
debugger, live-server channel or authoring/source-write path exists in C.
