import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertControlsVenue, requireApiProfile } from '$lib/server/api-auth';
import {
	deleteBusyPeriod,
	insertBusyPeriod,
	SchemaNotReadyError
} from '$lib/server/rotations-db';
import { createServiceClient } from '$lib/server/supabase';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');

	let body: {
		venue_id?: string;
		starts_on?: string;
		ends_on?: string;
		reason?: string;
	};

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.venue_id || !UUID_RE.test(body.venue_id)) {
		throw error(400, { message: 'venue_id must be a valid UUID' });
	}
	if (!body.starts_on || !body.ends_on) {
		throw error(400, { message: 'starts_on and ends_on are required' });
	}
	if (body.ends_on < body.starts_on) {
		throw error(400, { message: 'ends_on must be on or after starts_on' });
	}

	await assertControlsVenue(profile, body.venue_id);

	try {
		const period = await insertBusyPeriod({
			venue_id: body.venue_id,
			starts_on: body.starts_on,
			ends_on: body.ends_on,
			reason: body.reason
		});
		return json({ period });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to block busy period'
		});
	}
};

export const DELETE: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');
	const id = event.url.searchParams.get('id');
	if (!id || !UUID_RE.test(id)) {
		throw error(400, { message: 'id must be a valid UUID' });
	}

	const supabase = createServiceClient();
	const { data: period, error: qErr } = await supabase
		.from('venue_busy_periods')
		.select('id, venue_id')
		.eq('id', id)
		.maybeSingle();

	if (qErr && !qErr.message?.includes('does not exist')) {
		throw error(500, { message: 'Failed to load busy period' });
	}
	if (!period) {
		throw error(404, { message: 'Busy period not found' });
	}

	await assertControlsVenue(profile, period.venue_id);

	try {
		await deleteBusyPeriod(id);
		return json({ ok: true });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to remove busy period'
		});
	}
};
