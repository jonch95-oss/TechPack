/**
 * Dashboard at volume (V2 §8): the filters a URL carries, parsed and normalised. Pure.
 */
import { CATEGORIES } from "@/lib/questions/types";
import { studioDay } from "@/lib/dates";

export const PAGE_SIZE = 24;
export const PIPELINE = ["DRAFT", "IN_REVIEW", "APPROVED", "SENT", "PROTO_RECEIVED", "CLOSED"] as const;

export type DashFilters = {
  q: string;
  status: string;
  brand: string;
  category: string;
  stage: "" | "PROTO" | "PRODUCTION";
  due: "" | "asap" | "overdue" | "week";
  designer: string;
  mine: boolean;
  archived: boolean;
  view: "grid" | "pipeline";
  sort: "recent" | "due";
  page: number;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseFilters(sp: Record<string, string | string[] | undefined>): DashFilters {
  const stage = str(sp.stage).toUpperCase();
  const due = str(sp.due).toLowerCase();
  const page = Number(str(sp.page)) || 1;
  return {
    q: str(sp.q).toUpperCase(),
    status: (PIPELINE as readonly string[]).includes(str(sp.status)) ? str(sp.status) : "",
    brand: /^[0-9a-f-]{36}$/i.test(str(sp.brand)) ? str(sp.brand) : "",
    category: (CATEGORIES as readonly string[]).includes(str(sp.category)) ? str(sp.category) : "",
    stage: stage === "PROTO" || stage === "PRODUCTION" ? stage : "",
    due: due === "asap" || due === "overdue" || due === "week" ? due : "",
    designer: /^[0-9a-f-]{36}$/i.test(str(sp.designer)) ? str(sp.designer) : "",
    mine: str(sp.mine) === "1",
    archived: str(sp.archived) === "1",
    view: str(sp.view) === "pipeline" ? "pipeline" : "grid",
    sort: str(sp.sort) === "due" ? "due" : "recent",
    page: Math.max(1, Math.min(page, 10_000)),
  };
}

/** The URL for these filters with some changed (empty values dropped; page resets unless given). */
export function filterHref(f: DashFilters, change: Partial<DashFilters>): string {
  const n = { ...f, page: 1, ...change };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.status) p.set("status", n.status);
  if (n.brand) p.set("brand", n.brand);
  if (n.category) p.set("category", n.category);
  if (n.stage) p.set("stage", n.stage);
  if (n.due) p.set("due", n.due);
  if (n.designer) p.set("designer", n.designer);
  if (n.mine) p.set("mine", "1");
  if (n.archived) p.set("archived", "1");
  if (n.view === "pipeline") p.set("view", "pipeline");
  if (n.sort === "due") p.set("sort", "due");
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

/** ISO dates for the due filters, from today. */
export function dueWindow(today: Date) {
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  return { today: studioDay(today), week: studioDay(week) };
}
