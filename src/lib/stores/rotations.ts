import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import { nudgeForSlot, placementForHang } from '$lib/scheduling';
import { roomRoute } from '$lib/constants/routes';
import {
	artworks,
	currentUser,
	hydrateNetworkFromSupabase,
	matches,
	upsertLocalMatch,
	type NetworkArtwork,
	type NetworkMatch
} from '$lib/stores/network';
import { getArtistById } from '$lib/data/mock-artists';
import { getIdentityById } from '$lib/data/identity';
import type {
	BusyPeriod,
	PlacementProposal,
	ProposalType,
	QrScan,
	RotationSlot,
	ScanCondition,
	ScanInterest,
	ScanSource
} from '$lib/types/rotations';

interface RotationsState {
	slots: Record<string, RotationSlot>;
	busy: BusyPeriod[];
	proposals: PlacementProposal[];
	scans: QrScan[];
	ready: boolean;
	error: string | null;
}

function emptyState(): RotationsState {
	return { slots: {}, busy: [], proposals: [], scans: [], ready: false, error: null };
}

export const rotationsState = writable<RotationsState>(emptyState());
export const rotationsError = derived(rotationsState, ($state) => $state.error);

async function readJson<T>(response: Response): Promise<T> {
	const payload = (await response.json().catch(() => null)) as
		| (T & { message?: string })
		| null;
	if (!response.ok) {
		throw new Error(payload?.message ?? `Request failed (${response.status})`);
	}
	return payload as T;
}

/*
 * Hydrate calendar, proposals, and scans from Postgres via the service API.
 */
export async function hydrateRotationsFromDb(): Promise<void> {
	if (!browser) return;

	try {
		const response = await fetch('/api/rotations');
		/* Guests and buyers are not allowed - treat as empty, not an app error */
		if (response.status === 401 || response.status === 403) {
			rotationsState.set({
				slots: {},
				busy: [],
				proposals: [],
				scans: [],
				ready: true,
				error: null
			});
			return;
		}

		const bundle = await readJson<{
			slots: RotationSlot[];
			busy: BusyPeriod[];
			proposals: PlacementProposal[];
			scans: QrScan[];
		}>(response);

		const slots: Record<string, RotationSlot> = {};
		for (const slot of bundle.slots) {
			slots[slot.match_id] = slot;
		}

		rotationsState.set({
			slots,
			busy: bundle.busy,
			proposals: bundle.proposals,
			scans: bundle.scans,
			ready: true,
			error: null
		});
	} catch (err) {
		rotationsState.update((state) => ({
			...state,
			ready: true,
			error: err instanceof Error ? err.message : 'Failed to load rotations from the database'
		}));
	}
}

export interface CalendarRow {
	slot: RotationSlot;
	artwork: NetworkArtwork | undefined;
	artistName: string;
	scanCount: number;
	nudge: string | null;
}

export const venueCalendar = derived(
	[rotationsState, matches, artworks, currentUser],
	([$rotations, $matches, $artworks, $user]) => {
		if ($user.role !== 'venue') {
			return {
				slots: [] as CalendarRow[],
				busy: [] as BusyPeriod[],
				reminders: [] as CalendarRow[],
				current: [] as CalendarRow[],
				readyToHang: [] as CalendarRow[],
				upcoming: [] as CalendarRow[],
				awaitingApproval: [] as CalendarRow[]
			};
		}

		const today = new Date().toISOString().slice(0, 10);
		const busy = $rotations.busy.filter((period) => period.venue_id === $user.id);

		const rows: CalendarRow[] = $matches
			.filter((match) => match.venue_id === $user.id && match.status !== 'declined')
			.map((match) => {
				const slot = $rotations.slots[match.id];
				if (!slot) return null;
				const artwork = $artworks.find((item) => item.id === match.artwork_id);
				const artist = artwork ? getArtistById(artwork.artist_id) : undefined;
				const scanCount = $rotations.scans.filter(
					(scan) => scan.artwork_id === match.artwork_id
				).length;
				const liveSlot = {
					...slot,
					status: match.status,
					approved_at: match.approved_at ?? slot.approved_at,
					hung_at: match.hung_at ?? slot.hung_at
				};

				return {
					slot: liveSlot,
					artwork,
					artistName: artist?.full_name ?? 'Artist',
					scanCount,
					nudge: nudgeForSlot(liveSlot, scanCount)
				};
			})
			.filter((row): row is CalendarRow => Boolean(row?.artwork))
			.sort((a, b) => a.slot.starts_on.localeCompare(b.slot.starts_on));

		return {
			slots: rows,
			busy,
			reminders: rows.filter((row) => row.nudge),
			current: rows.filter(
				(row) =>
					row.slot.status === 'accepted' &&
					Boolean(row.slot.hung_at) &&
					row.slot.starts_on <= today &&
					row.slot.ends_on >= today
			),
			readyToHang: rows.filter(
				(row) =>
					row.slot.status === 'accepted' &&
					Boolean(row.slot.approved_at) &&
					!row.slot.hung_at
			),
			upcoming: rows.filter(
				(row) =>
					row.slot.starts_on > today &&
					(row.slot.status === 'accepted' || Boolean(row.slot.approved_at))
			),
			awaitingApproval: rows.filter(
				(row) => row.slot.status === 'pending' || !row.slot.approved_at
			)
		};
	}
);

