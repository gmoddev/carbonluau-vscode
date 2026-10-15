-- Development API 0.7.5-experimental; requires the qualified server Loot adapter.
local Loot = game:GetService("Loot")
Loot:RegisterDropRule(Prefab.Loot.Barrel1, Enum.DropMode.Replace, {
    { Item = Item.Scrap, Min = 5, Max = 12 },
    { Item = Item.MetalFragments, Min = 10, Max = 25 },
})
Loot:RegisterDropRule(Prefab.Loot.Barrel2, Enum.DropMode.Replace, {
    { Item = Item.Wood, Min = 50, Max = 100 },
})
