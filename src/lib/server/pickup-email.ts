/**
 * Purchase pickup emails - buyer proof + optional venue heads-up.
 * Verify page is read-only; collection still requires venue login.
 */
import QRCode from 'qrcode';
import { pickupVerifyRoute } from '$lib/constants/routes';
import { sendEmailSafe, siteOrigin } from '$lib/server/email';
import { createServiceClient } from '$lib/server/supabase';
import type { Database } from '$lib/types/database';
import { formatPrice } from '$lib/utils/format';

type PurchaseRow = Database['public']['Tables']['purchases']['Row'];

function formatWhen(iso: string | null): string {
	if (!iso) return 'just now';
	return new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

async function qrDataUrl(absoluteUrl: string): Promise<string | null> {
	try {
		return await QRCode.toDataURL(absoluteUrl, {
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 280,
			color: { dark: '#0e181f', light: '#faf9f6' }
		});
	} catch (err) {
		console.warn('[pickup-email] QR generate failed:', err);
		return null;
	}
}

export async function notifyPickupReady(purchase: PurchaseRow): Promise<void> {
	if (purchase.status !== 'paid' && purchase.status !== 'collected') return;
	if (!purchase.pickup_verify_token) return;

	const origin = siteOrigin();
	const verifyPath = pickupVerifyRoute(purchase.pickup_verify_token);
	const verifyUrl = `${origin}${verifyPath}`;
	const qr = await qrDataUrl(verifyUrl);

	const supabase = createServiceClient();
	const { data: artwork } = await supabase
		.from('artworks')
		.select('title, image_url')
		.eq('id', purchase.artwork_id)
		.maybeSingle();

	let venueName: string | null = null;
	let venueOwnerEmail: string | null = null;
	if (purchase.venue_id) {
		const { data: venue } = await supabase
			.from('venues')
			.select('name, owner_id')
			.eq('id', purchase.venue_id)
			.maybeSingle();
		venueName = venue?.name ?? null;
		if (venue?.owner_id) {
			const { data: owner } = await supabase
				.from('profiles')
				.select('email')
				.eq('id', venue.owner_id)
				.maybeSingle();
			venueOwnerEmail = owner?.email?.trim() || null;
		}
	}

	const title = artwork?.title ?? 'your artwork';
	const amount = formatPrice(purchase.amount_pence);
	const paidLabel = formatWhen(purchase.paid_at);
	const code = purchase.pickup_code;
	const expiresLabel = purchase.code_expires_at ? formatWhen(purchase.code_expires_at) : null;

	if (purchase.buyer_email) {
		const text = [
			`Thank you for buying "${title}" on Art Hawks.`,
			``,
			`Paid: ${paidLabel}`,
			`Amount: ${amount}`,
			venueName ? `Collect from: ${venueName}` : null,
			``,
			`Show this page to venue staff so they can confirm payment:`,
			verifyUrl,
			``,
			`Backup 6-digit code (for the venue owner account): ${code}`,
			expiresLabel ? `Code valid until: ${expiresLabel}` : null,
			``,
			`Staff can scan the QR / open the link without signing in.`,
			`The venue owner later confirms collection in Art Hawks to close the handover.`
		]
			.filter((line) => line !== null)
			.join('\n');

		const html = `
			<p>Thank you for buying <strong>${escapeHtml(title)}</strong> on Art Hawks.</p>
			<p>Paid <strong>${escapeHtml(paidLabel)}</strong> · ${escapeHtml(amount)}
			${venueName ? `<br/>Collect from <strong>${escapeHtml(venueName)}</strong>` : ''}</p>
			${
				qr
					? `<p style="text-align:center;margin:1.5rem 0"><img src="${qr}" alt="Pickup verify QR" width="140" height="140" style="display:inline-block"/></p>`
					: ''
			}
			<p>Show this to venue staff so they can confirm payment (no login needed):<br/>
			<a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
			<p>Backup 6-digit code for the venue owner: <strong style="letter-spacing:0.2em">${escapeHtml(code)}</strong>
			${expiresLabel ? `<br/><span style="color:#666">Valid until ${escapeHtml(expiresLabel)}</span>` : ''}</p>
			<p style="color:#555;font-size:0.9em">Staff verify with the link. The venue owner confirms collection in Art Hawks to close the handover.</p>
		`;

		sendEmailSafe({
			to: purchase.buyer_email,
			subject: `Pickup for "${title}" - show this at the venue`,
			text,
			html,
			replyTo: 'support'
		});
	}

	if (venueOwnerEmail && venueOwnerEmail !== purchase.buyer_email) {
		const text = [
			`A paid pickup is waiting${venueName ? ` at ${venueName}` : ''}.`,
			``,
			`Artwork: ${title}`,
			`Paid: ${paidLabel} · ${amount}`,
			``,
			`Buyer will show a QR / verify link. Staff can open it without signing in:`,
			verifyUrl,
			``,
			`When ready, confirm collection in Art Hawks (Venue → Confirm collection) with code ${code}.`
		].join('\n');

		sendEmailSafe({
			to: venueOwnerEmail,
			subject: `Paid pickup waiting: ${title}`,
			text,
			html: `<p>A paid pickup is waiting${venueName ? ` at <strong>${escapeHtml(venueName)}</strong>` : ''}.</p>
				<p><strong>${escapeHtml(title)}</strong><br/>Paid ${escapeHtml(paidLabel)} · ${escapeHtml(amount)}</p>
				<p>Buyer shows a QR. Staff can verify without signing in:<br/><a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
				<p>Confirm collection in Art Hawks (Venue → Confirm collection) with code <strong>${escapeHtml(code)}</strong>.</p>`,
			replyTo: 'venues'
		});
	}
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
