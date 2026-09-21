# CarbonLuau editor contribution entry point

Read README.md and docs/Architecture.md before editing. CarbonLuau owns all
canonical semantics; this repository owns editor integration only. Use PascalCase
for project-owned symbols; preserve required VS Code/JavaScript/JSON spellings.
Use CodexLock/apply_patch and isolate concurrent work. Do not introduce workspace
execution, server dependencies, unavailable commands or publishing in a bootstrap
task. Keep errors headless and logs in `[CarbonLuau:Subsystem]` form.

Run `npm ci` and `npm run check` for bootstrap changes. Later execution features
must add explicit Workspace Trust and process/security tests first.
