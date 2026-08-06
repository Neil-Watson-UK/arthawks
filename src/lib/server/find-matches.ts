import { isArtStyle, type ArtStyle, formatArtStyle } from '$lib/constants/art-styles';
import { isSeedArtworkId, isSeedArtistId, isSeedVenueId } from '$lib/constants/seed-ids';
import { parseGeographicLocation } from '$lib/server/geo-parse';
import { placementForHang } from '$lib/scheduling';
import type { Database } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type FindWork = {
	id: string;
	title: string;
	image_url: string;
	style: string | null;
	style_label: string | null;
	price_pence: number;
	artist_id: string;
	artist_name: string;
	artist_username: string | null;
	venue_id: string | null;
	venue_name: string | null;
	placement: 'showing' | 'transit' | 'studio' | 'available';
	score: number;
};

export type FindRoom = {
	venue_id: string;
	venue_name: string;
	venue_username: string;
	bio: string | null;
	image_url: string | null;
	location: string | null;
	opening_hours: string | null;
	lat: number | null;
	lng: number | null;
	matching_styles: string[];
	showing_count: number;
	sample_works: { id: string; title: string; image_url: string }[];
	score: number;
};

export type FindArtist = {
	id: string;
	username: string;
	full_name: string;
	bio: string | null;
	image_url: string | null;
	medium: string | null;
	matching_styles: string[];
	work_count: number;
	sample_works: { id: string; title: string; image_url: string }[];
	score: number;
};

export type FindResults = {
	styles: ArtStyle[];
	works: FindWork[];
	rooms: FindRoom[];
	artists: FindArtist[];
	empty: boolean;
};

function parseStylesParam(raw: string | null): ArtStyle[] {
	if (!raw) return [];
	return [
		...new Set(
			raw
				.split(',')
				.map((value) => value.trim().toLowerCase())
				.filter(isArtStyle)
		)
	];
}

export function resolveFindStyles(input: {
	queryStyles?: string | null;
	cookieStyles?: string | null;
}): ArtStyle[] {
	const fromQuery = parseStylesParam(input.queryStyles ?? null);
	if (fromQuery.length > 0) return fromQuery;
	return parseStylesParam(input.cookieStyles ?? null);
}

/**
 * Match live catalogue / rooms / artists to gateway taste styles.
 * Prefer works currently showing; include available studio works as secondary.
 */
