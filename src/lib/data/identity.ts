import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	getSimulatedUserById,
	SIMULATED_USERS,
	type BristolDistrict,
	type SimulatedUser
} from '$lib/data/simulated-users';

const DYNAMIC_KEY = 'arthawks_dynamic_identities';

function readDynamic(): SimulatedUser[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(DYNAMIC_KEY);
		if (!raw) return [];
		return JSON.parse(raw) as SimulatedUser[];
	} catch {
		return [];
	}
}

function writeDynamic(users: SimulatedUser[]): void {
	if (!browser) return;
	localStorage.setItem(DYNAMIC_KEY, JSON.stringify(users));
}

export const dynamicIdentities = writable<SimulatedUser[]>(readDynamic());

dynamicIdentities.subscribe((users) => {
	writeDynamic(users);
});

export const allIdentities = derived(dynamicIdentities, ($dynamic) => {
	const byId = new Map<string, SimulatedUser>();
	for (const user of SIMULATED_USERS) byId.set(user.id, user);
	for (const user of $dynamic) byId.set(user.id, user);
	return [...byId.values()];
});

export function listIdentities(): SimulatedUser[] {
	return get(allIdentities);
}

export function getIdentityById(userId: string): SimulatedUser | undefined {
	return (
		get(dynamicIdentities).find((user) => user.id === userId) ?? getSimulatedUserById(userId)
	);
}

export function rememberIdentity(user: SimulatedUser): void {
	dynamicIdentities.update((list) => [user, ...list.filter((item) => item.id !== user.id)]);
}

export function districtLabel(district: BristolDistrict): string {
	switch (district) {
		case 'stokes_croft':
			return 'Stokes Croft, Bristol';
		case 'montpelier':
			return 'Montpelier, Bristol';
		case 'clifton':
			return 'Clifton, Bristol';
		case 'harbourside':
			return 'Harbourside, Bristol';
	}
}
