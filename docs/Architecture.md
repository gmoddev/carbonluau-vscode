# Architecture routing

The canonical owner is CarbonLuau D19. This repository must not duplicate its
package parser, module visibility, GUI geometry, clipping or resource accounting.

- [Contributor entry](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/AICONTEXT.md)
- [Tooling baseline](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingBaseline.md)
- [Contract models](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingContracts.md)
- [Foundation A plan and phase routing](https://github.com/gmoddev/CarbonLuau/blob/33f9c75c62759cc093e06477b25b2fe05f0f03e5/docs/ToolingFoundationA.md)

Links pin the isolated adoption commit while another task works on runtime main;
follow canonical main after that change is integrated. No semantic source is
copied here. `extension/Extension.ts` is the only runtime entry in this bootstrap.
