import { asc } from "drizzle-orm";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { buildTemplate } from "@/lib/library-import-server";

/** Downloadable Excel templates: /api/templates/hardware, /api/templates/materials */
export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[kind]">) {
  if (!(await getCurrentUser())) return new Response("Not signed in", { status: 401 });
  const { kind } = await ctx.params;
  if (kind !== "hardware" && kind !== "materials") return new Response("Not found", { status: 404 });
  const names = (await db.select({ name: brands.name }).from(brands).orderBy(asc(brands.name))).map((b) => b.name);
  const buf = await buildTemplate(kind === "hardware" ? "hardware" : "material", names);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="icon-${kind}-template.xlsx"`,
    },
  });
}
