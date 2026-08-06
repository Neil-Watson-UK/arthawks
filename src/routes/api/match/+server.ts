import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertControlsVenue, requireApiProfile } from '$lib/server/api-auth';
import { approveHangInDb } from '$lib/server/rotations-db';
import { createServiceClient } from '$lib/server/supabase';
import type { MatchStatus, SwipeRequestBody, SwipeResponse } from '$lib/types/database';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
	return UUID_RE.test(value);
}

function parseLimit(raw: string | null): number {
	if (!raw) return 20;
	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed < 1) return 20;
	return Math.min(parsed, 50);
}

function isSwipeDirection(value: unknown): value is SwipeRequestBody['direction'] {
	return value === 'left' || value === 'right';
}

function mapSupabaseError(message: string, status: number) {
	return error(status, { message });
}

export const GET: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');
	const venueId = event.url.searchParams.get('venue_id');
	const limit = parseLimit(event.url.searchParams.get('limit'));

	if (!venueId) {
		throw error(400, { message: 'venue_id query parameter is required' });
	}

	if (!isUuid(venueId)) {
		throw error(400, { message: 'venue_id must be a valid UUID' });
	}

	await assertControlsVenue(profile, venueId);

	const supabase = createServiceClient();

	const { data: venueEntity, error: venueEntityError } = await supabase
		.from('venues')
		.select('id, geographic_location, is_active')
		.eq('id', venueId)
		.maybeSingle();

	if (venueEntityError && venueEntityError.code !== '42P01' && venueEntityError.code !== 'PGRST205') {
		throw mapSupabaseError('Failed to load venue', 500);
	}

	let geographicLocation = venueEntity?.geographic_location ?? null;

	if (!venueEntity) {
		const { data: venueProfile, error: venueError } = await supabase
			.from('profiles')
			.select('id, user_type, geographic_location')
			.eq('id', venueId)
			.maybeSingle();

		if (venueError) {
			throw mapSupabaseError('Failed to load venue profile', 500);
		}

		if (!venueProfile || venueProfile.user_type !== 'venue') {
			throw error(404, { message: 'Venue not found' });
		}

		geographicLocation = venueProfile.geographic_location;
	} else if (!venueEntity.is_active) {
		throw error(404, { message: 'Venue not found' });
	}

	if (!geographicLocation) {
		throw error(400, { message: 'Venue must have a geographic_location before swiping' });
	}

	const { data: cards, error: cardsError } = await supabase.rpc('get_swipeable_artworks', {
		p_venue_id: venueId,
		p_limit: limit
	});

	if (cardsError) {
		console.error('get_swipeable_artworks failed:', cardsError);
		throw mapSupabaseError('Failed to fetch swipeable artworks', 500);
	}

	return json({
		venue_id: venueId,
		count: cards?.length ?? 0,
		cards: cards ?? []
	});
};

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');

	let body: unknown;

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body || typeof body !== 'object') {
		throw error(400, { message: 'Request body must be an object' });
	}

	const { venue_id, artwork_id, direction } = body as Partial<SwipeRequestBody>;

	if (!venue_id || !artwork_id || !direction) {
		throw error(400, { message: 'venue_id, artwork_id, and direction are required' });
	}

	if (!isUuid(venue_id) || !isUuid(artwork_id)) {
		throw error(400, { message: 'venue_id and artwork_id must be valid UUIDs' });
	}

	if (!isSwipeDirection(direction)) {
		throw error(400, { message: "direction must be 'left' or 'right'" });
	}

	await assertControlsVenue(profile, venue_id);

	const supabase = createServiceClient();

	const [{ data: venueEntity }, { data: artwork, error: artworkError }] = await Promise.all([
		supabase.from('venues').select('id, is_active').eq('id', venue_id).maybeSingle(),
		supabase.from('artworks').select('id, artist_id, status').eq('id', artwork_id).maybeSingle()
	]);

	if (artworkError) {
		console.error('Swipe validation failed:', artworkError);
		throw mapSupabaseError('Failed to validate swipe request', 500);
	}

	let venueOk = Boolean(venueEntity?.is_active);
	if (!venueEntity) {
		const { data: venueProfile, error: venueError } = await supabase
			.from('profiles')
			.select('id, user_type')
			.eq('id', venue_id)
			.maybeSingle();
		if (venueError) {
			throw mapSupabaseError('Failed to validate swipe request', 500);
		}
		venueOk = venueProfile?.user_type === 'venue';
	}

	if (!venueOk) {
		throw error(404, { message: 'Venue not found' });
	}

	if (!artwork) {
		throw error(404, { message: 'Artwork not found' });
	}

	if (artwork.status !== 'available') {
		throw error(409, { message: 'Artwork is no longer available for matching' });
	}

	const declinedStatus: MatchStatus = 'declined';
	const pendingStatus: MatchStatus = 'pending';
	const acceptedStatus: MatchStatus = 'accepted';

	if (direction === 'left') {
		const { data: match, error: insertError } = await supabase
			.from('matches')
			.upsert(
				{
					venue_id,
					artwork_id,
					status: declinedStatus
				},
				{ onConflict: 'venue_id,artwork_id' }
			)
			.select('id, status')
			.single();

		if (insertError) {
			console.error('Decline swipe failed:', insertError);
			throw mapSupabaseError('Failed to record declined swipe', 500);
		}

		const response: SwipeResponse = {
			match: false,
			status: match.status,
			message: 'Swipe recorded',
			match_id: match.id
		};

		return json(response, { status: 201 });
	}

	const { data: artistInterest, error: interestError } = await supabase
		.from('artist_venue_interests')
		.select('id')
		.eq('venue_id', venue_id)
		.eq('artwork_id', artwork_id)
		.eq('artist_id', artwork.artist_id)
		.maybeSingle();

	if (interestError) {
		console.error('Artist interest lookup failed:', interestError);
		throw mapSupabaseError('Failed to check artist interest', 500);
	}

	const isTrueMatch = Boolean(artistInterest);
	const nextStatus: MatchStatus = pendingStatus;

	const { data: match, error: upsertError } = await supabase
		.from('matches')
		.upsert(
			{
				venue_id,
				artwork_id,
				status: nextStatus
			},
			{ onConflict: 'venue_id,artwork_id' }
		)
		.select('id, status')
		.single();

	if (upsertError) {
		console.error('Accept swipe failed:', upsertError);
		throw mapSupabaseError('Failed to record swipe', 500);
	}

	if (isTrueMatch) {
		try {
			await approveHangInDb(match.id);
			await supabase.from('artist_venue_interests').delete().eq('id', artistInterest!.id);
		} catch (err) {
			console.error('True match hang approval failed:', err);
			throw mapSupabaseError('Match created but hang approval failed', 500);
		}
	}

	const response: SwipeResponse = {
		match: isTrueMatch,
		status: isTrueMatch ? acceptedStatus : match.status,
		message: isTrueMatch ? 'Match - hang confirmed' : 'Swipe recorded - awaiting artist confirmation',
		match_id: match.id
	};

	return json(response, { status: isTrueMatch ? 200 : 201 });
};
