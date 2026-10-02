-- V2.1 §2.4: one standard page order and page names for every brand. Stored page names (comment
-- placements, reference-photo pages, revision change sections) move to the standard names; the app
-- also maps the old names on read, so this is a tidy-up, not a requirement.
CREATE OR REPLACE FUNCTION pg_temp.std_pages(t text) RETURNS text AS $$
  SELECT replace(replace(replace(replace(replace(replace(t,
    '"MATERIALS / HARDWARE"', '"OVERVIEW"'),
    '"PRODUCT FEATURES"', '"OVERVIEW"'),
    '"MEASUREMENTS SHEET"', '"MEASUREMENTS"'),
    '"ENLARGED CAD"', '"COLOURWAYS"'),
    '"REFERENCE PHOTOS FOR CONSTRUCTION"', '"REFERENCE IMAGES"'),
    '"HARDWARE / BRANDING DETAIL"', '"TRIMS & HARDWARE"')
$$ LANGUAGE sql IMMUTABLE;
--> statement-breakpoint
UPDATE "pack_answers" SET "value" = pg_temp.std_pages("value"::text)::jsonb WHERE "question_id" = 'comments.list' AND "value"::text <> pg_temp.std_pages("value"::text);
--> statement-breakpoint
UPDATE "revisions" SET "changes" = pg_temp.std_pages("changes"::text)::jsonb WHERE "changes"::text <> pg_temp.std_pages("changes"::text);
--> statement-breakpoint
UPDATE "pack_files" SET "page" = CASE "page"
  WHEN 'MATERIALS / HARDWARE' THEN 'OVERVIEW'
  WHEN 'PRODUCT FEATURES' THEN 'OVERVIEW'
  WHEN 'MEASUREMENTS SHEET' THEN 'MEASUREMENTS'
  WHEN 'ENLARGED CAD' THEN 'COLOURWAYS'
  WHEN 'REFERENCE PHOTOS FOR CONSTRUCTION' THEN 'REFERENCE IMAGES'
  WHEN 'HARDWARE / BRANDING DETAIL' THEN 'TRIMS & HARDWARE'
  ELSE "page" END
WHERE "page" IN ('MATERIALS / HARDWARE', 'PRODUCT FEATURES', 'MEASUREMENTS SHEET', 'ENLARGED CAD', 'REFERENCE PHOTOS FOR CONSTRUCTION', 'HARDWARE / BRANDING DETAIL');
