# Decisions

Choices made where the brief left things open, with the reasoning, so they can be revisited. Numbers quoted here are the ones in `src/content/balance.ts` and the content files at the time of writing; the files are the source of truth.

## World and map

- **Half-days as the time unit.** The clock counts half-days; a day is two. Meadow costs a half-day to enter, woodland, hills, ford and ruin a full day, bramble and marsh a day and a half. Half-days make foraging (half a day) a real trade against moving, without the clock becoming fiddly.
- **Rivers are impassable except at fords.** A river is a barrier that shapes routes rather than a costly hex. Fords appear every three to five hexes along it. Reachability of the door is checked after the river is carved, and generation retries with a sub-seed if the layout fails.
- **Terrain by percentile, not fixed thresholds.** Elevation, moisture and a thorn field are value noise sampled at hex centres; terrain is classified by percentile cut-offs so every seed has similar proportions, then smoothed twice to remove specks. Roughly a fifth of the map is hills, a tenth marsh, a quarter woodland and bramble together, the rest meadow.
- **Door placement by walking cost as well as distance.** The door sits ten to thirteen hexes from the hold and sixteen to twenty-one half-days away by the cheapest route. The cost band is what keeps seeds similarly hard; the distance band keeps the search a ring rather than a corridor.
- **The elders give a bearing.** Without a hint the door search would be a sweep of a few hundred hexes. The intro and HUD give an eight-point compass bearing from hold to door, which narrows the search to a wedge. The door's exact distance is not given.
- **Hills spot the ruins.** Standing on hills within five hexes of the door charts the door and its ruin cluster. This makes high ground worth climbing for more than its sight radius, and gives the search a satisfying "there, the grey" moment.
- **Fog has no line of sight.** Sight is a plain radius by terrain of the hex you stand on (hills 3, meadow and marsh 2, woodland and bramble 1). Blocking by terrain is a later refinement.
- **Ruin is its own terrain.** Grey, cold, no forage, low encounters. The door hex and about half its neighbours are ruin, so the cold reads on the map before the dialog does. The door hex carries nothing else special, so "enter" can be added as an action later without touching map generation.

## Provisions

- **One ration per mouse per day, three a day for the patrol.** Start with twenty-seven, carry at most forty. The hold refills to the maximum.
- **Foraging yields by terrain.** Woodland is the best ground (four to seven), bramble next, meadow decent, hills and marsh poor. On poor ground foraging returns less than the patrol eats in the time it takes, which is deliberate: the answer to hunger in the hills is to walk somewhere green.
- **Starvation is damage, not an instant loss.** A day without food costs every mouse a fifth of their maximum HP and marks them hungry (attack reduced by a quarter, no mending while camping). A fed day clears it. If starvation puts every mouse down, the run ends as "starved".
- **Foraging can be interrupted.** Rummaging rolls the terrain's encounter table at half the usual chance.

## Battle

- **Round-based with full-round commands.** The player enters one command per standing mouse, then the round resolves in speed order with a random tiebreak. This is the Phantasy Star rhythm and keeps the UI simple on a phone.
- **Flee is a party decision.** Any mouse choosing Flee makes the whole patrol run. Success is a base chance plus the enemy's flee modifier and the speed difference. Failure costs the patrol its turn. A smoke pod always works. The snake has a high flee modifier because the point of the snake is to run from it.
- **Downed mice get up after a battle.** With 1 HP. A wipe is a loss; anything short of one is a scare. Permanent death would need a hold-based revival loop the demo does not have.
- **Techniques for everyone, flavoured by trade.** The tinker's Spark, Arc and Ward are salvaged old-builder devices; the healer's Mend and Salve are herbcraft; the pathfinder's Lunge is just a good thrust. All cost TP. TP comes back at the hold, a little when camping, from honeycomb, and on level-up.
- **Defend halves damage.** A useful fallback for mice with no TP, and a cheap way to survive a bad round.
- **Experience is shared.** Every standing mouse gets the battle's full XP. Thresholds are 28 and 70 for levels two and three; a typical run has four to six battles and reaches level two, sometimes three.

## Landmarks

Five kinds, seven placed per map, each kind at least once if terrain allows: an abandoned burrow (full rest, repeatable), a standing stone (charts four hexes around it), a hazel grove (eight rations), a builder relay (two honeycomb), a clear spring (two poultices). The first visit to a landmark is safe from encounters; later visits are not.

## Win, loss and the hold

- Returning to the hold with the door found wins immediately. Days to spare is shown on the end screen.
- Winter arrives when the thirty-fourth day ends. Being anywhere, including the hold, without the door found is a loss.
- Returning to the hold without the door restores and restocks the patrol and counts a sortie. The clock does not stop.

## Presentation

- **Canvas for the map and battle scene, DOM for menus.** The brief asked for canvas 2D and no UI framework; plain DOM buttons are the simplest way to get large, accessible tap targets, so menus and dialogs are HTML and the drawn worlds are canvas.
- **Pointy-top hexes, odd-r offset for layout.** Axial coordinates everywhere else.
- **Placeholder art is drawn, not loaded.** Terrain glyphs, landmarks, the patrol token and the six enemies are canvas primitives with per-hex deterministic jitter. No external assets.
- **Autosave on every action.** There is one save slot, keyed by version. Loading a save in battle resumes the battle.

## Balance method

`src/sim/bots.ts` holds two scripted players that see only what a player sees (charted hexes, the party sheet, the bearing). The careful one forages ahead of need, camps when hurt, flees snakes and turns for home with time in hand; the careless one marches, fights everything and forages only when the pouches are empty. Over eighty seeds at the current numbers the careful bot wins about four runs in five with a median of around eight days to spare, and the careless bot wins about one in ten, mostly starving. `npm run sim` prints the report.

## Not in this pass

- Line-of-sight fog, weather, and the seasons visibly worsening on the map.
- Entering the door. The ruins are the hook for the first-person dungeons; the door hex and the ruin terrain are in place for it.
- Enemy abilities beyond a plain attack, status effects, equipment.
- Multiple save slots, cloud sync, sound.
