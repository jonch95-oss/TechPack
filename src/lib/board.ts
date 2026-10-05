import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { packFiles } from "@/db/schema";
import { callTechnicalDesigner } from "@/lib/ai/client";
import { readStoredFile } from "@/lib/storage";
import { loadPack } from "@/lib/data";
import { writeAnswer } from "@/lib/answer-write";
import { BOARD_INSTRUCTIONS, READ_BOARD_SCHEMA, boardAnswers, normaliseBoard, type ReadBoardOutput } from "@/lib/board-read";

/**
 * read_board: the full (uncropped) render or design board, read for notes around the product — so a
 * board that says "REFER TO SPEC" asks the designer for the spec sheet straight away.
 */
export async function readBoard(packId: string, fileId: string, styleNo: string, user: { id: string } = { id: "" }) {
  const [file] = await db.select().from(packFiles).where(and(eq(packFiles.id, fileId), eq(packFiles.packId, packId)));
  if (!file) return null;
  const img = await readStoredFile(file.url);
  const res = await callTechnicalDesigner<ReadBoardOutput>({
    task: "read_board",
    instructions: BOARD_INSTRUCTIONS,
    images: [img],
    schema: READ_BOARD_SCHEMA,
    fixtureName: [`read_board.${styleNo}`],
    effort: "low",
  });
  const board = normaliseBoard(res.output);
  await db.update(packFiles).set({ marks: { ...file.marks, board } }).where(eq(packFiles.id, file.id));
  // What the board says becomes answers to confirm, for questions not already settled.
  const p = await loadPack(packId);
  if (p)
    for (const s of boardAnswers(board, p.pack, p.answers)) {
      const m = p.meta[s.questionId];
      await writeAnswer({ packId, questionId: s.questionId, value: s.value, origin: "AI", status: "ai", source: "BOARD", note: s.note, userId: user.id || null }, m ? { value: p.answers[s.questionId], origin: m.origin, status: p.statuses[s.questionId], aiValue: m.aiValue } : null);
    }
  return board;
}
