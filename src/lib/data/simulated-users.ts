export type SimulatedRole = 'artist' | 'venue' | 'buyer' | 'admin';

export type BristolDistrict = 'stokes_croft' | 'montpelier' | 'clifton' | 'harbourside';

export interface SimulatedArtistProfile {
	role: 'artist';
	id: string;
	username: string;
	full_name: string;
	location: string;
	medium: string;
	district: BristolDistrict;
	aesthetic_tags: string[];
	/** Story the artist carries into rooms - persisted to profiles.bio */
	bio?: string | null;
	website?: string | null;
	instagram?: string | null;
}

export interface SimulatedVenueProfile {
	role: 'venue';
	id: string;
	username: string;
	full_name: string;
	location: string;
	district: BristolDistrict;
	footfall: 'high' | 'medium' | 'low';
	aesthetic_tags: string[];
	preferred_media: string[];
	/** Optional promotional copy persisted to profiles.bio */
	bio?: string | null;
	/** Atmosphere image for the public room page */
	image_url?: string | null;
	website?: string | null;
	instagram?: string | null;
}

export interface SimulatedBuyerProfile {
	role: 'buyer';
	id: string;
	username: string;
	full_name: string;
	location: string;
}

export interface SimulatedAdminProfile {
	role: 'admin';
	id: string;
	username: string;
	full_name: string;
	location: string;
}

export type SimulatedUser =
	| SimulatedArtistProfile
	| SimulatedVenueProfile
	| SimulatedBuyerProfile
	| SimulatedAdminProfile;

/*
 * Prototype personas for identity simulation before Supabase session wiring.
 * Swap via the Identity Switcher to test each audience journey in isolation.
 */
export const SIMULATED_USERS: SimulatedUser[] = [
	{
		role: 'artist',
		id: 'a0000000-0000-4000-8000-000000000001',
		username: 'neil_watson',
		full_name: 'Neil Watson',
		location: 'Stokes Croft, Bristol',
		medium: 'Oil',
		district: 'stokes_croft',
		aesthetic_tags: ['figurative', 'urban', 'oil'],
		bio: 'Bristol painter working in oil - quiet urban pauses, long light, and the spaces between footsteps.',
		website: 'https://neilwatson.art',
		instagram: '@neil_watson'
	},
	{
		role: 'artist',
		id: 'a0000000-0000-4000-8000-000000000002',
		username: 'elena_voss',
		full_name: 'Elena Voss',
		location: 'Montpelier, Bristol',
		medium: 'Contemporary / Mixed Media',
		district: 'montpelier',
		aesthetic_tags: ['contemporary', 'mixed_media', 'experimental'],
		bio: 'Montpelier-based contemporary artist exploring signal, collage, and geometry for rooms that prefer experiment over ornament.',
		instagram: '@elena.voss'
	},
	{
		role: 'venue',
		id: 'c0000000-0000-4000-8000-000000000001',
		username: 'the_gallimaufry',
		full_name: 'The Gallimaufry',
		location: 'Stokes Croft, Bristol',
		district: 'stokes_croft',
		footfall: 'high',
		aesthetic_tags: ['bohemian', 'eclectic', 'high_footfall'],
		preferred_media: ['oil', 'mixed media', 'acrylic'],
		bio: 'A quirky and vibrant space, The Gallimaufry invites you to unwind in a cosy atmosphere. Come in and enjoy local & carefully sourced beers, food from our kitchen pop-ups, and live music from Bristol’s best emerging artists every night of the week.',
		image_url:
			'https://images.squarespace-cdn.com/content/v1/623862f6046c27587d5092b1/b9fc271b-a869-4448-b6a2-dcb61d40ff5a/DSCF8562+%281%29.jpeg',
		website: 'https://thegallimaufry.co.uk',
		instagram: '@thegallimaufry'
	},
	{
		role: 'venue',
		id: 'c0000000-0000-4000-8000-000000000002',
		username: 'spicer_and_cole',
		full_name: 'Spicer & Cole',
		location: 'Clifton, Bristol',
		district: 'clifton',
		footfall: 'medium',
		aesthetic_tags: ['minimalist', 'clean', 'contemporary'],
		preferred_media: ['watercolor', 'acrylic', 'mixed media'],
		bio: 'We’re Spicer+Cole, four independent cafés in the heart of Bristol.\n\nWe think delicious food, along with good coffee, deserve a great place in which to be savoured. That’s why all our cafés are welcoming, light-filled spaces in lovely locations.\n\nThere’s Finzels Reach, leafy Queen Square and vibrant Clifton Village. In each café we serve the best artisan coffee and loose-leaf tea, together with super-fresh seasonal food, made from scratch in our kitchens each day.\n\nBreakfast, lunch, coffee and cake, all made by people who care. Come and join us…',
		image_url:
			'https://images.squarespace-cdn.com/content/v1/581c739fb3db2bd19dffa8b5/1489221758443-PY3JAVWPKX0WG8T9P65C/5D014586.jpg?format=2500w',
		website: 'https://spicerandcole.co.uk',
		instagram: '@spicerandcole'
	},
	{
		role: 'buyer',
		id: 'b0000000-0000-4000-8000-000000000099',
		username: 'guest_buyer',
		full_name: 'Guest Buyer',
		location: 'Bristol'
	}
];

export const DEFAULT_SIMULATED_USER_ID = SIMULATED_USERS[0].id;

export function getSimulatedUserById(userId: string): SimulatedUser | undefined {
	return SIMULATED_USERS.find((user) => user.id === userId);
}

export const DISTRICT_COORDINATES: Record<BristolDistrict, { lat: number; lng: number }> = {
	stokes_croft: { lat: 51.4642, lng: -2.5918 },
	montpelier: { lat: 51.4681, lng: -2.5776 },
	clifton: { lat: 51.4554, lng: -2.6181 },
	harbourside: { lat: 51.4502, lng: -2.5979 }
};
