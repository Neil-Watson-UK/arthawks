import type { ArtStyle } from '$lib/constants/art-styles';
import type { SubstrateTier } from '$lib/constants/auto-amor';

export type UserType = 'admin' | 'artist' | 'venue' | 'buyer';
export type ArtworkStatus = 'available' | 'matched' | 'sold';
export type MatchStatus = 'pending' | 'accepted' | 'declined';
export type SwipeDirection = 'left' | 'right';
export type InteractionType = 'like' | 'comment' | 'spotted_at_venue';
export type VenuePartnerStatus = 'verified' | 'active' | 'inactive';
export type VenueProspectLifecycle =
	| 'draft'
	| 'unclaimed'
	| 'claim_pending'
	| 'verified'
	| 'inactive';
export type VenueClaimStatus = 'pending' | 'approved' | 'rejected';
export type ContactTopic = 'hello' | 'artists' | 'venues' | 'support';
export type ContactSubmissionStatus = 'new' | 'read' | 'archived';
export type { ArtStyle, SubstrateTier };

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					updated_at: string;
					username: string;
					full_name: string | null;
					bio: string | null;
					user_type: UserType;
					website: string | null;
					instagram: string | null;
					geographic_location: string | null;
					medium: string | null;
					footfall: string | null;
					district: string | null;
					postcode: string | null;
					aesthetic_tags: string[];
					preferred_media: string[];
					image_url: string | null;
					onboarding_complete: boolean;
					city_id: string | null;
					is_active: boolean;
					email: string | null;
				};
				Insert: {
					id: string;
					username: string;
					user_type: UserType;
					full_name?: string | null;
					bio?: string | null;
					website?: string | null;
					instagram?: string | null;
					geographic_location?: string | null;
					medium?: string | null;
					footfall?: string | null;
					district?: string | null;
					postcode?: string | null;
					aesthetic_tags?: string[];
					preferred_media?: string[];
					image_url?: string | null;
					onboarding_complete?: boolean;
					city_id?: string | null;
					is_active?: boolean;
					email?: string | null;
				};
				Update: {
					username?: string;
					user_type?: UserType;
					full_name?: string | null;
					bio?: string | null;
					website?: string | null;
					instagram?: string | null;
					geographic_location?: string | null;
					medium?: string | null;
					footfall?: string | null;
					district?: string | null;
					postcode?: string | null;
					aesthetic_tags?: string[];
					preferred_media?: string[];
					image_url?: string | null;
					onboarding_complete?: boolean;
					city_id?: string | null;
					is_active?: boolean;
					email?: string | null;
				};
				Relationships: [];
			};
			cities: {
				Row: {
					id: string;
					slug: string;
					name: string;
					country_code: string;
					center: string | null;
					is_active: boolean;
					created_at: string;
				};
				Insert: {
					slug: string;
					name: string;
					id?: string;
					country_code?: string;
					center?: string | null;
					is_active?: boolean;
					created_at?: string;
				};
				Update: {
					slug?: string;
					name?: string;
					country_code?: string;
					center?: string | null;
					is_active?: boolean;
				};
				Relationships: [];
			};
			venues: {
				Row: {
					id: string;
					owner_id: string;
					city_id: string | null;
					name: string;
					slug: string;
					bio: string | null;
					website: string | null;
					instagram: string | null;
					image_url: string | null;
					geographic_location: string | null;
					district: string | null;
					postcode: string | null;
					opening_hours: string | null;
					footfall: string | null;
					aesthetic_tags: string[];
					preferred_media: string[];
					is_active: boolean;
					partner_status: VenuePartnerStatus;
					prospect_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					owner_id: string;
					name: string;
					slug: string;
					id?: string;
					city_id?: string | null;
					bio?: string | null;
					website?: string | null;
					instagram?: string | null;
					image_url?: string | null;
					geographic_location?: string | null;
					district?: string | null;
					postcode?: string | null;
					opening_hours?: string | null;
					footfall?: string | null;
					aesthetic_tags?: string[];
					preferred_media?: string[];
					is_active?: boolean;
					partner_status?: VenuePartnerStatus;
					prospect_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					owner_id?: string;
					city_id?: string | null;
					name?: string;
					slug?: string;
					bio?: string | null;
					website?: string | null;
					instagram?: string | null;
					image_url?: string | null;
					geographic_location?: string | null;
					district?: string | null;
					postcode?: string | null;
					opening_hours?: string | null;
					footfall?: string | null;
					aesthetic_tags?: string[];
					preferred_media?: string[];
					is_active?: boolean;
					partner_status?: VenuePartnerStatus;
					prospect_id?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			venue_prospects: {
				Row: {
					id: string;
					name: string;
					category: string | null;
					address: string | null;
					locality: string | null;
					postcode: string | null;
					latitude: number;
					longitude: number;
					website: string | null;
					phone: string | null;
					source: string;
					source_record_id: string;
					source_url: string | null;
					imported_at: string;
					last_checked_at: string;
					lifecycle_status: VenueProspectLifecycle;
					admin_notes: string | null;
					rejected_reason: string | null;
					merged_into_id: string | null;
					linked_venue_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					name: string;
					latitude: number;
					longitude: number;
					source_record_id: string;
					id?: string;
					category?: string | null;
					address?: string | null;
					locality?: string | null;
					postcode?: string | null;
					website?: string | null;
					phone?: string | null;
					source?: string;
					source_url?: string | null;
					imported_at?: string;
					last_checked_at?: string;
					lifecycle_status?: VenueProspectLifecycle;
					admin_notes?: string | null;
					rejected_reason?: string | null;
					merged_into_id?: string | null;
					linked_venue_id?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					name?: string;
					category?: string | null;
					address?: string | null;
					locality?: string | null;
					postcode?: string | null;
					latitude?: number;
					longitude?: number;
					website?: string | null;
					phone?: string | null;
					source?: string;
					source_record_id?: string;
					source_url?: string | null;
					imported_at?: string;
					last_checked_at?: string;
					lifecycle_status?: VenueProspectLifecycle;
					admin_notes?: string | null;
					rejected_reason?: string | null;
					merged_into_id?: string | null;
					linked_venue_id?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			venue_claims: {
				Row: {
					id: string;
					prospect_id: string;
					claimant_user_id: string;
					full_name: string;
					role_at_venue: string;
					work_email: string;
					verification_info: string;
					message: string | null;
					status: VenueClaimStatus;
					reviewed_by: string | null;
					reviewed_at: string | null;
					review_notes: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					prospect_id: string;
					claimant_user_id: string;
					full_name: string;
					role_at_venue: string;
					work_email: string;
					verification_info: string;
					id?: string;
					message?: string | null;
					status?: VenueClaimStatus;
					reviewed_by?: string | null;
					reviewed_at?: string | null;
					review_notes?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					prospect_id?: string;
					claimant_user_id?: string;
					full_name?: string;
					role_at_venue?: string;
					work_email?: string;
					verification_info?: string;
					message?: string | null;
					status?: VenueClaimStatus;
					reviewed_by?: string | null;
					reviewed_at?: string | null;
					review_notes?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			contact_submissions: {
				Row: {
					id: string;
					topic: ContactTopic;
					name: string;
					email: string;
					message: string;
					ip: string | null;
					email_sent: boolean;
					email_skipped: boolean;
					status: ContactSubmissionStatus;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					topic: ContactTopic;
					name: string;
					email: string;
					message: string;
					id?: string;
					ip?: string | null;
					email_sent?: boolean;
					email_skipped?: boolean;
					status?: ContactSubmissionStatus;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					topic?: ContactTopic;
					name?: string;
					email?: string;
					message?: string;
					ip?: string | null;
					email_sent?: boolean;
					email_skipped?: boolean;
					status?: ContactSubmissionStatus;
					updated_at?: string;
				};
				Relationships: [];
			};
			venue_ownership_audit: {
				Row: {
					id: string;
					venue_id: string | null;
					prospect_id: string | null;
					claim_id: string | null;
					actor_id: string | null;
					action: string;
					from_owner_id: string | null;
					to_owner_id: string | null;
					from_status: string | null;
					to_status: string | null;
					notes: string | null;
					created_at: string;
				};
				Insert: {
					action: string;
					id?: string;
					venue_id?: string | null;
					prospect_id?: string | null;
					claim_id?: string | null;
					actor_id?: string | null;
					from_owner_id?: string | null;
					to_owner_id?: string | null;
					from_status?: string | null;
					to_status?: string | null;
					notes?: string | null;
					created_at?: string;
				};
				Update: {
					venue_id?: string | null;
					prospect_id?: string | null;
					claim_id?: string | null;
					actor_id?: string | null;
					action?: string;
					from_owner_id?: string | null;
					to_owner_id?: string | null;
					from_status?: string | null;
					to_status?: string | null;
					notes?: string | null;
				};
				Relationships: [];
			};
			artworks: {
				Row: {
					id: string;
					artist_id: string;
					title: string;
					medium: string | null;
					description: string | null;
					style: ArtStyle | null;
					price_pence: number;
					height_cm: number | null;
					width_cm: number | null;
					substrate_tier: SubstrateTier;
					is_plug_and_play: boolean;
					image_url: string;
					status: ArtworkStatus;
					created_at: string;
				};
				Insert: {
					artist_id: string;
					title: string;
					price_pence: number;
					image_url?: string;
					medium?: string | null;
					description?: string | null;
					style?: ArtStyle | null;
					height_cm?: number | null;
					width_cm?: number | null;
					substrate_tier?: SubstrateTier;
					status?: ArtworkStatus;
					id?: string;
					created_at?: string;
				};
				Update: {
					title?: string;
					medium?: string | null;
					description?: string | null;
					style?: ArtStyle | null;
					price_pence?: number;
					height_cm?: number | null;
					width_cm?: number | null;
					substrate_tier?: SubstrateTier;
					image_url?: string;
					status?: ArtworkStatus;
				};
				Relationships: [];
			};
			matches: {
				Row: {
					id: string;
					venue_id: string;
					artwork_id: string;
					status: MatchStatus;
					created_at: string;
					starts_on: string | null;
					ends_on: string | null;
					install_buffer_hours: number;
					wall_label: string | null;
					reminder_at: string | null;
					approved_at: string | null;
					hung_at: string | null;
				};
				Insert: {
					venue_id: string;
					artwork_id: string;
					status: MatchStatus;
					id?: string;
					created_at?: string;
					starts_on?: string | null;
					ends_on?: string | null;
					install_buffer_hours?: number;
					wall_label?: string | null;
					reminder_at?: string | null;
					approved_at?: string | null;
					hung_at?: string | null;
				};
				Update: {
					status?: MatchStatus;
					starts_on?: string | null;
					ends_on?: string | null;
					install_buffer_hours?: number;
					wall_label?: string | null;
					reminder_at?: string | null;
					approved_at?: string | null;
					hung_at?: string | null;
				};
				Relationships: [];
			};
			venue_busy_periods: {
				Row: {
					id: string;
					venue_id: string;
					starts_on: string;
					ends_on: string;
					reason: string | null;
					created_at: string;
				};
				Insert: {
					venue_id: string;
					starts_on: string;
					ends_on: string;
					reason?: string | null;
					id?: string;
					created_at?: string;
				};
				Update: {
					starts_on?: string;
					ends_on?: string;
					reason?: string | null;
				};
				Relationships: [];
			};
			placement_proposals: {
				Row: {
					id: string;
					match_id: string | null;
					from_profile_id: string;
					to_profile_id: string;
					artwork_id: string;
					proposal_type: 'swap' | 'mood' | 'size' | 'hang';
					message: string | null;
					requested_mood: string | null;
					requested_min_cm: number | null;
					requested_max_cm: number | null;
					status: 'open' | 'accepted' | 'declined' | 'withdrawn';
					created_at: string;
					resolved_at: string | null;
				};
				Insert: {
					from_profile_id: string;
					to_profile_id: string;
					artwork_id: string;
					proposal_type?: 'swap' | 'mood' | 'size' | 'hang';
					match_id?: string | null;
					message?: string | null;
					requested_mood?: string | null;
					requested_min_cm?: number | null;
					requested_max_cm?: number | null;
					status?: 'open' | 'accepted' | 'declined' | 'withdrawn';
					id?: string;
					created_at?: string;
					resolved_at?: string | null;
				};
				Update: {
					status?: 'open' | 'accepted' | 'declined' | 'withdrawn';
					message?: string | null;
					resolved_at?: string | null;
				};
				Relationships: [];
			};
			qr_scans: {
				Row: {
					id: string;
					artwork_id: string;
					match_id: string | null;
					venue_id: string | null;
					scanned_at: string;
					source: 'wall_qr' | 'share' | 'unknown';
					condition: 'good' | 'needs_attention' | 'damaged' | null;
					interest_level: 'browse' | 'love' | 'buy_ask' | null;
					lat: number | null;
					lng: number | null;
					user_id: string | null;
					content: string | null;
				};
				Insert: {
					artwork_id: string;
					match_id?: string | null;
					venue_id?: string | null;
					scanned_at?: string;
					source?: 'wall_qr' | 'share' | 'unknown';
					condition?: 'good' | 'needs_attention' | 'damaged' | null;
					interest_level?: 'browse' | 'love' | 'buy_ask' | null;
					lat?: number | null;
					lng?: number | null;
					user_id?: string | null;
					content?: string | null;
					id?: string;
				};
				Update: {
					condition?: 'good' | 'needs_attention' | 'damaged' | null;
					interest_level?: 'browse' | 'love' | 'buy_ask' | null;
					content?: string | null;
				};
				Relationships: [];
			};
			social_interactions: {
				Row: {
					id: string;
					user_id: string;
					artwork_id: string;
					interaction_type: InteractionType;
					content: string | null;
					created_at: string;
				};
				Insert: {
					user_id: string;
					artwork_id: string;
					interaction_type: InteractionType;
					content?: string | null;
					id?: string;
					created_at?: string;
				};
				Update: {
					content?: string | null;
					interaction_type?: InteractionType;
				};
				Relationships: [];
			};
			purchases: {
				Row: {
					id: string;
					artwork_id: string;
					match_id: string | null;
					venue_id: string | null;
					artist_id: string;
					buyer_user_id: string | null;
					buyer_email: string | null;
					amount_pence: number;
					artist_share_pence: number | null;
					venue_share_pence: number | null;
					finder_share_pence: number | null;
					platform_share_pence: number | null;
					ledger_posted_at: string | null;
					finder_venue_id: string | null;
					currency: string;
					stripe_checkout_session_id: string | null;
					stripe_payment_intent_id: string | null;
					pickup_code: string;
					pickup_code_hash: string;
					pickup_verify_token: string | null;
					status:
						| 'pending'
						| 'paid'
						| 'collected'
						| 'expired'
						| 'refunded'
						| 'needs_refund';
					reconciliation_reason: string | null;
					winning_purchase_id: string | null;
					code_expires_at: string | null;
					paid_at: string | null;
					collected_at: string | null;
					collected_by: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					artwork_id: string;
					artist_id: string;
					amount_pence: number;
					pickup_code: string;
					pickup_code_hash: string;
					id?: string;
					match_id?: string | null;
					venue_id?: string | null;
					buyer_user_id?: string | null;
					buyer_email?: string | null;
					artist_share_pence?: number | null;
					venue_share_pence?: number | null;
					finder_share_pence?: number | null;
					platform_share_pence?: number | null;
					ledger_posted_at?: string | null;
					finder_venue_id?: string | null;
					currency?: string;
					stripe_checkout_session_id?: string | null;
					stripe_payment_intent_id?: string | null;
					pickup_verify_token?: string | null;
					status?:
						| 'pending'
						| 'paid'
						| 'collected'
						| 'expired'
						| 'refunded'
						| 'needs_refund';
					reconciliation_reason?: string | null;
					winning_purchase_id?: string | null;
					code_expires_at?: string | null;
					paid_at?: string | null;
					collected_at?: string | null;
					collected_by?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					match_id?: string | null;
					venue_id?: string | null;
					buyer_user_id?: string | null;
					buyer_email?: string | null;
					amount_pence?: number;
					artist_share_pence?: number | null;
					venue_share_pence?: number | null;
					finder_share_pence?: number | null;
					platform_share_pence?: number | null;
					ledger_posted_at?: string | null;
					finder_venue_id?: string | null;
					currency?: string;
					stripe_checkout_session_id?: string | null;
					stripe_payment_intent_id?: string | null;
					pickup_code?: string;
					pickup_code_hash?: string;
					pickup_verify_token?: string | null;
					status?:
						| 'pending'
						| 'paid'
						| 'collected'
						| 'expired'
						| 'refunded'
						| 'needs_refund';
					reconciliation_reason?: string | null;
					winning_purchase_id?: string | null;
					code_expires_at?: string | null;
					paid_at?: string | null;
					collected_at?: string | null;
					collected_by?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			account_balances: {
				Row: {
					id: string;
					party_type: 'artist' | 'venue' | 'platform';
					party_id: string;
					available_pence: number;
					lifetime_pence: number;
					updated_at: string;
				};
				Insert: {
					party_type: 'artist' | 'venue' | 'platform';
					party_id: string;
					id?: string;
					available_pence?: number;
					lifetime_pence?: number;
					updated_at?: string;
				};
				Update: {
					available_pence?: number;
					lifetime_pence?: number;
					updated_at?: string;
				};
				Relationships: [];
			};
			ledger_entries: {
				Row: {
					id: string;
					purchase_id: string;
					party_type: 'artist' | 'venue' | 'platform';
					party_id: string;
					amount_pence: number;
					kind: 'sale_credit' | 'finder_credit' | 'payout' | 'adjustment';
					created_at: string;
				};
				Insert: {
					purchase_id: string;
					party_type: 'artist' | 'venue' | 'platform';
					party_id: string;
					amount_pence: number;
					id?: string;
					kind?: 'sale_credit' | 'finder_credit' | 'payout' | 'adjustment';
					created_at?: string;
				};
				Update: {
					amount_pence?: number;
					kind?: 'sale_credit' | 'finder_credit' | 'payout' | 'adjustment';
				};
				Relationships: [];
			};
			artist_venue_interests: {
				Row: {
					id: string;
					artist_id: string;
					venue_id: string;
					artwork_id: string;
					created_at: string;
				};
				Insert: {
					artist_id: string;
					venue_id: string;
					artwork_id: string;
				};
				Update: {
					artist_id?: string;
					venue_id?: string;
					artwork_id?: string;
				};
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: {
			apply_purchase_ledger: {
				Args: {
					p_purchase_id: string;
				};
				Returns: Database['public']['Tables']['purchases']['Row'];
			};
			claim_purchase_sale: {
				Args: {
					p_purchase_id: string;
					p_paid_at: string;
					p_buyer_email: string | null;
					p_stripe_session_id: string | null;
					p_stripe_payment_intent_id: string | null;
				};
				Returns: Database['public']['Tables']['purchases']['Row'];
			};
			get_swipeable_artworks: {
				Args: {
					p_venue_id: string;
					p_limit?: number;
				};
				Returns: SwipeableArtwork[];
			};
			get_city_map_pins: {
				Args: Record<string, never>;
				Returns: {
					venue_id: string;
					venue_name: string;
					venue_username: string;
					venue_bio: string | null;
					opening_hours: string | null;
					lat: number;
					lng: number;
					showing_count: number;
					transit_count: number;
					works: unknown;
				}[];
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

export interface SwipeableArtwork {
	id: string;
	artist_id: string;
	title: string;
	medium: string | null;
	description: string | null;
	style: ArtStyle | null;
	price: number;
	height_cm: number | null;
	width_cm: number | null;
	image_url: string;
	status: ArtworkStatus;
	created_at: string;
	distance_meters: number;
	artist_username: string;
	artist_full_name: string | null;
	substrate_tier: SubstrateTier;
	is_plug_and_play: boolean;
}

export interface SwipeRequestBody {
	venue_id: string;
	artwork_id: string;
	direction: SwipeDirection;
}

export interface SwipeResponse {
	match: boolean;
	status: MatchStatus;
	message: string;
	match_id: string;
}
