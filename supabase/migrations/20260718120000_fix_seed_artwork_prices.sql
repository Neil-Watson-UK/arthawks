/*
 * Realign seed catalogue prices to the Art Hawks mock catalogue (GBP → pence).
 * Earlier prototype edits / partial seeds left some rows under-priced.
 */
update public.artworks set price_pence = 185000 where id = 'b0000000-0000-4000-8000-000000000001';
update public.artworks set price_pence = 145000 where id = 'b0000000-0000-4000-8000-000000000002';
update public.artworks set price_pence = 220000 where id = 'b0000000-0000-4000-8000-000000000003';
update public.artworks set price_pence = 98000 where id = 'b0000000-0000-4000-8000-000000000004';
update public.artworks set price_pence = 125000 where id = 'b0000000-0000-4000-8000-000000000005';
