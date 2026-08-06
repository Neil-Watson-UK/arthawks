import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';
import {
	approveProspectAsUnclaimed,
	listProspects,
	mergeProspects,
	rejectProspect,
	updateProspect
} from '$lib/server/venue-prospects';
import type { VenueProspectLifecycle } from '$lib/types/database';

export const GET: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const status = event.url.searchParams.get('status') as VenueProspectLifecycle | null;
	const prospects = await listProspects(supabase, {
		status: status || undefined,
		limit: 500
	});
	return json({ prospects });
};

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	let body: {
		id?: string;
		action?: 'publish' | 'reject' | 'inactive' | 'merge' | 'edit';
		reason?: string;
		merge_into_id?: string;
		patch?: Record<string, unknown>;
	};
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const id = body.id;
	if (!id) throw error(400, { message: 'id is required' });

	try {
		if (body.action === 'publish') {
			const prospect = await approveProspectAsUnclaimed(supabase, id);
			return json({ prospect });
		}
		if (body.action === 'reject' || body.action === 'inactive') {
			const prospect = await rejectProspect(supabase, id, body.reason ?? 'Inactive');
			return json({ prospect });
		}
		if (body.action === 'merge') {
			if (!body.merge_into_id) throw error(400, { message: 'merge_into_id required' });
			const prospect = await mergeProspects(supabase, body.merge_into_id, id);
			return json({ prospect });
		}
		if (body.action === 'edit' || body.patch) {
			const allowed = [
				'name',
				'category',
				'address',
				'locality',
				'postcode',
				'latitude',
				'longitude',
				'website',
				'phone',
				'admin_notes'
			] as const;
			const patch: Record<string, unknown> = {};
			const source = body.patch ?? body;
			for (const key of allowed) {
				if (key in source) patch[key] = (source as Record<string, unknown>)[key];
			}
			const prospect = await updateProspect(supabase, id, patch);
			return json({ prospect });
		}
		throw error(400, { message: 'Unknown action' });
	} catch (err) {
		throw error(400, { message: err instanceof Error ? err.message : 'Update failed' });
	}
};
