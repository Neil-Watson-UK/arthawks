import { env as publicEnv } from '$env/dynamic/public';

/*
 * Browser-safe mirror of mock-fallbacks (no private server imports).
 * PUBLIC_ALLOW_MOCK_FALLBACKS=true or PUBLIC_DEMO_IDENTITIES=true enables mocks.
 */
export function mockFallbacksAllowed(): boolean {
	if (publicEnv.PUBLIC_ALLOW_MOCK_FALLBACKS === 'true') return true;
	if (publicEnv.PUBLIC_ALLOW_MOCK_FALLBACKS === 'false') return false;
	return publicEnv.PUBLIC_DEMO_IDENTITIES === 'true';
}
