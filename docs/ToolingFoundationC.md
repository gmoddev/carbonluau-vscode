# Tooling Foundation C

Qualification record for the isolated `codex/tooling-foundation-c` branch.
Windows/Linux local qualification completed on 2026-09-21/22. The hosted CI
result and exact delivery revisions are recorded in the evidence follow-up.

## Delivery and reconciliation

1. **Verdict:** PASS for Windows/Linux local Foundation C gates; hosted CI pending
   implementation push. macOS execution remains deliberately unqualified.
2. **CarbonLuau:** started from origin/main
   `c37c36e0508a759c899dfdd4a1545cc923a88fc6`; fast-forward reconciliation finishes at
   `069387c0a56171808ef4be9725c766f2d8841008`. No Foundation C runtime edits.
3. **Extension start:** origin/main `85236a0b66b680bda46d94f0a3ed038253a193a7`.
4. **Foundation B reconciliation:** fast-forwarded the extension to
   `c93210ea692607ddd8d2ecb607753f8e30e4f7fa`; runtime to its evidence revision above.
   No conflicts, discarded changes, main resets or shared-checkout edits.
5. **C implementation/evidence commits:** this implementation commit contains
   the locally qualified source; exact hashes will be recorded in the evidence follow-up.
6. **Final tested extension revision:** the implementation commit containing this
   record, tested as the final isolated source snapshot before committing.

## Editor behavior

7. **Workflow:** Preview GUI resolves canonical Root/valid Addon projects, defaults
   to admitted init.luau, requests the B worker and opens one active-editor panel.
   Multiple projects use a picker; multiple screens use host-offered IDs.
8. **WebView architecture:** toolbar, paint surface, hierarchy/resources and
   inspector, responsive to narrower editors. Extension coordinates; WebView has
   no direct worker or filesystem access.
9. **Semantic boundary:** absolute emitted rectangles/order, supplied clip chains
   and resource values only. No retained layout, anchor, padding, Z or costs
   calculated in TypeScript. B schema/policy/pins remain authoritative.
10. **Viewport:** four requested presets and custom 1–8192 integer pixels; each
    change requests a new plan. Separate 25/50/75/100/150/200% display zoom.
11. **Refresh:** 400 ms debounce, fresh snapshot/worker, immediate stale-plan
    removal, revision/generation guards and cancellation; no VM hot reload.
12. **Hierarchy:** supplied ID/Children order; expandable, duplicate names,
    helpers and hidden nodes; arrow/Home/End/Enter/Space keyboard support.
13. **Selection:** hierarchy and painted objects share IDs; supplied projected
    rect highlight where visible. New plan selects its screen; no callbacks.
14. **Inspector:** identity, retained properties, projected output, layout-owner
    notice, clipping, paint/resources, fidelity and disabled Go to Source.
15. **Retained/projected:** separate sections; managed-child notice explicitly
    distinguishes authored Position/Size from canonical projected geometry.
16. **Resources:** emitted objects/elements/arranged children/clip counts and
    maxima, canonical byte estimate/scope; textual near/at-limit indications.
17. **Clipping:** Core clip-owner chains and rectangles become nested CSS clips.
    Only coordinate-system conversion occurs; legality/depth remain Core.
18. **Text/fonts:** literal text and alignment; canonical GuiFont retained,
    system sans/mono/bold fallback, approximate rasterization clearly identified.
19. **Images:** deterministic identity placeholders; None paints no pixels;
    no asset fetching or Rust/font-file access.
20. **Scrolling:** wheel/Shift-wheel and inspector offsets translate local paint
    layers within emitted content extents. Reset every plan; never CanvasPosition,
    ScrollTo semantics, server observation or callback execution.
21. **Fidelity:** plan metadata in inspector plus concise global approximation
    legend. Authenticated delivery, network reconciliation, actual click receipt
    and real client scroll are unavailable.
22. **Navigation:** disabled; Source=null in B. No guessed mapping/path message.
23. **Errors/console:** pending/errors remove old content; controlled code/message
    in status and operational Output. B has no structured source ranges or log
    stream; no inferred Problems ranges or fabricated console. Existing canonical
    project/type diagnostics retain their mapped Problems behavior.

## Qualification

24. **Security:** strict nonce CSP, packaged-only resource roots, textContent,
    path-free exact action schema, bounded plans/messages/DOM, closed failure.
    Unit hostile-input tests pass. Actual Windows/Linux WebViews reject network
    and eval probes with connect-src/script-src CSP violations; hostile GUI text
    stays literal. No workspace-controlled HTML or filesystem path messages.
