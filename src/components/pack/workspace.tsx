"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnswerStatus, PackFile, PackStatus } from "@/db/schema";
import type { LibraryOptions } from "@/lib/data";
import {
  completeness,
  derivedValue,
  applyStandardTolerances,
  bomFromAnswers,
  contentLabel,
  draftDescription,
  optionalToggleId,
  pomFromTemplate,
  templateKey,
  type BomRow,
  type PomRow,
  sectionsFor,
  sectionVisible,
  unitLabel as unitLabelFor,
  visibleQuestions,
  type AnswerMap,
  type Category,
  type EvalContext,
  type Question,
  type Section,
} from "@/lib/questions";
import { addPackFile, confirmAnswer, runPrefill, saveAnswer, updatePackSetup } from "@/app/actions/packs";
import { uploadFile } from "@/lib/client/upload";
import { Badge, Button, cx, Eyebrow } from "@/components/ui";
import { Toggle } from "@/components/chips";
import { LibraryProvider, useLibrary } from "./library-picker";
import { QuestionField } from "./question-field";
import { FilesPanel } from "./files-panel";
import { ExportPanel } from "./export-panel";
import { SignOff } from "./signoff";
import { SIGNED_OFF } from "@/lib/status";
import { DuplicatePack } from "./duplicate";
import { PackAdmin } from "./pack-admin";
import { FactoryQA } from "./factory-qa";
import { PhotoMarks } from "./photo-marks";

export type WorkspaceProps = {
  pack: {
    id: string;
    styleNo: string;
    styleName: string;
    category: Category;
    colorways: string[];
    aiAnalysis: { visible_features: string[]; not_visible: string[]; agent_notes: string; ran_at: string; model: string } | null;
    status: PackStatus;
    factory: string;
    factoryStyleNo: string;
    copiedFrom: { id: string; styleNo: string } | null;
    chineseOn: boolean;
    archived: boolean;
  };
  meId: string;
  review: { requestedBy: { id: string; name: string } | null; reviewedBy: { name: string } | null; reviewedAt: string | null };
  factoryQuestions: { id: string; askedBy: string; question: string; answer: string; answeredByName: string | null; createdAt: string; answeredAt: string | null }[];
  sampleSummary: { rounds: number; open: number };
  flatSummary: { count: number; inferred: number };
  brand: { id: string; name: string; logoUrl: string | null; licensorRequired: boolean };
  sentBy: string;
  answers: AnswerMap;
  statuses: Record<string, AnswerStatus>;
  meta: Record<string, { aiNote: string; aiValue: unknown }>;
  files: PackFile[];
  library: LibraryOptions;
  canEdit: boolean;
  isAdmin: boolean;
};

type SaveState = { state: "idle" | "saving" | "saved" | "error"; at?: string; error?: string };

const STATUS_BADGE: Record<string, { tone: "ai" | "est" | "inferred"; text: string }> = {
  ai: { tone: "ai", text: "AI-suggested — confirm" },
  est: { tone: "est", text: "EST — confirm" },
  inferred: { tone: "inferred", text: "Inferred — confirm" },
};

