/**
 * Story text for the fixed beats of the demo. Kept with the other content so
 * the voice of the game can be edited in one place.
 */
export const TEXT = {
  title: 'Fallowstar',
  subtitle: 'A patrol goes out before the snow.',
  intro: [
    'It is early autumn and the leaves are turning wrong: brown before they go gold, and all at once.',
    'The elders of Fallowstar Hold have a story about the makers who built the land, and the sealed doors they left behind in the wilds. Nobody living has seen one.',
    'Three guardmice are sent out to find a door before first snow, and to come home.',
    'Provisions are short. The country is unmapped. The season will not wait.',
  ],
  /** {bearing} is replaced with the compass direction to the door. */
  elders: 'The elders are sure of one thing: the door lies to the {bearing}, ten days\u2019 hard walking or more. Look for grey ground where nothing grows.',
  door: [
    'The ground changes underfoot. Grey slabs, too flat, too even, with no moss on them at all.',
    'Set into a bank of the same grey is a door. Not wood. Taller than ten mice standing on each other’s shoulders, with no handle, no hinge, and a single line of pale light running down its edge like frost.',
    'Peck puts a paw flat against it and pulls back as if stung. Something behind it is still running.',
    'You mark the place well. The hold must hear of this. Now: home, before the snow.',
  ],
  holdReturn:
    'The hold’s round door opens before you reach it. Warm bread, dry straw, and every pouch refilled. The patrol is whole again.',
  holdFirst: 'The hold. You have not left yet.',
  win: [
    'You see the chimneys first, then the beech, then the round door, and you are running.',
    'That night the elders listen to Peck describe the door three times over, and nobody tells her to stop.',
    'Tomorrow somebody will have to go back out, through whatever the winter leaves. But not tonight.',
  ],
  lossWinter: [
    'The first snow comes in the night, thick and quiet, and the way home is gone under it.',
    'The patrol digs in. Perhaps the thaw will find them. Perhaps it will not.',
  ],
  lossFallen: [
    'The last of the patrol goes down in the leaves, and the wilds close over the place.',
    'In the hold they wait a long time at the door.',
  ],
  lossStarved: [
    'The pouches have been empty too long. One morning the patrol does not get up.',
    'The hold will send another. The hold always does.',
  ],
  starving: 'The patrol goes hungry. Everyone is weaker for it.',
} as const;
