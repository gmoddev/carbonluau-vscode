const Assert = require('node:assert/strict');
const { test: Test } = require('node:test');
const { GetCatalog } = require('../dist/Catalog');

Test('bounded canonical discovery rejects drift, writable members and duplicate identities', () => {
  const Members = Array.from({ length: 221 }, (_, Index) => ({ OwnerId: 'Item', Name: 'Test' + Index, ValueType: JSON.stringify('test.' + Index), Summary: 'Canonical fixture', Writable: false }));
  Members.push(...[1, 2].map(Index => ({ OwnerId: 'PrefabLoot', Name: 'Barrel' + Index, ValueType: JSON.stringify('fixtures/barrel' + Index), Summary: 'Canonical fixture', Writable: false })));
  const Value = { Catalog: { Api: { Version: '0.7.5-experimental' }, Members } };
  Assert.deepEqual(GetCatalog(Value, '0.4.0-experimental'), []);
  const Entries = GetCatalog(Value, '0.7.5-experimental');
  Assert.equal(Entries.length, 223); Assert.equal(Entries.filter(Entry => Entry.Value.includes('barrel')).length, 2);
  Members[0].Writable = true; Assert.throws(() => GetCatalog(Value, '0.7.5-experimental'), /Invalid/); Members[0].Writable = false;
  Members[0].ValueType = Members[1].ValueType; Assert.throws(() => GetCatalog(Value, '0.7.5-experimental'), /Duplicate/);
  Members.shift(); Assert.throws(() => GetCatalog(Value, '0.7.5-experimental'), /Incomplete/);
  Value.Catalog.Api.Version = 'unknown'; Assert.throws(() => GetCatalog(Value, '0.7.5-experimental'), /Incompatible/);
});
