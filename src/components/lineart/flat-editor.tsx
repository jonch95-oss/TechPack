"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { autoAnnotate, approveFlat, retrace, saveFlat } from "@/app/actions/flats";
import { EDITABLE_LAYERS, LAYERS, annotSize, calloutSvg, dimSvg, fmtLen, type Box, type CalloutSpec, type DimSpec, type LayerName, type Unit } from "@/lib/lineart/geometry";
import { Badge, Button, cx } from "@/components/ui";

/**
 * In-browser flat editor (BRIEF 1.7 "Edit"), built on Paper.js:
 * select / move · node editing · line · curve · dashed stitch line · delete · mirror ·
 * re-trace region · undo / redo · layers (outline / stitching / hardware / callouts / dimensions).
 * Dimension lines and callouts are data-driven: moving one re-draws it, and a dimension's label is
 * always its drawn length ÷ the flat's scale, so it reads true.
 */

export type FlatData = { id: string; view: string; status: string; source: string; svg: string; updatedAt: string };

type Tool = "select" | "nodes" | "line" | "curve" | "stitch" | "retrace";
type Dim = { key: string; label: string; text: string };

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "Click to select, drag to move. Delete removes it." },
  { id: "nodes", label: "Nodes", hint: "Drag a node or handle. Drag the ends of a dimension line; drag a callout's dot to re-aim it." },
  { id: "line", label: "Line", hint: "Click to add points; double-click or Enter to finish." },
  { id: "curve", label: "Curve", hint: "Drag to draw; the curve is smoothed when you let go." },
  { id: "stitch", label: "Stitch", hint: "Dashed stitch line — click points, double-click or Enter to finish." },
  { id: "retrace", label: "Re-trace", hint: "Drag a box over the source image area to trace again." },
];

const LAYER_LABEL: Record<LayerName, string> = { fill: "Fill", outline: "Outline", stitching: "Stitching", hardware: "Hardware", callouts: "Callouts", dimensions: "Dimensions" };

