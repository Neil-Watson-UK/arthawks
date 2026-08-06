/**
 * Theatrical pitch copy: sell the proposition before the register form.
 */
export const WHY_HOST = {
	metaTitle: 'Why host art · Art Hawks',
	metaDescription:
		'Turn empty walls into a living gallery. Match local artists, hang work, and give guests a reason to linger.',
	eyebrow: 'For venues',
	headline: 'Why host art',
	lede: 'Empty walls are quiet. Hung walls make people stay, look twice, and come back.',
	heroImage: '/artworks/StokesCroft.jpg',
	heroAlt: 'Art hung in a lived-in city room',
	ctaLabel: 'Register your space',
	ctaHref: '/onboard/venue',
	ctaHint: 'Takes about two minutes. Then pin your room on the map.',
	acts: [
		{
			eyebrow: 'Act I',
			title: 'Your room(s) joins the city gallery',
			body: 'Art Hawks turns cafés, bars, hotels, and neighbourhood rooms into a distributed gallery. People shouldn’t have to enter anodyne white rooms; they should find art where they already gather.'
		},
		{
			eyebrow: 'Act II',
			title: 'Footfall with a story',
			body: 'A hung wall is marketing you don’t have to invent. QR code doors open the work; loves and interests land in your pulse. You’re not decorating - you’re hosting encounters.'
		},
		{
			eyebrow: 'Act III',
			title: 'Match, hang, go live',
			body: 'Swipe or Curate for Me to find pieces that fit. Approve a hang, the artist will hang their work, mark it hung when it’s on the wall and the map and room page do the rest. The artists bring their audiences to your space - free promotion and customers to your space.'
		},
		{
			eyebrow: 'Encore',
			title: 'Walls that rotate, not stagnate',
			body: 'Calendar, busy days, and gentle nudges keep the room fresh. When the pulse softens, swap. When it’s strong, celebrate - and share this week’s room.'
		}
	]
} as const;

export const WHY_EXHIBIT = {
	metaTitle: 'Why exhibit · Art Hawks',
	metaDescription:
		'Hang your work where people already gather. Living walls, real door traffic, and venues that want local art.',
	eyebrow: 'For artists',
	headline: 'Why exhibit',
	lede: 'Stop waiting for the gallery representation. Hang where people already gather and meet them at the door.',
	heroImage: '/artworks/BridgeofGertSighs.JPG',
	heroAlt: 'A painting ready for living walls',
	ctaLabel: 'Sign up - open your studio',
	ctaHref: '/onboard/artist',
	ctaHint: 'Upload once. Nearby venues can match and hang.',
	acts: [
		{
			eyebrow: 'Act I',
			title: 'Living walls, not storage',
			body: 'Your catalogue leaves the portfolio and enters cafés, bars, and rooms on the map. People meet the work in the wild with light, noise, coffee, and time to look.'
		},
		{
			eyebrow: 'Act II',
			title: 'Real eyes at the door',
			body: 'Every wall QR opens your door. Scans, loves, and buy asks land in your inbox. You see which pieces pull people closer - not just likes on a feed.'
		},
		{
			eyebrow: 'Act III',
			title: 'Install without theatre',
			body: 'Hang your work and place your Art Hawks QR code (download your artwork kit). You confirm interest; venues mark when hung; the city gallery shows you as live.'
		},
		{
			eyebrow: 'Encore',
			title: 'Mutual match, not cold call',
			body: 'Venues swipe and curate for their walls. You confirm or propose a swap. The loop is co-owned - your work on their walls, their footfall on your name.'
		}
	]
} as const;

export type WhyPitch = typeof WHY_HOST | typeof WHY_EXHIBIT;
