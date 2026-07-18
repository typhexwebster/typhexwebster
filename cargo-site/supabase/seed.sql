-- ============================================================
-- CARGO — Seed-Daten (bestehende 4 Alben).
-- Nach schema.sql ausführen. Idempotent via ON CONFLICT.
-- audio_path bleibt NULL -> Audiodateien lädst du später im Admin hoch.
-- ============================================================

insert into public.albums (id,title,artist,year,availability,apple_url,spotify_url,description,duration,cover_color,cover_path,in_library,sort_order) values
  ('psy-atlas','PSY-ATLAS - EP','Typhex Webster','2024','apple music & spotify',null,null,'PSY-ATLAS is a sonic journey through fragmented realities and altered states of perception. Produced entirely by Typhex Webster, the project blends hypnotic textures with raw energy.','34 Min','#8B3A1A','/uploads/cover-psy-atlas-ep-sm.png',false,1),
  ('twin-sun-static','TWIN SUN STATIC','Typhex Webster','2024','not available on any other platform',null,null,'Twin Sun Static is an exclusive release, only available through CARGO. A raw and unfiltered collection of instrumental beats, capturing the dual nature of light and shadow.','29 Min','#C65A20','/uploads/cover-twin-sun-static-sm.png',false,2),
  ('camels-n-zebras','CAMELS N'' ZEBRAS','Typhex Webster & keinzeitstudent','2026','not available on any other platform',null,null,'A collaborative project between Typhex Webster and keinzeitstudent — raw, cinematic, and unapologetic.','23 Min','#1A3A6B','/uploads/cover-camels-n-zebras-sm.png',true,3),
  ('softwhere','SOFTWHERE!?','Typhex Webster','2026','apple music & spotify',null,null,'SOFTWHERE!? is a glitched-out beat tape built from cardboard textures and corner-store nostalgia. Crunchy, off-grid and unapologetically lo-fi — Typhex Webster digs through the static for something real.','31 Min','#2A6B5A','/uploads/cover-softwhere-sm.jpg',false,4)
on conflict (id) do update set title=excluded.title, artist=excluded.artist, year=excluded.year, availability=excluded.availability, description=excluded.description, duration=excluded.duration, cover_color=excluded.cover_color, cover_path=excluded.cover_path, in_library=excluded.in_library, sort_order=excluded.sort_order;

delete from public.tracks where album_id in ('psy-atlas','twin-sun-static','camels-n-zebras','softwhere');
insert into public.tracks (album_id,track_no,title,artist,duration) values
  ('psy-atlas',1,'Σ-44','Typhex Webster','3:42'),
  ('psy-atlas',2,'Σ-108','Typhex Webster','4:18'),
  ('psy-atlas',3,'NEURAL DRIFT','Typhex Webster','3:55'),
  ('psy-atlas',4,'ATLAS VOID','Typhex Webster','5:02'),
  ('psy-atlas',5,'PSYCHE LOOP','Typhex Webster','3:30'),
  ('psy-atlas',6,'FRACTURED EYE','Typhex Webster','4:11'),
  ('psy-atlas',7,'STATIC MIND','Typhex Webster','3:28'),
  ('psy-atlas',8,'TERMINAL','Typhex Webster','5:44'),
  ('twin-sun-static',1,'TWIN SUN I','Typhex Webster','4:22'),
  ('twin-sun-static',2,'STATIC WAVE','Typhex Webster','3:55'),
  ('twin-sun-static',3,'SOLAR BURN','Typhex Webster','4:10'),
  ('twin-sun-static',4,'DESERT SIGNAL','Typhex Webster','3:44'),
  ('twin-sun-static',5,'TWIN SUN II','Typhex Webster','5:01'),
  ('twin-sun-static',6,'GOLD FREQUENCY','Typhex Webster','3:28'),
  ('twin-sun-static',7,'LAST LIGHT','Typhex Webster','4:20'),
  ('camels-n-zebras',1,'STARGAZING','Typhex Webster & keinzeitstudent','3:44'),
  ('camels-n-zebras',2,'BE THERE','Typhex Webster','4:02'),
  ('camels-n-zebras',3,'QUAD (feat. Sanyx)','Typhex Webster & keinzeitstudent','3:28'),
  ('camels-n-zebras',4,'TA-GA-TE-GE','Typhex Webster & keinzeitstudent','5:11'),
  ('camels-n-zebras',5,'FIZZY','Typhex Webster & keinzeitstudent','3:55'),
  ('softwhere',1,'SUPERCRISPY','Typhex Webster','3:12'),
  ('softwhere',2,'CARDBOARD CHURCH','Typhex Webster','4:05'),
  ('softwhere',3,'42 UNITÉS','Typhex Webster','2:58'),
  ('softwhere',4,'SOUR CREAM DREAM','Typhex Webster','3:47'),
  ('softwhere',5,'PAPRIKA CHILI','Typhex Webster','3:30'),
  ('softwhere',6,'NIGHT SHIFT AISLE','Typhex Webster','4:18'),
  ('softwhere',7,'PLASTIC SAINTS','Typhex Webster','3:22'),
  ('softwhere',8,'STATIC SNACK','Typhex Webster','2:44'),
  ('softwhere',9,'SOFTWHERE','Typhex Webster','3:04');

insert into public.gallery_items (kind,label,src_path,sort_order) values
  ('image','fruit','/uploads/fruit.png',1),
  ('image','atlas war','/uploads/atlas_war.png',2)
on conflict do nothing;

