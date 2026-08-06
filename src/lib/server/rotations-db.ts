import { createServiceClient } from '$lib/server/supabase';
import {
	addDays,
	nextOpenInstallDay,
	synthesizeSlot,
	toDateOnly
} from '$lib/scheduling';
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
import type { MatchStatus } from '$lib/types/database';

export class SchemaNotReadyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SchemaNotReadyError';
	}
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
	if (!error) return false;
	return (
		error.code === '42P01' ||
		error.code === '42703' ||
		Boolean(error.message?.includes('does not exist'))
	);
}

function requireReady(error: { code?: string; message?: string } | null, label: string): void {
	if (isMissingRelation(error)) {
		throw new SchemaNotReadyError(
			`${label} is not in the database yet. Run migration 20260718150000_rotations_and_scans.sql in the Supabase SQL editor.`
		);
	}
}

export interface RotationsBundle {
	slots: RotationSlot[];
	busy: BusyPeriod[];
	proposals: PlacementProposal[];
	scans: QrScan[];
}

function mapMatchToSlot(row: {
	id: string;
	venue_id: string;
	artwork_id: string;
	status: MatchStatus;
	created_at: string;
	starts_on?: string | null;
	ends_on?: string | null;
	install_buffer_hours?: number | null;
	wall_label?: string | null;
	reminder_at?: string | null;
	approved_at?: string | null;
	hung_at?: string | null;
}): RotationSlot {
	if (row.starts_on && row.ends_on) {
		return {
			match_id: row.id,
			venue_id: row.venue_id,
			artwork_id: row.artwork_id,
			status: row.status,
			starts_on: row.starts_on,
			ends_on: row.ends_on,
			install_buffer_hours: row.install_buffer_hours ?? 24,
			wall_label: row.wall_label ?? null,
			reminder_at: row.reminder_at ?? null,
			approved_at: row.approved_at ?? null,
			hung_at: 'hung_at' in row ? (row.hung_at ?? null) : (row.approved_at ?? null)
		};
	}

	return synthesizeSlot({
		match_id: row.id,
		venue_id: row.venue_id,
		artwork_id: row.artwork_id,
		status: row.status,
		created_at: row.created_at,
		install_buffer_hours: row.install_buffer_hours ?? 24
	});
}

const MATCH_SLOT_COLUMNS =
	'id, venue_id, artwork_id, status, created_at, starts_on, ends_on, install_buffer_hours, wall_label, reminder_at, approved_at, hung_at';

const MATCH_SLOT_COLUMNS_LEGACY =
	'id, venue_id, artwork_id, status, created_at, starts_on, ends_on, install_buffer_hours, wall_label, reminder_at, approved_at';

async function selectMatchSlots(
	supabase: ReturnType<typeof createServiceClient>,
	filter?: { id?: string; statuses?: MatchStatus[] }
) {
	let query = supabase.from('matches').select(MATCH_SLOT_COLUMNS);
	if (filter?.id) query = query.eq('id', filter.id);
	if (filter?.statuses) query = query.in('status', filter.statuses);
	if (!filter?.id) query = query.order('created_at', { ascending: false });

	const first = filter?.id ? await query.maybeSingle() : await query;
	if (!first.error || first.error.code !== '42703') return first;

	let legacy = supabase.from('matches').select(MATCH_SLOT_COLUMNS_LEGACY);
	if (filter?.id) legacy = legacy.eq('id', filter.id);
	if (filter?.statuses) legacy = legacy.in('status', filter.statuses);
	if (!filter?.id) legacy = legacy.order('created_at', { ascending: false });
	return filter?.id ? await legacy.maybeSingle() : await legacy;
}

