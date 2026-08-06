import { requireUserType } from '$lib/server/auth';
import { getVenueBalance } from '$lib/server/ledger';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { getVenueOwnedBy } from '$lib/server/venues';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = requireUserType(event, 'venue');

	let venueId = profile.id;
	let venueName = profile.full_name ?? profile.username;
	let postcode = profile.postcode ?? null;
	let openingHours: string | null = null;
	let onMap = Boolean(profile.geographic_location || profile.postcode);
	let imageUrl = profile.image_url ?? null;
	let footfall = profile.footfall ?? 'medium';
	let bio = profile.bio ?? null;
	let website = profile.website ?? null;
	let instagram = profile.instagram ?? null;
	let balance = { available_pence: 0, lifetime_pence: 0 };
	let venue: Awaited<ReturnType<typeof getVenueOwnedBy>> = null;

	if (hasPublicSupabaseEnv()) {
		try {
			const supabase = createServiceClient();
			venue = await getVenueOwnedBy(supabase, profile.id);
			if (venue) {
				venueId = venue.id;
				venueName = venue.name;
				postcode = venue.postcode ?? postcode;
				openingHours = venue.opening_hours ?? null;
				onMap = Boolean(venue.geographic_location || postcode);
				imageUrl = venue.image_url ?? imageUrl;
				footfall = venue.footfall ?? footfall;
				bio = venue.bio ?? bio;
				website = venue.website ?? website;
				instagram = venue.instagram ?? instagram;
				balance = await getVenueBalance(venue.id);
			}
		} catch (err) {
			console.warn('Venue resolve skipped:', err);
		}
	}

	return {
		profile,
		venueId,
		venueName,
		balance,
		partnerStatus: (venue?.partner_status as string | undefined) ?? (venue ? 'active' : null),
		venueIdentity: {
			full_name: venueName,
			bio,
			website,
			instagram,
			image_url: imageUrl,
			postcode,
			opening_hours: openingHours,
			footfall,
			on_map: onMap
		}
	};
};
