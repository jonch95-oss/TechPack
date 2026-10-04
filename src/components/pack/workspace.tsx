"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
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
  NOT_A_MATERIAL,
  type AnswerMap,
  type MaterialEntry,
  type Category,
  type EvalContext,
  type Question,
  type Section,
} from "@/lib/questions";
import { ReviewScreen } from "./review-screen";
import { addPackFile, confirmAnswer, confirmAnswers, confirmFromSource, resolveConflict, saveAnswer, updatePackSetup, type ClientOrigin } from "@/app/actions/packs";
import { ORIGIN_LABEL, type Origin } from "@/lib/answer-source";
import { requiredAt } from "@/lib/stage-gate";
import { isReference, refText } from "@/lib/reference-answer";
import { ReferenceControl } from "./reference-control";
import { useJob } from "@/components/use-job";
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
import { SetupEditor } from "./setup-editor";
import { PackAdmin } from "./pack-admin";
import { CropEditor } from "./crop-editor";
import { SourcesPanel } from "./sources-panel";
import { neededFromYou, type NeededItem } from "@/lib/needed";
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
    stage: "PROTO" | "PRODUCTION";
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
  meta: Record<string, RowMeta>;
  files: PackFile[];
  library: LibraryOptions;
  canEdit: boolean;
  isAdmin: boolean;
  brands: { id: string; name: string }[];
};

type RowMeta = {
  aiNote: string;
  aiValue: unknown;
  source?: string;
  origin?: Origin;
  conflict?: { origin: string; source: string; value: unknown; note: string } | null;
  confidence?: string;
  /** When the server last changed it — sent back with a save so another person's change is never overwritten. */
  updatedAt?: string;
};

type SaveState = {
  state: "idle" | "saving" | "saved" | "error" | "stale";
  at?: string;
  error?: string;
  /** Failed save: the typed value is kept; Retry sends it again. */
  retry?: () => void;
  /** Someone else changed it: reload theirs, or keep mine. */
  stale?: { by: string; reload: () => void; keep: () => void };
};

const STATUS_BADGE: Record<string, { tone: "ai" | "est" | "inferred"; text: string }> = {
  ai: { tone: "ai", text: "AI-suggested — confirm" },
  est: { tone: "est", text: "EST — confirm" },
  inferred: { tone: "inferred", text: "Inferred — confirm" },
  sourced: { tone: "ai", text: "From upload — confirm" },
};

