-- Review round 6 cleanup on the shared database:
--  1. the test pack OW-BSHO-90004 (every pack table cascades);
--  2. its library items OW001–OW005 — only the ones a source read created ("FROM …" notes) and that no
--     remaining pack uses (any still in use are left and reported);
--  3. any hardware whose finish is a note ("NOT STATED ON SPEC SHEET — CONFIRM (GUNMETAL PER RENDER)"):
--     the finish becomes the value named in it (GUNMETAL), flagged AI-suggested, and the note moves to notes.
-- Counts are printed in the build log.
DO $$
DECLARE packs_deleted integer; hw_deleted integer; still_used integer; finishes_fixed integer;
BEGIN
  DELETE FROM "packs" WHERE "style_no" = 'OW-BSHO-90004';
  GET DIAGNOSTICS packs_deleted = ROW_COUNT;

  SELECT count(*) INTO still_used FROM "hardware" h
  WHERE h."code" IN ('OW001', 'OW002', 'OW003', 'OW004', 'OW005') AND h."notes" LIKE 'FROM %'
    AND EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');

  DELETE FROM "library_usage" u USING "hardware" h
  WHERE u."item_id" = h."id" AND h."code" IN ('OW001', 'OW002', 'OW003', 'OW004', 'OW005') AND h."notes" LIKE 'FROM %'
    AND NOT EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');
  DELETE FROM "hardware" h
  WHERE h."code" IN ('OW001', 'OW002', 'OW003', 'OW004', 'OW005') AND h."notes" LIKE 'FROM %'
    AND NOT EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');
  GET DIAGNOSTICS hw_deleted = ROW_COUNT;

  WITH bad AS (
    SELECT "id", upper("finish") AS f, coalesce(substring(upper("finish") from '\(([^)]*)\)'), '') AS inner_f
    FROM "hardware"
    WHERE upper("finish") ~ '(NOT (STATED|GIVEN|SPECIFIED|SHOWN|LISTED|ON)|CONFIRM|\m(PER|FROM|AS) (THE )?(RENDER|BOARD|PHOTO|IMAGE)|\mTB[CD]\M|UNKNOWN|ASSUMED|\?)'
  ), picked AS (
    SELECT "id", f, coalesce(
      substring(inner_f from '\m(SHINY CHAMPAGNE GOLD|LIGHT GOLD|ANTIQUE BRASS|GUN ?METAL|SHINY NICKEL|BLACK NICKEL|MATTE BLACK|ROSE GOLD|ANTIQUE SILVER|SHINY SILVER|SHINY GOLD|RUTHENIUM|CHROME|NICKEL|GOLD|SILVER|BRASS)\M'),
      substring(f from '\m(SHINY CHAMPAGNE GOLD|LIGHT GOLD|ANTIQUE BRASS|GUN ?METAL|SHINY NICKEL|BLACK NICKEL|MATTE BLACK|ROSE GOLD|ANTIQUE SILVER|SHINY SILVER|SHINY GOLD|RUTHENIUM|CHROME|NICKEL|GOLD|SILVER|BRASS)\M'),
      '') AS v
    FROM bad
  )
  UPDATE "hardware" h
  SET "finish" = replace(p.v, 'GUN METAL', 'GUNMETAL'),
      "field_status" = h."field_status" || '{"finish": "ai"}'::jsonb,
      "notes" = trim(both ' ·' from h."notes" || ' · FINISH: ' || p.f),
      "updated_at" = now()
  FROM picked p WHERE h."id" = p."id";
  GET DIAGNOSTICS finishes_fixed = ROW_COUNT;

  RAISE NOTICE 'round 6 cleanup: test packs deleted %, OW001-OW005 deleted %, still in use by a pack %, finish notes fixed %', packs_deleted, hw_deleted, still_used, finishes_fixed;
END $$;
