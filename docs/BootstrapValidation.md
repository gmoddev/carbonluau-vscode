# Bootstrap validation

2026-09-21: new repository; no pre-existing extension source or remote was found.
Canonical CarbonLuau baseline is commit
`33f9c75c62759cc093e06477b25b2fe05f0f03e5`, based on runtime
`3f6a3196b28e2243dc8802d3b8ff2374196f3c89`.

Windows x64 checks passed: locked `npm ci --ignore-scripts`, TypeScript build,
ESLint, manifest contract assertions and 3 bootstrap tests. Activation/deactivation
run with no host modules/capabilities for trusted and untrusted fixture contexts.
This is not VS Code E2E; no language server or other future behavior is claimed.
`vsce ls --tree` 3.6.0 inspected the package inventory without creating a VSIX.

Local tools: Node 20.18.0, npm 11.4.1, TypeScript 5.9.3, ESLint 9.39.1. The linter
reports upstream deprecation; temporary vsce's transitive undici reports a minimum
Node 20.18.1 warning. Both checks completed; CI uses Node 22. Requalify the release
toolchain in Foundation E. No VSIX, telemetry, preview, WebView, fixtures, live
integration, visual authoring or workspace execution was added.

The repository is initially private. Intended publisher `gmoddev` remains an
unverified Marketplace/Open VSX administrative gate. `private: true` and
`UNLICENSED` make this a development bootstrap, not a publishable extension.
Platform CI covers compiler/lint/bootstrap checks, not tooling pack qualification.
