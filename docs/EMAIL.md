# Art Hawks email

Outbound product mail uses **IONOS Basic SMTP**. Auth (password reset) stays on **Supabase Auth**.

## Addresses

| Address | Role |
|---------|------|
| `neil@arthawks.com` | Founder BCC on venue-claim admin alerts |
| `hello@arthawks.com` | General / public contact form |
| `artists@arthawks.com` | Artist onboarding form |
| `venues@arthawks.com` | Venue claims + partnership form |
| `support@arthawks.com` | SMTP From + support form |

IONOS Basic typically sends only *as* the authenticated mailbox. MVP uses one SMTP user (`MAIL_SMTP_USER`, recommend `support@`). Transactional mail uses role **Reply-To**; contact forms set **Reply-To** to the visitor’s email.

## Env (VPS `.env`)

```
MAIL_SMTP_HOST=smtp.ionos.com
MAIL_SMTP_PORT=587
MAIL_SMTP_SECURE=false
MAIL_SMTP_USER=support@arthawks.com
MAIL_SMTP_PASS=...
MAIL_FROM="Art Hawks <support@arthawks.com>"
MAIL_REPLY_HELLO=hello@arthawks.com
MAIL_REPLY_ARTISTS=artists@arthawks.com
MAIL_REPLY_VENUES=venues@arthawks.com
MAIL_REPLY_SUPPORT=support@arthawks.com
MAIL_BCC_FOUNDER=neil@arthawks.com
ORIGIN=https://arthawks.com

# Google reCAPTCHA v3 — domains: arthawks.com + localhost
PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_SECRET_KEY=...
```

Then `sudo systemctl restart arthawks`.

## Code

- `src/lib/server/email.ts` — `sendEmail` / `sendEmailSafe`
- `src/lib/server/email-templates.ts` — claim + activation copy
- `src/lib/server/recaptcha.ts` — v3 `siteverify` (min score 0.5, action `contact`)
- `POST /api/contact` — public forms + reCAPTCHA + honeypot + rate limit
- `POST /api/admin/email/test` — admin SMTP smoke test

If SMTP env is missing, sends are **skipped** (logged); product mutations still succeed.  
If `RECAPTCHA_SECRET_KEY` is missing, captcha verification is skipped (local only — set it in production).

## Transactional hooks

- Venue claim submitted → `venues@` + claimant confirmation (+ founder BCC)
- Claim approved / rejected → claimant
- Venue activated → owner + `venues@` ops note

## Contact forms

- `/contact` — hello
- `/why/exhibit` — artists (alongside signup)
- `/why/host` — venues partnership enquiry
- Footer / `/contact?topic=support` — support

## Marketing later

Keep calling `sendEmail()`. Replace the Nodemailer transport in `email.ts` with Resend/Postmark/etc. when you outgrow IONOS hourly limits (~50–500/hour). Do not send blasts through Basic mail.

## Localhost

Add the `MAIL_*` block from `.env.example` to your project `.env` (use the real `support@` IONOS password).  
Restart `npm run dev` after editing `.env` — SvelteKit only loads private env at startup.

Then Admin → Dashboard → **Send test**.
