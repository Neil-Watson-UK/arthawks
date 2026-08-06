export type AwaitingCollectionRow = {
	id: string;
	artwork_id: string;
	amount_pence: number;
	paid_at: string | null;
	code_expires_at: string | null;
	status: string;
	buyer_email: string | null;
	pickup_code: string;
	artwork_title: string;
	artwork_image_url: string | null;
	artist_name: string;
};
