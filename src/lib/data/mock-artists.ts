import type { ArtStyle } from '$lib/constants/art-styles';
import type { SubstrateTier } from '$lib/constants/auto-amor';
import type { ArtworkSpotting } from '$lib/types/swipe';
import type { BristolDistrict } from '$lib/data/simulated-users';

/* Base path for locally hosted artwork images (maps to /static/artworks/) */
export const ARTWORK_IMAGE_BASE = '/artworks';

export interface MockArtistProfile {
	id: string;
	username: string;
	full_name: string;
	location: string;
	medium: string;
	district: BristolDistrict;
}

export interface MockArtworkListing {
	id: string;
	artist_id: string;
	title: string;
	medium: string;
	/** Artist story - the human door into the work */
	description?: string | null;
	/** Price in minor currency units (pence) for Stripe compatibility */
	price: number;
	height_cm: number;
	width_cm: number;
	/** Filename only - resolved via artworkImageUrl() */
	image_filename: string;
	distance_meters: number;
	/** Visual classification for taste + venue curation */
	style?: ArtStyle | null;
	/** custom | auto_amor_24x30 - Auto Amor boards are plug-and-play */
	substrate_tier?: SubstrateTier;
	is_plug_and_play?: boolean;
	spottings?: ArtworkSpotting[];
}

export function artworkImageUrl(filename: string): string {
	return filename ? `${ARTWORK_IMAGE_BASE}/${filename}` : '';
}

export function gbpToPence(gbp: number): number {
	return Math.round(gbp * 100);
}

/*
 * Initial artist catalogue for local MVP loading.
 * Supabase seed script can mirror this structure in a later pass.
 */
export const mockArtistProfiles: MockArtistProfile[] = [
	{
		id: 'a0000000-0000-4000-8000-000000000001',
		username: 'neil_watson',
		full_name: 'Neil Watson',
		location: 'Stokes Croft, Bristol',
		medium: 'Oil',
		district: 'stokes_croft'
	},
	{
		id: 'a0000000-0000-4000-8000-000000000002',
		username: 'elena_voss',
		full_name: 'Elena Voss',
		location: 'Montpelier, Bristol',
		medium: 'Contemporary / Mixed Media',
		district: 'montpelier'
	}
];

export const mockArtworkListings: MockArtworkListing[] = [
	{
		id: 'b0000000-0000-4000-8000-000000000001',
		artist_id: 'a0000000-0000-4000-8000-000000000001',
		title: 'Bridge of Gert Sighs',
		medium: 'Oil on canvas',
		description:
			'Painted from the path above the Avon, where the bridge holds the city in a long pause. I wanted the quiet between footsteps - the kind of pause Hopper knew.',
		price: gbpToPence(1850),
		height_cm: 90,
		width_cm: 70,
		image_filename: 'BridgeofGertSighs.JPG',
		distance_meters: 820,
		style: 'landscape',
		spottings: [
			{
				username: 'maya_k',
				venue_name: 'The Gallimaufry',
				location: 'Bristol'
			}
		]
	},
	{
		id: 'b0000000-0000-4000-8000-000000000002',
		artist_id: 'a0000000-0000-4000-8000-000000000001',
		title: 'Stokes Croft',
		medium: 'Oil on canvas',
		description:
			'Stokes Croft at the blue hour. Neon, brick, and the soft insistence of people still out walking. A street portrait for walls that live with conversation.',
		price: gbpToPence(1450),
		height_cm: 80,
		width_cm: 60,
		image_filename: 'StokesCroft.jpg',
		distance_meters: 1100,
		style: 'figurative'
	},
	{
		id: 'b0000000-0000-4000-8000-000000000003',
		artist_id: 'a0000000-0000-4000-8000-000000000001',
		title: 'Girl with a Pearl Earring',
		medium: 'Oil on canvas',
		description:
			'A contemporary reading of a familiar gaze - oil, patience, and the question of who is looking back. Made for rooms where strangers become company.',
		price: gbpToPence(2200),
		height_cm: 100,
		width_cm: 80,
		image_filename: 'GirlwithPearlEarring.webp',
		distance_meters: 1350,
		style: 'portrait',
		spottings: [
			{
				username: 'lucia_p',
				venue_name: 'Paper & Grain',
				location: 'Bath'
			}
		]
	},
	{
		id: 'b0000000-0000-4000-8000-000000000004',
		artist_id: 'a0000000-0000-4000-8000-000000000002',
		title: 'Signal Collage No. 7',
		medium: 'Mixed media on Auto Amor board',
		description:
			'Layered paper, found pigment, and the signal noise of Montpelier nights. Painted on an official Auto Amor 24×30cm Project Board for plug-and-play venue walls.',
		price: gbpToPence(980),
		height_cm: 24,
		width_cm: 30,
		image_filename: 'StokesCroft.jpg',
		distance_meters: 640,
		style: 'graphic',
		substrate_tier: 'auto_amor_24x30',
		is_plug_and_play: true
	},
	{
		id: 'b0000000-0000-4000-8000-000000000005',
		artist_id: 'a0000000-0000-4000-8000-000000000002',
		title: 'Quiet Geometry',
		medium: 'Acrylic and ink on Auto Amor board',
		description:
			'Quiet Geometry is about breathing room - ink lines that refuse to shout. On a verified Auto Amor 24×30cm board for standard wall anchors.',
		price: gbpToPence(1250),
		height_cm: 24,
		width_cm: 30,
		image_filename: 'GirlwithPearlEarring.webp',
		distance_meters: 720,
		style: 'abstract',
		substrate_tier: 'auto_amor_24x30',
		is_plug_and_play: true
	}
];

export function getArtistById(artistId: string): MockArtistProfile | undefined {
	return mockArtistProfiles.find((artist) => artist.id === artistId);
}
