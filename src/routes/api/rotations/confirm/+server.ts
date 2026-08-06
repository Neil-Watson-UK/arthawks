import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertArtistOnMatch, requireApiProfile } from '$lib/server/api-auth';
import {
	confirmArtistInterestInDb,
	declineMatchInDb,
	SchemaNotReadyError
} from '$lib/server/rotations-db';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'artist');

	let body: { match_id?: string; action?: 'confirm' | 'decline' };

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.match_id || !UUID_RE.test(body.match_id)) {
		throw error(400, { message: 'match_id must be a valid UUID' });
	}

	await assertArtistOnMatch(profile, body.match_id);

	try {
		if (body.action === 'decline') {
			await declineMatchInDb(body.match_id);
			return json({ ok: true, status: 'declined' });
		}

		const slot = await confirmArtistInterestInDb(body.match_id);
		return json({ ok: true, status: 'accepted', slot });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to update interest'
		});
	}
};
