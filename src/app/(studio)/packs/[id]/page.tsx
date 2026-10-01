import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth/dal";
import { libraryOptions, loadPack } from "@/lib/data";
import { PackWorkspace } from "@/components/pack/workspace";

export default async function PackPage(props: PageProps<"/packs/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [p, library] = await Promise.all([loadPack(id), libraryOptions()]);
  if (!p) notFound();
  return (
    <>
      <Link href="/" className="eyebrow hover:text-ink inline-block mb-8">← All tech packs</Link>
      <PackWorkspace
        pack={{
          id: p.pack.id,
          styleNo: p.pack.styleNo,
          styleName: p.pack.styleName,
          category: p.pack.category,
          colorways: p.pack.colorways,
          aiAnalysis: p.pack.aiAnalysis,
        }}
        brand={{ id: p.brand.id, name: p.brand.name, logoUrl: p.brand.logoUrl, licensorRequired: p.brand.licensorRequired }}
        sentBy={p.sentBy}
        answers={p.answers}
        statuses={p.statuses}
        meta={Object.fromEntries(Object.entries(p.meta).map(([k, m]) => [k, { aiNote: m.aiNote, aiValue: m.aiValue }]))}
        files={p.files}
        library={library}
        canEdit={can(user, "designer")}
      />
    </>
  );
}
