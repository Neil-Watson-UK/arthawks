import { env as publicEnv } from '$env/dynamic/public';

/*
 * Demo Identity Switcher is off by default once real auth ships.
 * Set PUBLIC_DEMO_IDENTITIES=true in .env for local persona testing.
 */
export function demoIdentitiesEnabled(): boolean {
	return publicEnv.PUBLIC_DEMO_IDENTITIES === 'true';
}
