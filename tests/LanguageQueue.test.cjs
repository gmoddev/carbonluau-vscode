const Assert = require('node:assert/strict');
const { test: Test } = require('node:test');
const Module = require('node:module');
const Original = Module._load;
let Language;
try {
  Module._load = function (Name, ...Arguments) { return Name === 'vscode' ? {} : Original.call(this, Name, ...Arguments); };
  ({ Language } = require('../dist/Language'));
} finally { Module._load = Original; }

Test('queued snapshots cannot replay analysis after a preceding request fails', async () => {
  const Manager = Object.assign(Object.create(Language.prototype), {
    Tail: Promise.resolve(), Queued: 0, Failed: false,
    Diagnostics: { clear() {} }, Log() {}, Changed() {}
  });
  let Started = false;
  const Failure = Manager.Enqueue(async () => { throw new Error('Analysis deadline exceeded'); });
  const QueuedSnapshot = Manager.Enqueue(async () => { Started = true; });
  await Promise.all([Failure, QueuedSnapshot]);
  Assert.equal(Started, false);
  Assert.equal(Manager.Failed, true);
  Assert.equal(Manager.Queued, 0);
});
