import type { MatchStatus } from '$lib/types/database';

export type ProposalType = 'swap' | 'mood' | 'size' | 'hang';
export type ProposalStatus = 'open' | 'accepted' | 'declined' | 'withdrawn';
export type ScanSource = 'wall_qr' | 'share' | 'unknown';
export type ScanCondition = 'good' | 'needs_attention' | 'damaged';
export type ScanInterest = 'browse' | 'love' | 'buy_ask';

export interface RotationSlot {
	match_id: string;
	venue_id: string;
	artwork_id: string;
	status: MatchStatus;
	starts_on: string;
	ends_on: string;
	install_buffer_hours: number;
	wall_label: string | null;
	reminder_at: string | null;
	approved_at: string | null;
	hung_at: string | null;
}

export interface BusyPeriod {
	id: string;
	venue_id: string;
	starts_on: string;
	ends_on: string;
	reason: string | null;
	created_at: string;
}

export interface PlacementProposal {
	id: string;
	match_id: string | null;
	from_profile_id: string;
	to_profile_id: string;
	artwork_id: string;
	proposal_type: ProposalType;
	message: string | null;
	requested_mood: string | null;
	requested_min_cm: number | null;
	requested_max_cm: number | null;
	status: ProposalStatus;
	created_at: string;
	resolved_at: string | null;
}

export interface QrScan {
	id: string;
	artwork_id: string;
	match_id: string | null;
	venue_id: string | null;
	scanned_at: string;
	source: ScanSource;
	condition: ScanCondition | null;
	interest_level: ScanInterest | null;
	user_id: string | null;
	content: string | null;
}

export interface WallRequestTemplate {
	id: string;
	label: string;
	mood: string;
	min_cm: number;
	max_cm: number;
	message: string;
}
