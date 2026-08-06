import {
	artworkImageUrl,
	getArtistById,
	mockArtistProfiles,
	mockArtworkListings
} from '$lib/data/mock-artists';
import { formatArtStyle, isArtStyle } from '$lib/constants/art-styles';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import { placementForHang } from '$lib/scheduling';
import { getSimulatedUserById } from '$lib/data/simulated-users';
import type { Database } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ArtistPageWork {
	id: string;
	title: string;
	image_url: string;
	style: string | null;
	description: string | null;
	placement: 'showing' | 'transit' | 'studio' | 'sold';
	venue_id: string | null;
	venue_name: string | null;
}

export interface ArtistPage {
	id: string;
	username: string;
	full_name: string;
	bio: string | null;
	medium: string | null;
	website: string | null;
	instagram: string | null;
	image_url: string | null;
	location: string | null;
	works: ArtistPageWork[];
	on_walls_count: number;
}

function resolveStyleLabel(artworkId: string, style: string | null | undefined): string | null {
	if (style && isArtStyle(style)) return formatArtStyle(style);
	if (!mockFallbacksAllowed()) return null;
	const seed = mockArtworkListings.find((row) => row.id === artworkId);
	return seed?.style ? formatArtStyle(seed.style) : null;
}

function mockArtistPage(param: string): ArtistPage | null {
	if (!mockFallbacksAllowed()) return null;

	const profile =
		mockArtistProfiles.find(
			(row) =>
				row.username.toLowerCase() === param.toLowerCase() ||
				row.id === param
		) ?? null;
	if (!profile) return null;

	const simulated = getSimulatedUserById(profile.id);
	const artworks = mockArtworkListings.filter((row) => row.artist_id === profile.id);

	const works: ArtistPageWork[] = artworks.map((artwork) => ({
		id: artwork.id,
		title: artwork.title,
		image_url: artworkImageUrl(artwork.image_filename),
		style: artwork.style ? formatArtStyle(artwork.style) : null,
		description: artwork.description ?? null,
		placement: 'studio',
		venue_id: null,
		venue_name: null
	}));

	return {
		id: profile.id,
		username: profile.username,
		full_name: profile.full_name,
		bio: null,
		medium: profile.medium,
		website: null,
		instagram: null,
		image_url: null,
		location: simulated?.role === 'artist' ? simulated.location : profile.location,
		works,
		on_walls_count: 0
	};
}

/*
 * Public artist presence - works on walls nearby, then studio catalogue.
 * Accepts username or UUID.
 */
export async function loadArtistPage(
	supabase: SupabaseClient<Database> | null,
	param: string
): Promise<ArtistPage | null> {
	const key = param.trim();
	if (!key) return null;

	if (!supabase) return mockFallbacksAllowed() ? mockArtistPage(key) : null;

	let profileQuery = supabase
		.from('profiles')
		.select('id, username, full_name, bio, medium, website, instagram, image_url, user_type, is_active')
		.eq('user_type', 'artist')
		.limit(1);

	if (UUID_RE.test(key)) {
		profileQuery = profileQuery.eq('id', key);
	} else {
		profileQuery = profileQuery.ilike('username', key);
	}

	const { data: profile, error: profileError } = await profileQuery.maybeSingle();

	if (profileError) {
		if (profileError.code !== 'PGRST116') throw new Error(profileError.message);
	}

	if (!profile || profile.is_active === false) {
		return mockFallbacksAllowed() ? mockArtistPage(key) : null;
	}

	const simulated = getSimulatedUserById(profile.id);
	const mock = getArtistById(profile.id);

	const { data: artworks, error: artError } = await supabase
		.from('artworks')
		.select('id, title, image_url, description, style, status, artist_id')
		.eq('artist_id', profile.id)
		.order('created_at', { ascending: false });

	if (artError) throw new Error(artError.message);

	const artworkIds = (artworks ?? []).map((row) => row.id);
	const matchByArtwork = new Map<
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
		let matchRows: {
			artwork_id: string;
			venue_id: string;
			status: string;
			approved_at: string | null;
			hung_at: string | null;
			starts_on: string | null;
			ends_on: string | null;
		}[] = [];

		const withHung = await supabase
			.from('matches')
			.select('artwork_id, venue_id, status, approved_at, hung_at, starts_on, ends_on')
			.in('artwork_id', artworkIds)
			.in('status', ['pending', 'accepted']);

		if (withHung.error?.code === '42703') {
			const legacy = await supabase
				.from('matches')
				.select('artwork_id, venue_id, status, approved_at, starts_on, ends_on')
				.in('artwork_id', artworkIds)
				.in('status', ['pending', 'accepted']);
			if (legacy.error) throw new Error(legacy.error.message);
			matchRows = (legacy.data ?? []).map((row) => ({
				...row,
				hung_at: row.approved_at
			}));
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
			if (!matchByArtwork.has(row.artwork_id)) {
				matchByArtwork.set(row.artwork_id, row);
			}
		}
	}

	const venueIds = [...new Set([...matchByArtwork.values()].map((row) => row.venue_id))];
	const venueNameById = new Map<string, string>();

	if (venueIds.length > 0) {
		const { data: venues } = await supabase.from('venues').select('id, name').in('id', venueIds);
		for (const venue of venues ?? []) {
			venueNameById.set(venue.id, venue.name);
		}

		const missing = venueIds.filter((id) => !venueNameById.has(id));
		if (missing.length > 0) {
			const { data: profiles } = await supabase
				.from('profiles')
				.select('id, full_name, username')
				.in('id', missing);
			for (const row of profiles ?? []) {
				venueNameById.set(row.id, row.full_name ?? row.username);
			}
		}
	}

	const works: ArtistPageWork[] = (artworks ?? []).map((artwork) => {
		if (artwork.status === 'sold') {
			return {
				id: artwork.id,
				title: artwork.title,
				image_url: artwork.image_url || '',
				style: resolveStyleLabel(artwork.id, artwork.style),
				description: artwork.description,
				placement: 'sold' as const,
				venue_id: null,
				venue_name: null
			};
		}
		const match = matchByArtwork.get(artwork.id);
		const placement = match ? placementForHang(match) : ('studio' as const);
		return {
			id: artwork.id,
			title: artwork.title,
			image_url: artwork.image_url || '',
			style: resolveStyleLabel(artwork.id, artwork.style),
			description: artwork.description,
			placement: placement === 'showing' || placement === 'transit' ? placement : 'studio',
			venue_id: match?.venue_id ?? null,
			venue_name: match ? venueNameById.get(match.venue_id) ?? 'Venue' : null
		};
	});

	works.sort((a, b) => {
		const rank = (placement: ArtistPageWork['placement']) =>
			placement === 'showing' ? 0 : placement === 'transit' ? 1 : placement === 'studio' ? 2 : 3;
		const byPlace = rank(a.placement) - rank(b.placement);
		if (byPlace !== 0) return byPlace;
		return a.title.localeCompare(b.title);
	});

	return {
		id: profile.id,
		username: profile.username,
		full_name: profile.full_name ?? profile.username,
		bio: profile.bio,
		medium: profile.medium ?? mock?.medium ?? null,
		website: profile.website,
		instagram: profile.instagram,
		image_url: profile.image_url,
		location:
			simulated?.role === 'artist'
				? simulated.location
				: mock?.location ?? null,
		works,
		on_walls_count: works.filter((work) => work.placement === 'showing').length
	};
}

export { UUID_RE as ARTIST_PARAM_UUID_RE };
