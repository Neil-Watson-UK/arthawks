export type MapPlacement = 'showing' | 'transit';

export interface MapWorkPin {
	id: string;
	title: string;
	image_url: string;
	artist_name: string;
	placement: MapPlacement;
}

export interface CityMapPin {
	venue_id: string;
	venue_name: string;
	venue_username: string;
	venue_bio: string | null;
	opening_hours: string | null;
	lat: number;
	lng: number;
	showing_count: number;
	transit_count: number;
	works: MapWorkPin[];
}

/** Public unclaimed / claim_pending OSM prospects - not Art Hawks partners */
export interface ProspectMapPin {
	prospect_id: string;
	name: string;
	category: string | null;
	lat: number;
	lng: number;
	lifecycle_status: 'unclaimed' | 'claim_pending';
	label: 'Potential Art Hawks space';
}

export interface CityMapResponse {
	city: string;
	center: { lat: number; lng: number };
	pins: CityMapPin[];
	prospect_pins?: ProspectMapPin[];
}
