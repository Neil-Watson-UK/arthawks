import { error, type RequestEvent } from '@sveltejs/kit';
import type { UserType } from '$lib/types/database';
import { createServiceClient } from '$lib/server/supabase';

export type ApiProfile = NonNullable<RequestEvent['locals']['profile']>;

export interface MatchParticipants {
	match_id: string;
	venue_id: string;
	artwork_id: string;
	artist_id: string;
	status: string;
}

/*
 * JSON API auth - throw 401/403 (not redirects).
 */
export function requireApiProfile(
	event: RequestEvent,
	allowed?: UserType | UserType[]
): ApiProfile {
	if (!event.locals.session || !event.locals.profile) {
		throw error(401, { message: 'Sign in required' });
	}
	if (event.locals.profile.is_active === false) {
		throw error(403, { message: 'This account has been deactivated' });
	}

	if (allowed) {
		const types = Array.isArray(allowed) ? allowed : [allowed];
		if (
			!types.includes(event.locals.profile.user_type) &&
			event.locals.profile.user_type !== 'admin'
		) {
			throw error(403, { message: 'Not allowed for this account type' });
		}
	}

	return event.locals.profile;
}

/** Venue profile id or venues row owned by this profile. */
export async function assertControlsVenue(profile: ApiProfile, venueId: string): Promise<void> {
	if (profile.user_type === 'admin') return;
	if (profile.user_type !== 'venue') {
		throw error(403, { message: 'Only venue accounts can do this' });
	}
	if (profile.id === venueId) return;

	const supabase = createServiceClient();
	const { data, error: qErr } = await supabase
		.from('venues')
		.select('id, owner_id')
		.eq('id', venueId)
		.maybeSingle();

	if (qErr && qErr.code !== '42P01' && qErr.code !== 'PGRST205') {
		throw error(500, { message: 'Failed to verify venue ownership' });
	}
	if (data?.owner_id === profile.id) return;

	throw error(403, { message: 'You do not control this venue' });
}

export async function loadMatchParticipants(matchId: string): Promise<MatchParticipants> {
	const supabase = createServiceClient();
	const { data: match, error: matchErr } = await supabase
		.from('matches')
		.select('id, venue_id, artwork_id, status')
		.eq('id', matchId)
		.maybeSingle();

	if (matchErr) throw error(500, { message: 'Failed to load match' });
	if (!match) throw error(404, { message: 'Match not found' });

	const { data: artwork, error: artErr } = await supabase
		.from('artworks')
		.select('id, artist_id')
		.eq('id', match.artwork_id)
		.maybeSingle();

	if (artErr) throw error(500, { message: 'Failed to load artwork' });
	if (!artwork) throw error(404, { message: 'Artwork not found' });

	return {
		match_id: match.id,
		venue_id: match.venue_id,
		artwork_id: match.artwork_id,
		artist_id: artwork.artist_id,
		status: match.status
	};
}

export async function assertVenueOnMatch(
	profile: ApiProfile,
	matchId: string
): Promise<MatchParticipants> {
	const match = await loadMatchParticipants(matchId);
	await assertControlsVenue(profile, match.venue_id);
	return match;
}

export async function assertArtistOnMatch(
	profile: ApiProfile,
	matchId: string
): Promise<MatchParticipants> {
	if (profile.user_type === 'admin') return loadMatchParticipants(matchId);
	if (profile.user_type !== 'artist') {
		throw error(403, { message: 'Only the artist can do this' });
	}
	const match = await loadMatchParticipants(matchId);
	if (match.artist_id !== profile.id) {
		throw error(403, { message: 'Not your artwork' });
	}
	return match;
}

export async function assertMatchParticipant(
	profile: ApiProfile,
	matchId: string
): Promise<MatchParticipants> {
	if (profile.user_type === 'admin') return loadMatchParticipants(matchId);
	const match = await loadMatchParticipants(matchId);
	if (profile.user_type === 'artist' && match.artist_id === profile.id) return match;
	if (profile.user_type === 'venue') {
		await assertControlsVenue(profile, match.venue_id);
		return match;
	}
	throw error(403, { message: 'Not a participant on this match' });
}

export async function venueIdsForProfile(profileId: string): Promise<Set<string>> {
	const ids = new Set<string>([profileId]);
	const supabase = createServiceClient();
	const { data, error: qErr } = await supabase
		.from('venues')
		.select('id')
		.eq('owner_id', profileId);

	if (qErr && qErr.code !== '42P01' && qErr.code !== 'PGRST205') {
		throw error(500, { message: 'Failed to resolve venues for profile' });
	}
	for (const row of data ?? []) ids.add(row.id);
	return ids;
}