export interface InboxRow {
	match: NetworkMatch;
	artwork: NetworkArtwork | undefined;
	venueName: string;
	slot: RotationSlot | undefined;
	openProposals: PlacementProposal[];
}

export interface DoorInterestRow {
	scan: QrScan;
	artwork: NetworkArtwork | undefined;
	venueName: string | null;
}

export interface ArtistWallPulseRow {
	artwork: NetworkArtwork;
	venueName: string | null;
	scanCount: number;
	scansWeek: number;
	loves: number;
	buyAsks: number;
	live: boolean;
}

export const artistInbox = derived(
	[rotationsState, matches, artworks, currentUser],
	([$rotations, $matches, $artworks, $user]) => {
		if ($user.role !== 'artist') {
			return {
				pending: [] as InboxRow[],
				proposals: [] as PlacementProposal[],
				doorInterest: [] as DoorInterestRow[],
				wallPulse: [] as ArtistWallPulseRow[],
				totals: { scans: 0, scansWeek: 0, loves: 0, buyAsks: 0, live: 0 }
			};
		}

		const myArtworks = $artworks.filter((artwork) => artwork.artist_id === $user.id);
		const myArtworkIds = new Set(myArtworks.map((artwork) => artwork.id));
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

		const pending = $matches
			.filter((match) => match.status === 'pending' && myArtworkIds.has(match.artwork_id))
			.map((match) => {
				const artwork = $artworks.find((item) => item.id === match.artwork_id);
				const venue = getIdentityById(match.venue_id);
				return {
					match,
					artwork,
					venueName: venue?.full_name ?? 'Venue',
					slot: $rotations.slots[match.id],
					openProposals: $rotations.proposals.filter(
						(proposal) => proposal.match_id === match.id && proposal.status === 'open'
					)
				};
			})
			.filter((row) => row.artwork);

		const proposals = $rotations.proposals
			.filter(
				(proposal) =>
					proposal.to_profile_id === $user.id || proposal.from_profile_id === $user.id
			)
			.sort((a, b) => b.created_at.localeCompare(a.created_at));

		const myScans = $rotations.scans.filter((scan) => myArtworkIds.has(scan.artwork_id));

		const doorInterest = myScans
			.filter(
				(scan) => scan.interest_level === 'love' || scan.interest_level === 'buy_ask'
			)
			.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at))
			.slice(0, 40)
			.map((scan) => {
				const artwork = $artworks.find((item) => item.id === scan.artwork_id);
				const venue = scan.venue_id ? getIdentityById(scan.venue_id) : null;
				return {
					scan,
					artwork,
					venueName: venue?.full_name ?? null
				};
			});

		const wallPulse: ArtistWallPulseRow[] = [];
		for (const artwork of myArtworks) {
			const artworkScans = myScans.filter((scan) => scan.artwork_id === artwork.id);
			if (artworkScans.length === 0 && artwork.status !== 'matched') continue;
			const match = $matches.find(
				(item) =>
					item.artwork_id === artwork.id &&
					(item.status === 'pending' || item.status === 'accepted')
			);
			const venue = match ? getIdentityById(match.venue_id) : null;
			wallPulse.push({
				artwork,
				venueName: venue?.full_name ?? null,
				scanCount: artworkScans.length,
				scansWeek: artworkScans.filter(
					(scan) => new Date(scan.scanned_at).getTime() >= weekAgo
				).length,
				loves: artworkScans.filter((scan) => scan.interest_level === 'love').length,
				buyAsks: artworkScans.filter((scan) => scan.interest_level === 'buy_ask').length,
				live: Boolean(match && placementForHang(match) === 'showing')
			});
		}
		wallPulse.sort(
			(a, b) =>
				Number(b.live) - Number(a.live) ||
				b.scansWeek - a.scansWeek ||
				b.scanCount - a.scanCount
		);

		const totals = {
			scans: myScans.length,
			scansWeek: myScans.filter((scan) => new Date(scan.scanned_at).getTime() >= weekAgo)
				.length,
			loves: myScans.filter((scan) => scan.interest_level === 'love').length,
			buyAsks: myScans.filter((scan) => scan.interest_level === 'buy_ask').length,
			live: wallPulse.filter((row) => row.live).length
		};

		return { pending, proposals, doorInterest, wallPulse, totals };
	}
);

