import type { PageServerLoad } from './$types';

/*
 * Client page clears browser + cookie sessions.
 * Keep load as a no-op so GET /logout always reaches the client handler.
 */
export const load: PageServerLoad = async () => {
	return {};
};