export async function loadRotationsBundle(): Promise<RotationsBundle> {
	const supabase = createServiceClient();

	const [matchesRes, busyRes, proposalsRes, scansRes] = await Promise.all([
		selectMatchSlots(supabase, { statuses: ['pending', 'accepted'] }),
		supabase.from('venue_busy_periods').select('*').order('starts_on', { ascending: true }),
		supabase.from('placement_proposals').select('*').order('created_at', { ascending: false }),
		supabase.from('qr_scans').select('*').order('scanned_at', { ascending: false }).limit(400)
	]);

	requireReady(matchesRes.error, 'matches.starts_on');
	requireReady(busyRes.error, 'venue_busy_periods');
	requireReady(proposalsRes.error, 'placement_proposals');
	requireReady(scansRes.error, 'qr_scans');

	if (matchesRes.error) throw new Error(matchesRes.error.message);
	if (busyRes.error) throw new Error(busyRes.error.message);
	if (proposalsRes.error) throw new Error(proposalsRes.error.message);
	if (scansRes.error) throw new Error(scansRes.error.message);

	const matchRows = (Array.isArray(matchesRes.data)
		? matchesRes.data
		: matchesRes.data
			? [matchesRes.data]
			: []) as Parameters<typeof mapMatchToSlot>[0][];

	const slots = matchRows.map((row) => mapMatchToSlot(row));

	/* Persist synthesized windows so the calendar stays DB-owned */
	await Promise.all(
		matchRows.map(async (row) => {
			if (row.starts_on && row.ends_on) return;
			const slot = mapMatchToSlot(row);
			const { error } = await supabase
				.from('matches')
				.update({
					starts_on: slot.starts_on,
					ends_on: slot.ends_on,
					install_buffer_hours: slot.install_buffer_hours,
					reminder_at: slot.reminder_at,
					wall_label: slot.wall_label,
					approved_at: slot.approved_at
				})
				.eq('id', row.id);
			if (error && !isMissingRelation(error)) {
				console.warn('Failed to persist synthesized slot:', error.message);
			}
		})
	);

	return {
		slots,
		busy: (busyRes.data ?? []) as BusyPeriod[],
		proposals: (proposalsRes.data ?? []) as PlacementProposal[],
		scans: (scansRes.data ?? []).map((row) => ({
			id: row.id,
			artwork_id: row.artwork_id,
			match_id: row.match_id,
			venue_id: row.venue_id,
			scanned_at: row.scanned_at,
			source: row.source,
			condition: row.condition,
			interest_level: row.interest_level,
			user_id: row.user_id,
			content: row.content
		})) as QrScan[]
	};
}

/*
 * Participant-scoped hydrate - never return the full network to a client.
 */
export async function loadRotationsBundleForActor(actor: {
	id: string;
	user_type: string;
}): Promise<RotationsBundle> {
	const full = await loadRotationsBundle();
	if (actor.user_type === 'admin') return full;

	const supabase = createServiceClient();

	if (actor.user_type === 'venue') {
		const venueIds = new Set<string>([actor.id]);
		const { data: owned } = await supabase.from('venues').select('id').eq('owner_id', actor.id);
		for (const row of owned ?? []) venueIds.add(row.id);

		const slots = full.slots.filter((slot) => venueIds.has(slot.venue_id));
		const artworkIds = new Set(slots.map((slot) => slot.artwork_id));
		return {
			slots,
			busy: full.busy.filter((period) => venueIds.has(period.venue_id)),
			proposals: full.proposals.filter(
				(row) => row.from_profile_id === actor.id || row.to_profile_id === actor.id
			),
			scans: full.scans.filter(
				(scan) =>
					(scan.venue_id != null && venueIds.has(scan.venue_id)) ||
					artworkIds.has(scan.artwork_id)
			)
		};
	}

	if (actor.user_type === 'artist') {
		const { data: arts } = await supabase.from('artworks').select('id').eq('artist_id', actor.id);
		const artworkIds = new Set((arts ?? []).map((row) => row.id));
		const slots = full.slots.filter((slot) => artworkIds.has(slot.artwork_id));
		const venueIds = new Set(slots.map((slot) => slot.venue_id));
		return {
			slots,
			busy: full.busy.filter((period) => venueIds.has(period.venue_id)),
			proposals: full.proposals.filter(
				(row) =>
					row.from_profile_id === actor.id ||
					row.to_profile_id === actor.id ||
					artworkIds.has(row.artwork_id)
			),
			scans: full.scans.filter((scan) => artworkIds.has(scan.artwork_id))
		};
	}

	return {
		slots: [],
		busy: [],
		proposals: [],
		scans: full.scans.filter((scan) => scan.user_id === actor.id)
	};
}

