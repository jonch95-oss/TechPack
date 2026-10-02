/**
 * The Icon trade dictionary: words that are correct in a tech pack but not in a general English
 * dictionary, plus the corrections seen in real packs (BRIEF Part 2, rule 3).
 * Admins will maintain this alongside the Chinese glossary in Phase 4.
 */
export const TRADE_TERMS = [
  // abbreviations used on packs
  "DTM", "PU", "TPU", "PVC", "PEVA", "EVA", "EPE", "PC", "ABS", "PP", "TSA", "SPI", "MTL", "MTLS", "PKT", "PKTS", "CWY", "FTY", "ATTN", "EXCL", "INCL",
  "PG", "PGS", "REF", "QTY", "CM", "MM", "IN", "W", "H", "D", "L", "LBS", "KG", "OZ", "SS", "FW", "AW", "PO", "MOQ", "RN", "CA", "COO",
  "TCX", "TPX", "TPG", "PMS", "PANTONE", "RGB", "CMYK", "AI", "EPS", "SVG", "PSD", "PDF", "ZIP", "YKK", "SBS", "EST", "OEM", "SKU",
  "R1", "R2", "R3", "R4", "W/", "W/O", "N/A", "AH", "HB", "TB", "TBC", "ASAP", "CAD", "CADS", "LAB", "L/AB", "TJX", "UPC",
  // materials / construction
  "CROSSBODY", "DOPP", "GINGHAM", "RIPSTOP", "POLYURETHANE", "POLY", "POLYESTER", "NYLON", "SAFFIANO", "PEBBLED", "NUBUCK", "SUEDETTE",
  "MICROFIBRE", "MICROFIBER", "MINKY", "VELOUR", "NEOPRENE", "TRICOT", "TAFFETA", "JACQUARD", "DENIER", "INTERLINING", "LEATHERBOARD",
  "BONDED", "TURNLOCK", "TURNLOCKS", "KISSLOCK", "KISS-LOCK", "DRAWSTRING", "GUSSETED", "UNLINED", "EDGEPAINT", "EDGE-PAINT", "HEATSEAL",
  "HEAT-SEAL", "HEAT-SEALED", "RF", "BIFOLD", "TRIFOLD", "WRISTLET", "MINAUDIERE", "HOBO", "BAGUETTE", "WEEKENDER", "SPINNER", "SPINNERS",
  "PULLER", "PULLERS", "KEYCHAIN", "KEYCHAINS", "KEYRING", "DEBOSS", "DEBOSSED", "EMBOSS", "EM-BOSSED", "DE-BOSSED", "UNDERFLAP", "TOPSTITCH", "TOPSTITCHED", "TOPSTITCHING",
  "BARTACK", "BARTACKS", "BARTACKED", "SKIVE", "SKIVED", "SKIVING", "COLORWAY", "COLORWAYS", "COLOURWAY", "COLOURWAYS", "DESICCANT",
  "HANGTAG", "HANGTAGS", "LUGGAGE", "TROLLEY", "MEMORY", "MICROBEADS", "ZIPPERED", "ZIPPERS", "COIL", "MOLDED", "MOULDED", "GUNMETAL",
  "ANTIQUE", "CHAMPAGNE", "IRIDESCENT", "HOLOGRAPHIC", "TONAL", "ORG", "REMAINING", "PROTO", "PROTOS", "HARDSIDE", "SOFTSIDE", "PICKUP",
  // brands, suppliers, places that appear on packs
  "ICON", "PINK", "LONDON", "TED", "BAKER", "CHAMPION", "OFF-WHITE", "PALM", "ANGELS", "PLAY", "JUNFA", "JINXIN", "BETSY", "JOHNSON",
  "TJ", "MAXX", "MARSHALLS", "HOMEGOODS", "SIERRA", "WINNERS", "BEALLS", "ROSS", "BURLINGTON", "JODIE", "SHARKSKIN",
];

/** Known misspellings → correction (checked first; these also come from the reference packs). */
export const KNOWN_CORRECTIONS: Record<string, string> = {
  CLOURE: "CLOSURE",
  CLOSUER: "CLOSURE",
  RECIEVE: "RECEIVE",
  RECIEVED: "RECEIVED",
  IRRIDESCENT: "IRIDESCENT",
  IRIDESENT: "IRIDESCENT",
  INGRAIVED: "ENGRAVED",
  INGRAVED: "ENGRAVED",
  CHAMPANGE: "CHAMPAGNE",
  CHAMPAIGNE: "CHAMPAGNE",
  GUSETT: "GUSSET",
  GUSSETT: "GUSSET",
  ZIPER: "ZIPPER",
  ZIPPPER: "ZIPPER",
  SEPERATE: "SEPARATE",
  ADJUSTIBLE: "ADJUSTABLE",
  REMOVEABLE: "REMOVABLE",
  HARDWEAR: "HARDWARE",
  EMBROIDARY: "EMBROIDERY",
  LINNING: "LINING",
  MAGENTIC: "MAGNETIC",
  MAGNECTIC: "MAGNETIC",
  WIEGHT: "WEIGHT",
  HIEGHT: "HEIGHT",
  WIDHT: "WIDTH",
  LENGHT: "LENGTH",
  DEPHT: "DEPTH",
  PANTOME: "PANTONE",
  ACCESORY: "ACCESSORY",
  ACCESORIES: "ACCESSORIES",
};
