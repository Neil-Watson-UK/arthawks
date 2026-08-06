/**
 * Thin outbound email interface - IONOS SMTP today; swap transport later for marketing ESP.
 * Server-side only. Uses SvelteKit private env so .env works in vite dev.
 */
import { env as privateEnv } from '$env/dynamic/private';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailRole = 'hello' | 'artists' | 'venues' | 'support';

export type SendEmailInput = {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
	replyTo?: string | MailRole;
	bcc?: string | string[];
};

export type SendEmailResult =
	| { ok: true; skipped?: false; messageId?: string }
	| { ok: true; skipped: true; reason: string }
	| { ok: false; error: string };

function env(name: keyof typeof privateEnv | string, fallback = ''): string {
	const value = privateEnv[name as keyof typeof privateEnv];
	return typeof value === 'string' ? value.trim() : fallback;
}

export function mailConfigured(): boolean {
	return Boolean(env('MAIL_SMTP_USER') && env('MAIL_SMTP_PASS'));
}

export function mailFrom(): string {
	return env('MAIL_FROM') || env('MAIL_SMTP_USER') || 'Art Hawks <support@arthawks.com>';
}

export function mailReplyAddress(role: MailRole): string {
	switch (role) {
		case 'hello':
			return env('MAIL_REPLY_HELLO', 'hello@arthawks.com');
		case 'artists':
			return env('MAIL_REPLY_ARTISTS', 'artists@arthawks.com');
		case 'venues':
			return env('MAIL_REPLY_VENUES', 'venues@arthawks.com');
		case 'support':
			return env('MAIL_REPLY_SUPPORT', 'support@arthawks.com');
	}
}

export function mailFounderBcc(): string | null {
	const bcc = env('MAIL_BCC_FOUNDER');
	return bcc || null;
}

export function siteOrigin(): string {
	return env('ORIGIN', 'http://localhost:5173').replace(/\/$/, '');
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
	if (!mailConfigured()) return null;
	if (transporter) return transporter;

	const port = Number(env('MAIL_SMTP_PORT', '587')) || 587;
	const secure =
		env('MAIL_SMTP_SECURE') === 'true' || env('MAIL_SMTP_SECURE') === '1' || port === 465;

	transporter = nodemailer.createTransport({
		host: env('MAIL_SMTP_HOST', 'smtp.ionos.com'),
		port,
		secure,
		auth: {
			user: env('MAIL_SMTP_USER'),
			pass: env('MAIL_SMTP_PASS')
		}
	});

	return transporter;
}

function resolveReplyTo(replyTo?: string | MailRole): string | undefined {
	if (!replyTo) return undefined;
	if (replyTo === 'hello' || replyTo === 'artists' || replyTo === 'venues' || replyTo === 'support') {
		return mailReplyAddress(replyTo);
	}
	return replyTo;
}

/**
 * Send an email. Fail-open for callers: returns ok:false on error; never throws.
 * When SMTP is unset, returns skipped (pilot-safe).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
	const transport = getTransporter();
	if (!transport) {
		console.warn('[email] SMTP not configured - skipped:', input.subject);
		return { ok: true, skipped: true, reason: 'MAIL_SMTP_USER / MAIL_SMTP_PASS not set' };
	}

	try {
		const info = await transport.sendMail({
			from: mailFrom(),
			to: input.to,
			bcc: input.bcc,
			replyTo: resolveReplyTo(input.replyTo),
			subject: input.subject,
			text: input.text,
			html: input.html ?? undefined
		});
		return { ok: true, messageId: info.messageId };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[email] send failed:', message, { subject: input.subject });
		return { ok: false, error: message };
	}
}

/** Fire-and-forget wrapper for product hooks - never throws. */
export function sendEmailSafe(input: SendEmailInput): void {
	void sendEmail(input).then((result) => {
		if (!result.ok) {
			console.warn('[email] safe send failed:', result.error);
		}
	});
}