export async function approveHangInDb(
	matchId: string,
	wallLabel?: string
): Promise<RotationSlot> {
	const supabase = createServiceClient();
	const matchRes = await selectMatchSlots(supabase, { id: matchId });
	requireReady(matchRes.error, 'matches schedule columns');
	if (matchRes.error) throw new Error(matchRes.error.message);
	const match = matchRes.data as Parameters<typeof mapMatchToSlot>[0] | null;
	if (!match) throw new Error('Match not found');

	const { data: busyRows, error: busyError } = await supabase
		.from('venue_busy_periods')
		.select('*')
		.eq('venue_id', match.venue_id);
	requireReady(busyError, 'venue_busy_periods');
	if (busyError) throw new Error(busyError.message);

	const buffer = match.install_buffer_hours ?? 24;
	const startsOn = nextOpenInstallDay(
		match.venue_id,
		(busyRows ?? []) as BusyPeriod[],
		toDateOnly(new Date()),
		buffer
	);
	const endsOn = addDays(startsOn, 42);
	const approvedAt = match.approved_at ?? new Date().toISOString();
	const reminderAt = new Date(`${addDays(endsOn, -7)}T09:00:00.000Z`).toISOString();
	const label = wallLabel?.trim() || match.wall_label || 'Main wall';

	const patch: Record<string, unknown> = {
		status: 'accepted',
		starts_on: match.starts_on && match.ends_on ? match.starts_on : startsOn,
		ends_on: match.starts_on && match.ends_on ? match.ends_on : endsOn,
		install_buffer_hours: buffer,
		wall_label: label,
		reminder_at: match.reminder_at ?? reminderAt,
		approved_at: approvedAt
	};

	const { data: updated, error: updateError } = await supabase
		.from('matches')
		.update(patch as never)
		.eq('id', matchId)
		.select(MATCH_SLOT_COLUMNS)
		.maybeSingle();

	if (updateError?.code === '42703') {
		const legacy = await supabase
			.from('matches')
			.update(patch as never)
			.eq('id', matchId)
			.select(MATCH_SLOT_COLUMNS_LEGACY)
			.single();
		if (legacy.error) throw new Error(legacy.error.message);
		await supabase.from('artworks').update({ status: 'matched' }).eq('id', match.artwork_id);
		return mapMatchToSlot(legacy.data as never);
	}

	if (updateError) throw new Error(updateError.message);
	if (!updated) throw new Error('Match not found');

	await supabase.from('artworks').update({ status: 'matched' }).eq('id', match.artwork_id);

	return mapMatchToSlot(updated as never);
}

/**
 * Venue marks the work physically hung - goes live on map/room and opens the QR moment.
 */
export async function markHungInDb(
	matchId: string,
	wallLabel?: string
): Promise<{ slot: RotationSlot; artwork_id: string; door_path: string }> {
	const supabase = createServiceClient();
	let slot = await approveHangInDb(matchId, wallLabel);

	const today = toDateOnly(new Date());
	const hungAt = new Date().toISOString();
	const startsOn = slot.starts_on > today ? today : slot.starts_on;
	const endsOn = slot.ends_on >= today ? slot.ends_on : addDays(today, 42);
	const label = wallLabel?.trim() || slot.wall_label || 'Main wall';
	const reminderAt =
		slot.reminder_at ?? new Date(`${addDays(endsOn, -7)}T09:00:00.000Z`).toISOString();

	const patch = {
		status: 'accepted' as const,
		starts_on: startsOn,
		ends_on: endsOn,
		wall_label: label,
		reminder_at: reminderAt,
		approved_at: slot.approved_at ?? hungAt,
		hung_at: hungAt
	};

	const { data: updated, error: updateError } = await supabase
		.from('matches')
		.update(patch as never)
		.eq('id', matchId)
		.select(MATCH_SLOT_COLUMNS)
		.maybeSingle();

	if (updateError) {
		if (updateError.code === '42703') {
			throw new SchemaNotReadyError(
				'hung_at is not in the database yet. Run migration 20260730140000_install_handshake_hung_at.sql'
			);
		}
		throw new Error(updateError.message);
	}
	if (!updated) throw new Error('Match not found');

	slot = mapMatchToSlot(updated as never);
	await supabase.from('artworks').update({ status: 'matched' }).eq('id', slot.artwork_id);

	return {
		slot,
		artwork_id: slot.artwork_id,
		door_path: `/art/${slot.artwork_id}`
	};
}

export async function insertBusyPeriod(input: {
	venue_id: string;
	starts_on: string;
	ends_on: string;
	reason?: string | null;
}): Promise<BusyPeriod> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('venue_busy_periods')
		.insert({
			venue_id: input.venue_id,
			starts_on: input.starts_on,
			ends_on: input.ends_on,
			reason: input.reason ?? null
		})
		.select('*')
		.single();

	requireReady(error, 'venue_busy_periods');
	if (error) throw new Error(error.message);
	return data as BusyPeriod;
}

export async function deleteBusyPeriod(id: string): Promise<void> {
	const supabase = createServiceClient();
	const { error } = await supabase.from('venue_busy_periods').delete().eq('id', id);
	requireReady(error, 'venue_busy_periods');
	if (error) throw new Error(error.message);
}

