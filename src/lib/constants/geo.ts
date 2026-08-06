/** Seed Bristol city UUID - matches migration 20260720120000 */
export const BRISTOL_CITY_ID = 'd0000000-0000-4000-8000-000000000001';

export const DEMO_IDENTITIES_ENABLED =
	(typeof import.meta !== 'undefined' &&
		(import.meta as { env?: { PUBLIC_DEMO_IDENTITIES?: string } }).env
			?.PUBLIC_DEMO_IDENTITIES === 'true') ||
	false;