export interface PulseArtwork {
	artwork: NetworkArtwork | undefined;
	scanCount: number;
	loves: number;
	buyAsks: number;
	attention: number;
	nudge: string | null;
	live: boolean;
}

export interface ThisWeeksRoom {
	path: string;
	title: string;
	shareText: string;
	works: { id: string; title: string }[];
	loves: number;
	buyAsks: number;
	scans: number;
}

export const venuePulse = derived(
	[rotationsState, matches, artworks, currentUser],
	([$rotations, $matches, $artworks, $user]) => {
		if ($user.role !== 'venue') {
			return {
				scans: [] as QrScan[],
				byArtwork: [] as PulseArtwork[],
				nudgeCount: 0,
				thisWeek: null as ThisWeeksRoom | null
			};
		}

		const venueMatches = $matches.filter(
			(match) =>
				match.venue_id === $user.id &&
				(match.status === 'pending' || match.status === 'accepted')
		);
		const liveMatches = venueMatches.filter(
			(match) => placementForHang(match) === 'showing'
		);
		const artworkIds = new Set(venueMatches.map((match) => match.artwork_id));
		const liveArtworkIds = new Set(
			liveMatches.filter((m) => placementForHang(m) === 'showing').map((m) => m.artwork_id)
		);
		const scans = $rotations.scans
			.filter((scan) => scan.venue_id === $user.id || artworkIds.has(scan.artwork_id))
			.sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));

		const byArtwork = [...artworkIds]
			.map((artworkId) => {
				const artwork = $artworks.find((item) => item.id === artworkId);
				const artworkScans = scans.filter((scan) => scan.artwork_id === artworkId);
				const match = venueMatches.find((item) => item.artwork_id === artworkId);
				const slot = match ? $rotations.slots[match.id] : undefined;
				return {
					artwork,
					scanCount: artworkScans.length,
					loves: artworkScans.filter((scan) => scan.interest_level === 'love').length,
					buyAsks: artworkScans.filter((scan) => scan.interest_level === 'buy_ask').length,
					attention: artworkScans.filter(
						(scan) =>
							scan.condition === 'needs_attention' || scan.condition === 'damaged'
					).length,
					nudge: slot ? nudgeForSlot(slot, artworkScans.length) : null,
					live: Boolean(match && placementForHang(match) === 'showing')
				};
			})
			.filter((row) => row.artwork)
			.sort((a, b) => Number(b.live) - Number(a.live) || b.scanCount - a.scanCount);

		const liveWorks = byArtwork.filter((row) => row.live && row.artwork);
		const weekLoves = scans.filter(
			(scan) =>
				liveArtworkIds.has(scan.artwork_id) && scan.interest_level === 'love'
		).length;
		const weekBuys = scans.filter(
			(scan) =>
				liveArtworkIds.has(scan.artwork_id) && scan.interest_level === 'buy_ask'
		).length;
		const weekScans = scans.filter((scan) => liveArtworkIds.has(scan.artwork_id)).length;

		const titles = liveWorks.map((row) => row.artwork!.title);
		const thisWeek: ThisWeeksRoom | null =
			liveWorks.length > 0
				? {
						path: roomRoute($user.id),
						title: `${$user.full_name} · this week’s room`,
						shareText:
							titles.length === 1
								? `Now showing at ${$user.full_name}: “${titles[0]}”. Open the door on Art Hawks.`
								: `Now showing at ${$user.full_name}: ${titles.slice(0, 3).map((t) => `“${t}”`).join(', ')}${titles.length > 3 ? '…' : ''}. Open the door on Art Hawks.`,
						works: liveWorks.map((row) => ({
							id: row.artwork!.id,
							title: row.artwork!.title
						})),
						loves: weekLoves,
						buyAsks: weekBuys,
						scans: weekScans
					}
				: null;

		return {
			scans: scans.slice(0, 40),
			byArtwork,
			nudgeCount: byArtwork.filter((row) => row.nudge).length,
			thisWeek
		};
	}
);

export async function approveHang(matchId: string, wallLabel?: string): Promise<void> {
	const payload = await readJson<{ slot: RotationSlot }>(
		await fetch('/api/rotations/approve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ match_id: matchId, wall_label: wallLabel })
		})
	);

	rotationsState.update((state) => ({
		...state,
		slots: { ...state.slots, [payload.slot.match_id]: payload.slot },
		error: null
	}));

	const match = get(matches).find((item) => item.id === matchId);
	if (match) {
		upsertLocalMatch({
			...match,
			status: 'accepted',
			approved_at: payload.slot.approved_at,
			hung_at: payload.slot.hung_at,
			starts_on: payload.slot.starts_on,
			ends_on: payload.slot.ends_on
		});
	}
	await hydrateNetworkFromSupabase();
	await hydrateRotationsFromDb();
}