export async function insertProposal(input: {
	from_profile_id: string;
	to_profile_id: string;
	artwork_id: string;
	match_id?: string | null;
	proposal_type: ProposalType;
	message?: string | null;
	requested_mood?: string | null;
	requested_min_cm?: number | null;
	requested_max_cm?: number | null;
}): Promise<PlacementProposal> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('placement_proposals')
		.insert({
			match_id: input.match_id ?? null,
			from_profile_id: input.from_profile_id,
			to_profile_id: input.to_profile_id,
			artwork_id: input.artwork_id,
			proposal_type: input.proposal_type,
			message: input.message ?? null,
			requested_mood: input.requested_mood ?? null,
			requested_min_cm: input.requested_min_cm ?? null,
			requested_max_cm: input.requested_max_cm ?? null,
			status: 'open'
		})
		.select('*')
		.single();

	requireReady(error, 'placement_proposals');
	if (error) throw new Error(error.message);
	return data as PlacementProposal;
}

export async function updateProposalStatus(
	proposalId: string,
	status: 'accepted' | 'declined' | 'withdrawn'
): Promise<PlacementProposal> {
	const supabase = createServiceClient();
	const resolvedAt = new Date().toISOString();
	const { data, error } = await supabase
		.from('placement_proposals')
		.update({ status, resolved_at: resolvedAt })
		.eq('id', proposalId)
		.select('*')
		.single();

	requireReady(error, 'placement_proposals');
	if (error) throw new Error(error.message);

	const proposal = data as PlacementProposal;
	if (status === 'accepted' && proposal.match_id) {
		await approveHangInDb(proposal.match_id);
		const { data: match } = await supabase
			.from('matches')
			.select('venue_id, artwork_id')
			.eq('id', proposal.match_id)
			.maybeSingle();
		if (match) {
			const artistId =
				proposal.from_profile_id === match.venue_id
					? proposal.to_profile_id
					: proposal.from_profile_id;
			await supabase.from('artist_venue_interests').upsert(
				{
					artist_id: artistId,
					venue_id: match.venue_id,
					artwork_id: match.artwork_id
				},
				{ onConflict: 'artist_id,venue_id,artwork_id' }
			);
		}
	}

	return proposal;
}

export async function declineMatchInDb(matchId: string): Promise<void> {
	const supabase = createServiceClient();
	const { error } = await supabase.from('matches').update({ status: 'declined' }).eq('id', matchId);
	if (error) throw new Error(error.message);
}

export async function confirmArtistInterestInDb(matchId: string): Promise<RotationSlot> {
	const supabase = createServiceClient();
	const { data: match, error } = await supabase
		.from('matches')
		.select('id, venue_id, artwork_id')
		.eq('id', matchId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!match) throw new Error('Match not found');

	const { data: artwork } = await supabase
		.from('artworks')
		.select('artist_id')
		.eq('id', match.artwork_id)
		.maybeSingle();

	if (artwork?.artist_id) {
		await supabase.from('artist_venue_interests').upsert(
			{
				artist_id: artwork.artist_id,
				venue_id: match.venue_id,
				artwork_id: match.artwork_id
			},
			{ onConflict: 'artist_id,venue_id,artwork_id' }
		);
	}

	return approveHangInDb(matchId);
}

export async function insertQrScan(input: {
	artwork_id: string;
	source?: ScanSource;
	condition?: ScanCondition | null;
	interest_level?: ScanInterest | null;
	content?: string | null;
	user_id?: string | null;
}): Promise<QrScan> {
	const supabase = createServiceClient();
	const { data: match } = await supabase
		.from('matches')
		.select('id, venue_id')
		.eq('artwork_id', input.artwork_id)
		.in('status', ['pending', 'accepted'])
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	const { data, error } = await supabase
		.from('qr_scans')
		.insert({
			artwork_id: input.artwork_id,
			match_id: match?.id ?? null,
			venue_id: match?.venue_id ?? null,
			source: input.source ?? 'wall_qr',
			condition: input.condition ?? null,
			interest_level: input.interest_level ?? 'browse',
			user_id: input.user_id ?? null,
			content: input.content ?? null
		})
		.select('*')
		.single();

	requireReady(error, 'qr_scans');
	if (error) throw new Error(error.message);

	return {
		id: data.id,
		artwork_id: data.artwork_id,
		match_id: data.match_id,
		venue_id: data.venue_id,
		scanned_at: data.scanned_at,
		source: data.source,
		condition: data.condition,
		interest_level: data.interest_level,
		user_id: data.user_id,
		content: data.content
	};
}

export async function updateMatchWallLabel(matchId: string, wallLabel: string): Promise<void> {
	const supabase = createServiceClient();
	const { error } = await supabase
		.from('matches')
		.update({ wall_label: wallLabel.trim() || null })
		.eq('id', matchId);
	requireReady(error, 'matches.wall_label');
	if (error) throw new Error(error.message);
}
