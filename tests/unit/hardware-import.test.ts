import { describe, expect, it } from "vitest";
import { matchImage, normaliseType, parseCsv } from "@/lib/hardware-import";

describe("hardware import", () => {
  it("maps loose headers and normalises types", () => {
    const { rows, errors } = parseCsv("Code,Brand,Type,Description,Dimensions,Plating,Image\nPINK005,Pink London,Logo plate,Pink plate,40 x 12,shiny champagne gold,pink005.png\n,Pink London,magnet,,14,,\n");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ code: "PINK005", type: "LOGO PLATE", dimsMm: "40 X 12", finish: "SHINY CHAMPAGNE GOLD", photo: "pink005.png" });
    expect(rows[1]).toMatchObject({ code: "", type: "MAGNETIC SNAP" });
  });

  it("matches images by photo column, then by code", () => {
    const files = ["imgs/PINK003.jpg", "imgs/plate.png"];
    expect(matchImage(files, "plate.png", "PINK005")).toBe("imgs/plate.png");
    expect(matchImage(files, "", "PINK003")).toBe("imgs/PINK003.jpg");
    expect(matchImage(files, "", "PINK009")).toBeNull();
  });

  it("knows the trims", () => {
    expect(normaliseType("zipper puller")).toBe("ZIPPER PULL");
    expect(normaliseType("Keychain")).toBe("KEYCHAIN/CHARM");
    expect(normaliseType("woven label")).toBe("WOVEN LABEL");
  });
});