export function PackWorkspace(props: WorkspaceProps) {
  const router = useRouter();
  const { pack, brand, canEdit } = props;
  const [answers, setAnswers] = useState<AnswerMap>(props.answers);
  const [statuses, setStatuses] = useState<Record<string, AnswerStatus>>(props.statuses);
  const [meta, setMeta] = useState(props.meta);
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  /** Bumped after every saved change so the validation gate re-checks. */
  const [version, setVersion] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ running: boolean; message?: string; error?: string }>({ running: false });
  const [colorways, setColorways] = useState(pack.colorways);
  const [chinese, setChinese] = useState(pack.chineseOn);
  const [, start] = useTransition();
  const inflight = useRef(0);

  // Keep local state in sync after server refreshes (e.g. AI pre-fill).
  const [seen, setSeen] = useState(props.answers);
  if (seen !== props.answers) {
    setSeen(props.answers);
    setVersion((v) => v + 1);
    setAnswers(props.answers);
    setStatuses(props.statuses);
    setMeta(props.meta);
  }

  const ctx: EvalContext = useMemo(() => ({ category: pack.category, answers, brand }), [pack.category, answers, brand]);
  const visible = useMemo(() => new Set(visibleQuestions(ctx).map((q) => q.id)), [ctx]);
  const issues = useMemo(() => completeness(ctx, statuses, colorways), [ctx, statuses, colorways]);
  const sections = useMemo(() => sectionsFor(pack.category), [pack.category]);
  const unitLabel = useCallback((u: string) => unitLabelFor(u, answers).toUpperCase(), [answers]);
  const toConfirm = Object.entries(statuses).filter(([k, s]) => s !== "confirmed" && visible.has(k)).length;
  const requiredTotal = visibleQuestions(ctx).filter((q) => q.required).length;
  const requiredOpen = new Set(issues.map((i) => i.questionId)).size;

  const commit = useCallback(
    (questionId: string, value: unknown) => {
      const prev = { v: answers[questionId], s: statuses[questionId] };
      setAnswers((a) => ({ ...a, [questionId]: value }));
      setStatuses((s) => ({ ...s, [questionId]: "confirmed" }));
      setSave({ state: "saving" });
      inflight.current++;
      start(async () => {
        const res = await saveAnswer(pack.id, questionId, value);
        inflight.current--;
        if (!res.ok) {
          setAnswers((a) => ({ ...a, [questionId]: prev.v }));
          setStatuses((s) => ({ ...s, [questionId]: prev.s }));
          setSave({ state: "error", error: res.error });
          return;
        }
        setVersion((v) => v + 1);
        if (inflight.current === 0) setSave({ state: "saved", at: res.updatedAt });
        // An edit after review / sign-off sends the pack back to draft: show that straight away.
        if (pack.status === "IN_REVIEW" || pack.status === "APPROVED") router.refresh();
      });
    },
    [answers, statuses, pack.id, pack.status, router],
  );

  const confirm = (questionId: string) => {
    setStatuses((s) => ({ ...s, [questionId]: "confirmed" }));
    start(async () => {
      const res = await confirmAnswer(pack.id, questionId);
      if (!res.ok) setSave({ state: "error", error: res.error });
      else {
        setSave({ state: "saved", at: new Date().toISOString() });
        setVersion((v) => v + 1);
      }
    });
  };

  const jump = (questionId: string) => {
    const el = document.getElementById(`q-${questionId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(questionId);
    setTimeout(() => setFlash(null), 1600);
  };

  const nextUnconfirmed = () => {
    const order = visibleQuestions(ctx).map((q) => q.id);
    const target = order.find((id) => statuses[id] && statuses[id] !== "confirmed") ?? issues[0]?.questionId;
    if (target) jump(target);
  };

  const render = props.files.find((f) => f.kind === "render");


  const doPrefill = () => {
    setPrefill({ running: true });
    start(async () => {
      const res = await runPrefill(pack.id);
      if (!res.ok) setPrefill({ running: false, error: res.error });
      else {
        setPrefill({
          running: false,
          message: `${res.filled} answer${res.filled === 1 ? "" : "s"} pre-filled${res.skippedConfirmed ? ` · ${res.skippedConfirmed} confirmed answer(s) left untouched` : ""}${res.fixture ? " · fixture mode" : ""}. Confirm or change each one.`,
        });
        router.refresh();
      }
    });
  };

  return (
    <LibraryProvider initial={props.library} brandId={brand.id}>
      {/* ------------------------------ Masthead ------------------------------ */}
      <section className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-12 pb-12 border-b border-hairline fade-up">
        <div className="relative bg-white border border-hairline aspect-[4/3] flex items-center justify-center overflow-hidden">
          {render ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={render.url} alt={`${pack.styleNo} render`} className="w-full h-full object-contain" data-testid="render-image" />
          ) : null}
          {render && canEdit ? (
            <PhotoMarks
              packId={pack.id}
              mode="logo"
              file={render}
              trigger={(open) => (
                <button type="button" onClick={open} className="absolute top-4 left-4 inline-flex h-8 px-4 items-center bg-ivory/90 border border-hairline-strong text-[10px] tracking-[0.18em] uppercase hover:border-ink" data-testid="mark-logo">
                  {render.marks?.dot ? "Logo marked ●" : "Mark logo"}
                </button>
              )}
            />
          ) : null}
          {render ? null : (
            <div className="text-center px-10">
              <div className="display italic text-3xl text-ink-soft">The render</div>
              <p className="text-taupe text-[12px] mt-3 max-w-xs mx-auto leading-relaxed">A single product render is all that&apos;s needed. The Technical Designer reads it and pre-answers what it can see.</p>
            </div>
          )}
          {canEdit && (
            <label className="absolute bottom-4 right-4 cursor-pointer">
              <span className="inline-flex h-9 px-5 items-center bg-ivory/90 backdrop-blur border border-ink text-[10px] tracking-[0.2em] uppercase hover:bg-ink hover:text-ivory transition-colors">
                {render ? "Replace render" : "Upload render"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                data-testid="upload-render"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setSave({ state: "saving" });
                  try {
                    const url = await uploadFile(f, "renders");
                    const res = await addPackFile(pack.id, { kind: "render", url, name: f.name });
                    if (!res.ok) throw new Error(res.error);
                    setSave({ state: "saved", at: new Date().toISOString() });
                    router.refresh();
                  } catch (err) {
                    setSave({ state: "error", error: (err as Error).message });
                  }
                }}
              />
            </label>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-6">
            <Eyebrow>
              {brand.name} · {pack.category}
            </Eyebrow>
            <span className="flex items-center gap-5">
              <a href={`/packs/${pack.id}/flats`} className="eyebrow hover:text-ink" data-testid="lineart-link">
                Line art{props.flatSummary.count ? ` · ${props.flatSummary.count}` : ""}
                {props.flatSummary.inferred ? <span className="text-signal"> · {props.flatSummary.inferred} to confirm</span> : null}
              </a>
              <a href={`/packs/${pack.id}/samples`} className="eyebrow hover:text-ink" data-testid="samples-link">
                Samples{props.sampleSummary.rounds ? ` · ${props.sampleSummary.open} open` : ""}
              </a>
              {canEdit && <DuplicatePack packId={pack.id} styleNo={pack.styleNo} styleName={pack.styleName} />}
              {props.isAdmin && <PackAdmin packId={pack.id} styleNo={pack.styleNo} archived={pack.archived} />}
              <SaveIndicator s={save} />
            </span>
          </div>
          {pack.archived && (
            <p className="mt-4 text-[12px] text-signal" role="status" data-testid="archived-note">
              Archived — read-only and hidden from the dashboard.{props.isAdmin ? " Restore it to edit." : ""}
            </p>
          )}
          <h1 className="display text-[56px] leading-[1] mt-4">
            {pack.styleNo}
            <span className="block italic text-ink-soft text-[40px] mt-1">{pack.styleName}</span>
          </h1>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 mt-8 text-[12px]">
            <Meta k="Sent by" v={props.sentBy} />
            <Meta k="Attn" v="FTY" />
            <div>
              <dt className="eyebrow mb-1">Proto</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="tracking-[0.06em]">{pack.styleNo}</span>
                {colorways.map((c) => (
                  <span key={c} className="border border-hairline-strong px-2 h-6 inline-flex items-center text-[11px]">{c}</span>
                ))}
                {canEdit && (
                  <span className="inline-flex gap-1">
                    <button
                      type="button"
                      aria-label="Remove last colorway"
                      className="w-6 h-6 border border-hairline-strong text-taupe hover:text-ink hover:border-ink disabled:opacity-30"
                      disabled={colorways.length <= 1}
                      onClick={() => {
                        const next = colorways.slice(0, -1);
                        setColorways(next);
                        start(async () => void (await updatePackSetup(pack.id, { colorways: next })));
                      }}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-label="Add colorway"
                      className="w-6 h-6 border border-hairline-strong text-taupe hover:text-ink hover:border-ink"
                      onClick={() => {
                        const next = [...colorways, `-${String.fromCharCode(65 + colorways.length)}`];
                        setColorways(next);
                        start(async () => void (await updatePackSetup(pack.id, { colorways: next })));
                      }}
                    >
                      +
                    </button>
                  </span>
                )}
              </dd>
            </div>
            <Meta k="Description" v={(answers["header.description"] as string) || "—"} />
            <div>
              <dt className="eyebrow mb-1">Output</dt>
              <dd className="inline-flex border border-hairline-strong" role="radiogroup" aria-label="Output language" data-testid="language">
                {[
                  { v: false, label: "EN" },
                  { v: true, label: "EN + 中文" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={chinese === o.v}
                    disabled={!canEdit}
                    onClick={() => {
                      setChinese(o.v);
                      start(async () => {
                        await updatePackSetup(pack.id, { chineseOn: o.v });
                        setVersion((n) => n + 1);
                      });
                    }}
                    className={cx("h-7 px-3 text-[11px] tracking-[0.1em] transition-colors", chinese === o.v ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink")}
                  >
                    {o.label}
                  </button>
                ))}
              </dd>
            </div>
            {pack.copiedFrom && (
              <div>
                <dt className="eyebrow mb-1">Carried over from</dt>
                <dd><a href={`/packs/${pack.copiedFrom.id}`} className="underline decoration-hairline-strong underline-offset-4 hover:decoration-ink">{pack.copiedFrom.styleNo}</a></dd>
              </div>
            )}
          </dl>

          <div className="mt-auto pt-10">
            <div className="border border-hairline bg-paper p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="display text-2xl">Technical Designer</div>
                  <p className="text-taupe text-[12px] mt-1 leading-relaxed max-w-md">
                    Reads the render and pre-answers every question it can see. Each answer is marked for you to confirm or change with a click.
                    Measurements are always EST; back, interior and underside are INFERRED.
                  </p>
                </div>
                {canEdit && (
                  <Button variant="gold" onClick={doPrefill} disabled={!render || prefill.running} data-testid="run-prefill">
                    {prefill.running ? <span className="shimmer px-2">Reading render…</span> : pack.aiAnalysis ? "Re-read render" : "Pre-fill from render"}
                  </Button>
                )}
              </div>
              {prefill.message && <p className="mt-4 text-[12px] text-ok" role="status">{prefill.message}</p>}
              {prefill.error && <p className="mt-4 text-[12px] text-signal" role="alert">{prefill.error}</p>}
              {pack.aiAnalysis && (
                <div className="grid sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-hairline text-[11.5px]">
                  <div>
                    <div className="eyebrow mb-2">Seen on render</div>
                    <ul className="space-y-1 text-ink-soft">
                      {pack.aiAnalysis.visible_features.map((f) => (
                        <li key={f}>— {f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="eyebrow mb-2">Cannot be seen</div>
                    <ul className="space-y-1 text-ink-soft">
                      {pack.aiAnalysis.not_visible.map((f) => (
                        <li key={f}>— {f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ Body ------------------------------ */}
      <div className="grid xl:grid-cols-[220px_minmax(0,1fr)_300px] lg:grid-cols-[200px_minmax(0,1fr)] gap-12 pt-12">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1" aria-label="Sections">
            <div className="eyebrow mb-4">Contents</div>
            {sections
              .filter((s) => !s.optional && sectionVisible(s, ctx))
              .map((s, i) => (
                <SectionLink key={s.id} s={s} i={i} ctx={ctx} statuses={statuses} issues={issues} visible={visible} />
              ))}
            <div className="eyebrow pt-6 pb-2">Optional</div>
            {sections
              .filter((s) => s.optional)
              .map((s) => (
                <a key={s.id} href={`#sec-${s.id}`} className={cx("block text-[12px] py-1", answers[optionalToggleId(s.id)] ? "text-ink" : "text-mist")}>
                  {s.title}
                </a>
              ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-16">
          {sections.map((s, si) => {
            if (s.optional) return null;
            if (!sectionVisible(s, ctx)) return null;
            const qs = s.questions.filter((q) => visible.has(q.id));
            if (!qs.length) return null;
            return (
              <section key={s.id} id={`sec-${s.id}`} className="scroll-mt-28">
                <SectionTitle n={si + 1} title={s.title} />
                <div className="divide-y divide-hairline border-y border-hairline">
                  {qs.map((q) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      value={answers[q.id]}
                      status={statuses[q.id]}
                      meta={meta[q.id]}
                      flash={flash === q.id}
                      canEdit={canEdit}
                      onChange={(v) => commit(q.id, v)}
                      onConfirm={() => confirm(q.id)}
                      ctx={ctx}
                      colorways={colorways}
                      unitLabel={unitLabel}
                      extra={canEdit ? <QuestionHelpers qid={q.id} category={pack.category} answers={answers} colorways={colorways} onCommit={commit} /> : null}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <section id="sec-factory" className="scroll-mt-28">
            <SectionTitle n="—" title="Factory questions" />
            <FactoryQA packId={pack.id} questions={props.factoryQuestions} canEdit={canEdit} factory={pack.factory} />
          </section>

          <section id="sec-uploads" className="scroll-mt-28">
            <SectionTitle n="—" title="Uploads & references" />
            <FilesPanel packId={pack.id} files={props.files} colorways={colorways} canEdit={canEdit} />
          </section>

          <section className="scroll-mt-28">
            <SectionTitle n="—" title="Optional sections" />
            <p className="text-taupe text-[12px] -mt-4 mb-6">Off by default. Turn a section on for this pack only.</p>
            <div className="space-y-6">
              {sections
                .filter((s) => s.optional)
                .map((s) => {
                  const on = answers[optionalToggleId(s.id)] === true;
                  return (
                    <div key={s.id} id={`sec-${s.id}`} className="border border-hairline scroll-mt-28">
                      <div className="flex items-center justify-between px-6 py-4 bg-paper">
                        <div className="display text-xl">{s.title}</div>
                        <Toggle value={on} onChange={(v) => commit(optionalToggleId(s.id), v)} disabled={!canEdit} />
                      </div>
                      {on && (
                        <div className="divide-y divide-hairline border-t border-hairline px-6">
                          {s.questions
                            .filter((q) => visible.has(q.id))
                            .map((q) => (
                              <QuestionRow
                                key={q.id}
                                q={q}
                                value={answers[q.id]}
                                status={statuses[q.id]}
                                meta={meta[q.id]}
                                flash={flash === q.id}
                                canEdit={canEdit}
                                onChange={(v) => commit(q.id, v)}
                                onConfirm={() => confirm(q.id)}
                                ctx={ctx}
                                colorways={colorways}
                                unitLabel={unitLabel}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-28 border border-hairline bg-paper">
            <div className="p-6 border-b border-hairline">
              <div className="eyebrow mb-3">Readiness</div>
              <div className="flex items-end gap-2">
                <span className="display text-[44px] leading-none" data-testid="required-done">{Math.max(0, requiredTotal - requiredOpen)}</span>
                <span className="text-taupe mb-1">/ {requiredTotal} ★ complete</span>
              </div>
              <div className="h-px bg-hairline mt-4 relative">
                <div className="absolute inset-y-0 left-0 bg-ink transition-all duration-500" style={{ width: `${requiredTotal ? ((requiredTotal - requiredOpen) / requiredTotal) * 100 : 0}%`, height: 2, top: -0.5 }} />
              </div>
              {toConfirm > 0 && (
                <button type="button" onClick={nextUnconfirmed} className="mt-5 w-full flex items-center justify-between text-[10.5px] tracking-[0.18em] uppercase text-gold hover:text-ink">
                  <span>{toConfirm} AI answer{toConfirm > 1 ? "s" : ""} to confirm</span>
                  <span>Next →</span>
                </button>
              )}
            </div>
            <div className="max-h-[28vh] overflow-y-auto">
              {issues.length === 0 ? (
                <div className="p-6 text-[12px] text-ok">Every ★ field is confirmed. Ready for the PDF stage.</div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {issues.slice(0, 80).map((i, k) => (
                    <li key={`${i.questionId}-${k}`}>
                      <button type="button" onClick={() => jump(i.questionId)} className="w-full text-left px-6 py-3 hover:bg-ivory transition-colors">
                        <div className="text-[12px] text-ink truncate">{i.label}</div>
                        <div className="text-[9.5px] tracking-[0.16em] uppercase text-signal mt-0.5">{i.problem}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <SignOff
              packId={pack.id}
              status={pack.status}
              meId={props.meId}
              requestedBy={props.review.requestedBy}
              reviewedBy={props.review.reviewedBy}
              reviewedAt={props.review.reviewedAt}
              factory={pack.factory}
              factoryStyleNo={pack.factoryStyleNo}
              canEdit={canEdit}
            />
            <ExportPanel packId={pack.id} version={version} onJump={jump} canEdit={canEdit} signedOff={SIGNED_OFF.includes(pack.status)} />
            <a href={`/api/packs/${pack.id}/techpack`} target="_blank" className="block pb-5 text-center text-[9.5px] tracking-[0.2em] uppercase text-mist hover:text-ink">
              TechPack JSON
            </a>
          </div>
        </aside>
      </div>

      {/* Readiness bar for screens without the right-hand rail. */}
      <div className="xl:hidden fixed bottom-0 inset-x-0 z-30 bg-ivory/95 backdrop-blur border-t border-hairline">
        <div className="max-w-[1480px] mx-auto px-10 h-14 flex items-center justify-between gap-6">
          <span className="text-[11px] tracking-[0.16em] uppercase">
            <span className="display text-xl normal-case tracking-normal mr-2">{Math.max(0, requiredTotal - requiredOpen)}</span>/ {requiredTotal} ★ complete
            {issues.length > 0 && <span className="text-signal ml-4">{issues.length} open</span>}
          </span>
          <a href={`/api/packs/${pack.id}/pdf?draft=1`} target="_blank" className="text-[10.5px] tracking-[0.2em] uppercase text-taupe hover:text-ink">Draft PDF</a>
          {(toConfirm > 0 || issues.length > 0) && (
            <button type="button" onClick={nextUnconfirmed} className="text-[10.5px] tracking-[0.2em] uppercase text-gold hover:text-ink">
              {toConfirm > 0 ? `${toConfirm} to confirm` : "Next open item"} →
            </button>
          )}
        </div>
      </div>
    </LibraryProvider>
  );
}

function SectionTitle({ n, title }: { n: number | string; title: string }) {
  return (
    <div className="flex items-baseline gap-5 mb-6">
      <span className="display italic text-gold text-[22px] w-8">{typeof n === "number" ? toRoman(n) : n}</span>
      <h2 className="display text-[34px] leading-none">{title}</h2>
    </div>
  );
}

function toRoman(n: number) {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

function SectionLink({ s, i, ctx, statuses, issues, visible }: { s: Section; i: number; ctx: EvalContext; statuses: Record<string, string>; issues: { questionId: string }[]; visible: Set<string> }) {
  const ids = s.questions.filter((q) => visible.has(q.id)).map((q) => q.id);
  if (!ids.length) return null;
  const open = issues.some((x) => ids.includes(x.questionId));
  const ai = ids.some((id) => statuses[id] && statuses[id] !== "confirmed");
  void ctx;
  return (
    <a href={`#sec-${s.id}`} className="group flex items-center gap-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink">
      <span className="display italic text-mist w-6 text-[13px]">{toRoman(i + 1)}</span>
      <span className="flex-1 truncate">{s.title}</span>
      <span className={cx("w-1.5 h-1.5 rounded-full", ai ? "bg-gold" : open ? "bg-signal/70" : "bg-ok")} aria-hidden />
    </a>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow mb-1">{k}</dt>
      <dd className="tracking-[0.04em] line-clamp-2">{v || "—"}</dd>
    </div>
  );
}

function SaveIndicator({ s }: { s: SaveState }) {
  if (s.state === "saving") return <span className="eyebrow text-gold">Saving…</span>;
  if (s.state === "error") return <span className="text-[11px] text-signal" role="alert">{s.error}</span>;
  if (s.state === "saved") return <span className="eyebrow text-ok">Saved ✓</span>;
  return <span className="eyebrow">Autosaves every click</span>;
}

function QuestionRow({
  q,
  value,
  status,
  meta,
  flash,
  canEdit,
  onChange,
  onConfirm,
  ctx,
  colorways,
  unitLabel,
  extra,
}: {
  q: Question;
  value: unknown;
  status?: AnswerStatus;
  meta?: { aiNote: string; aiValue: unknown };
  flash: boolean;
  canEdit: boolean;
  onChange: (v: unknown) => void;
  onConfirm: () => void;
  ctx: EvalContext;
  colorways: string[];
  unitLabel: (u: string) => string;
  extra?: React.ReactNode;
}) {
  const badge = status && status !== "confirmed" ? STATUS_BADGE[status] : null;
  const wide = ["rows", "materials", "colorway_matrix", "per_colorway_text"].includes(q.kind);
  const overridden = status === "confirmed" && meta?.aiValue !== undefined && meta?.aiValue !== null && JSON.stringify(meta.aiValue) !== JSON.stringify(value);
  return (
    <div
      id={`q-${q.id}`}
      data-testid={`q-${q.id}`}
      data-status={status ?? "empty"}
      className={cx(
        "py-7 scroll-mt-32 transition-colors duration-700",
        wide ? "block" : "grid md:grid-cols-[260px_minmax(0,1fr)] gap-x-10 gap-y-3",
        flash && "bg-gold-soft/60",
        badge && "bg-gold-soft/15",
      )}
    >
      <div className={cx(wide && "flex flex-wrap items-baseline justify-between gap-4 mb-5")}>
        <div>
          <div className="text-[13.5px] text-ink leading-snug">
            {q.label}
            {q.required && <span className="text-signal ml-1" title="Required — blocks export">★</span>}
          </div>
          {q.help && <div className="text-[11px] text-taupe mt-1 leading-relaxed max-w-sm">{q.help}</div>}
        </div>
        {badge && (
          <div className={cx("flex flex-wrap items-center gap-2", !wide && "mt-3")}>
            <Badge tone={badge.tone}>{badge.text}</Badge>
            {canEdit && (
              <button type="button" onClick={onConfirm} data-testid={`confirm-${q.id}`} className="h-[22px] px-2 border border-ink text-[9.5px] tracking-[0.16em] uppercase hover:bg-ink hover:text-ivory transition-colors">
                ✓ Confirm
              </button>
            )}
          </div>
        )}
        {badge && meta?.aiNote && <div className="text-[10.5px] tracking-[0.08em] text-gold mt-2">Saw: {meta.aiNote}</div>}
        {overridden && <div className="text-[10.5px] text-taupe mt-2 italic">AI suggested {displayAi(meta!.aiValue)}</div>}
        {extra && <div className="mt-2">{extra}</div>}
      </div>
      <div className="min-w-0">
        <QuestionField
          q={q}
          value={value}
          onChange={onChange}
          ctx={ctx}
          colorways={colorways}
          disabled={!canEdit}
          unitLabel={unitLabel}
          derived={q.kind === "derived" ? derivedValue(q, ctx) : undefined}
        />
      </div>
    </div>
  );
}

function displayAi(v: unknown): string {
  if (v === true) return "YES";
  if (v === false) return "NO";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? (x as { name?: string }).name ?? "…" : String(x))).join(", ");
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("label" in o) return String(o.label);
    if ("w" in o) return `${o.w} × ${o.h}`;
  }
  return String(v);
}



/** One-click helpers beside some questions. They copy answers already given — never invent values. */
function ContentLabelPreview({ answers, colorways }: { answers: AnswerMap; colorways: string[] }) {
  const lib = useLibrary();
  const comp = new Map(lib.options.material.map((m) => [m.id, m.composition]));
  const labels = contentLabel(answers, colorways, (id) => comp.get(id) || undefined);
  return (
    <div className="mt-3 border border-hairline bg-paper p-4 text-[11px] leading-relaxed space-y-1 max-w-sm" data-testid="content-label">
      <div className="eyebrow mb-1">Content label (from the library)</div>
      {colorways.map((cw) => (
        <div key={cw}>
          <span className="display text-base mr-2">{cw}</span>
          {labels[cw]?.text || <span className="italic text-taupe">—</span>}
          {labels[cw]?.missing.length ? <div className="text-signal">Composition missing: {labels[cw].missing.join(", ")}</div> : null}
        </div>
      ))}
    </div>
  );
}

function QuestionHelpers({ qid, category, answers, colorways, onCommit }: { qid: string; category: Category; answers: AnswerMap; colorways: string[]; onCommit: (qid: string, v: unknown) => void }) {
  const helper = (label: string, onClick: () => void, testId?: string) => (
    <button key={label} type="button" data-testid={testId} className="block text-[10px] tracking-[0.2em] uppercase text-gold hover:text-ink mt-1" onClick={onClick}>
      ✦ {label}
    </button>
  );
  if (qid === "header.description") return helper("Redraft from answers", () => onCommit(qid, draftDescription(category, answers)));
  if (qid === "pom.list") {
    const rows = (answers["pom.list"] as PomRow[] | undefined) ?? [];
    return (
      <>
        {helper(`Load ${templateKey(category, answers).toLowerCase()} template`, () => onCommit(qid, pomFromTemplate(category, answers, rows)), "pom-template")}
        {rows.some((r) => r.tol == null) && helper("Apply standard tolerances to blanks", () => onCommit(qid, applyStandardTolerances(rows, answers["dims.unit"] === "INCHES")), "pom-tolerances")}
      </>
    );
  }
  if (qid === "opt.labels.types") return <ContentLabelPreview answers={answers} colorways={colorways} />;
  if (qid === "bom.list") return helper("Build from answers", () => onCommit(qid, bomFromAnswers(answers, (answers["bom.list"] as BomRow[] | undefined) ?? [])), "bom-build");
  return null;
}
