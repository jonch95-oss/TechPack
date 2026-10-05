import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/dal";
import { storeFile, usingBlob, contentTypeFor } from "@/lib/storage";

const FOLDERS = new Set(["renders", "references", "specs", "swatches", "hardware", "prints", "brands", "misc"]);
const MAX_BYTES = 25 * 1024 * 1024;

/** Server-side upload (local dev, and small files in Blob mode). Large files go through /api/blob client uploads. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "designer")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "misc");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 25 MB" }, { status: 413 });
  const url = await storeFile(FOLDERS.has(folder) ? folder : "misc", file.name, await file.arrayBuffer(), file.type || contentTypeFor(file.name));
  return NextResponse.json({ url, blob: usingBlob() });
}
