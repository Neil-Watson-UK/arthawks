import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { RoomPage } from '$lib/server/room';

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(`/api/rooms/${params.id}`);

	if (response.status === 404) {
		throw error(404, 'This room could not be found');
	}

	if (!response.ok) {
		throw error(500, 'Could not open this room');
	}

	const room = (await response.json()) as RoomPage;
	return { room };
};
