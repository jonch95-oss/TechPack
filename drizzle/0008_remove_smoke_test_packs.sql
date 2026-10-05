-- One-off cleanup requested in review round 3: the smoke-test packs PINK999 and OW-BSHO-90001, made on
-- the preview (which shares the production database). Only those two style numbers, and only when the
-- pack is marked SMOKE TEST (in its style name or any answer, e.g. the description). Every pack table
-- cascades. The count deleted is printed in the build log.
DO $$
DECLARE n integer;
BEGIN
  DELETE FROM "packs" p
  WHERE p."style_no" IN ('PINK999', 'OW-BSHO-90001')
    AND (
      upper(p."style_name") LIKE '%SMOKE TEST%'
      OR EXISTS (SELECT 1 FROM "pack_answers" a WHERE a."pack_id" = p."id" AND upper(a."value" #>> '{}') LIKE '%SMOKE TEST%')
    );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'smoke-test packs deleted: %', n;
END $$;
