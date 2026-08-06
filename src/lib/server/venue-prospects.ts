import type { Database, VenueProspectLifecycle } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	distanceMetres,
	fetchBristolVenueCandidates,
	namesLikelyDuplicate,
	normalizeOverpassElement,
	OSM_SOURCE,
	type ImportReport,
	type ImportReportRow,
	type NormalizedProspectCandidate
} from '$lib/server/overpass-import';

export type VenueProspectRow = Database['public']['Tables']['venue_prospects']['Row'];

const PROTECTED_STATUSES: VenueProspectLifecycle[] = ['verified', 'claim_pending'];

export async function listProspects(
	supabase: SupabaseClient<Database>,
	opts: { status?: VenueProspectLifecycle | VenueProspectLifecycle[]; limit?: number } = {}
): Promise<VenueProspectRow[]> {
	let q = supabase.from('venue_prospects').select('*').order('name').limit(opts.limit ?? 500);
	if (opts.status) {
		const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
		q = q.in('lifecycle_status', statuses);
	}
	const { data, error } = await q;
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function getProspectById(
	supabase: SupabaseClient<Database>,
	id: string
): Promise<VenueProspectRow | null> {
	const { data, error } = await supabase
		.from('venue_prospects')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return data;
}

export async function getPublicProspect(
	supabase: SupabaseClient<Database>,
	id: string
): Promise<VenueProspectRow | null> {
	const row = await getProspectById(supabase, id);
	if (!row) return null;
	if (row.lifecycle_status !== 'unclaimed' && row.lifecycle_status !== 'claim_pending') {
		return null;
	}
	return row;
}

export async function updateProspect(
	supabase: SupabaseClient<Database>,
	id: string,
	patch: Database['public']['Tables']['venue_prospects']['Update']
): Promise<VenueProspectRow> {
	const { data, error } = await supabase
		.from('venue_prospects')
		.update({ ...patch, updated_at: new Date().toISOString() } as never)
		.eq('id', id)
		.select('*')
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) throw new Error('Prospect not found');
	return data;
}

export async function approveProspectAsUnclaimed(
	supabase: SupabaseClient<Database>,
	id: string
): Promise<VenueProspectRow> {
	const row = await getProspectById(supabase, id);
	if (!row) throw new Error('Prospect not found');
	if (row.lifecycle_status !== 'draft' && row.lifecycle_status !== 'inactive') {
		throw new Error(`Cannot publish prospect in status ${row.lifecycle_status}`);
	}
	return updateProspect(supabase, id, { lifecycle_status: 'unclaimed', rejected_reason: null });
}

export async function rejectProspect(
	supabase: SupabaseClient<Database>,
	id: string,
	reason: string
): Promise<VenueProspectRow> {
	return updateProspect(supabase, id, {
		lifecycle_status: 'inactive',
		rejected_reason: reason.trim() || 'Rejected by admin'
	});
}

export async function mergeProspects(
	supabase: SupabaseClient<Database>,
	keepId: string,
	mergeId: string
): Promise<VenueProspectRow> {
	if (keepId === mergeId) throw new Error('Cannot merge a prospect into itself');
	const [keep, merge] = await Promise.all([
		getProspectById(supabase, keepId),
		getProspectById(supabase, mergeId)
	]);
	if (!keep || !merge) throw new Error('Prospect not found');
	if (merge.lifecycle_status === 'verified' || merge.linked_venue_id) {
		throw new Error('Cannot merge a verified/linked prospect away');
	}

	await updateProspect(supabase, mergeId, {
		lifecycle_status: 'inactive',
		merged_into_id: keepId,
		rejected_reason: `Merged into ${keep.name}`
	});

	await supabase
		.from('venue_claims')
		.update({ prospect_id: keepId, updated_at: new Date().toISOString() } as never)
		.eq('prospect_id', mergeId)
		.eq('status', 'pending');

	return keep;
}

function softFieldUpdate(
	existing: VenueProspectRow,
	incoming: NormalizedProspectCandidate
): Database['public']['Tables']['venue_prospects']['Update'] | null {
	/* Never overwrite verified/claim_pending core identity from import */
	if (PROTECTED_STATUSES.includes(existing.lifecycle_status) || existing.linked_venue_id) {
		return {
			last_checked_at: new Date().toISOString()
		};
	}

	const patch: Database['public']['Tables']['venue_prospects']['Update'] = {
		last_checked_at: new Date().toISOString(),
		name: incoming.name,
		category: incoming.category,
		address: incoming.address,
		locality: incoming.locality,
		postcode: incoming.postcode,
		latitude: incoming.latitude,
		longitude: incoming.longitude,
		website: incoming.website,
		phone: incoming.phone,
		source_url: incoming.source_url
	};
	return patch;
}

