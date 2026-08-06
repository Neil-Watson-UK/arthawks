import type { ArtStyle } from '$lib/constants/art-styles';
import type { BusyPeriod, RotationSlot } from '$lib/types/rotations';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateOnly(input: Date | string): string {
	const date = typeof input === 'string' ? new Date(input) : input;
	return date.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
	const date = new Date(`${dateOnly}T12:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return toDateOnly(date);
}

export function daysBetween(start: string, end: string): number {
	const a = new Date(`${start}T12:00:00.000Z`).getTime();
	const b = new Date(`${end}T12:00:00.000Z`).getTime();
	return Math.round((b - a) / DAY_MS);
}

export function rangesOverlap(
	aStart: string,
	aEnd: string,
	bStart: string,
	bEnd: string
): boolean {
	return aStart <= bEnd && bStart <= aEnd;
}

export function isBusyOn(busy: BusyPeriod[], venueId: string, day: string): boolean {
	return busy.some(
		(period) =>
			period.venue_id === venueId && rangesOverlap(period.starts_on, period.ends_on, day, day)
	);
}

/*
 * Default hang window: install buffer day, then ~6 weeks on the wall.
 */
export function synthesizeSlot(input: {
	match_id: string;
	venue_id: string;
	artwork_id: string;
	status: RotationSlot['status'];
	created_at: string;
	install_buffer_hours?: number;
}): RotationSlot {
	const bufferHours = input.install_buffer_hours ?? 24;
	const created = toDateOnly(input.created_at);
	const startsOn = addDays(created, Math.max(1, Math.ceil(bufferHours / 24)));
	const endsOn = addDays(startsOn, 42);
	const reminderAt = new Date(`${addDays(endsOn, -7)}T09:00:00.000Z`).toISOString();

	return {
		match_id: input.match_id,
		venue_id: input.venue_id,
		artwork_id: input.artwork_id,
		status: input.status,
		starts_on: startsOn,
		ends_on: endsOn,
		install_buffer_hours: bufferHours,
		wall_label: null,
		reminder_at: reminderAt,
		approved_at: input.status === 'accepted' ? input.created_at : null,
		hung_at: null
	};
}

export function nudgeForSlot(slot: RotationSlot, scanCount = 0): string | null {
	const today = toDateOnly(new Date());
	const daysLeft = daysBetween(today, slot.ends_on);

	if (slot.status === 'pending' && !slot.approved_at) {
		return 'Awaiting one-click hang approval';
	}
	if (slot.approved_at && !slot.hung_at) {
		return 'Ready to hang - mark when it’s on the wall';
	}
	if (daysLeft <= 0) {
		return 'Rotation due - walls ready for a swap';
	}
	if (daysLeft <= 7) {
		return scanCount > 12
			? 'Strong pulse - consider a fresh hang soon'
			: `Rotate soon - ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
	}
	if (scanCount === 0 && daysBetween(slot.starts_on, today) >= 5) {
		return 'Quiet wall - check the QR is live';
	}
	if (scanCount >= 8) {
		return 'Strong door traffic - consider refreshing this wall';
	}
	return null;
}

/** Confirmed hang: accepted, approved, and physically hung. */
export function isConfirmedHang(match: {
	status: string;
	approved_at?: string | null;
	hung_at?: string | null;
}): boolean {
	return (
		match.status === 'accepted' && Boolean(match.approved_at) && Boolean(match.hung_at)
	);
}

/** Past-hang finders fee window (days after hung_at). */
export const FINDER_FEE_WINDOW_DAYS = 30;

/** True while hung_at is within the finders-fee window. */
export function isWithinFinderWindow(
	hungAt: string | null | undefined,
	now = new Date()
): boolean {
	if (!hungAt) return false;
	const hungMs = new Date(hungAt).getTime();
	if (Number.isNaN(hungMs)) return false;
	const ageMs = now.getTime() - hungMs;
	return ageMs >= 0 && ageMs <= FINDER_FEE_WINDOW_DAYS * DAY_MS;
}

/**
 * Finder fee eligibility: hung here within 30 days, not currently showing,
 * and not accepted at a different venue (avoids stacking wall + finder).
 */
export function isEligibleFinderHang(
	candidate: {
		venue_id: string;
		status: string;
		approved_at?: string | null;
		hung_at?: string | null;
		starts_on?: string | null;
		ends_on?: string | null;
	},
	allHangs: {
		venue_id: string;
		status: string;
		approved_at?: string | null;
		hung_at?: string | null;
		starts_on?: string | null;
		ends_on?: string | null;
	}[],
	now = new Date()
): boolean {
	if (!isConfirmedHang(candidate)) return false;
	if (!isWithinFinderWindow(candidate.hung_at, now)) return false;
	if (placementForHang(candidate) === 'showing') return false;

	const showingElsewhere = allHangs.some(
		(row) =>
			row.venue_id !== candidate.venue_id && placementForHang(row) === 'showing'
	);
	if (showingElsewhere) return false;

	const acceptedElsewhere = allHangs.some(
		(row) => row.venue_id !== candidate.venue_id && row.status === 'accepted'
	);
	return !acceptedElsewhere;
}

/**
 * Public placement for map / rooms / discover.
 * showing = hung on the wall inside its window
 * transit = pending interest, scheduled but not hung, or outside window
 */
export function placementForHang(match: {
	status: string;
	approved_at?: string | null;
	hung_at?: string | null;
	starts_on?: string | null;
	ends_on?: string | null;
}): 'showing' | 'transit' {
	if (!isConfirmedHang(match)) return 'transit';

	const today = toDateOnly(new Date());
	if (match.starts_on && match.starts_on > today) return 'transit';
	if (match.ends_on && match.ends_on < today) return 'transit';
	return 'showing';
}

/**
 * Room wall archive: past = sold, or hung after its window ended.
 */
export function roomPlacementForHang(
	match: {
		status: string;
		approved_at?: string | null;
		hung_at?: string | null;
		starts_on?: string | null;
		ends_on?: string | null;
	},
	artworkStatus: string
): 'showing' | 'transit' | 'past' {
	if (artworkStatus === 'sold') return 'past';
	if (!isConfirmedHang(match)) return 'transit';

	const today = toDateOnly(new Date());
	if (match.ends_on && match.ends_on < today) return 'past';
	if (match.starts_on && match.starts_on > today) return 'transit';
	return 'showing';
}

export function styleFitScore(
	artworkStyle: ArtStyle | null | undefined,
	preferred: ArtStyle[]
): number {
	if (!artworkStyle) return 0;
	return preferred.includes(artworkStyle) ? 40 : 0;
}

export function nextOpenInstallDay(
	venueId: string,
	busy: BusyPeriod[],
	from = toDateOnly(new Date()),
	bufferHours = 24
): string {
	let candidate = addDays(from, Math.max(1, Math.ceil(bufferHours / 24)));
	for (let i = 0; i < 60; i += 1) {
		if (!isBusyOn(busy, venueId, candidate)) return candidate;
		candidate = addDays(candidate, 1);
	}
	return candidate;
}
