/*
 * Official Auto Amor Project Board - standard plug-and-play wall format.
 * Venues with pre-installed Auto Amor anchor arrays can hang these without
 * custom measurement or install verification.
 */
export const AUTO_AMOR_HEIGHT_CM = 24;
export const AUTO_AMOR_WIDTH_CM = 30;

export const SUBSTRATE_TIERS = ['custom', 'auto_amor_24x30'] as const;

export type SubstrateTier = (typeof SUBSTRATE_TIERS)[number];

export function isSubstrateTier(value: string): value is SubstrateTier {
	return (SUBSTRATE_TIERS as readonly string[]).includes(value);
}

export function isPlugAndPlayTier(tier: SubstrateTier | null | undefined): boolean {
	return tier === 'auto_amor_24x30';
}

export function resolveSubstrateTier(
	tier: string | null | undefined,
	heightCm?: number | null,
	widthCm?: number | null
): { substrate_tier: SubstrateTier; is_plug_and_play: boolean } {
	if (tier && isSubstrateTier(tier)) {
		return {
			substrate_tier: tier,
			is_plug_and_play: isPlugAndPlayTier(tier)
		};
	}

	/* Infer legacy rows that already match the official board footprint */
	if (Number(heightCm) === AUTO_AMOR_HEIGHT_CM && Number(widthCm) === AUTO_AMOR_WIDTH_CM) {
		return { substrate_tier: 'auto_amor_24x30', is_plug_and_play: true };
	}

	return { substrate_tier: 'custom', is_plug_and_play: false };
}
