import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiProfile } from '$lib/server/api-auth';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { submitVenueClaim } from '$lib/server/venue-claims';

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event);

	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let body: {
		prospect_id?: string;
		full_name?: string;
		role_at_venue?: string;
		work_email?: string;
		verification_info?: string;
		message?: string;
	};
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const prospect_id = body.prospect_id?.trim() ?? '';
	const full_name = body.full_name?.trim() ?? '';
	const role_at_venue = body.role_at_venue?.trim() ?? '';
	const work_email = body.work_email?.trim() ?? '';
	const verification_info = body.verification_info?.trim() ?? '';

	if (!prospect_id || !full_name || !role_at_venue || !work_email || !verification_info) {
		throw error(400, {
			message:
				'prospect_id, full_name, role_at_venue, work_email, and verification_info are required'
		});
	}

	let supabase;
	try {
		supabase = createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured' });
	}

	try {
		const claim = await submitVenueClaim(supabase, {
			prospect_id,
			claimant_user_id: profile.id,
			full_name,
			role_at_venue,
			work_email,
			verification_info,
			message: body.message ?? null,
			claimant_user_type: profile.user_type
		});
		return json({ claim });
	} catch (err) {
		throw error(400, { message: err instanceof Error ? err.message : 'Claim failed' });
	}
};
