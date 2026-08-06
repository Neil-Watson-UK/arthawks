import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hubForUserType } from '$lib/constants/routes';
import { geocodeUkPostcode, looksLikeUkPostcode, pointWkt } from '$lib/server/postcode';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { upsertVenueForOwner } from '$lib/server/venues';
import { profileToIdentity } from '$lib/server/profile-identity';
import type { Database, UserType } from '$lib/types/database';

type RegisterBody = {
	role?: 'artist' | 'venue' | 'buyer';
	email?: string;
	password?: string;
	full_name?: string;
	username?: string;
	bio?: string;
	website?: string;
	instagram?: string;
	postcode?: string;
	medium?: string;
	footfall?: 'high' | 'medium' | 'low';
	image_url?: string;
	aesthetic_tags?: string[];
	preferred_media?: string[];
};

function slugUsername(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 30);
}

export const POST: RequestHandler = async (event) => {
	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let body: RegisterBody;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const role = body.role;
	if (role !== 'artist' && role !== 'venue' && role !== 'buyer') {
		throw error(400, { message: 'role must be artist, venue, or buyer' });
	}

	const email = body.email?.trim().toLowerCase() ?? '';
	const password = body.password ?? '';
	const fullName = body.full_name?.trim() ?? '';
	const username = slugUsername(body.username || fullName || email.split('@')[0] || 'member');

	if (!email.includes('@') || password.length < 8) {
		throw error(400, { message: 'A valid email and password (8+ characters) are required' });
	}
	if (!fullName || username.length < 2) {
		throw error(400, { message: 'Full name and username are required' });
	}

	const needsPostcode = role === 'artist' || role === 'venue';
	const rawPostcode = body.postcode?.trim() ?? '';
	let postcode: string | null = null;
	let geoWkt: string | null = null;
	let placeLabel: string | null = null;

	if (needsPostcode || rawPostcode) {
		if (!looksLikeUkPostcode(rawPostcode)) {
			throw error(400, { message: 'Please enter a valid UK postcode' });
		}

		const geo = await geocodeUkPostcode(rawPostcode);
		if (!geo) {
			throw error(400, {
				message: 'We couldn’t find that postcode. Check it and try again.'
			});
		}

		postcode = geo.postcode;
		geoWkt = pointWkt(geo.lat, geo.lng);
		placeLabel = [geo.admin_district, geo.region].filter(Boolean).join(', ') || geo.postcode;
	}

	let supabase;
	try {
		supabase = createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured for registration' });
	}

	const { data: created, error: createError } = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			full_name: fullName,
			user_type: role
		}
	});

	if (createError || !created.user) {
		throw error(400, {
			message: createError?.message ?? 'Could not create account'
		});
	}

	const userId = created.user.id;
	const userType: UserType = role;

	const profilePayload: Database['public']['Tables']['profiles']['Insert'] = {
		id: userId,
		username,
		full_name: fullName,
		user_type: userType,
		email,
		city_id: null,
		bio: body.bio?.trim() || null,
		website: body.website?.trim() || null,
		instagram: body.instagram?.trim() || null,
		medium: role === 'artist' ? body.medium?.trim() || null : null,
		footfall: role === 'venue' ? body.footfall || 'medium' : null,
		district: null,
		postcode,
		aesthetic_tags: body.aesthetic_tags ?? [],
		preferred_media: body.preferred_media ?? [],
		image_url: role === 'venue' ? body.image_url?.trim() || null : null,
		onboarding_complete: true,
		is_active: true,
		geographic_location: geoWkt
	};

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.upsert(profilePayload as never, { onConflict: 'id' })
		.select('*')
		.maybeSingle();

	if (profileError || !profile) {
		await supabase.auth.admin.deleteUser(userId);
		const missing =
			profileError?.code === '42703' ||
			Boolean(profileError?.message.includes('does not exist'));
		throw error(missing ? 503 : 500, {
			message: missing
				? 'Profile columns are missing. Run the postcode section of scripts/APPLY_IN_SUPABASE.sql (or supabase/migrations/20260720140000_postcode.sql) in the Supabase SQL editor.'
				: profileError?.message ?? 'Could not create profile'
		});
	}

	if (role === 'venue') {
		try {
			await upsertVenueForOwner(supabase, {
				id: userId,
				owner_id: userId,
				name: fullName,
				slug: username,
				bio: body.bio?.trim() || null,
				website: body.website?.trim() || null,
				instagram: body.instagram?.trim() || null,
				image_url: body.image_url?.trim() || null,
				postcode,
				geographic_location: geoWkt,
				footfall: body.footfall || 'medium',
				aesthetic_tags: body.aesthetic_tags ?? ['contemporary'],
				preferred_media: body.preferred_media ?? [],
				city_id: null,
				partner_status: 'verified'
			});
		} catch (err) {
			console.warn('Venue row create skipped:', err);
		}
	}

	if (event.locals.supabase) {
		const { error: signInError } = await event.locals.supabase.auth.signInWithPassword({
			email,
			password
		});
		if (signInError) {
			console.warn('Post-register sign-in failed:', signInError.message);
		}
	}

	return json({
		profile_id: userId,
		role,
		postcode,
		redirectTo: hubForUserType(role),
		identity: profileToIdentity(profile, placeLabel)
	});
};
