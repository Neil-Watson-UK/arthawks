/*
 * Seed artist stories for the Bristol catalogue so swipe / discover
 * can demonstrate "From the artist" storytelling immediately.
 */

update public.artworks
set description = 'Painted from the path above the Avon, where the bridge holds the city in a long pause. I wanted the quiet between footsteps — the kind of pause Hopper knew.'
where id = 'b0000000-0000-4000-8000-000000000001'
  and (description is null or description = '');

update public.artworks
set description = 'Stokes Croft at the blue hour. Neon, brick, and the soft insistence of people still out walking. A street portrait for walls that live with conversation.'
where id = 'b0000000-0000-4000-8000-000000000002'
  and (description is null or description = '');

update public.artworks
set description = 'A contemporary reading of a familiar gaze — oil, patience, and the question of who is looking back. Made for rooms where strangers become company.'
where id = 'b0000000-0000-4000-8000-000000000003'
  and (description is null or description = '');

update public.artworks
set description = 'Layered paper, found pigment, and the signal noise of Montpelier nights. Contemporary mixed media for spaces that prefer experiment over ornament.'
where id = 'b0000000-0000-4000-8000-000000000004'
  and (description is null or description = '');

update public.artworks
set description = 'Quiet Geometry is about breathing room — ink lines that refuse to shout. Hung best where morning light can finish the composition.'
where id = 'b0000000-0000-4000-8000-000000000005'
  and (description is null or description = '');
