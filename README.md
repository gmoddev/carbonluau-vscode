# CarbonLuau for VS Code

Development bootstrap for the official CarbonLuau editor integration. This is not
a usable language server, validator or GUI preview release. It registers `.luau`
and an inert lifecycle entry point; no workspace code or host process executes.

Canonical package/module/API/GUI semantics belong to
[gmoddev/CarbonLuau](https://github.com/gmoddev/CarbonLuau). Start with
[architecture routing](docs/Architecture.md) for the accepted baseline and phase plan.

The [language-analysis security decision](docs/Architecture.md#language-analysis-security-amendment)
now defines the Foundation A handoff: safe static features in Restricted Mode,
trusted-only supervised LSP analysis over snapshots, and no workspace executable
configuration/custom plugins. This documentation branch does not implement or
enable that profile; the partial Foundation A implementation remains isolated
and unqualified. Process separation is not a portable OS sandbox claim.

Use Node.js 22 LTS (Node 20.9+ satisfies the current compiler/linter requirements):

```text
npm ci
npm run check
```

Checks compile TypeScript, lint, validate the bootstrap manifest contract and invoke
activation/deactivation without host capabilities in both trust modes. These are
bootstrap checks, not VS Code E2E or platform tooling qualification.

No telemetry, no server dependency, no bundled tooling pack yet. Reserved commands
and settings are documented canonically and will appear only with working backends.
`gmoddev` in the extension manifest is the intended publisher namespace, not proof
of Marketplace/Open VSX registration. Publishing, licensing of a future release,
and platform qualification are Foundation E gates. No VSIX is produced here.