export async function loadFindMatches(
	supabase: SupabaseClient<Database>,
	styles: ArtStyle[]
): Promise<FindResults> {
	if (styles.length === 0) {
		return { styles: [], works: [], rooms: [], artists: [], empty: true };
	}

	const styleSet = new Set(styles);

	type ArtworkRow = {
		id: string;
		title: string;
		image_url: string;
		description: string | null;
		style: string | null;
		price_pence: number;
		status: string;
		artist_id: string;
		created_at: string;
	};

	let artworks: ArtworkRow[] = [];
	{
		const withStyle = await supabase
			.from('artworks')
			.select('id, title, image_url, description, style, price_pence, status, artist_id, created_at')
			.in('status', ['available', 'matched'])
			.order('created_at', { ascending: false })
			.limit(200);

		if (withStyle.error?.code === '42703') {
			const legacy = await supabase
				.from('artworks')
				.select('id, title, image_url, description, price_pence, status, artist_id, created_at')
				.in('status', ['available', 'matched'])
				.order('created_at', { ascending: false })
				.limit(200);
			if (legacy.error) throw new Error(legacy.error.message);
			artworks = (legacy.data ?? []).map((row) => ({ ...row, style: null }));
		} else if (withStyle.error) {
			throw new Error(withStyle.error.message);
		} else {
			artworks = (withStyle.data ?? []) as ArtworkRow[];
		}
	}

	const matchedArtworks = artworks.filter(
		(row) =>
			row.style &&
			isArtStyle(row.style) &&
			styleSet.has(row.style) &&
			!isSeedArtworkId(row.id) &&
			!isSeedArtistId(row.artist_id)
	);
	/* Strict taste match - empty results beat a misleading generic dump */
	const pool = matchedArtworks;

	const artworkIds = pool.map((row) => row.id);
	const artistIds = [...new Set(pool.map((row) => row.artist_id))];

	const hangByArtwork = new Map<
		string,
		{
			venue_id: string;
			status: string;
			approved_at: string | null;
			hung_at: string | null;
			starts_on: string | null;
			ends_on: string | null;
		}
	>();

	if (artworkIds.length > 0) {
		const withHung = await supabase
			.from('matches')
			.select('artwork_id, venue_id, status, approved_at, hung_at, starts_on, ends_on')
			.in('artwork_id', artworkIds)
			.in('status', ['pending', 'accepted']);

		let matchRows: {
			artwork_id: string;
			venue_id: string;
			status: string;
			approved_at: string | null;
			hung_at: string | null;
			starts_on: string | null;
			ends_on: string | null;
		}[] = [];

		if (withHung.error?.code === '42703') {
			const legacy = await supabase
				.from('matches')
				.select('artwork_id, venue_id, status, approved_at, starts_on, ends_on')
				.in('artwork_id', artworkIds)
				.in('status', ['pending', 'accepted']);
			if (legacy.error) throw new Error(legacy.error.message);
			matchRows = (legacy.data ?? []).map((row) => ({ ...row, hung_at: row.approved_at }));
		} else if (withHung.error) {
			throw new Error(withHung.error.message);
		} else {
			matchRows = (withHung.data ?? []).map((row) => ({
				...row,
				hung_at: row.hung_at ?? null
			}));
		}

		const ranked = [...matchRows].sort((a, b) => {
			const rank = (row: typeof a) => (placementForHang(row) === 'showing' ? 0 : 1);
			return rank(a) - rank(b);
		});
		for (const row of ranked) {
			if (!hangByArtwork.has(row.artwork_id)) hangByArtwork.set(row.artwork_id, row);
		}
	}

	const venueIds = [...new Set([...hangByArtwork.values()].map((row) => row.venue_id))];

	const artistById = new Map<
		string,
		{
			id: string;
			username: string;
			full_name: string | null;
			bio: string | null;
			image_url: string | null;
			medium: string | null;
			is_active: boolean | null;
		}
	>();

	if (artistIds.length > 0) {
		const { data: artists, error: artistError } = await supabase
			.from('profiles')
			.select('id, username, full_name, bio, image_url, medium, is_active, user_type')
			.in('id', artistIds)
			.eq('user_type', 'artist');
		if (artistError) throw new Error(artistError.message);
		for (const row of artists ?? []) {
			if (row.is_active === false) continue;
			if (isSeedArtistId(row.id)) continue;
			artistById.set(row.id, row);
		}
	}

	const venueById = new Map<
		string,
		{
			id: string;
			name: string;
			slug: string;
			bio: string | null;
			image_url: string | null;
			district: string | null;
			opening_hours: string | null;
			geographic_location: string | null;
			aesthetic_tags: string[] | null;
		}
	>();

	if (venueIds.length > 0) {
		const withHours = await supabase
			.from('venues')
			.select(
				'id, name, slug, bio, image_url, district, opening_hours, geographic_location, aesthetic_tags, is_active'
			)
			.in('id', venueIds)
			.eq('is_active', true);

		if (withHours.error?.code === '42703' || withHours.error?.code === '42P01') {
			const { data: profiles } = await supabase
				.from('profiles')
				.select('id, username, full_name, bio, image_url, district, geographic_location, is_active')
				.in('id', venueIds)
				.eq('user_type', 'venue');
			for (const row of profiles ?? []) {
				if (row.is_active === false) continue;
				venueById.set(row.id, {
					id: row.id,
					name: row.full_name ?? row.username,
					slug: row.username,
					bio: row.bio,
					image_url: row.image_url,
					district: row.district,
					opening_hours: null,
					geographic_location: row.geographic_location,
					aesthetic_tags: null
				});
			}
		} else if (withHours.error) {
			throw new Error(withHours.error.message);
		} else {
			for (const row of withHours.data ?? []) {
				if (isSeedVenueId(row.id)) continue;
				venueById.set(row.id, {
					id: row.id,
					name: row.name,
					slug: row.slug,
					bio: row.bio,
					image_url: row.image_url,
					district: row.district,
					opening_hours: row.opening_hours ?? null,
					geographic_location: row.geographic_location,
					aesthetic_tags: row.aesthetic_tags ?? null
				});
			}
		}
	}

	/* Also surface active venues whose aesthetic tags overlap taste, even without a hang yet */
	{
		const { data: taggedVenues, error: taggedError } = await supabase
			.from('venues')
			.select(
				'id, name, slug, bio, image_url, district, opening_hours, geographic_location, aesthetic_tags, is_active'
			)
			.eq('is_active', true)
			.limit(80);

		if (!taggedError && taggedVenues) {
			for (const row of taggedVenues) {
				if (isSeedVenueId(row.id)) continue;
				if (venueById.has(row.id)) continue;
				const tags = (row.aesthetic_tags ?? []).map((tag) => tag.toLowerCase());
				const overlap = styles.filter(
					(style) => tags.includes(style) || tags.some((tag) => tag.includes(style))
				);
				if (overlap.length === 0) continue;
				venueById.set(row.id, {
					id: row.id,
					name: row.name,
					slug: row.slug,
					bio: row.bio,
					image_url: row.image_url,
					district: row.district,
					opening_hours: row.opening_hours ?? null,
					geographic_location: row.geographic_location,
					aesthetic_tags: row.aesthetic_tags ?? null
				});
			}
		}
	}

	const works: FindWork[] = pool
		.filter((row) => artistById.has(row.artist_id))
		.map((row) => {
			const artist = artistById.get(row.artist_id)!;
			const hang = hangByArtwork.get(row.id) ?? null;
			const venue = hang ? venueById.get(hang.venue_id) : null;
			const placement = hang
				? placementForHang(hang) === 'showing'
					? ('showing' as const)
					: ('transit' as const)
				: row.status === 'available'
					? ('available' as const)
					: ('studio' as const);

			let score = 0;
			if (row.style && isArtStyle(row.style) && styleSet.has(row.style)) score += 100;
			if (placement === 'showing') score += 80;
			if (placement === 'transit') score += 30;
			if (placement === 'available') score += 10;

			return {
				id: row.id,
				title: row.title,
				image_url: row.image_url || '',
				style: row.style,
				style_label: row.style ? formatArtStyle(row.style) : null,
				price_pence: row.price_pence,
				artist_id: row.artist_id,
				artist_name: artist.full_name ?? artist.username,
				artist_username: artist.username,
				venue_id: venue?.id ?? hang?.venue_id ?? null,
				venue_name: venue?.name ?? null,
				placement,
				score
			};
		})
		.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
		.slice(0, 24);

	const roomBuckets = new Map<string, FindRoom>();
	for (const work of works) {
		if (!work.venue_id) continue;
		const venue = venueById.get(work.venue_id);
		if (!venue) continue;

		const tags = (venue.aesthetic_tags ?? []).map((tag) => tag.toLowerCase());
		const matching_styles = [
			...new Set([
				...styles.filter(
					(style) => tags.includes(style) || tags.some((tag) => tag.includes(style))
				),
				...(work.style && isArtStyle(work.style) && styleSet.has(work.style)
					? [work.style]
					: [])
			])
		].map((style) => formatArtStyle(style));

		const geo = parseGeographicLocation(venue.geographic_location);
		const existing = roomBuckets.get(venue.id);
		if (!existing) {
			roomBuckets.set(venue.id, {
				venue_id: venue.id,
				venue_name: venue.name,
				venue_username: venue.slug,
				bio: venue.bio,
				image_url: venue.image_url,
				location: venue.district
					? `${venue.district.replace(/_/g, ' ')}, Bristol`
					: null,
				opening_hours: venue.opening_hours,
				lat: geo?.lat ?? null,
				lng: geo?.lng ?? null,
				matching_styles,
				showing_count: work.placement === 'showing' ? 1 : 0,
				sample_works: work.image_url
					? [{ id: work.id, title: work.title, image_url: work.image_url }]
					: [],
				score: work.score + (work.placement === 'showing' ? 40 : 0)
			});
		} else {
			existing.score += work.score;
			if (work.placement === 'showing') existing.showing_count += 1;
			if (existing.sample_works.length < 3 && work.image_url) {
				existing.sample_works.push({
					id: work.id,
					title: work.title,
					image_url: work.image_url
				});
			}
			existing.matching_styles = [...new Set([...existing.matching_styles, ...matching_styles])];
		}
	}

	/* Venues with aesthetic overlap but no matched works yet */
	for (const venue of venueById.values()) {
		if (roomBuckets.has(venue.id)) continue;
		const tags = (venue.aesthetic_tags ?? []).map((tag) => tag.toLowerCase());
		const overlap = styles.filter(
			(style) => tags.includes(style) || tags.some((tag) => tag.includes(style))
		);
		if (overlap.length === 0) continue;
		const geo = parseGeographicLocation(venue.geographic_location);
		roomBuckets.set(venue.id, {
			venue_id: venue.id,
			venue_name: venue.name,
			venue_username: venue.slug,
			bio: venue.bio,
			image_url: venue.image_url,
			location: venue.district ? `${venue.district.replace(/_/g, ' ')}, Bristol` : null,
			opening_hours: venue.opening_hours,
			lat: geo?.lat ?? null,
			lng: geo?.lng ?? null,
			matching_styles: overlap.map((style) => formatArtStyle(style)),
			showing_count: 0,
			sample_works: [],
			score: 20 * overlap.length
		});
	}

	const rooms = [...roomBuckets.values()]
		.sort((a, b) => b.score - a.score || a.venue_name.localeCompare(b.venue_name))
		.reduce<FindRoom[]>((acc, room) => {
			const key = room.venue_name.trim().toLowerCase();
			const priorIdx = acc.findIndex((row) => row.venue_name.trim().toLowerCase() === key);
			if (priorIdx === -1) {
				acc.push(room);
				return acc;
			}
			if (room.score > acc[priorIdx].score || room.showing_count > acc[priorIdx].showing_count) {
				acc[priorIdx] = room;
			}
			return acc;
		}, [])
		.slice(0, 12);

	const artistBuckets = new Map<string, FindArtist>();
	for (const work of works) {
		const artist = artistById.get(work.artist_id);
		if (!artist) continue;
		const existing = artistBuckets.get(artist.id);
		const styleLabel =
			work.style && isArtStyle(work.style) && styleSet.has(work.style)
				? formatArtStyle(work.style)
				: null;

		if (!existing) {
			artistBuckets.set(artist.id, {
				id: artist.id,
				username: artist.username,
				full_name: artist.full_name ?? artist.username,
				bio: artist.bio,
				image_url: artist.image_url,
				medium: artist.medium,
				matching_styles: styleLabel ? [styleLabel] : [],
				work_count: 1,
				sample_works: work.image_url
					? [{ id: work.id, title: work.title, image_url: work.image_url }]
					: [],
				score: work.score
			});
		} else {
			existing.work_count += 1;
			existing.score += work.score;
			if (styleLabel) {
				existing.matching_styles = [...new Set([...existing.matching_styles, styleLabel])];
			}
			if (existing.sample_works.length < 3 && work.image_url) {
				existing.sample_works.push({
					id: work.id,
					title: work.title,
					image_url: work.image_url
				});
			}
		}
	}

	const artists = [...artistBuckets.values()]
		.sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name))
		.slice(0, 12);

	return {
		styles,
		works,
		rooms,
		artists,
		empty: works.length === 0 && rooms.length === 0 && artists.length === 0
	};
}
