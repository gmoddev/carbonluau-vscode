const Assert = require('node:assert/strict');
const {test: Test} = require('node:test');
const {setImmediate: SetImmediate} = require('node:timers');
const {Preview} = require('../dist/Preview');
const Pack = {ApiVersion: 'api', PackVersion: 'pack', Platform: 'win32-x64', PreviewQualified: true,
  ToolingBuildId: 'sha256:' + 'a'.repeat(64), SemanticRevision: 'b'.repeat(40)};
const Selection = {ProjectId: '0/', Viewport: {Width: 1920, Height: 1080}};
function Fixture() {
  const State = {Trusted: true, Starts: 0, Stops: 0, Failure: undefined, Hold: false, Pending: undefined, Mutate: Value => Value};
  const Instance = new Preview(Pack, () => State.Trusted, () => {}, () => {
    State.Starts++;
    return {Request: async (Method, Params, Digest) => {
      if (Method === 'initialize') return {PreviewPlanSchema: 1, Capabilities: ['PreviewExecution']};
      if (State.Failure) throw State.Failure;
      const Plan = {SchemaVersion: 1, ProjectRevision: Digest, ApiVersion: Pack.ApiVersion, PackVersion: Pack.PackVersion,
        SemanticRevision: Pack.SemanticRevision, ToolingBuildId: Pack.ToolingBuildId, ProjectId: Params.ProjectId,
        Entry: Params.Entry ?? 'init.luau', Viewport: Params.Viewport, Nodes: [], Clips: [], AvailableScreens: [], Accounting: {}, Screen: {Id: '1', Name: 'Screen'}};
      if (State.Hold) await new Promise(Resolve => {State.Pending = Resolve;});
      return State.Mutate(Plan);
    }, Stop: async () => {State.Stops++;}};
  });
  return {State, Instance};
}
Test('preview does not launch in Restricted Mode or on an unqualified pack', async () => {
  const {State, Instance} = Fixture(); State.Trusted = false;
  await Assert.rejects(Instance.Request({}, Selection), /Workspace Trust/); Assert.equal(State.Starts, 0);
  const Other = new Preview({...Pack, PreviewQualified: false}, () => true, () => {}, () => {throw new Error('launched');});
  await Assert.rejects(Other.Request({}, Selection), /unqualified/);
});
Test('preview stores a copied plan and clears it on every failure; next request succeeds', async () => {
  const {State, Instance} = Fixture();
  const Plan = await Instance.Request({}, Selection); Plan.Screen.Name = 'mutated';
  Assert.equal(Instance.GetState().Plan.Screen.Name, 'Screen');
  for (const Code of ['CompileError', 'RuntimeError', 'GuiError', 'PreviewCrash', 'PreviewDeadline', 'PreviewMemory', 'PreviewProtocol']) {
    State.Failure = Object.assign(new Error(Code), {Code});
    await Assert.rejects(Instance.Request({}, Selection)); Assert.equal(Instance.GetState().Plan, undefined);
    Assert.equal(Instance.GetState().Error.Code, Code);
    State.Failure = undefined; await Instance.Request({}, Selection);
  }
  Assert.equal(State.Starts, State.Stops);
});
Test('preview exact identities, stale replies and trust changes are rejected', async () => {
  const {State, Instance} = Fixture();
  for (const Field of ['SchemaVersion', 'ProjectRevision', 'ApiVersion', 'PackVersion', 'ToolingBuildId', 'SemanticRevision', 'ProjectId', 'Entry']) {
    State.Mutate = Plan => ({...Plan, [Field]: 'invalid'});
    await Assert.rejects(Instance.Request({}, Selection), /mismatch/); Assert.equal(Instance.GetState().Plan, undefined);
  }
  State.Mutate = Value => Value;
  await Assert.rejects(Instance.Request({}, {...Selection, ScreenId: '2'}), /mismatch/);
  Assert.equal(Instance.GetState().Plan, undefined);
  await Instance.Request({}, {...Selection, ScreenId: '1'});
  for (const Invalidate of [() => Instance.Invalidate(), () => {State.Trusted = false;}]) {
    State.Trusted = true; State.Hold = true;
    const Running = Instance.Request({}, Selection);
    await new Promise(Resolve => SetImmediate(Resolve));
    Invalidate(); State.Pending(); await Assert.rejects(Running, /stale|superseded/);
    Assert.equal(Instance.GetState().Plan, undefined);
  }
  State.Hold = false; State.Trusted = true; await Instance.Request({}, Selection);
});
Test('preview keeps reap failures latched and does not start another coordinator', async () => {
  let Starts = 0;
  const Instance = new Preview(Pack, () => true, () => {}, () => {
    Starts++; return {Request: async () => {throw new Error('worker failure');}, Stop: async () => {throw new Error('unreaped');}};
  });
  await Assert.rejects(Instance.Request({}, Selection), /unreaped/);
  await Assert.rejects(Instance.Request({}, Selection), /unreaped/); Assert.equal(Starts, 1);
});
