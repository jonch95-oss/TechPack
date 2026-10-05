import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { getCurrentUser } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { loadPack } from "@/lib/data";
import { packZip } from "@/lib/exports";

export const maxDuration = 300;

/** GET /api/packs/export?ids=a,b,c — batch export (V2 §3 step 5): one ZIP of the packs' own ZIPs. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
  if (!ids.length) return NextResponse.json({ error: "No packs" }, { status: 400 });
  const files: Record<string, Uint8Array> = {};
  for (const id of ids) {
    const p = await loadPack(id);
    if (!p) continue;
    const { zip, name } = await packZip(p);
    files[name] = new Uint8Array(zip);
  }
  const zip = zipSync(files, { level: 0 });
  await audit({ userId: user.id, entity: "pack", entityId: ids[0], action: "update", field: "export:batch", after: { packs: Object.keys(files) } });
  return new Response(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="TECH_PACKS_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip"` } });
}
