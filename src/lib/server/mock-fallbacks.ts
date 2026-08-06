import { env as publicEnv } from '$env/dynamic/public';
import { demoIdentitiesEnabled } from '$lib/server/demo-flag';

/*
 * Mock/seed catalogue fallbacks are for local prototype only.
 * Enable with PUBLIC_ALLOW_MOCK_FALLBACKS=true (or demo identities).
 * Production / pilot: leave unset or false - empty/error instead of fake data.
 */
export function mockFallbacksAllowed(): boolean {
	if (publicEnv.PUBLIC_ALLOW_MOCK_FALLBACKS === 'true') return true;
	if (publicEnv.PUBLIC_ALLOW_MOCK_FALLBACKS === 'false') return false;
	return demoIdentitiesEnabled();
}