export async function markHungOnWall(
	matchId: string,
	wallLabel?: string
): Promise<{ door_path: string; artwork_id: string }> {
	const payload = await readJson<{
		slot: RotationSlot;
		artwork_id: string;
		door_path: string;
	}>(
		await fetch('/api/rotations/hung', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ match_id: matchId, wall_label: wallLabel })
		})
	);

	rotationsState.update((state) => ({
		...state,
		slots: { ...state.slots, [payload.slot.match_id]: payload.slot },
		error: null
	}));

	const match = get(matches).find((item) => item.id === matchId);
	if (match) {
		upsertLocalMatch({
			...match,
			status: 'accepted',
			approved_at: payload.slot.approved_at,
			hung_at: payload.slot.hung_at,
			starts_on: payload.slot.starts_on,
			ends_on: payload.slot.ends_on
		});
	}
	await hydrateNetworkFromSupabase();
	await hydrateRotationsFromDb();
	return { door_path: payload.door_path, artwork_id: payload.artwork_id };
}

export async function blockBusyPeriod(input: {
	venue_id: string;
	starts_on: string;
	ends_on: string;
	reason?: string;
}): Promise<BusyPeriod> {
	const payload = await readJson<{ period: BusyPeriod }>(
		await fetch('/api/rotations/busy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
	);

	rotationsState.update((state) => ({
		...state,
		busy: [...state.busy, payload.period],
		error: null
	}));

	return payload.period;
}

export async function removeBusyPeriod(id: string): Promise<void> {
	await readJson<{ ok: boolean }>(
		await fetch(`/api/rotations/busy?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
	);

	rotationsState.update((state) => ({
		...state,
		busy: state.busy.filter((period) => period.id !== id),
		error: null
	}));
}

export async function createProposal(input: {
	from_profile_id: string;
	to_profile_id: string;
	artwork_id: string;
	match_id?: string | null;
	proposal_type: ProposalType;
	message?: string;
	requested_mood?: string;
	requested_min_cm?: number;
	requested_max_cm?: number;
	template_id?: string;
}): Promise<PlacementProposal> {
	const payload = await readJson<{ proposal: PlacementProposal }>(
		await fetch('/api/rotations/proposals', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
	);

	rotationsState.update((state) => ({
		...state,
		proposals: [payload.proposal, ...state.proposals],
		error: null
	}));

	return payload.proposal;
}

export async function resolveProposal(
	proposalId: string,
	status: 'accepted' | 'declined' | 'withdrawn'
): Promise<void> {
	await readJson<{ proposal: PlacementProposal }>(
		await fetch('/api/rotations/proposals', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ proposal_id: proposalId, status })
		})
	);

	await hydrateNetworkFromSupabase();
	await hydrateRotationsFromDb();
}

export async function artistConfirmInterest(matchId: string): Promise<void> {
	await readJson(
		await fetch('/api/rotations/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ match_id: matchId, action: 'confirm' })
		})
	);

	await hydrateNetworkFromSupabase();
	await hydrateRotationsFromDb();
}

export async function artistDeclineInterest(matchId: string): Promise<void> {
	await readJson(
		await fetch('/api/rotations/confirm', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ match_id: matchId, action: 'decline' })
		})
	);

	const match = get(matches).find((item) => item.id === matchId);
	if (match) upsertLocalMatch({ ...match, status: 'declined' });
	await hydrateRotationsFromDb();
}

export async function logQrScan(input: {
	artwork_id: string;
	source?: ScanSource;
	condition?: ScanCondition | null;
	interest_level?: ScanInterest | null;
	content?: string | null;
	user_id?: string | null;
}): Promise<QrScan> {
	const payload = await readJson<{ scan: QrScan }>(
		await fetch('/api/rotations/scans', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		})
	);

	rotationsState.update((state) => ({
		...state,
		scans: [payload.scan, ...state.scans].slice(0, 200),
		error: null
	}));

	return payload.scan;
}

export async function updateSlotLabel(matchId: string, wallLabel: string): Promise<void> {
	rotationsState.update((state) => {
		const existing = state.slots[matchId];
		if (!existing) return state;
		return {
			...state,
			slots: {
				...state.slots,
				[matchId]: { ...existing, wall_label: wallLabel.trim() || null }
			}
		};
	});

	try {
		await readJson(
			await fetch('/api/rotations/label', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ match_id: matchId, wall_label: wallLabel })
			})
		);
	} catch (err) {
		rotationsState.update((state) => ({
			...state,
			error: err instanceof Error ? err.message : 'Failed to save wall label'
		}));
	}
}
