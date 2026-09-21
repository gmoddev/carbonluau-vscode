// VS Code requires these exact lifecycle export names.
// Foundation A will add editor integration against the canonical tooling pack.
export function activate(): void {
  // Bootstrap intentionally has no workspace, process, network or server dependency.
}

export function deactivate(): void {
  // No resources are acquired by bootstrap activation.
}