/** "From spec sheet — confirm", "EST from sample photo — confirm" … for answers read from an upload. */
function sourceBadge(status: string, source?: string) {
  const base = STATUS_BADGE[status];
  if (!base || !source) return base ?? null;
  const from = source.toLowerCase();
  if (status === "est") return { ...base, text: `EST from ${from} — confirm` };
  if (status === "inferred") return { ...base, text: `Inferred from ${from} — confirm` };
  return { ...base, text: `From ${from} — confirm` };
}

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
    setColorways(pack.colorways); // pre-fill can set the colourway count from the render
  }

  const ctx: EvalContext = useMemo(() => ({ category: pack.category, answers, brand }), [pack.category, answers, brand]);
  const visible = useMemo(() => new Set(visibleQuestions(ctx).map((q) => q.id)), [ctx]);
  const [stage, setStage] = useState(pack.stage);
  const issues = useMemo(() => completeness(ctx, statuses, colorways, stage), [ctx, statuses, colorways, stage]);
  const sections = useMemo(() => sectionsFor(pack.category), [pack.category]);
  const unitLabel = useCallback((u: string) => unitLabelFor(u, answers).toUpperCase(), [answers]);
  const toConfirm = Object.entries(statuses).filter(([k, s]) => s !== "confirmed" && visible.has(k)).length;
  const requiredTotal = visibleQuestions(ctx).filter((q) => requiredAt(q, stage)).length;
  const requiredOpen = new Set(issues.map((i) => i.questionId)).size;

  /** The latest commit, for Retry / Keep mine buttons created by an earlier render. */
  const commitRef = useRef<(questionId: string, value: unknown, origin?: ClientOrigin, force?: boolean) => void>(() => {});
  const commit = useCallback(
    (questionId: string, value: unknown, origin: ClientOrigin = "DESIGNER", force = false) => {
      const base = meta[questionId]?.updatedAt ?? null;
      setAnswers((a) => ({ ...a, [questionId]: value }));
      setStatuses((s) => ({ ...s, [questionId]: "confirmed" }));
      setMeta((m) => ({ ...m, [questionId]: { ...(m[questionId] ?? { aiNote: "", aiValue: null }), origin, source: "", conflict: null } }));
      setSave({ state: "saving" });
      inflight.current++;
      start(async () => {
        // A failed save keeps the typed value on screen and offers Retry — nothing typed is lost.
        const again = () => commitRef.current(questionId, value, origin, force);
        let res: Awaited<ReturnType<typeof saveAnswer>>;
        try {
          res = await saveAnswer(pack.id, questionId, value, origin, { base, force });
        } catch {
          inflight.current--;
          setSave({ state: "error", error: navigator.onLine ? "Couldn't save — the connection dropped." : "You're offline — not saved yet.", retry: again });
          return;
        }
        inflight.current--;
        if (!res.ok) {
          if ("stale" in res) {
            setSave({
              state: "stale",
              error: `${res.stale.by} changed this`,
              stale: { by: res.stale.by, reload: () => router.refresh(), keep: () => commitRef.current(questionId, value, origin, true) },
            });
            return;
          }
          setSave({ state: "error", error: res.error, retry: again });
          return;
        }
        setMeta((m) => ({ ...m, [questionId]: { ...(m[questionId] ?? { aiNote: "", aiValue: null }), updatedAt: res.updatedAt } }));
        setVersion((v) => v + 1);
        if (inflight.current === 0) setSave({ state: "saved", at: res.updatedAt });
        // An edit after review / sign-off sends the pack back to draft: show that straight away.
        if (pack.status === "IN_REVIEW" || pack.status === "APPROVED") router.refresh();
      });
    },
    [meta, pack.id, pack.status, router],
  );
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  /** Bulk confirm (review groups, "All visible", Enter on a row): one server call. */
  const confirmMany = (ids: string[]) => {
    if (!ids.length) return;
    setStatuses((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, "confirmed" as const])) }));
    start(async () => {
      const res = await confirmAnswers(pack.id, ids);
      if (!res.ok) setSave({ state: "error", error: res.error });
      else {
        setSave({ state: "saved", at: new Date().toISOString() });
        setVersion((v) => v + 1);
      }
    });
  };
  // Review (compact, keyboard-first) or All questions (the full sections); remembered per browser.
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "all" as const);
  const setMode = (m: "review" | "all") => {
    try {
      localStorage.setItem("packMode", m);
    } catch {}
    window.dispatchEvent(new Event("packmode"));
  };

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

  const settleConflict = (questionId: string, choice: "keep" | "switch") => {
    const c = meta[questionId]?.conflict;
    setMeta((m) => ({ ...m, [questionId]: { ...m[questionId], conflict: null, ...(choice === "switch" && c ? { origin: c.origin as Origin, source: c.source } : {}) } }));
    if (choice === "switch" && c) {
      setAnswers((a) => ({ ...a, [questionId]: c.value }));
      setStatuses((s) => ({ ...s, [questionId]: "confirmed" }));
    }
    start(async () => {
      const res = await resolveConflict(pack.id, questionId, choice);
      if (!res.ok) setSave({ state: "error", error: res.error });
      else {
        setSave({ state: "saved", at: new Date().toISOString() });
        setVersion((v) => v + 1);
      }
    });
  };

  const jump = (questionId: string, row?: number) => {
    const el = (row !== undefined ? document.querySelector<HTMLElement>(`[data-testid="${questionId}-row-${row}"]`) : null) ?? document.getElementById(`q-${questionId}`);
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


  const [cropOpen, setCropOpen] = useState(false);
  // Unconfirmed answers read from uploads, grouped by upload, for "Confirm all from …".
  const pendingBySource = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [qid, st] of Object.entries(statuses)) {
      const src = meta[qid]?.source;
      if (src && st !== "confirmed") m.set(src, [...(m.get(src) ?? []), qid]);
    }
    return [...m.entries()];
  }, [statuses, meta]);
  const confirmAllFrom = (source: string, ids: string[]) => {
    setStatuses((s) => ({ ...s, ...Object.fromEntries(ids.map((id) => [id, "confirmed" as const])) }));
    start(async () => {
      const res = await confirmFromSource(pack.id, source);
      if (!res.ok) setSave({ state: "error", error: res.error });
      else setSave({ state: "saved", at: new Date().toISOString() });
      router.refresh();
    });
  };
  const [sourceFocus, setSourceFocus] = useState<"spec_sheet" | null>(null);
  const needed = useMemo(
    () =>
      neededFromYou({
        category: pack.category,
        answers,
        statuses,
        colorways,
        hardwareDims: Object.fromEntries(props.library.hardware.filter((h) => h.dims).map((h) => [h.id, h.dims])),
      }),
    [pack.category, answers, statuses, colorways, props.library.hardware],
  );
  // The board's own notes are read in the background right after upload ("REFER TO SPEC" …).
  const boardJob = useJob(pack.id, (j) => j.kind === "BOARD", () => router.refresh());
  const board = render?.marks?.board;
  const specAsked = !!board?.refersToSpec && !props.files.some((f) => f.kind === "spec_sheet");
  const goToSources = () => {
    setSourceFocus("spec_sheet");
    document.getElementById("sec-sources")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Pre-fill runs as a background job; the page polls it, so a dropped connection loses nothing.
  const prefillJob = useJob(
    pack.id,
    (j) => j.kind === "PREFILL",
    (j) => {
      if (j.status === "ERROR") setPrefill({ running: false, error: j.error ?? "AI pre-fill didn't work this time. Try again." });
      else {
        const r = (j.result ?? {}) as { filled?: number; skippedConfirmed?: number; fixture?: boolean };
        const filled = r.filled ?? 0;
        setPrefill({
          running: false,
          message: `${filled} answer${filled === 1 ? "" : "s"} pre-filled${r.skippedConfirmed ? ` · ${r.skippedConfirmed} confirmed answer(s) left untouched` : ""}${r.fixture ? " · fixture mode" : ""}. Confirm or change each one.`,
        });
        router.refresh();
      }
    },
  );
  const doPrefill = async () => {
    setPrefill({ running: true });
    await prefillJob.start({ kind: "prefill" });
    setPrefill((p) => (p.running ? { running: false } : p)); // could not start (startError says why)
  };
  const prefillRunning = prefill.running || prefillJob.running;

  return (
    <LibraryProvider initial={props.library} brandId={brand.id}>
      {/* ------------------------------ Masthead ------------------------------ */}
      <section className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-12 pb-12 border-b border-hairline fade-up">
        <div className="relative bg-white border border-hairline aspect-[4/3] flex items-center justify-center overflow-hidden">
          {render ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={render.marks?.crop ? `/api/packs/${pack.id}/files/${render.id}?c=${Object.values(render.marks.crop).join("_")}` : render.url}
              alt={`${pack.styleNo} render`}
              className="w-full h-full object-contain"
              data-testid="render-image"
              data-cropped={render.marks?.crop ? "1" : "0"}
            />
          ) : null}
          {render && canEdit ? (
            <PhotoMarks
              packId={pack.id}
              mode="logo"
              file={render}
              materials={((answers["materials.list"] as { callout: number; name: string; locations?: string[] }[] | undefined) ?? []).filter((m) => m?.name && !NOT_A_MATERIAL.test(m.name.toUpperCase()))}
              trigger={(open) => (
                <button type="button" onClick={open} className="absolute top-4 left-4 inline-flex h-8 px-4 items-center bg-ivory/90 border border-hairline-strong text-[10px] tracking-[0.18em] uppercase hover:border-ink" data-testid="mark-logo">
                  {render.marks?.dot ? "Logo marked ●" : "Mark logo"} · callouts
                </button>
              )}
            />
          ) : null}
          {render && canEdit ? (
            <>
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                className="absolute top-4 left-40 inline-flex h-8 px-4 items-center bg-ivory/90 border border-hairline-strong text-[10px] tracking-[0.18em] uppercase hover:border-ink"
                data-testid="crop-render"
              >
                {render.marks?.crop ? "Cropped ●" : "Crop"}
              </button>
              <CropEditor key={`${render.id}-${cropOpen}`} packId={pack.id} file={render} open={cropOpen} onClose={() => setCropOpen(false)} />
            </>
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
                    // Crop step: check the auto-detected product box before anything reads the render.
                    setCropOpen(true);
                    boardJob.resume(); // the server is reading the board's notes ("REFER TO SPEC" …)
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
              {canEdit && (
                <SetupEditor
                  pack={{ id: pack.id, styleNo: pack.styleNo, styleName: pack.styleName, category: pack.category, brandId: brand.id, colorways }}
                  brands={props.brands}
                  names={(answers["colorways.names"] as Record<string, string> | undefined) ?? {}}
                />
              )}
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
              <dt className="eyebrow mb-1">Stage</dt>
              <dd className="inline-flex border border-hairline-strong" role="radiogroup" aria-label="Stage" data-testid="stage">
                {(["PROTO", "PRODUCTION"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={stage === st}
                    disabled={!canEdit}
                    data-testid={`stage-${st}`}
                    title={st === "PROTO" ? "Lean, reference-driven: only what a proto needs blocks export" : "Every ★ answer, licensor fields and resolved references"}
                    onClick={() => {
                      if (stage === st) return;
                      setStage(st);
                      start(async () => {
                        const res = await updatePackSetup(pack.id, { stage: st });
                        if (!res.ok) setSave({ state: "error", error: res.error });
                        setVersion((v) => v + 1);
                      });
                    }}
                    className={cx("h-7 px-3 text-[10px] tracking-[0.16em] uppercase", stage === st ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink")}
                  >
                    {st === "PROTO" ? "Proto" : "Production"}
                  </button>
                ))}
              </dd>
            </div>
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
                        // Removing goes through the server so the colourway's data goes with it.
                        const last = colorways[colorways.length - 1];
                        setColorways(colorways.slice(0, -1));
                        start(async () => {
                          await updatePackSetup(pack.id, { removeColorway: last });
                          router.refresh();
                        });
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
                  <Button variant="gold" onClick={doPrefill} disabled={!render || prefillRunning} data-testid="run-prefill">
                    {prefillRunning ? <span className="shimmer px-2">{prefillJob.job?.step ? `${prefillJob.job.step}…` : "Reading render…"}</span> : pack.aiAnalysis ? "Re-read render" : "Pre-fill from render"}
                  </Button>
                )}
              </div>
              {prefill.message && <p className="mt-4 text-[12px] text-ok" role="status">{prefill.message}</p>}
              {prefillRunning && <p className="mt-4 text-[12px] text-taupe" data-testid="prefill-progress">Working in the background — you can keep going or leave this page; the answers appear when it&apos;s done.</p>}
              {(prefill.error || prefillJob.startError) && (
                <p className="mt-4 text-[12px] text-signal" role="alert">
                  {prefill.error || prefillJob.startError}
                </p>
              )}
              {specAsked && (
                <div className="mt-5 border border-signal bg-signal-soft/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3" role="alert" data-testid="spec-prompt">
                  <p className="text-[12px] leading-relaxed">
                    The render says <b>{board!.reference || "REFER TO SPEC"}</b>. Upload that spec sheet now — its measurements fill the pack instead of estimates.
                  </p>
                  {canEdit && (
                    <Button variant="gold" onClick={goToSources} data-testid="spec-prompt-upload">
                      Upload the spec sheet
                    </Button>
                  )}
                </div>
              )}
              {pack.aiAnalysis && needed.items.length > 0 && <NeededList needed={needed} onJump={jump} />}
              {canEdit && pendingBySource.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-3" data-testid="confirm-sources">
                  <span className="text-[11px] text-taupe">Read from uploads, still to confirm:</span>
                  {pendingBySource.map(([src, ids]) => (
                    <Button key={src} size="sm" variant="ghost" onClick={() => confirmAllFrom(src, ids)} data-testid={`confirm-all-${src.toLowerCase().replace(/\W+/g, "-")}`}>
                      Confirm all {ids.length} from {src.toLowerCase()}
                    </Button>
                  ))}
                </div>
              )}
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

      {/* ------------------------------ Sources the AI reads ------------------------------ */}
      {(canEdit || props.files.some((f) => ["spec_sheet", "view_photo", "scale_photo", "swatch_photo", "hardware_sheet"].includes(f.kind))) && (
        <section id="sec-sources" className="scroll-mt-28 pt-10 pb-2 border-b border-hairline">
          <SourcesPanel
            packId={pack.id}
            files={props.files}
            canEdit={canEdit}
            materials={((answers["materials.list"] as MaterialEntry[] | undefined) ?? []).map((m) => ({ callout: m.callout, name: m.name }))}
            colorways={colorways}
            highlight={sourceFocus}
          />
        </section>
      )}

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

        <div className="min-w-0">
          <div className="relative z-10 flex items-center gap-1 mb-12" role="tablist" aria-label="View">
            {(
              [
                ["review", "Review"],
                ["all", "All questions"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                data-testid={`mode-${m}`}
                onClick={() => setMode(m)}
                className={cx("h-8 px-4 text-[10px] tracking-[0.2em] uppercase border", mode === m ? "bg-ink text-ivory border-ink" : "border-hairline-strong text-ink-soft hover:border-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-16">
          {mode === "review" && (
            <ReviewScreen
              questions={visibleQuestions(ctx)}
              answers={answers}
              statuses={statuses}
              meta={meta}
              renderUrl={null}
              ctx={ctx}
              colorways={colorways}
              unitLabel={unitLabel}
              canEdit={canEdit}
              onCommit={(qid, v) => commit(qid, v)}
              onConfirm={confirmMany}
              onConflict={settleConflict}
              display={displayAi}
            />
          )}
          {mode === "all" && sections.map((s, si) => {
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
                      onConflict={(c) => settleConflict(q.id, c)}
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
            <FilesPanel packId={pack.id} files={props.files} colorways={colorways} canEdit={canEdit} comments={((answers["comments.list"] as { text?: string }[] | undefined) ?? []).map((c) => c.text ?? "")} />
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
                                onConflict={(c) => settleConflict(q.id, c)}
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

function subscribeMode(cb: () => void) {
  window.addEventListener("packmode", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("packmode", cb);
    window.removeEventListener("storage", cb);
  };
}
function readMode(): "review" | "all" {
  try {
    return localStorage.getItem("packMode") === "review" ? "review" : "all";
  } catch {
    return "all";
  }
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
  if (s.state === "stale" && s.stale)
    return (
      <span className="text-[11px] text-signal flex items-center gap-2" role="alert" data-testid="save-stale">
        {s.stale.by} changed this —
        <button type="button" className="underline" onClick={s.stale.reload}>reload</button>/
        <button type="button" className="underline" onClick={s.stale.keep} data-testid="save-keep-mine">keep mine</button>
      </span>
    );
  if (s.state === "error")
    return (
      <span className="text-[11px] text-signal flex items-center gap-2" role="alert">
        {s.error}
        {s.retry && (
          <button type="button" className="underline" onClick={s.retry} data-testid="save-retry">
            Retry
          </button>
        )}
      </span>
    );
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
  onConflict,
  ctx,
  colorways,
  unitLabel,
  extra,
}: {
  q: Question;
  value: unknown;
  status?: AnswerStatus;
  meta?: RowMeta;
  flash: boolean;
  canEdit: boolean;
  onChange: (v: unknown) => void;
  onConfirm: () => void;
  onConflict: (choice: "keep" | "switch") => void;
  ctx: EvalContext;
  colorways: string[];
  unitLabel: (u: string) => string;
  extra?: React.ReactNode;
}) {
  const badge = status && status !== "confirmed" ? sourceBadge(status, meta?.source) : null;
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
        {!badge && status === "confirmed" && settledTag(meta) && (
          <div className="mt-2 text-[10px] tracking-[0.14em] uppercase text-taupe" data-testid={`source-${q.id}`} title={meta?.aiNote || undefined}>
            {settledTag(meta)}
          </div>
        )}
        {meta?.conflict && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border border-signal/60 bg-signal/5 px-2.5 py-1.5" data-testid={`conflict-${q.id}`} role="alert">
            <span className="text-[10.5px] tracking-[0.06em] text-signal">
              {conflictWho(meta.conflict)} reads {displayAi(meta.conflict.value)}
            </span>
            {canEdit && (
              <>
                <button type="button" onClick={() => onConflict("switch")} data-testid={`conflict-switch-${q.id}`} className="h-[22px] px-2 border border-signal text-signal text-[9.5px] tracking-[0.16em] uppercase hover:bg-signal hover:text-ivory">
                  Switch
                </button>
                <button type="button" onClick={() => onConflict("keep")} data-testid={`conflict-keep-${q.id}`} className="h-[22px] px-2 border border-hairline-strong text-[9.5px] tracking-[0.16em] uppercase hover:border-ink">
                  Keep
                </button>
              </>
            )}
          </div>
        )}
        {overridden && <div className="text-[10.5px] text-taupe mt-2 italic">AI suggested {displayAi(meta!.aiValue)}</div>}
        {extra && <div className="mt-2">{extra}</div>}
        {q.kind !== "derived" && <ReferenceControl qid={q.id} value={value} onChange={onChange} disabled={!canEdit} />}
      </div>
      <div className="min-w-0">
        {isReference(value) ? (
          <div className="text-[12px] italic text-taupe pt-2">Answered by reference — clear it to enter a value.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

/** "From spec sheet", "Base style PINK013", "House", "Derived" … for settled answers that a person didn't type. */
function settledTag(meta?: RowMeta): string {
  if (!meta) return "";
  if (meta.origin === "BASE_STYLE") return `Base style${meta.source ? ` ${meta.source}` : ""}`;
  if (meta.source && meta.origin !== "DESIGNER") return `From ${meta.source.toLowerCase()}`;
  if (meta.origin && meta.origin !== "DESIGNER" && meta.origin !== "AI") return ORIGIN_LABEL[meta.origin];
  return "";
}

function conflictWho(c: { origin: string; source: string }) {
  if (c.source) return c.source;
  return c.origin === "AI" ? "The render" : (ORIGIN_LABEL[c.origin as Origin] ?? c.origin);
}

function displayAi(v: unknown): string {
  if (isReference(v)) return `↪ ${refText(v)}`;
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

function QuestionHelpers({ qid, category, answers, colorways, onCommit }: { qid: string; category: Category; answers: AnswerMap; colorways: string[]; onCommit: (qid: string, v: unknown, origin?: ClientOrigin) => void }) {
  const helper = (label: string, onClick: () => void, testId?: string) => (
    <button key={label} type="button" data-testid={testId} className="block text-[10px] tracking-[0.2em] uppercase text-gold hover:text-ink mt-1" onClick={onClick}>
      ✦ {label}
    </button>
  );
  if (qid === "header.description") return helper("Redraft from answers", () => onCommit(qid, draftDescription(category, answers), "DERIVED"));
  if (qid === "pom.list") {
    const rows = (answers["pom.list"] as PomRow[] | undefined) ?? [];
    return (
      <>
        {helper(`Load ${templateKey(category, answers).toLowerCase()} template`, () => onCommit(qid, pomFromTemplate(category, answers, rows), "DERIVED"), "pom-template")}
        {rows.some((r) => r.tol == null) && helper("Apply standard tolerances to blanks", () => onCommit(qid, applyStandardTolerances(rows, answers["dims.unit"] === "INCHES")), "pom-tolerances")}
      </>
    );
  }
  if (qid === "opt.labels.types") return <ContentLabelPreview answers={answers} colorways={colorways} />;
  if (qid === "bom.list") return helper("Build from answers", () => onCommit(qid, bomFromAnswers(answers, (answers["bom.list"] as BomRow[] | undefined) ?? []), "DERIVED"), "bom-build");
  return null;
}

/** "Needed from you": what the render can't give, one line each, jumping to the field (and row). */
function NeededList({ needed, onJump }: { needed: { items: NeededItem[]; counts: Record<NeededItem["group"], number> }; onJump: (q: string, row?: number) => void }) {
  const groups: { key: NeededItem["group"]; title: string }[] = [
    { key: "measurement", title: "Measurements" },
    { key: "material", title: "Materials" },
    { key: "hardware", title: "Hardware" },
  ];
  return (
    <div className="mt-6 pt-6 border-t border-hairline" data-testid="needed">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="eyebrow text-ink">Needed from you</div>
        <div className="text-[11px] text-taupe" data-testid="needed-counts">
          {needed.counts.measurement} measurement{needed.counts.measurement === 1 ? "" : "s"} · {needed.counts.material} material{needed.counts.material === 1 ? "" : "s"} · {needed.counts.hardware} hardware still needed
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-5 mt-3">
        {groups
          .filter((g) => needed.counts[g.key])
          .map((g) => (
            <div key={g.key}>
              <div className="text-[10px] tracking-[0.18em] uppercase text-taupe mb-1.5">
                {g.title} · {needed.counts[g.key]}
              </div>
              <ul className="space-y-1">
                {needed.items
                  .filter((i) => i.group === g.key)
                  .map((i, k) => (
                    <li key={k}>
                      <button type="button" onClick={() => onJump(i.questionId, i.row)} className="text-left text-[11.5px] leading-snug hover:text-signal underline decoration-hairline-strong underline-offset-2" data-testid="needed-item">
                        {i.label}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}
