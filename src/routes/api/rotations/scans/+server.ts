import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiProfile } from '$lib/server/api-auth';
import { insertQrScan, SchemaNotReadyError } from '$lib/server/rotations-db';
import type { ScanCondition, ScanInterest, ScanSource } from '$lib/types/rotations';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, ['artist', 'venue', 'buyer', 'admin']);

	let body: {
		artwork_id?: string;
		source?: ScanSource;
		condition?: ScanCondition | null;
		interest_level?: ScanInterest | null;
		content?: string | null;
		user_id?: string | null;
	};

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.artwork_id || !UUID_RE.test(body.artwork_id)) {
		throw error(400, { message: 'artwork_id must be a valid UUID' });
	}

	try {
		const scan = await insertQrScan({
			artwork_id: body.artwork_id,
			source: body.source,
			condition: body.condition,
			interest_level: body.interest_level,
			content: body.content,
			/* Never trust client-supplied user_id */
			user_id: profile.id
		});
		return json({ scan });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to log scan'
		});
	}
};
