import { BRISTOL_CITY_ID } from '$lib/constants/geo';
import type { BristolDistrict } from '$lib/data/simulated-users';
import type {
	SimulatedAdminProfile,
	SimulatedArtistProfile,
	SimulatedBuyerProfile,
	SimulatedUser,
	SimulatedVenueProfile
} from '$lib/data/simulated-users';
import type { Database, UserType } from '$lib/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const DISTRICT_LABELS: Record<BristolDistrict, string> = {
	stokes_croft: 'Stokes Croft, Bristol',
	montpelier: 'Montpelier, Bristol',
	clifton: 'Clifton, Bristol',
	harbourside: 'Harbourside, Bristol'
};

function asDistrict(value: string | null | undefined): BristolDistrict {
	if (
		value === 'stokes_croft' ||
		value === 'montpelier' ||
		value === 'clifton' ||
		value === 'harbourside'
	) {
		return value;
	}
	return 'stokes_croft';
}

function locationForProfile(profile: ProfileRow, placeHint?: string | null): string {
	if (placeHint?.trim()) return placeHint.trim();
	if (profile.postcode) {
		return profile.postcode;
	}
	if (profile.district) {
		return DISTRICT_LABELS[asDistrict(profile.district)];
	}
	return 'United Kingdom';
}

export type SessionIdentity = SimulatedUser;

export function profileToIdentity(
	profile: ProfileRow,
	placeHint?: string | null
): SessionIdentity {
	const district = asDistrict(profile.district);
	const location = locationForProfile(profile, placeHint);

	switch (profile.user_type as UserType) {
		case 'artist':
			return {
				role: 'artist',
				id: profile.id,
				username: profile.username,
				full_name: profile.full_name ?? profile.username,
				location,
				medium: profile.medium ?? 'Mixed Media',
				district,
				aesthetic_tags: profile.aesthetic_tags ?? [],
				bio: profile.bio,
				website: profile.website,
				instagram: profile.instagram
			} satisfies SimulatedArtistProfile;
		case 'venue':
			return {
				role: 'venue',
				id: profile.id,
				username: profile.username,
				full_name: profile.full_name ?? profile.username,
				location,
				district,
				footfall: (profile.footfall as SimulatedVenueProfile['footfall']) || 'medium',
				aesthetic_tags: profile.aesthetic_tags ?? ['contemporary'],
				preferred_media: profile.preferred_media ?? [],
				bio: profile.bio,
				image_url: profile.image_url,
				website: profile.website,
				instagram: profile.instagram
			} satisfies SimulatedVenueProfile;
		case 'admin':
			return {
				role: 'admin',
				id: profile.id,
				username: profile.username,
				full_name: profile.full_name ?? profile.username,
				location: 'Art Hawks'
			} satisfies SimulatedAdminProfile;
		case 'buyer':
		default:
			return {
				role: 'buyer',
				id: profile.id,
				username: profile.username,
				full_name: profile.full_name ?? profile.username,
				location
			} satisfies SimulatedBuyerProfile;
	}
}

export { BRISTOL_CITY_ID };
