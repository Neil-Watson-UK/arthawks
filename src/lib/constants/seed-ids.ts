/*
 * Phase-1 seed identities / artworks used for early demoware.
 * Keep out of public feeds when mock fallbacks are off.
 */
export const SEED_ARTIST_IDS = [
	'a0000000-0000-4000-8000-000000000001',
	'a0000000-0000-4000-8000-000000000002'
] as const;

export const SEED_VENUE_IDS = [
	'c0000000-0000-4000-8000-000000000001',
	'c0000000-0000-4000-8000-000000000002'
] as const;

export const SEED_BUYER_IDS = ['b0000000-0000-4000-8000-000000000099'] as const;

export const SEED_ARTWORK_IDS = [
	'b0000000-0000-4000-8000-000000000001',
	'b0000000-0000-4000-8000-000000000002',
	'b0000000-0000-4000-8000-000000000003',
	'b0000000-0000-4000-8000-000000000004',
	'b0000000-0000-4000-8000-000000000005'
] as const;

export const SEED_PROFILE_IDS = [
	...SEED_ARTIST_IDS,
	...SEED_VENUE_IDS,
	...SEED_BUYER_IDS
] as const;

export function isSeedArtworkId(id: string): boolean {
	return (SEED_ARTWORK_IDS as readonly string[]).includes(id);
}

export function isSeedArtistId(id: string): boolean {
	return (SEED_ARTIST_IDS as readonly string[]).includes(id);
}

export function isSeedVenueId(id: string): boolean {
	return (SEED_VENUE_IDS as readonly string[]).includes(id);
}

export function isSeedProfileId(id: string): boolean {
	return (SEED_PROFILE_IDS as readonly string[]).includes(id);
}