25. **Trust:** Restricted Mode executes no preview; actual VS Code trust grant,
    revocation/reload and responsiveness tests retained. macOS remains unqualified.
26. **Performance:** measured below, including three complete save refreshes.
27. **Real VS Code E2E:** PASS on 1.95.3; actual installed worker, panel DOM,
    literal hostile text, CSP, synchronized/keyboard/helper selection, preset and
    custom viewport, display zoom, three saves, compile/deadline failure,
    recovery, 128 objects, Restricted Mode and trust revocation with preview open.
    No production test hooks; CDP exists only in the excluded test driver.
28. **Windows:** npm ci, build/lint, 47/47 tests with zero skips, actual VS Code
    restricted/reopen scenarios PASS on Node 22.17.0.
29. **Linux:** same 47/47 with zero skips and actual VS Code/Xvfb scenarios PASS;
    remote Docker runner constrained to two CPUs and 4 GiB.
30. **macOS:** static-only; CI build/lint/DOM/unit checks do not qualify execution.
31. **Foundation B regression:** PASS on both platforms with unchanged
    `3d0fce97ecc3aeb6f078f26c03b5328198d38fbe` pack payloads downloaded from
    [the successful canonical tooling run](https://github.com/gmoddev/CarbonLuau/actions/runs/35677995786).
    TestPreview.cjs repeated all 17 golden plans through fresh workers and checked
    exact plans, loop/heap/compile/runtime/unsupported-host failures and recovery,
    forbidden capabilities, module policy, screen selection, trust and identity.
    The 47-test extension suite also exercises the real analysis supervisor and
    its native resource controls. No Core/production semantics changed.
32. **CI:** pending implementation push after all applicable local gates.
33. **Documentation:** README workflow and Architecture boundary/protocol updated.
34. **ToolingPreviewPlan:** no schema, Core, runtime, metadata or pack-pin changes.
35. **D handoff:** retain ProjectManager -> Preview -> bounded B worker -> plan
    seam and independent read-only Renderer. Future mock fixture/interaction
    requests require their own scoped protocol/trust decision; no authority is
    implied by selection or local scroll.
36. **Exclusions:** no mocks, Activated callbacks, production tokens, TextBox,
    live server, debugger, authoring, source rewriting, stateful reload or VSIX
    publication.
37. **Branch/worktrees:** isolated CarbonLuau-tooling-c and carbonluau-vscode-c;
    main and other-agent/B worktrees preserved. Both remote mains were rechecked
    before committing and still matched the starting hashes. The runtime branch
    has no C changes; only the extension C branch needs a new implementation push.

## Observed editor performance

| Observation | Windows | Linux (2 CPUs, Docker bind storage) |
|---|---:|---:|
| Initial command through rendered/inspected panel | 1.343 s | 3.810 s |
| Initial five-node paint DOM construction | 0.5 ms | 0.5 ms |
| Initial hierarchy construction | 0.1 ms | 0.3 ms |
| 128-node paint DOM construction | 1.4 ms | 1.2 ms |
| 128-node hierarchy construction | 1.2 ms | 1.2 ms |
| Selection + inspector update | 0.5 ms | 0.8 ms |
| Preset change through fresh plan | 1.336 s | 3.365 s |
| Custom viewport through fresh plan | 1.328 s | 3.372 s |
| Three source-save refreshes | 1.228–1.520 s | 3.523–3.594 s |

DOM timings are synchronous browser construction measurements, not GPU frame
times. Workflow timings include 400 ms debounce, fresh worker startup, CDP
polling and, for the initial panel, security/selection inspection. These are
observations on the qualification worker, not latency guarantees. The simple
bounded renderer did not require a virtual DOM or incremental layout engine.
Both platform screenshots were visually reviewed for legibility and layout;
pixel fidelity was never a correctness oracle.

The first test iterations corrected two test defects: VS Code's injected
bootstrap scripts were mistakenly counted as GUI markup, and a 128-object test
initially violated the canonical per-parent child limit. The final tests scope
injection assertions to GUI-controlled DOM and use a valid two-parent fixture.
No canonical limit or security requirement was relaxed.

## Evidence method

Renderer tests consume the canonical B golden corpus from the pinned checkout;
they check CSS rectangles/ordering/clips, text/fonts/images, hierarchy,
selection, inspector and resources, including all 17 fixtures. They compare
semantic output, never screenshot pixels. Screenshots only review panel UX.
Browser timing observations are informational, not cross-machine performance
guarantees. Native process/VM/trust qualifications retain their B limitations;
no portable OS filesystem/network sandbox or pixel-perfect Rust emulation is
claimed.
