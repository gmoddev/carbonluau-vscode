// Editor discovery consumes canonical generated API metadata, never a second item list.
export interface CatalogEntry { Name: string; Value: string; Summary: string }

export function GetCatalog(Value: unknown, ApiVersion: string): CatalogEntry[] {
  if (ApiVersion !== '0.7.5-experimental') return [];
  const Catalog = (Value as { Catalog: { Api: { Version: string }; Members: { OwnerId: string; Name: string; ValueType?: string; Summary: string; Writable?: boolean }[] } }).Catalog;
  if (Catalog.Api.Version !== ApiVersion || !Array.isArray(Catalog.Members) || Catalog.Members.length > 8192) throw new Error('Incompatible catalog metadata.');
  const Entries: CatalogEntry[] = [], Names = new Set<string>(), Values = new Set<string>();
  let Items = 0, Prefabs = 0;
  for (const Member of Catalog.Members) {
    if (Member.OwnerId !== 'Item' && Member.OwnerId !== 'PrefabLoot') continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(Member.Name) || typeof Member.ValueType !== 'string' || Member.ValueType.length > 512 ||
        typeof Member.Summary !== 'string' || Member.Summary.length > 4096 || Member.Writable !== false) throw new Error('Invalid catalog member.');
    const Canonical: unknown = JSON.parse(Member.ValueType);
    if (typeof Canonical !== 'string' || !/^[a-zA-Z0-9_./-]{1,256}$/.test(Canonical)) throw new Error('Invalid catalog literal.');
    const Name = (Member.OwnerId === 'Item' ? 'Item.' : 'Prefab.Loot.') + Member.Name;
    if (Names.has(Name) || Values.has(Canonical)) throw new Error('Duplicate catalog identity.');
    Names.add(Name); Values.add(Canonical);
    Entries.push({ Name, Value: Canonical, Summary: Member.Summary });
    if (Member.OwnerId === 'Item') ++Items; else ++Prefabs;
  }
  if (Items !== 221 || Prefabs !== 2) throw new Error('Incomplete qualified catalog.');
  return Entries.sort((Left, Right) => Left.Name < Right.Name ? -1 : Left.Name > Right.Name ? 1 : 0);
}
