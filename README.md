# CarbonLuau for VS Code

Foundation A development integration: Luau syntax, canonical CarbonLuau API
information, project/package diagnostics and trusted language analysis. This is
an unpublished development extension; no VSIX or Marketplace release is provided.
Runtime semantics and metadata belong to [CarbonLuau](https://github.com/gmoddev/CarbonLuau).

## Develop and run

Use Node.js 22, .NET SDK 10, Python 3, CMake and a C++17 compiler. Check out the
CarbonLuau revision recorded in `tooling-source.json` beside this repository.
From PowerShell 7 in this repository:

```powershell
npm ci --ignore-scripts
../CarbonLuau/tools/Build-Tooling.ps1 -Extension $pwd
npm run check
code --extensionDevelopmentPath="$pwd" /path/to/project
```

The explicit pack build downloads a SHA-256-pinned luau-lsp archive unless
`-LanguageServerArchive` supplies an existing copy. It builds the static parser,
self-contained tooling host and analysis launcher into `tooling/<platform>`.
No server assemblies are required. Build each pack on its target platform.
Pack payload hashes detect corruption; local development packs are not signed
distribution attestations. Run `npm run test:e2e` on a dedicated desktop runner
(Linux: `xvfb-run -a npm run test:e2e`). Tests manipulate their own VS Code trust
profile. See [architecture and qualification routing](docs/Architecture.md).

## Projects and diagnostics

Open a standalone/root Luau folder, an addon folder containing `addon.json`, or a
multi-folder workspace. Nested addon projects and `.claddon` package validation
are supported. Unsaved Luau buffers are included in bounded snapshots. Loose
files outside workspace folders receive static support only. No new project file
is required.

Problems reports canonical manifest/schema/API, package ID/version, path, main,
public-module, dependency and source/module-limit errors. Declared dependencies
resolve by exact package ID to sibling workspace addons; undeclared/private
modules stay inaccessible. `require("local/module")`, `require("@addon")` and
`require("@addon/public/module")` use the runtime's shared legality rules. This is
development analysis, with no registry, downloading or version solver.

The installed `0.4.0-experimental` API includes current Player/inventory, GUI,
Signals, value types and enums. Reference hovers work in static mode; trusted
mode adds type diagnostics, inferred hover, completion, signatures and source
navigation. Reference hovers identify themselves as canonical API information,
not expression type inference. Unsupported API/schema identities fail explicitly.

Commands: **Preview GUI**, **Validate Project**, **Select Scripting API**, **Restart Tooling**, and
**Show Output**, all under **CarbonLuau** in the Command Palette. Only installed
offline API targets can be selected.

## Workspace Trust

Restricted Mode keeps syntax, API information and project/package diagnostics.
It never starts luau-lsp or evaluates type functions. The status bar explains
that richer analysis requires Workspace Trust, without repeated notifications.

Trust automatically enables supervised analysis on qualified Windows x64 and
Linux x64 packs. Type functions may execute in luau-lsp's restricted Luau VM,
outside VS Code's extension host, with heap and external process/deadline limits.
Workspace `.config.luau`, `.luaurc`, `.robloxrc`, LSP settings and custom plugins
are excluded in both modes. CarbonLuau uses its own pinned configuration and
require adapter. Ordinary project configuration interoperability is consequently
limited; configuration cannot relax the analysis policy.

Analysis uses a private bounded snapshot, not workspace paths. Dynamic/aliased or
invalid requires, syntax errors, invalid packages and their dependent sources
are withheld from executable analysis; static diagnostics remain available.
An unexpected crash gets one restart per five minutes. Timeout, resource or
protocol failure requires **Restart Tooling**; editing does not replay failed
analysis automatically. Revoking trust follows VS Code's reload behavior and
terminates the trusted analysis processes.

Process supervision and Luau VM restrictions are **not an OS filesystem/network
sandbox**. Native processes retain the user's OS authority if compromised.
macOS x64/arm64 remains static-only: hosted arm64 build/static-host checks pass,
but executable language analysis is unqualified and deliberately disabled even
when the workspace is trusted. macOS x64 has no execution evidence.

Once provisioned, editor operation is offline: no telemetry, HTTP listener,
remote API, server connection or automatic tooling download. Standard VS Code
services have their own settings. No mocks, debugger or live server integration
exists here.

## GUI preview

In a trusted Windows/Linux workspace with a qualified tooling pack, run
**CarbonLuau: Preview GUI**. Choose a canonical root/addon project if there is more
than one. The entry defaults to its admitted `init.luau`. Source executes in
Foundation B's fresh bounded worker, never in the extension host. No Carbon
installation or Rust server is needed. macOS remains static-only.

The panel combines a paint surface, ID-based hierarchy, retained/projected
inspector and canonical resource usage. Click a painted object or hierarchy row
to inspect it. Arrow keys navigate the hierarchy. Layout helpers and hidden
objects remain inspectable; managed children identify their layout owner.
Buttons select only: they do not run callbacks.

Choose a viewport preset or enter custom whole-pixel dimensions (1–8192).
Changing the viewport requests a new canonical plan. **Display zoom** changes
only presentation. Source edits/saves debounce for 400 ms and request a fresh
worker; **Refresh** does the same. Pending/failed refreshes clear the previous
plan. Successful plans reset selection to the screen and local scroll to zero.
Use the screen selector when a project produces multiple screens.

Layout and geometry come from canonical CarbonLuau tooling. Text uses system
font approximations; image identities use offline placeholders, including
Sprite/Png/Item/SteamAvatar. None paints no image. Scrolling uses wheel/Shift-wheel
or selected-scroller inspector offsets as an editor-only convenience. No images,
avatars, Rust files or fonts are downloaded. This is not an authenticated Rust
client; actual client delivery, click receipt and scroll state are unavailable.

Source navigation is disabled because Foundation B supplies no creation-site
mapping. It also supplies no script log stream, so there is no preview console.
Errors appear in panel status; operational details go to **CarbonLuau Output**.
Existing canonical Problems/type diagnostics remain available. Only viewport
and zoom preferences are persisted. See [Foundation C evidence](docs/ToolingFoundationC.md).
