-- Review round 5 cleanup on the shared database:
--  1. the test packs Jon listed (every pack table cascades);
--  2. OW001, the LOGO PLATE 50 × 32 the spec-sheet bug created and linked to every hardware row —
--     deleted once no remaining pack uses it (if one still does, it is left and reported).
-- Counts are printed in the build log.
DO $$
DECLARE packs_deleted integer; hw_deleted integer; still_used integer;
BEGIN
  DELETE FROM "packs" WHERE "style_no" IN ('OW-BSHO-90001', 'OW-BSHO-90003', 'PINK997', 'PINK999', 'TB25_ACC9999');
  GET DIAGNOSTICS packs_deleted = ROW_COUNT;

  SELECT count(*) INTO still_used FROM "hardware" h
  WHERE h."code" = 'OW001' AND h."type" = 'LOGO PLATE' AND h."notes" LIKE 'FROM SPEC SHEET%'
    AND EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');

  DELETE FROM "library_usage" u USING "hardware" h
  WHERE u."item_id" = h."id" AND h."code" = 'OW001' AND h."type" = 'LOGO PLATE' AND h."notes" LIKE 'FROM SPEC SHEET%'
    AND NOT EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');
  DELETE FROM "hardware" h
  WHERE h."code" = 'OW001' AND h."type" = 'LOGO PLATE' AND h."notes" LIKE 'FROM SPEC SHEET%'
    AND NOT EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."value"::text LIKE '%' || h."id"::text || '%');
  GET DIAGNOSTICS hw_deleted = ROW_COUNT;

  RAISE NOTICE 'round 5 cleanup: test packs deleted %, bad OW001 deleted %, OW001 still in use by a pack %', packs_deleted, hw_deleted, still_used;
END $$;