const parse = (fragment: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${fragment}</svg>`, "image/svg+xml").documentElement;

export function FlatEditor({ flat, canEdit, onChange }: { flat: FlatData; canEdit: boolean; onChange?: (f: FlatData) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scopeRef = useRef<paper.PaperScope | null>(null);
  const metaRef = useRef({ w: 0, h: 0, view: "FRONT", unit: "cm" as Unit, pxPerUnit: null as number | null });
  const history = useRef<{ stack: string[]; at: number }>({ stack: [], at: -1 });
  const selected = useRef<paper.Item | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolRef = useRef<Tool>("select");

  const [tool, setToolState] = useState<Tool>("select");
  const [ready, setReady] = useState(false);
  const [layerState, setLayerState] = useState<Record<string, { visible: boolean; locked: boolean; count: number }>>({});
  const [active, setActive] = useState<LayerName>("outline");
  const activeRef = useRef<LayerName>("outline");
  const [dims, setDims] = useState<Dim[]>([]);
  const [sel, setSel] = useState<{ kind: string; label: string } | null>(null);
  const [save, setSave] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [msg, setMsg] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(160);
  const thresholdRef = useRef(160);
  const fitRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState(flat.status);
  const [undoState, setUndoState] = useState({ undo: false, redo: false });

  const setTool = (t: Tool) => {
    toolRef.current = t;
    setToolState(t);
  };

  /* ------------------------------ model helpers ------------------------------ */
  const layer = (name: LayerName) => scopeRef.current?.project.layers.find((l) => l.name === name) as paper.Layer | undefined;
  const size = () => annotSize(metaRef.current.w, metaRef.current.h);

  const refreshPanels = useCallback(() => {
    const s = scopeRef.current;
    if (!s) return;
    const st: Record<string, { visible: boolean; locked: boolean; count: number }> = {};
    for (const l of s.project.layers) st[l.name] = { visible: l.visible, locked: l.locked, count: l.children.length };
    setLayerState(st);
    const m = metaRef.current;
    const ds: Dim[] = [];
    for (const it of layer("dimensions")?.children ?? []) {
      const d = it.data as Partial<DimSpec> & { kind?: string; label?: string };
      if (d.kind !== "dim" || !m.pxPerUnit) continue;
      const len = Math.hypot(d.x2! - d.x1!, d.y2! - d.y1!) / m.pxPerUnit;
      ds.push({ key: String(d.key), label: d.label || (d.key === "W" ? (m.view === "SIDE" ? "DEPTH" : "WIDTH") : d.key === "H" ? "HEIGHT" : String(d.key)), text: fmtLen(len, m.unit) });
    }
    setDims(ds);
    setUndoState({ undo: history.current.at > 0, redo: history.current.at < history.current.stack.length - 1 });
  }, []);

  /** Imports one fragment (a `<g>` with data) as a paper item. */
  const importFragment = (fragment: string) => {
    const el = parse(fragment).firstElementChild as SVGElement | null;
    if (!el) return null;
    return scopeRef.current!.project.importSVG(el, { insert: false }) as paper.Item;
  };

  /** Re-draws a dimension or callout from its data (keeps it canonical). */
  const rebuild = (item: paper.Item) => {
    const d = item.data as { kind?: string };
    const m = metaRef.current;
    let frag = "";
    if (d.kind === "dim" && m.pxPerUnit) frag = dimSvg(item.data as DimSpec, m.pxPerUnit, m.unit, size());
    else if (d.kind === "material" || d.kind === "comment" || d.kind === "logo") frag = calloutSvg(item.data as CalloutSpec, size());
    if (!frag) return item;
    const fresh = importFragment(frag);
    if (!fresh) return item;
    fresh.data = { ...item.data };
    item.replaceWith(fresh);
    return fresh;
  };

  /* ------------------------------ load / export ------------------------------ */
  const load = useCallback((svg: string) => {
    const s = scopeRef.current!;
    s.activate();
    s.project.clear();
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    const vb = (doc.getAttribute("viewBox") ?? "0 0 1000 700").split(/\s+/).map(Number);
    metaRef.current.w = vb[2];
    metaRef.current.h = vb[3];
    metaRef.current.view = doc.getAttribute("data-view") ?? "FRONT";
    for (const name of LAYERS) {
      const g = Array.from(doc.children).find((c) => c.getAttribute("id") === name) as SVGElement | undefined;
      const l = new s.Layer({ name });
      if (!g) continue;
      const imported = s.project.importSVG(g, { insert: false }) as paper.Group;
      l.data = imported.data ?? {};
      for (const c of imported.removeChildren()) {
        // Group styles (fill on the layer's <g>) are applied by Paper to children on import.
        l.addChild(c);
      }
      if (name === "fill") l.locked = true;
    }
    const dm = layer("dimensions")?.data as { pxPerUnit?: number; unit?: string } | undefined;
    metaRef.current.pxPerUnit = typeof dm?.pxPerUnit === "number" ? dm.pxPerUnit : null;
    metaRef.current.unit = dm?.unit === "in" ? "in" : "cm";
    selected.current = null;
    setSel(null);
    refreshPanels();
  }, [refreshPanels]);

  const exportSvg = useCallback(() => {
    const s = scopeRef.current!;
    const m = metaRef.current;
    const ser = new XMLSerializer();
    const outline = layer("outline");
    const b = outline && outline.children.length ? outline.bounds : null;
    const parts = LAYERS.map((name) => {
      const l = layer(name);
      if (!l) return `<g id="${name}"></g>`;
      const attrs =
        name === "outline"
          ? ` fill="#111111" fill-rule="evenodd" stroke="none" data-paper-data='${JSON.stringify({ bbox: b ? { x: r(b.x), y: r(b.y), w: r(b.width), h: r(b.height) } : null })}'`
          : name === "dimensions"
            ? ` data-paper-data='${JSON.stringify({ pxPerUnit: m.pxPerUnit, unit: m.unit, view: m.view })}'`
            : name === "fill"
              ? ` fill="#ffffff" stroke="none"`
              : name === "stitching"
                ? ` fill="#111111" stroke="none"`
                : name === "hardware"
                  ? ` fill="none" stroke="#111111"`
                  : "";
      // Dimensions and callouts are written from their data so their text stays exact.
      const inner =
        name === "dimensions" || name === "callouts"
          ? l.children
              .map((c) => {
                const d = c.data as { kind?: string };
                if (d.kind === "dim" && m.pxPerUnit) return dimSvg(c.data as DimSpec, m.pxPerUnit, m.unit, size());
                if (d.kind === "material" || d.kind === "comment" || d.kind === "logo") return calloutSvg(c.data as CalloutSpec, size());
                return ser.serializeToString(c.exportSVG({ asString: false }) as SVGElement);
              })
              .join("")
          : l.children.map((c) => ser.serializeToString(c.exportSVG({ asString: false }) as SVGElement)).join("");
      return `<g id="${name}"${attrs}${l.visible ? "" : ` data-hidden="1"`}>${inner}</g>`;
    });
    void s;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.w} ${m.h}" width="${m.w}" height="${m.h}" data-view="${m.view}">${parts.join("")}</svg>`;
  }, []);

  const persist = useCallback(() => {
    if (!canEdit) return;
    setSave("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSave("saving");
      const svg = exportSvg();
      const res = await saveFlat(flat.id, svg);
      setSave(res.ok ? "saved" : "error");
      if (res.ok) onChange?.({ ...flat, svg, status, updatedAt: res.updatedAt });
      else setMsg(res.error);
    }, 900);
  }, [canEdit, exportSvg, flat, onChange, status]);

  /** Records a change: history snapshot, panels, autosave. */
  const commit = useCallback(() => {
    const h = history.current;
    const svg = exportSvg();
    h.stack = [...h.stack.slice(0, h.at + 1), svg].slice(-60);
    h.at = h.stack.length - 1;
    refreshPanels();
    persist();
  }, [exportSvg, persist, refreshPanels]);

  const undo = useCallback(() => {
    const h = history.current;
    if (h.at <= 0) return;
    h.at--;
    load(h.stack[h.at]);
    persist();
  }, [load, persist]);
  const redo = useCallback(() => {
    const h = history.current;
    if (h.at >= h.stack.length - 1) return;
    h.at++;
    load(h.stack[h.at]);
    persist();
  }, [load, persist]);

  /* ------------------------------ selection ------------------------------ */
  const topLevel = (item: paper.Item | null) => {
    let it = item;
    while (it && it.parent && !(it.parent instanceof (scopeRef.current as paper.PaperScope).Layer)) it = it.parent;
    return it;
  };
  const select = (item: paper.Item | null, nodes = false) => {
    if (selected.current) {
      selected.current.selected = false;
      (selected.current as paper.Path).fullySelected = false;
    }
    selected.current = item;
    if (item) {
      if (nodes && (item.data as { kind?: string }).kind == null) (item as paper.Path).fullySelected = true;
      else item.selected = true;
      const d = item.data as { kind?: string; label?: string; key?: string };
      setSel({ kind: d.kind ?? (item.layer?.name ?? "path"), label: d.label ?? d.key ?? "" });
    } else setSel(null);
  };

  const removeSelected = useCallback(() => {
    if (!selected.current || selected.current.layer?.locked) return;
    selected.current.remove();
    selected.current = null;
    setSel(null);
    commit();
  }, [commit]);

  const mirrorSelected = () => {
    const it = selected.current;
    const outline = layer("outline");
    if (!it || !outline) return;
    const axis = outline.bounds.center.x;
    const copy = it.clone();
    copy.scale(-1, 1, new (scopeRef.current as paper.PaperScope).Point(axis, it.bounds.center.y));
    if ((copy.data as { kind?: string }).kind === "dim") {
      const d = copy.data as DimSpec;
      copy.data = { ...d, x1: 2 * axis - d.x1, x2: 2 * axis - d.x2, offset: -d.offset };
      rebuild(copy);
    }
    select(copy);
    commit();
  };

  /* ------------------------------ setup ------------------------------ */
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const mod = (await import("paper")).default;
      if (disposed || !canvasRef.current) return;
      const scope = new mod.PaperScope();
      scope.setup(canvasRef.current);
      scopeRef.current = scope;
      const fit = () => {
        const wrap = wrapRef.current!;
        scope.view.viewSize = new scope.Size(wrap.clientWidth, wrap.clientHeight);
        const m = metaRef.current;
        scope.view.zoom = Math.min(wrap.clientWidth / m.w, wrap.clientHeight / m.h) * 0.96;
        scope.view.center = new scope.Point(m.w / 2, m.h / 2);
      };
      load(flat.svg);
      history.current = { stack: [exportSvg()], at: 0 };
      refreshPanels();
      fit();
      setReady(true);

      /* ---------- tools ---------- */
      const t = new scope.Tool();
      let drawing: paper.Path | null = null;
      let dragKind: "move" | "node" | "handle-in" | "handle-out" | "dim-1" | "dim-2" | "target" | "pan" | "box" | null = null;
      let seg: paper.Segment | null = null;
      let box: paper.Path | null = null;
      let boxFrom: paper.Point | null = null;
      let moved = false;
      let space = false;

      const strokeFor = (stitch: boolean): Partial<paper.Style> => ({
        strokeColor: new scope.Color("#111111"),
        strokeWidth: size() * (stitch ? 0.06 : 0.09),
        dashArray: stitch ? [size() * 0.35, size() * 0.25] : [],
        fillColor: null as unknown as paper.Color,
        strokeCap: "round",
        strokeJoin: "round",
      });
      const finishDrawing = () => {
        if (drawing) {
          // Double-clicks repeat the last point; drop consecutive duplicates.
          for (let i = drawing.segments.length - 1; i > 0; i--) if (drawing.segments[i].point.getDistance(drawing.segments[i - 1].point) < 0.5) drawing.segments[i].remove();
          if (drawing.segments.length < 2) drawing.remove();
          else commit();
        }
        drawing = null;
      };

      const hitItem = (point: paper.Point) => {
        const hit = scope.project.hitTest(point, {
          fill: true,
          stroke: true,
          segments: toolRef.current === "nodes",
          handles: toolRef.current === "nodes",
          tolerance: 8 / scope.view.zoom,
          match: (h: paper.HitResult) => !h.item.layer?.locked && h.item.layer?.visible !== false && h.item.layer?.name !== "fill",
        });
        return hit;
      };

      t.onMouseDown = (e: paper.ToolEvent) => {
        moved = false;
        const ne = e as unknown as { event: MouseEvent };
        if (space || ne.event.button === 1) {
          dragKind = "pan";
          return;
        }
        if (!canEdit) return;
        const tl = toolRef.current;
        if (tl === "line" || tl === "stitch") {
          const stitch = tl === "stitch";
          if (!drawing) {
            const target = layer(stitch ? "stitching" : activeRef.current === "fill" ? "outline" : activeRef.current)!;
            target.activate();
            drawing = new scope.Path({ segments: [e.point], ...strokeFor(stitch) });
            target.addChild(drawing);
          } else drawing.add(e.point);
          if (ne.event.detail >= 2) finishDrawing();
          return;
        }
        if (tl === "curve") {
          const target = layer(activeRef.current === "fill" ? "outline" : activeRef.current)!;
          drawing = new scope.Path({ segments: [e.point], ...strokeFor(false) });
          target.addChild(drawing);
          return;
        }
        if (tl === "retrace") {
          boxFrom = e.point;
          box = new scope.Path.Rectangle({ from: e.point, to: e.point, strokeColor: new scope.Color("#e2231a"), dashArray: [6 / scope.view.zoom, 4 / scope.view.zoom], strokeWidth: 1.5 / scope.view.zoom });
          dragKind = "box";
          return;
        }
        const hit = hitItem(e.point);
        if (!hit) {
          select(null);
          dragKind = null;
          return;
        }
        const top = topLevel(hit.item);
        const data = (top?.data ?? {}) as { kind?: string; x1?: number; y1?: number; x2?: number; y2?: number; tx?: number; ty?: number; offset?: number };
        if (tl === "nodes" && data.kind === "dim") {
          select(top);
          const d1 = Math.hypot(e.point.x - data.x1!, e.point.y - data.y1!);
          const d2 = Math.hypot(e.point.x - data.x2!, e.point.y - data.y2!);
          dragKind = d1 < d2 ? "dim-1" : "dim-2";
          return;
        }
        if (tl === "nodes" && data.tx != null && data.ty != null && Math.hypot(e.point.x - data.tx, e.point.y - data.ty) < size()) {
          select(top);
          dragKind = "target";
          return;
        }
        if (tl === "nodes" && (hit.type === "segment" || hit.type === "handle-in" || hit.type === "handle-out") && hit.segment) {
          seg = hit.segment;
          select(top, true);
          dragKind = hit.type === "segment" ? "node" : (hit.type as "handle-in" | "handle-out");
          return;
        }
        select(top, tl === "nodes");
        dragKind = "move";
      };

      t.onMouseDrag = (e: paper.ToolEvent) => {
        moved = true;
        if (dragKind === "pan") {
          const ne = e as unknown as { event: MouseEvent };
          scope.view.center = scope.view.center.subtract(new scope.Point(ne.event.movementX, ne.event.movementY).divide(scope.view.zoom));
          return;
        }
        if (!canEdit) return;
        const tl = toolRef.current;
        if (tl === "curve" && drawing) {
          drawing.add(e.point);
          return;
        }
        if (dragKind === "box" && box && boxFrom) {
          box.remove();
          box = new scope.Path.Rectangle({ from: boxFrom, to: e.point, strokeColor: new scope.Color("#e2231a"), dashArray: [6 / scope.view.zoom, 4 / scope.view.zoom], strokeWidth: 1.5 / scope.view.zoom });
          return;
        }
        const it = selected.current;
        if (!it) return;
        const d = it.data as Record<string, number> & { kind?: string };
        if (dragKind === "move") {
          if (d.kind === "dim") {
            it.data = { ...d, x1: d.x1 + e.delta.x, y1: d.y1 + e.delta.y, x2: d.x2 + e.delta.x, y2: d.y2 + e.delta.y };
            it.position = it.position.add(e.delta);
          } else if (d.kind === "material" || d.kind === "comment" || d.kind === "logo") {
            it.data = { ...d, x: d.x + e.delta.x, y: d.y + e.delta.y };
            selected.current = rebuild(it);
            selected.current.selected = true;
          } else it.position = it.position.add(e.delta);
        } else if (dragKind === "dim-1" || dragKind === "dim-2") {
          const k = dragKind === "dim-1" ? "1" : "2";
          // Keep dimension lines straight: snap to horizontal / vertical when nearly so.
          const ox = dragKind === "dim-1" ? d.x2 : d.x1;
          const oy = dragKind === "dim-1" ? d.y2 : d.y1;
          let px = e.point.x,
            py = e.point.y;
          if (Math.abs(px - ox) < Math.abs(py - oy) * 0.15) px = ox;
          if (Math.abs(py - oy) < Math.abs(px - ox) * 0.15) py = oy;
          it.data = { ...d, [`x${k}`]: px, [`y${k}`]: py };
          selected.current = rebuild(it);
          selected.current.selected = true;
        } else if (dragKind === "target") {
          it.data = { ...d, tx: e.point.x, ty: e.point.y };
          selected.current = rebuild(it);
          selected.current.selected = true;
        } else if (dragKind === "node" && seg) seg.point = seg.point.add(e.delta);
        else if (dragKind === "handle-in" && seg) seg.handleIn = seg.handleIn.add(e.delta);
        else if (dragKind === "handle-out" && seg) seg.handleOut = seg.handleOut.add(e.delta);
        if (dragKind === "dim-1" || dragKind === "dim-2") refreshPanels();
      };

      t.onMouseUp = async () => {
        const tl = toolRef.current;
        if (tl === "curve" && drawing) {
          drawing.simplify(size() * 0.25);
          finishDrawing();
          return;
        }
        if (dragKind === "box" && box) {
          const b = box.bounds;
          box.remove();
          box = null;
          dragKind = null;
          if (b.width < 8 || b.height < 8) return;
          setMsg("Re-tracing…");
          const res = await retrace(flat.id, { x: b.x, y: b.y, w: b.width, h: b.height }, thresholdRef.current);
          if (!res.ok) return setMsg(res.error);
          for (const name of ["outline", "stitching"] as const) {
            const l = layer(name)!;
            for (const c of [...l.children]) if (c.bounds.intersects(b) && b.contains(c.bounds)) c.remove();
            for (const d of name === "outline" ? res.outline : res.stitching) {
              const p = new scope.CompoundPath(d);
              p.fillColor = new scope.Color("#111111");
              p.fillRule = "evenodd";
              l.addChild(p);
            }
          }
          setMsg(`Re-traced (${res.outline.length} shapes, ${res.stitching.length} stitches).`);
          commit();
          return;
        }
        if (moved && dragKind && dragKind !== "pan") commit();
        dragKind = null;
        seg = null;
      };

      t.onKeyDown = (e: paper.KeyEvent) => {
        const tag = (document.activeElement?.tagName ?? "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.key === "space") space = true;
        if (e.key === "enter" || e.key === "escape") finishDrawing();
        if ((e.key === "delete" || e.key === "backspace") && canEdit) removeSelected();
        if (e.key === "z" && (e.modifiers.control || e.modifiers.meta)) (e.modifiers.shift ? redo : undo)();
      };
      t.onKeyUp = (e: paper.KeyEvent) => {
        if (e.key === "space") space = false;
      };

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault();
        const rect = canvasRef.current!.getBoundingClientRect();
        const at = scope.view.viewToProject(new scope.Point(ev.clientX - rect.left, ev.clientY - rect.top));
        const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        const z = Math.min(20, Math.max(0.05, scope.view.zoom * factor));
        const k = scope.view.zoom / z;
        scope.view.zoom = z;
        scope.view.center = at.add(scope.view.center.subtract(at).multiply(k));
      };
      const canvas = canvasRef.current;
      canvas.addEventListener("wheel", onWheel, { passive: false });
      const ro = new ResizeObserver(() => fit());
      ro.observe(wrapRef.current!);
      fitRef.current = fit;
      cleanup = () => {
        canvas.removeEventListener("wheel", onWheel);
        ro.disconnect();
        scope.project.clear();
        t.remove();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // The editor is mounted per flat (keyed by id); later prop changes don't reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ------------------------------ actions ------------------------------ */
  const runAnnotate = async (what: { dimensions?: boolean; callouts?: boolean }) => {
    setMsg(null);
    const res = await autoAnnotate(flat.id, exportSvg(), what);
    if (!res.ok) return setMsg(res.error);
    load(res.svg);
    commit();
    setMsg(what.dimensions ? "Scaled to the entered dimensions; dimension lines re-drawn." : "Callouts re-placed.");
  };

  const addCallout = (kind: CalloutSpec["kind"], given?: string) => {
    const s = scopeRef.current;
    if (!s) return;
    const label = given ?? (kind === "material" ? String(nextNumber("material")) : kind === "comment" ? String.fromCharCode(64 + nextNumber("comment")) : "LABEL");
    const c = s.view.center;
    const it = importFragment(calloutSvg({ kind, label, x: c.x, y: c.y, tx: c.x + size() * 3, ty: c.y + size() * 2 }, size()));
    if (!it) return;
    it.data = { kind, label, tx: c.x + size() * 3, ty: c.y + size() * 2, x: c.x, y: c.y };
    layer("callouts")!.addChild(it);
    select(it);
    commit();
  };
  // Trims are labels T1, T2 … matching the trim columns (T1, T2 …) of the colour breakdown.
  const nextTrim = () => `T${(layer("callouts")?.children.filter((c) => /^T\d+$/.test(String((c.data as { label?: string }).label ?? ""))).length ?? 0) + 1}`;
  const nextNumber = (kind: string) => (layer("callouts")?.children.filter((c) => (c.data as { kind?: string }).kind === kind).length ?? 0) + 1;

  const relabel = (label: string) => {
    const it = selected.current;
    if (!it) return;
    it.data = { ...it.data, label: label.toUpperCase() };
    selected.current = rebuild(it);
    selected.current.selected = true;
    setSel((s) => (s ? { ...s, label: label.toUpperCase() } : s));
  };

  const toggleLayer = (name: LayerName, prop: "visible" | "locked") => {
    const l = layer(name);
    if (!l) return;
    l[prop] = !l[prop];
    refreshPanels();
  };

  const approve = async () => {
    const res = await approveFlat(flat.id);
    if (res.ok) {
      setStatus("CONFIRMED");
      onChange?.({ ...flat, status: "CONFIRMED" });
    } else setMsg(res.error);
  };

  const hint = TOOLS.find((t) => t.id === tool)?.hint;
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6" data-testid="flat-editor" data-ready={ready ? "1" : "0"}>
      <div className="min-w-0">
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3" role="toolbar" aria-label="Drawing tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTool(t.id)}
                title={t.hint}
                className={cx("h-8 px-3 border text-[10.5px] tracking-[0.14em] uppercase transition-colors", tool === t.id ? "bg-ink text-ivory border-ink" : "border-hairline-strong hover:border-ink")}
                data-testid={`tool-${t.id}`}
                aria-pressed={tool === t.id}
              >
                {t.label}
              </button>
            ))}
            <span className="w-px h-6 bg-hairline mx-1" />
            <ToolButton onClick={removeSelected} disabled={!sel} testId="tool-delete">Delete</ToolButton>
            <ToolButton onClick={mirrorSelected} disabled={!sel} testId="tool-mirror">Mirror</ToolButton>
            <ToolButton onClick={undo} disabled={!undoState.undo} testId="tool-undo">Undo</ToolButton>
            <ToolButton onClick={redo} disabled={!undoState.redo} testId="tool-redo">Redo</ToolButton>
            <ToolButton onClick={() => fitRef.current()} testId="tool-fit">Fit</ToolButton>
          </div>
        )}
        <div ref={wrapRef} className="relative h-[68vh] min-h-[480px] border border-hairline bg-white overflow-hidden">
          <canvas ref={canvasRef} className={cx("absolute inset-0 w-full h-full", tool === "select" ? "cursor-default" : "cursor-crosshair")} data-testid="flat-canvas" />
          {!ready && <div className="absolute inset-0 flex items-center justify-center text-taupe text-[12px]">Loading drawing…</div>}
          {status === "INFERRED" && <div className="absolute top-3 left-3 bg-signal text-ivory text-[10px] tracking-[0.16em] uppercase px-2 py-1" data-testid="inferred-tag">Inferred — confirm</div>}
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-taupe min-h-5">
          <span>{msg ?? hint}</span>
          <span data-testid="flat-save" className={cx(save === "error" && "text-signal")}>{save === "saving" ? "Saving…" : save === "dirty" ? "Unsaved" : save === "error" ? "Not saved" : "Saved"}</span>
        </div>
        {tool === "retrace" && canEdit && (
          <label className="flex items-center gap-3 mt-2 text-[11px] text-taupe">
            Line threshold
            <input type="range" min={60} max={230} value={threshold} onChange={(e) => {
                setThreshold(Number(e.target.value));
                thresholdRef.current = Number(e.target.value);
              }} aria-label="Re-trace threshold" />
            {threshold}
          </label>
        )}
      </div>

      <aside className="space-y-6">
        {status === "INFERRED" && canEdit && (
          <div className="border border-signal/50 p-4 space-y-3">
            <p className="text-[12px] leading-relaxed">This view is inferred — the render doesn&apos;t show it. Check it against the sample, then approve.</p>
            <Button size="sm" onClick={approve} data-testid="approve-flat">Approve view</Button>
          </div>
        )}
        <div>
          <div className="eyebrow mb-2">Dimensions</div>
          {dims.length ? (
            <ul className="space-y-1" data-testid="dim-readouts">
              {dims.map((d) => (
                <li key={d.key} className="flex justify-between text-[12px]">
                  <span className="text-taupe">{d.label}</span>
                  <span className="text-signal tabular-nums" data-testid={`dim-${d.key}`}>{d.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-taupe">Not scaled yet — enter H × W × D, then scale.</p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="secondary" onClick={() => runAnnotate({ dimensions: true, callouts: false })} data-testid="auto-dims">Scale &amp; dimension</Button>
              <Button size="sm" variant="ghost" onClick={() => runAnnotate({ dimensions: false, callouts: true })} data-testid="auto-callouts">Re-place callouts</Button>
            </div>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2">Layers</div>
          <ul className="border border-hairline divide-y divide-hairline" data-testid="layers">
            {EDITABLE_LAYERS.map((name) => {
              const st = layerState[name];
              return (
                <li key={name} className={cx("flex items-center gap-2 px-3 h-9 text-[12px]", active === name && "bg-paper")} data-testid={`layer-${name}`}>
                  <button type="button" onClick={() => toggleLayer(name, "visible")} aria-label={`${st?.visible === false ? "Show" : "Hide"} ${name}`} className={cx("w-5 text-center", st?.visible === false ? "text-mist" : "text-ink")}>
                    {st?.visible === false ? "○" : "●"}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      setActive(name);
                      activeRef.current = name;
                    }}
                  >
                    {LAYER_LABEL[name]}
                  </button>
                  <span className="text-[10px] text-taupe tabular-nums" data-testid={`layer-count-${name}`}>{st?.count ?? 0}</span>
                  <button type="button" onClick={() => toggleLayer(name, "locked")} aria-label={`${st?.locked ? "Unlock" : "Lock"} ${name}`} className={cx("text-[10px] tracking-[0.12em] uppercase w-12 text-right", st?.locked ? "text-signal" : "text-mist")}>
                    {st?.locked ? "Locked" : "Lock"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[10.5px] text-taupe mt-2">Line and curve draw on the highlighted layer; stitch lines always go on Stitching.</p>
        </div>

        {canEdit && (
          <div>
            <div className="eyebrow mb-2">Callouts</div>
            <div className="flex flex-wrap gap-2">
              <ToolButton onClick={() => addCallout("material")} testId="add-material-callout">+ Material</ToolButton>
              <ToolButton onClick={() => addCallout("comment")} testId="add-comment-callout">+ Comment</ToolButton>
              <ToolButton onClick={() => addCallout("logo", nextTrim())} testId="add-trim-callout">+ Trim</ToolButton>
              <ToolButton onClick={() => addCallout("logo")} testId="add-label-callout">+ Label</ToolButton>
            </div>
            {sel && (sel.kind === "material" || sel.kind === "comment" || sel.kind === "logo") && (
              <label className="block mt-3">
                <span className="eyebrow block mb-1">Selected callout</span>
                <input
                  defaultValue={sel.label}
                  key={sel.label}
                  onBlur={(e) => {
                    relabel(e.target.value);
                    commit();
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="w-full h-9 bg-transparent border-0 border-b border-hairline-strong text-[13px] uppercase focus:outline-none focus:border-ink"
                  aria-label="Callout text"
                />
              </label>
            )}
          </div>
        )}
        <div className="text-[10.5px] text-taupe leading-relaxed">
          Scroll to zoom · hold Space and drag to pan · Ctrl/⌘ Z to undo · Delete removes the selection.
          {flat.source === "TRACE" && <div className="mt-2"><Badge tone="ai">Traced from render</Badge></div>}
        </div>
      </aside>
    </div>
  );
}

function ToolButton({ children, onClick, disabled, testId }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-8 px-3 border border-hairline-strong text-[10.5px] tracking-[0.14em] uppercase hover:border-ink disabled:opacity-35 disabled:pointer-events-none" data-testid={testId}>
      {children}
    </button>
  );
}

const r = (n: number) => Math.round(n * 10) / 10;
export type { Box };
