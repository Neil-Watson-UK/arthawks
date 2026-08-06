/**
 * Pitch copy before the register form.
 */
export const WHY_HOST = {
	metaTitle: 'Why host art · Art Hawks',
	metaDescription:
		'Fill empty walls with local art. Free to hang. Earn 15% when a hung piece sells.',
	eyebrow: 'For venues',
	headline: 'Why host art',
	lede: 'Empty walls cost you nothing and earn you nothing. Hung walls give guests something to talk about, and you a cut when a piece sells.',
	heroImage: '/artworks/StokesCroft.jpg',
	heroAlt: 'Art hung in a lived-in city room',
	ctaLabel: 'Register your space',
	ctaHref: '/onboard/venue',
	ctaHint: 'About two minutes. Then pin your room on the map.',
	acts: [
		{
			eyebrow: 'Step 1',
			title: 'No cost to try',
			body: 'Browse and match for free. No subscription, no contract to hang. If it isn’t working, take the work down.'
		},
		{
			eyebrow: 'Step 2',
			title: 'Art that fits the room',
			body: 'Swipe what’s nearby or give a short brief (how many pieces, max size, styles). Approve a hang, the artist installs, you mark it hung, and your room goes live on the map.'
		},
		{
			eyebrow: 'Step 3',
			title: 'Earn when it sells',
			body: 'You take 15% when hung work sells on your walls. There’s also a 5% finder’s fee for 30 days after a hang if the work isn’t showing elsewhere. Buyers collect in person; staff confirm pickup with a QR. No extra app for the till.'
		},
		{
			eyebrow: 'Step 4',
			title: 'Keep the walls fresh',
			body: 'Rotate when a piece has had its moment. The calendar and gentle nudges help you swap without turning it into a second job.'
		}
	]
} as const;

export const WHY_EXHIBIT = {
	metaTitle: 'Why exhibit · Art Hawks',
	metaDescription:
		'Hang your work where people already gather. No monthly fee. Keep 70% when it sells.',
	eyebrow: 'For artists',
	headline: 'Why exhibit',
	lede: 'Skip the cold emails. Hang where people already sit, drink, and wait, and meet them at the wall.',
	heroImage: '/artworks/BridgeofGertSighs.JPG',
	heroAlt: 'A painting ready for living walls',
	ctaLabel: 'Sign up and open your studio',
	ctaHref: '/onboard/artist',
	ctaHint: 'Upload once. Nearby venues can match and hang.',
	acts: [
		{
			eyebrow: 'Step 1',
			title: 'Real rooms, not a portfolio tab',
			body: 'Your work leaves the hard drive and goes into cafés, bars, and neighbourhood rooms on the map. People see it with daylight, noise, and time to look.'
		},
		{
			eyebrow: 'Step 2',
			title: 'The wall is the storefront',
			body: 'Every piece gets an Art Hawks QR. Scans, loves, and buy asks come back to you. You see which works pull people in, not just likes on a feed.'
		},
		{
			eyebrow: 'Step 3',
			title: 'Simple install',
			body: 'Hang the work, put up the QR from your artwork kit. You confirm interest; the venue marks when it’s hung; the map shows you as live.'
		},
		{
			eyebrow: 'Step 4',
			title: 'Fair cut, no rent',
			body: 'No monthly subscription. Keep 70% when a piece sells. Venues earn 15%. Art Hawks takes 15%. Venues swipe and curate; you confirm or propose a swap.'
		}
	]
} as const;

export type WhyPitch = typeof WHY_HOST | typeof WHY_EXHIBIT;
