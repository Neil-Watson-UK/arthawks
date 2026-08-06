import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	const [purchasesRes, balancesRes, ledgerRes] = await Promise.all([
		supabase
			.from('purchases')
			.select(
				'id, artwork_id, artist_id, venue_id, finder_venue_id, buyer_email, amount_pence, currency, status, artist_share_pence, venue_share_pence, finder_share_pence, platform_share_pence, ledger_posted_at, paid_at, collected_at, created_at'
			)
			.order('created_at', { ascending: false })
			.limit(200),
		supabase
			.from('account_balances')
			.select('party_type, party_id, available_pence, lifetime_pence, updated_at')
			.order('lifetime_pence', { ascending: false })
			.limit(200),
		supabase
			.from('ledger_entries')
			.select('id, purchase_id, party_type, party_id, amount_pence, kind, created_at')
			.order('created_at', { ascending: false })
			.limit(300)
	]);

	const purchases = purchasesRes.data ?? [];
	const balances = balancesRes.data ?? [];
	const ledger = ledgerRes.data ?? [];

	const partyIds = [
		...new Set([
			...purchases.map((p) => p.artist_id),
			...purchases.map((p) => p.venue_id).filter(Boolean) as string[],
			...purchases.map((p) => p.finder_venue_id).filter(Boolean) as string[],
			...balances.map((b) => b.party_id),
			...ledger.map((l) => l.party_id)
		])
	];

	const artworkIds = [...new Set(purchases.map((p) => p.artwork_id))];

	const [{ data: profiles }, { data: venues }, { data: artworks }] = await Promise.all([
		partyIds.length
			? supabase.from('profiles').select('id, full_name, username, user_type').in('id', partyIds)
			: Promise.resolve({ data: [] as { id: string; full_name: string | null; username: string; user_type: string }[] }),
		partyIds.length
			? supabase.from('venues').select('id, name').in('id', partyIds)
			: Promise.resolve({ data: [] as { id: string; name: string }[] }),
		artworkIds.length
			? supabase.from('artworks').select('id, title').in('id', artworkIds)
			: Promise.resolve({ data: [] as { id: string; title: string }[] })
	]);

	const nameById = new Map<string, string>();
	for (const p of profiles ?? []) {
		nameById.set(p.id, p.full_name ?? p.username);
	}
	for (const v of venues ?? []) {
		nameById.set(v.id, v.name);
	}
	nameById.set('00000000-0000-0000-0000-000000000001', 'Art Hawks platform');

	const titleById = new Map((artworks ?? []).map((a) => [a.id, a.title]));

	const gmv = purchases
		.filter((p) => p.status === 'paid' || p.status === 'collected')
		.reduce((sum, p) => sum + (p.amount_pence ?? 0), 0);

	const csvRows = [
		[
			'purchase_id',
			'created_at',
			'status',
			'artwork',
			'artist',
			'venue',
			'finder_venue',
			'buyer_email',
			'amount_pence',
			'artist_share_pence',
			'venue_share_pence',
			'finder_share_pence',
			'platform_share_pence',
			'ledger_posted_at',
			'paid_at',
			'collected_at'
		].join(','),
		...purchases.map((p) =>
			[
				p.id,
				p.created_at,
				p.status,
				csvEscape(titleById.get(p.artwork_id) ?? p.artwork_id),
				csvEscape(nameById.get(p.artist_id) ?? p.artist_id),
				csvEscape(p.venue_id ? nameById.get(p.venue_id) ?? p.venue_id : ''),
				csvEscape(p.finder_venue_id ? nameById.get(p.finder_venue_id) ?? p.finder_venue_id : ''),
				csvEscape(p.buyer_email ?? ''),
				p.amount_pence,
				p.artist_share_pence ?? '',
				p.venue_share_pence ?? '',
				p.finder_share_pence ?? '',
				p.platform_share_pence ?? '',
				p.ledger_posted_at ?? '',
				p.paid_at ?? '',
				p.collected_at ?? ''
			].join(',')
		)
	];

	return {
		error:
			purchasesRes.error?.message ??
			balancesRes.error?.message ??
			ledgerRes.error?.message ??
			null,
		gmv_pence: gmv,
		purchases: purchases.map((p) => ({
			...p,
			artwork_title: titleById.get(p.artwork_id) ?? '-',
			artist_name: nameById.get(p.artist_id) ?? '-',
			venue_name: p.venue_id ? nameById.get(p.venue_id) ?? '-' : '-',
			finder_name: p.finder_venue_id ? nameById.get(p.finder_venue_id) ?? '-' : '-'
		})),
		balances: balances.map((b) => ({
			...b,
			party_name: nameById.get(b.party_id) ?? b.party_id
		})),
		ledger: ledger.map((row) => ({
			...row,
			party_name: nameById.get(row.party_id) ?? row.party_id
		})),
		csv: csvRows.join('\n')
	};
};

function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}
