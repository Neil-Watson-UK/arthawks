/**
 * Public directory + daily spotlight picks.
 * Order/picks are stable for a UTC calendar day (not reshuffled on refresh).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

export type DirectoryArtist = {
	id: string;
	username: string;
	full_name: string;
	medium: string | null;
	image_url: string | null;
	cover_image_url: string | null;
	work_count: number;
};

export type DailyArtist = {
	id: string;
	username: string;
	full_name: string;
	medium: string | null;
	bio: string | null;
	image_url: string | null;
	cover_image_url: string | null;
};

export type DailyVenue = {
	id: string;
	name: string;
	district: string | null;
	postcode: string | null;
	bio: string | null;
	image_url: string | null;
};

export type DailySpotlight = {
	dateKey: string;
	artist: DailyArtist | null;
	venue: DailyVenue | null;
};

/** UTC YYYY-MM-DD for stable daily seeds. */
export function utcDateKey(now = new Date()): string {
	return now.toISOString().slice(0, 10);
}

/** FNV-1a 32-bit hash → unsigned int. */
export function hashSeed(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Mulberry32 PRNG from a seed. */
function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let r = Math.imul(t ^ (t >>> 15), 1 | t);
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
}

export function shuffleDaily<T>(items: T[], seedKey: string): T[] {
	const out = [...items];
	const rand = mulberry32(hashSeed(seedKey));
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export function pickDaily<T>(items: T[], seedKey: string): T | null {
	if (items.length === 0) return null;
	const idx = hashSeed(seedKey) % items.length;
	return items[idx] ?? null;
}

type ArtworkCover = { artist_id: string; image_url: string };

async function artworkCoversByArtist(
	supabase: SupabaseClient<Database>,
	artistIds: string[]
): Promise<Map<string, { cover: string; count: number }>> {
	const map = new Map<string, { cover: string; count: number }>();
	if (artistIds.length === 0) return map;

	const { data, error } = await supabase
		.from('artworks')
		.select('artist_id, image_url, status, created_at')
		.in('artist_id', artistIds)
		.order('created_at', { ascending: false });

	if (error) {
		console.warn('daily-spotlight covers:', error.message);
		return map;
	}

	for (const row of (data ?? []) as ArtworkCover[]) {
		const prev = map.get(row.artist_id);
		if (!prev) {
			map.set(row.artist_id, { cover: row.image_url, count: 1 });
		} else {
			prev.count += 1;
		}
	}
	return map;
}

/**
 * Artists with at least one artwork, active artist profiles.
 */
export async function listDirectoryArtists(
	supabase: SupabaseClient<Database>,
	dateKey = utcDateKey()
): Promise<DirectoryArtist[]> {
	const { data: profiles, error } = await supabase
		.from('profiles')
		.select('id, username, full_name, medium, image_url, is_active')
		.eq('user_type', 'artist')
		.eq('is_active', true)
		.limit(500);

	if (error) {
		console.warn('directory artists:', error.message);
		return [];
	}

	const rows = (profiles ?? []).filter((p) => Boolean(p.full_name || p.username));
	const covers = await artworkCoversByArtist(
		supabase,
		rows.map((p) => p.id)
	);

	const eligible: DirectoryArtist[] = [];
	for (const p of rows) {
		const cover = covers.get(p.id);
		if (!cover || cover.count < 1) continue;
		eligible.push({
			id: p.id,
			username: p.username,
			full_name: p.full_name?.trim() || p.username,
			medium: p.medium,
			image_url: p.image_url,
			cover_image_url: cover.cover,
			work_count: cover.count
		});
	}

	return shuffleDaily(eligible, `artists:${dateKey}`);
}

async function eligibleSpotlightArtists(
	supabase: SupabaseClient<Database>
): Promise<DailyArtist[]> {
	const { data: profiles, error } = await supabase
		.from('profiles')
		.select('id, username, full_name, medium, bio, image_url, is_active')
		.eq('user_type', 'artist')
		.eq('is_active', true)
		.limit(500);

	if (error) {
		console.warn('spotlight artists:', error.message);
		return [];
	}

	const rows = profiles ?? [];
	const covers = await artworkCoversByArtist(
		supabase,
		rows.map((p) => p.id)
	);

	const out: DailyArtist[] = [];
	for (const p of rows) {
		const cover = covers.get(p.id);
		if (!cover) continue;
		out.push({
			id: p.id,
			username: p.username,
			full_name: p.full_name?.trim() || p.username,
			medium: p.medium,
			bio: p.bio,
			image_url: p.image_url,
			cover_image_url: cover.cover
		});
	}
	return out;
}

async function eligibleSpotlightVenues(
	supabase: SupabaseClient<Database>
): Promise<DailyVenue[]> {
	const withPartner = await supabase
		.from('venues')
		.select('id, name, district, postcode, bio, image_url')
		.eq('partner_status', 'active')
		.limit(300);

	if (!withPartner.error && withPartner.data) {
		return withPartner.data.map((v) => ({
			id: v.id,
			name: v.name,
			district: v.district,
			postcode: v.postcode,
			bio: v.bio,
			image_url: v.image_url
		}));
	}

	const legacy = await supabase
		.from('venues')
		.select('id, name, district, postcode, bio, image_url')
		.eq('is_active', true)
		.limit(300);

	if (legacy.error) {
		console.warn('spotlight venues:', legacy.error.message);
		return [];
	}

	return (legacy.data ?? []).map((v) => ({
		id: v.id,
		name: v.name,
		district: v.district,
		postcode: v.postcode,
		bio: v.bio,
		image_url: v.image_url
	}));
}

export async function loadDailySpotlight(
	supabase: SupabaseClient<Database>,
	now = new Date()
): Promise<DailySpotlight> {
	const dateKey = utcDateKey(now);
	const [artists, venues] = await Promise.all([
		eligibleSpotlightArtists(supabase),
		eligibleSpotlightVenues(supabase)
	]);

	const artist = pickDaily(artists, `artist-of-day:${dateKey}`);
	const venue = pickDaily(venues, `venue-of-day:${dateKey}`);

	return { dateKey, artist, venue };
}
