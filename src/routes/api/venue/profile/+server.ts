import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	geocodeUkPostcode,
	looksLikeUkPostcode,
	pointWkt
} from '$lib/server/postcode';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { getVenueOwnedBy, upsertVenueForOwner } from '$lib/server/venues';
import { profileToIdentity } from '$lib/server/profile-identity';

type Body = {
	full_name?: string;
	bio?: string;
	website?: string;
	instagram?: string;
	image_url?: string;
	postcode?: string;
	opening_hours?: string;
	footfall?: 'high' | 'medium' | 'low';
	aesthetic_tags?: string[];
};

function requireVenueProfile(event: Parameters<RequestHandler>[0]) {
	if (!event.locals.session || !event.locals.profile) {
		throw error(401, { message: 'Sign in as a venue to continue' });
	}
	if (event.locals.profile.user_type !== 'venue') {
		throw error(403, { message: 'Only venue accounts can update venue identity' });
	}
	if (event.locals.profile.is_active === false) {
		throw error(403, { message: 'This account has been deactivated' });
	}
	return event.locals.profile;
}

export const PATCH: RequestHandler = async (event) => {
	const profile = requireVenueProfile(event);

	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let body: Body;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const fullName = body.full_name?.trim() ?? '';
	if (!fullName) {
		throw error(400, { message: 'Venue name is required' });
	}

	const rawPostcode = body.postcode?.trim() ?? '';
	if (!rawPostcode || !looksLikeUkPostcode(rawPostcode)) {
		throw error(400, { message: 'A valid UK postcode is required so we can place you on the map' });
	}

	const geo = await geocodeUkPostcode(rawPostcode);
	if (!geo) {
		throw error(400, { message: 'We couldn’t find that postcode. Check it and try again.' });
	}

	const geoWkt = pointWkt(geo.lat, geo.lng);
	const placeLabel = [geo.admin_district, geo.region].filter(Boolean).join(', ') || geo.postcode;

	let supabase;
	try {
		supabase = createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured' });
	}

	const footfall = body.footfall ?? (profile.footfall as Body['footfall']) ?? 'medium';
	const aestheticTags = body.aesthetic_tags ?? profile.aesthetic_tags ?? ['contemporary'];
	const openingHours = body.opening_hours?.trim() || null;

	const profilePatch = {
		full_name: fullName,
		bio: body.bio?.trim() || null,
		website: body.website?.trim() || null,
		instagram: body.instagram?.trim() || null,
		image_url: body.image_url?.trim() || null,
		postcode: geo.postcode,
		district: null,
		footfall,
		aesthetic_tags: aestheticTags,
		geographic_location: geoWkt,
		city_id: null,
		updated_at: new Date().toISOString()
	};

	const { data: updatedProfile, error: profileError } = await supabase
		.from('profiles')
		.update(profilePatch as never)
		.eq('id', profile.id)
		.select('*')
		.maybeSingle();

	if (profileError || !updatedProfile) {
		const missing = profileError?.code === '42703';
		throw error(missing ? 503 : 500, {
			message: missing
				? 'Postcode column missing - run supabase/migrations/20260720140000_postcode.sql'
				: profileError?.message ?? 'Could not update profile'
		});
	}

	const existing = await getVenueOwnedBy(supabase, profile.id);
	const slug = existing?.slug ?? updatedProfile.username;

	const venue = await upsertVenueForOwner(supabase, {
		id: existing?.id ?? profile.id,
		owner_id: profile.id,
		name: fullName,
		slug,
		bio: profilePatch.bio,
		website: profilePatch.website,
		instagram: profilePatch.instagram,
		image_url: profilePatch.image_url,
		postcode: geo.postcode,
		geographic_location: geoWkt,
		opening_hours: openingHours,
		footfall,
		aesthetic_tags: aestheticTags,
		preferred_media: existing?.preferred_media ?? [],
		city_id: null,
		preserve_partner_status: true,
		partner_status: existing?.partner_status ?? 'verified'
	});

	return json({
		ok: true,
		postcode: geo.postcode,
		lat: geo.lat,
		lng: geo.lng,
		place_label: placeLabel,
		opening_hours: openingHours,
		venue_id: venue?.id ?? existing?.id ?? profile.id,
		on_map: true,
		identity: profileToIdentity(updatedProfile, placeLabel)
	});
};

export const GET: RequestHandler = async (event) => {
	const profile = requireVenueProfile(event);

	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let supabase;
	try {
		supabase = createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured' });
	}

	const venue = await getVenueOwnedBy(supabase, profile.id);
	const hasLocation = Boolean(
		venue?.geographic_location || profile.geographic_location || profile.postcode || venue?.postcode
	);

	return json({
		profile: {
			id: profile.id,
			full_name: profile.full_name,
			username: profile.username,
			bio: profile.bio,
			website: profile.website,
			instagram: profile.instagram,
			image_url: profile.image_url ?? venue?.image_url ?? null,
			postcode: profile.postcode ?? venue?.postcode ?? null,
			opening_hours: venue?.opening_hours ?? null,
			footfall: profile.footfall ?? venue?.footfall ?? 'medium',
			aesthetic_tags: venue?.aesthetic_tags ?? profile.aesthetic_tags ?? []
		},
		venue: venue
			? {
					id: venue.id,
					name: venue.name,
					slug: venue.slug,
					postcode: venue.postcode,
					opening_hours: venue.opening_hours,
					has_location: Boolean(venue.geographic_location)
				}
			: null,
		on_map: hasLocation,
		room_path: `/rooms/${venue?.id ?? profile.id}`
	});
};
