import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient, requireAdmin } from '$lib/server/admin';
import { approveClaim, listClaims, rejectClaim } from '$lib/server/venue-claims';
import type { VenueClaimStatus } from '$lib/types/database';

export const GET: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const status = event.url.searchParams.get('status') as VenueClaimStatus | null;
	const claims = await listClaims(supabase, { status: status || undefined });
	return json({ claims });
};

export const PATCH: RequestHandler = async (event) => {
	const admin = requireAdmin(event);
	const supabase = adminServiceClient(event);

	let body: { id?: string; action?: 'approve' | 'reject'; notes?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	if (!body.id || !body.action) {
		throw error(400, { message: 'id and action are required' });
	}

	try {
		if (body.action === 'approve') {
			const result = await approveClaim(supabase, body.id, admin.id, body.notes);
			return json(result);
		}
		if (body.action === 'reject') {
			const claim = await rejectClaim(supabase, body.id, admin.id, body.notes);
			return json({ claim });
		}
		throw error(400, { message: 'Unknown action' });
	} catch (err) {
		throw error(400, { message: err instanceof Error ? err.message : 'Claim update failed' });
	}
};
