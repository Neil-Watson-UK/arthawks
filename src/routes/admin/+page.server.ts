import { adminServiceClient } from '$lib/server/admin';
import { getPlatformBalance, sumPaidGmvPence } from '$lib/server/ledger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	async function headCount(
		run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>
	): Promise<number> {
		const { count, error } = await run();
		if (error) {
			console.warn('admin count:', error.message);
			return 0;
		}
		return count ?? 0;
	}

	const [artists, venueUsers, buyers, admins, artworks, venues, openMatches, recentScans] =
		await Promise.all([
			headCount(() =>
				supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'artist')
			),
			headCount(() =>
				supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'venue')
			),
			headCount(() =>
				supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'buyer')
			),
			headCount(() =>
				supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'admin')
			),
			headCount(() => supabase.from('artworks').select('*', { count: 'exact', head: true })),
			headCount(() => supabase.from('venues').select('*', { count: 'exact', head: true })),
			headCount(() =>
				supabase
					.from('matches')
					.select('*', { count: 'exact', head: true })
					.in('status', ['pending', 'accepted'])
			),
			headCount(() => supabase.from('qr_scans').select('*', { count: 'exact', head: true }))
		]);

	let platformBalance = { available_pence: 0, lifetime_pence: 0 };
	let gmvPence = 0;
	try {
		[platformBalance, gmvPence] = await Promise.all([getPlatformBalance(), sumPaidGmvPence()]);
	} catch (err) {
		console.warn('admin ledger skipped:', err);
	}

	return {
		stats: {
			artists,
			venueUsers,
			buyers,
			admins,
			artworks,
			venues,
			openMatches,
			recentScans,
			gmv_pence: gmvPence,
			platform_available_pence: platformBalance.available_pence,
			platform_lifetime_pence: platformBalance.lifetime_pence
		}
	};
};
