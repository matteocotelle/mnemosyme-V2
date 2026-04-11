/** Pre-defined seeds that generate diverse DiceBear "adventurer" avatars.
 *  Selected for maximum variety: skin tones, hair colors, accessories. */
export const AVATAR_SEEDS = [
	'Comet6',
	'Nova',
	'Nyx',
	'Atlas',
	'Star55',
	'Rex',
	'Pepper',
	'Silk',
	'Cloud11',
	'Miko',
	'Kai',
	'Juno',
] as const;

export type AvatarSeed = (typeof AVATAR_SEEDS)[number];