async function findNearbyNameDuplicate(
	supabase: SupabaseClient<Database>,
	candidate: NormalizedProspectCandidate,
	excludeSourceId?: string
): Promise<VenueProspectRow | null> {
	const { data, error } = await supabase
		.from('venue_prospects')
		.select('*')
		.eq('source', OSM_SOURCE)
		.limit(2000);
	if (error) throw new Error(error.message);

	for (const row of data ?? []) {
		if (excludeSourceId && row.source_record_id === excludeSourceId) continue;
		if (row.lifecycle_status === 'inactive' && row.merged_into_id) continue;
		if (!namesLikelyDuplicate(row.name, candidate.name)) continue;
		const d = distanceMetres(
			{ lat: row.latitude, lng: row.longitude },
			{ lat: candidate.latitude, lng: candidate.longitude }
		);
		if (d <= 80) return row;
	}
	return null;
}

export async function runOverpassImport(
	supabase: SupabaseClient<Database>,
	opts: { dryRun?: boolean; preferCache?: boolean } = {}
): Promise<ImportReport> {
	const dryRun = Boolean(opts.dryRun);
	const preferCache = Boolean(opts.preferCache);
	const queried_at = new Date().toISOString();
	const { elements, endpoint, from_cache } = await fetchBristolVenueCandidates(undefined, {
		preferCache,
		allowCacheFallback: true
	});

	const rows: ImportReportRow[] = [];
	let inserted = 0;
	let updated = 0;
	let skipped = 0;
	let invalid = 0;
	let protectedCount = 0;
	let normalized = 0;

	const seen = new Set<string>();
	const candidates: NormalizedProspectCandidate[] = [];

	for (const el of elements) {
		const c = normalizeOverpassElement(el);
		if (!c) {
			invalid += 1;
			rows.push({
				source_record_id: `${el.type}/${el.id}`,
				name: el.tags?.name ?? '(unnamed)',
				action: 'invalid',
				reason: 'Missing name or invalid coordinates'
			});
			continue;
		}
		if (seen.has(c.source_record_id)) {
			skipped += 1;
			rows.push({
				source_record_id: c.source_record_id,
				name: c.name,
				action: 'skip',
				reason: 'Duplicate in Overpass response'
			});
			continue;
		}
		seen.add(c.source_record_id);
		candidates.push(c);
		normalized += 1;
	}

	for (const candidate of candidates) {
		const { data: existing, error: findErr } = await supabase
			.from('venue_prospects')
			.select('*')
			.eq('source', candidate.source)
			.eq('source_record_id', candidate.source_record_id)
			.maybeSingle();

		if (findErr) throw new Error(findErr.message);

		if (existing) {
			const isProtected =
				PROTECTED_STATUSES.includes(existing.lifecycle_status) || Boolean(existing.linked_venue_id);

			if (isProtected) {
				protectedCount += 1;
				rows.push({
					source_record_id: candidate.source_record_id,
					name: candidate.name,
					action: 'protected',
					reason: `Existing ${existing.lifecycle_status}; last_checked only`
				});
				if (!dryRun) {
					await updateProspect(supabase, existing.id, {
						last_checked_at: queried_at
					});
				}
				continue;
			}

			const patch = softFieldUpdate(existing, candidate);
			if (!dryRun && patch) {
				await updateProspect(supabase, existing.id, patch);
			}
			updated += 1;
			rows.push({
				source_record_id: candidate.source_record_id,
				name: candidate.name,
				action: 'update'
			});
			continue;
		}

		const nearDup = await findNearbyNameDuplicate(supabase, candidate);
		if (nearDup) {
			skipped += 1;
			rows.push({
				source_record_id: candidate.source_record_id,
				name: candidate.name,
				action: 'skip',
				reason: `Near-duplicate of ${nearDup.source_record_id} (${nearDup.name})`
			});
			continue;
		}

		if (!dryRun) {
			const { error: insertErr } = await supabase.from('venue_prospects').insert({
				name: candidate.name,
				category: candidate.category,
				address: candidate.address,
				locality: candidate.locality,
				postcode: candidate.postcode,
				latitude: candidate.latitude,
				longitude: candidate.longitude,
				website: candidate.website,
				phone: candidate.phone,
				source: candidate.source,
				source_record_id: candidate.source_record_id,
				source_url: candidate.source_url,
				imported_at: queried_at,
				last_checked_at: queried_at,
				lifecycle_status: 'draft'
			} as never);
			if (insertErr) throw new Error(insertErr.message);
		}

		inserted += 1;
		rows.push({
			source_record_id: candidate.source_record_id,
			name: candidate.name,
			action: 'insert'
		});
	}

	return {
		dry_run: dryRun,
		fetched: elements.length,
		normalized,
		inserted,
		updated,
		skipped,
		invalid,
		protected: protectedCount,
		rows,
		queried_at,
		bbox: {
			south: 51.384,
			west: -2.722,
			north: 51.544,
			east: -2.45
		},
		source_endpoint: endpoint,
		from_cache
	};
}
