import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'arthawks_loved_art';

export interface LovedArtEntry {
	id: string;
	loved_at: string;
}

function readStored(): LovedArtEntry[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(
				(row): row is LovedArtEntry =>
					Boolean(row) &&
					typeof row === 'object' &&
					typeof (row as LovedArtEntry).id === 'string' &&
					typeof (row as LovedArtEntry).loved_at === 'string'
			)
			.slice(0, 80);
	} catch {
		return [];
	}
}

function persist(entries: LovedArtEntry[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 80)));
	} catch {
		/* ignore quota / private mode */
	}
}

/** Local loves for buyer swipe - no DB, pilot shortlist only. */
export const lovedArt = writable<LovedArtEntry[]>(readStored());

export function loveArtwork(id: string): void {
	const loved_at = new Date().toISOString();
	lovedArt.update((list) => {
		const next = [{ id, loved_at }, ...list.filter((entry) => entry.id !== id)].slice(0, 80);
		persist(next);
		return next;
	});
}

export function clearLovedArt(): void {
	lovedArt.set([]);
	if (browser) {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* ignore */
		}
	}
}
