import type { ItemId } from '../sim/types';

export interface ItemDef {
  id: ItemId;
  name: string;
  plural: string;
  effect: 'heal' | 'tp' | 'flee';
  power: number;
  /** Can it be used on the overworld as well as in battle? */
  overworld: boolean;
  description: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  poultice: {
    id: 'poultice',
    name: 'Poultice',
    plural: 'Poultices',
    effect: 'heal',
    power: 16,
    overworld: true,
    description: 'Moss and crushed plantain in a leaf wrap. Heals one mouse.',
  },
  smokepod: {
    id: 'smokepod',
    name: 'Smoke Pod',
    plural: 'Smoke Pods',
    effect: 'flee',
    power: 1,
    overworld: false,
    description: 'A dried puffball packed with soot. Burst it and run. Guaranteed escape.',
  },
  honeycomb: {
    id: 'honeycomb',
    name: 'Honeycomb',
    plural: 'Honeycomb',
    effect: 'tp',
    power: 10,
    overworld: true,
    description: 'A sticky square of wild comb. Restores a mouse’s strength for techniques.',
  },
};

export const ITEM_LIST: ItemDef[] = Object.values(ITEMS);
