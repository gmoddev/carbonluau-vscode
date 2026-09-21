const Assert = require('node:assert/strict');
const { test: Test } = require('node:test');
const { FrameReader, Revision } = require('../dist/ToolingClient');

Test('bounded framing preserves UTF-8 across arbitrary transport chunks', () => {
  const Reader = new FrameReader();
  const Value = { Text: 'é😀' };
  const Body = Buffer.from(JSON.stringify(Value));
  const Frame = Buffer.concat([Buffer.from(`Content-Length: ${Body.length}\r\n\r\n`), Body]);
  const Results = [];
  for (const Byte of Frame) Results.push(...Reader.Push(Buffer.from([Byte])));
  Assert.deepEqual(Results, [Value]);
  Assert.throws(() => new FrameReader().Push(Buffer.from('Content-Length: 8388609\r\n\r\n')));
  Assert.throws(() => new FrameReader().Push(Buffer.from('x'.repeat(4097))));
  Assert.throws(() => new FrameReader().Push(Buffer.from('Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}')));
  for (const Text of ['{"Id":1,"Id":2}', '['.repeat(33) + '0' + ']'.repeat(33)]) {
    Assert.throws(() => new FrameReader().Push(Buffer.from(`Content-Length: ${Buffer.byteLength(Text)}\r\n\r\n${Text}`)));
  }
});

Test('snapshot revision is stable across property order and changes with content/API/pack', () => {
  Assert.equal(Revision({ B: 2, A: 1 }, 'a', 'p'), Revision({ A: 1, B: 2 }, 'a', 'p'));
  Assert.notEqual(Revision({ A: 1 }, 'a', 'p'), Revision({ A: 2 }, 'a', 'p'));
  Assert.notEqual(Revision({}, 'a', 'p'), Revision({}, 'b', 'p'));
  Assert.notEqual(Revision({}, 'a', 'p'), Revision({}, 'a', 'q'));
});
