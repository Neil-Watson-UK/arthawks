import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertVenueOnMatch, requireApiProfile } from '$lib/server/api-auth';
import { approveHangInDb, SchemaNotReadyError } from '$lib/server/rotations-db';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');

	let body: { match_id?: string; wall_label?: string };

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.match_id || !UUID_RE.test(body.match_id)) {
		throw error(400, { message: 'match_id must be a valid UUID' });
	}

	await assertVenueOnMatch(profile, body.match_id);

	try {
		const slot = await approveHangInDb(body.match_id, body.wall_label);
		return json({ slot });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to approve hang'
		});
	}
};
