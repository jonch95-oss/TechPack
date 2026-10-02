#!/usr/bin/env bash
# Side-by-side of generated packs vs the confidential reference packs (both at 70 dpi).
# Output: .data/compare/<pack>-p<n>.png  (left = reference, right = generated). .data is gitignored.
set -euo pipefail
OUT=.data/compare
mkdir -p "$OUT"
pair() { # name refPdf genPdf "refPageForGen1 refPageForGen2 ..."
  local name=$1 ref=$2 gen=$3; shift 3
  local i=1
  for r in $1; do
    pdftoppm -r 70 -f "$r" -l "$r" -png -singlefile "$ref" "$OUT/_ref"
    pdftoppm -r 70 -f "$i" -l "$i" -png -singlefile "$gen" "$OUT/_gen"
    convert \( "$OUT/_ref.png" -resize x770 -background "#999" -gravity east -splice 6x0 \) \( "$OUT/_gen.png" -resize x770 \) +append "$OUT/$name-p$i.png"
    i=$((i+1))
  done
  rm -f "$OUT/_ref.png" "$OUT/_gen.png"
}
pair PINK013 reference/PINK013-A_B_JODIE_SATCHEL.pdf .data/phase2/PINK013.pdf "1 2 3 4 5 6 7 8"
# TB25 prints in Icon order; the reference is in Ted Baker's order (features, refs, materials, interior, hardware, fabric).
pair TB25 reference/TB25_ACC0023_GINGHAM_PU_DOPP_KIT_TP_R1.pdf .data/phase2/TB25_ACC0023.pdf "3 1 2 4 5 6"
ls "$OUT"
