import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { mailConfigured, mailFrom, sendEmail } from '$lib/server/email';

/** POST /api/admin/email/test - SMTP smoke test */
export const POST: RequestHandler = async (event) => {
	const admin = requireAdmin(event);

	if (!mailConfigured()) {
		throw error(503, {
			message:
				'MAIL_SMTP_USER / MAIL_SMTP_PASS are not set. Add them to .env (see .env.example), then restart npm run dev.'
		});
	}

	let body: { to?: string };
	try {
		body = await event.request.json();
	} catch {
		body = {};
	}

	const to = body.to?.trim() || admin.email || null;
	if (!to || !to.includes('@')) {
		throw error(400, { message: 'Provide { "to": "you@example.com" } or set your admin profile email' });
	}

	const result = await sendEmail({
		to,
		replyTo: 'support',
		subject: '[Art Hawks] SMTP test',
		text: [
			`SMTP test from Art Hawks.`,
			`From: ${mailFrom()}`,
			`Requested by admin ${admin.id}`,
			`Time: ${new Date().toISOString()}`
		].join('\n'),
		html: `<p>SMTP test from Art Hawks.</p><p>From: ${mailFrom()}</p>`
	});

	if (!result.ok) {
		throw error(502, { message: result.error });
	}

	return json({
		ok: true,
		to,
		from: mailFrom(),
		messageId: 'messageId' in result ? result.messageId : undefined,
		skipped: 'skipped' in result ? result.skipped : false
	});
};
