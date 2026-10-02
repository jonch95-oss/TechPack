-- One-off cleanup requested in review: the smoke-test pack made on the preview (which shares the
-- production database). Matches only that pack — style # PINK999 named SMOKE TEST … — and its rows
-- in every pack table go with it (all pack foreign keys cascade). Its uploaded blobs are left alone.
DELETE FROM "packs" WHERE "style_no" = 'PINK999' AND upper("style_name") LIKE 'SMOKE TEST%';
