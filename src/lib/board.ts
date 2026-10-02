import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { packFiles } from "@/db/schema";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { readStoredFile } from "@/lib/storage";

const READ_BOARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["board_text", "refers_to_spec", "reference"],
  properties: {
    board_text: { type: "array", items: { type: "string" }, description: "Every note written on the board around the product, CAPITALS, as written." },
    refers_to_spec: { type: "boolean", description: "True when a note sends the reader to another document: REFER TO SPEC, SEE SPEC SHEET, SEE TECH PACK, PER SPEC, MEASUREMENTS TO FOLLOW …" },
    reference: { type: "string", description: "That note exactly, e.g. \"(REFER TO SPEC)\"; empty when none." },
  },
} as const;

type ReadBoardOutput = { board_text: string[]; refers_to_spec: boolean; reference: string };

/**
 * read_board: the full (uncropped) render or design board, read for notes around the product — so a
 * board that says "REFER TO SPEC" asks the designer for the spec sheet straight away.
 */
export async function readBoard(packId: string, fileId: string, styleNo: string) {
  const [file] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  if (!file) return null;
  const img = await readStoredFile(file.url);
  const res = await callTechnicalDesigner<ReadBoardOutput>({
    task: "read_board",
    instructions: "Read only the TEXT written on this design board / render around the product (labels, notes, arrows' captions). Ignore the product itself and any logo on it.",
    images: [img],
    schema: READ_BOARD_SCHEMA,
    fixtureName: [`read_board.${styleNo}`],
    effort: "low",
  });
  const text = (res.output.board_text ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  const reference = (res.output.reference ?? "").trim().toUpperCase();
  const refersToSpec = !!res.output.refers_to_spec || text.some((t) => /REFER TO SPEC|SEE SPEC|PER SPEC|SEE TECH ?PACK|MEASUREMENTS? TO FOLLOW/.test(t));
  const board = { text, refersToSpec, reference: reference || text.find((t) => /SPEC/.test(t)) || "" };
  await db.update(packFiles).set({ marks: { ...file.marks, board } }).where(eq(packFiles.id, file.id));
  return board;
}
