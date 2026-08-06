import { createServiceClient } from '$lib/server/supabase';
import type { Database } from '$lib/types/database';

export const PLATFORM_PARTY_ID = '00000000-0000-0000-0000-000000000001';

export const SALE_SPLIT = {
	artistPercent: 70,
	venuePercent: 15,
	finderPercent: 5,
	platformPercent: 15
} as const;

export type BalancePartyType = 'artist' | 'venue' | 'platform';
export type AccountBalanceRow = Database['public']['Tables']['account_balances']['Row'];
export type PurchaseRow = Database['public']['Tables']['purchases']['Row'];

export type SaleAttribution = 'wall' | 'finder' | 'none';

export type SaleSplit = {
	artistSharePence: number;
	venueSharePence: number;
	finderSharePence: number;
	platformSharePence: number;
	attribution: SaleAttribution;
};

/**
 * wall → 70 / 15 / 0 / ~15
 * finder → 70 / 0 / 5 / rest
 * none → artist keeps venue share, platform 15%
 */
export function computeSaleSplit(amountPence: number, attribution: SaleAttribution): SaleSplit {
	if (attribution === 'wall') {
		const artistSharePence = Math.floor((amountPence * SALE_SPLIT.artistPercent) / 100);
		const venueSharePence = Math.floor((amountPence * SALE_SPLIT.venuePercent) / 100);
		return {
			artistSharePence,
			venueSharePence,
			finderSharePence: 0,
			platformSharePence: amountPence - artistSharePence - venueSharePence,
			attribution
		};
	}

	if (attribution === 'finder') {
		const artistSharePence = Math.floor((amountPence * SALE_SPLIT.artistPercent) / 100);
		const finderSharePence = Math.floor((amountPence * SALE_SPLIT.finderPercent) / 100);
		return {
			artistSharePence,
			venueSharePence: 0,
			finderSharePence,
			platformSharePence: amountPence - artistSharePence - finderSharePence,
			attribution
		};
	}

	const platformSharePence = Math.floor((amountPence * SALE_SPLIT.platformPercent) / 100);
	return {
		artistSharePence: amountPence - platformSharePence,
		venueSharePence: 0,
		finderSharePence: 0,
		platformSharePence,
		attribution: 'none'
	};
}

export async function applyPurchaseLedger(purchaseId: string): Promise<PurchaseRow | null> {
	const supabase = createServiceClient();
	const { data, error } = await supabase.rpc('apply_purchase_ledger', {
		p_purchase_id: purchaseId
	});

	if (error) {
		if (error.code === '42P01' || error.code === '42883' || error.code === '42703') {
			console.warn('Ledger RPC unavailable - run sale ledger migrations');
			return null;
		}
		throw new Error(error.message);
	}

	return data as PurchaseRow;
}

export async function getPartyBalance(
	partyType: BalancePartyType,
	partyId: string
): Promise<{ available_pence: number; lifetime_pence: number }> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('account_balances')
		.select('available_pence, lifetime_pence')
		.eq('party_type', partyType)
		.eq('party_id', partyId)
		.maybeSingle();

	if (error) {
		if (error.code === '42P01' || error.code === '42703') {
			return { available_pence: 0, lifetime_pence: 0 };
		}
		throw new Error(error.message);
	}

	return {
		available_pence: data?.available_pence ?? 0,
		lifetime_pence: data?.lifetime_pence ?? 0
	};
}

export async function getPlatformBalance() {
	return getPartyBalance('platform', PLATFORM_PARTY_ID);
}

export async function getArtistBalance(artistId: string) {
	return getPartyBalance('artist', artistId);
}

export async function getVenueBalance(venueId: string) {
	return getPartyBalance('venue', venueId);
}

export async function sumPaidGmvPence(): Promise<number> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('purchases')
		.select('amount_pence')
		.in('status', ['paid', 'collected']);

	if (error) {
		if (error.code === '42P01' || error.code === '42703') return 0;
		throw new Error(error.message);
	}

	return (data ?? []).reduce((sum, row) => sum + (row.amount_pence ?? 0), 0);
}

/** Distinct artworks sold through Art Hawks checkout (social proof). */
export async function countWorksSoldThroughPlatform(): Promise<number> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('purchases')
		.select('artwork_id')
		.in('status', ['paid', 'collected']);

	if (error) {
		if (error.code === '42P01' || error.code === '42703') return 0;
		throw new Error(error.message);
	}

	return new Set((data ?? []).map((row) => row.artwork_id)).size;
}
