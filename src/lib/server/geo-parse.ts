/**
 * Parse PostGIS / PostgREST geography values into lat/lng.
 * Supabase often returns geography as EWKB hex (e.g. 0101000020E6100000...).
 */
export function parseGeographicLocation(
	raw: string | null | undefined
): { lat: number; lng: number } | null {
	if (!raw) return null;
	const value = String(raw).trim();
	if (!value) return null;

	const wkt = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
	if (wkt) {
		const lng = Number(wkt[1]);
		const lat = Number(wkt[2]);
		if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
	}

	if (value.startsWith('{') || value.startsWith('[')) {
		try {
			const parsed = JSON.parse(value) as { coordinates?: [number, number]; type?: string };
			if (parsed?.coordinates?.length === 2) {
				const [lng, lat] = parsed.coordinates;
				if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
			}
		} catch {
			/* fall through */
		}
	}

	const ewkb = parseEwkbPointHex(value);
	if (ewkb) return ewkb;

	return null;
}

function parseEwkbPointHex(hex: string): { lat: number; lng: number } | null {
	const clean = hex.replace(/^\\x/i, '').replace(/\s/g, '');
	if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length < 42) return null;

	try {
		const buf = Buffer.from(clean, 'hex');
		if (buf.length < 21) return null;

		const littleEndian = buf[0] === 1;
		if (!littleEndian) return null; /* big-endian EWKB rare from PostGIS */

		const typeWord = buf.readUInt32LE(1);
		const geomType = typeWord & 0xff;
		if (geomType !== 1) return null; /* Point only */

		const hasSrid = (typeWord & 0x20000000) !== 0;
		const offset = hasSrid ? 9 : 5;
		if (buf.length < offset + 16) return null;

		const lng = buf.readDoubleLE(offset);
		const lat = buf.readDoubleLE(offset + 8);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		return { lat, lng };
	} catch {
		return null;
	}
}
