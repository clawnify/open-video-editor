import { useEffect, useRef, useState } from "react";
import {
  Film,
  Plus,
  Upload,
  Trash2,
  Copy,
  Check,
  Loader2,
  Play,
  Pause,
  Video,
  Image as ImageIcon,
  Type as TypeIcon,
  Music,
  AlertCircle,
} from "lucide-react";

// ── types ────────────────────────────────────────────────────────────

interface Composition {
  id: string;
  name: string;
  description: string;
  html: string;
  fps: number;
  updated_at: string;
}

interface Asset {
  id: string;
  key: string;
  name: string;
  content_type: string;
  size: number;
}

interface RenderJob {
  id: number;
  composition_id: string;
  status: "rendering" | "completed" | "failed";
  output_url: string | null;
  error: string | null;
  created_at: string;
}

// ── api ──────────────────────────────────────────────────────────────

async function errText(r: Response): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return j.error || r.statusText;
}

const api = {
  async get<T>(url: string): Promise<T> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await errText(r));
    return r.json();
  },
  async send<T>(method: string, url: string, body?: unknown): Promise<T> {
    const r = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await errText(r));
    return r.json();
  },
};

// ── app ──────────────────────────────────────────────────────────────

// Starter composition for "New" — three clips on three separate tracks with a
// staggered GSAP timeline, so the timeline view shows real track registration.
// Lives here as a string (not a DB seed) so it goes in via the normal
// parameterized insert.
const STARTER_HTML = `<div id="root" data-composition-id="untitled" data-start="0" data-width="1920" data-height="1080"
     style="width:1920px;height:1080px;background:#0b1020;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif">
  <div id="kicker" class="clip" data-start="0" data-duration="5" data-track-index="2"
       style="position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);color:#7c8cff;font-size:28px;font-weight:700;letter-spacing:4px;text-transform:uppercase;white-space:nowrap">
    Product Launch
  </div>
  <div id="title" class="clip" data-start="0.3" data-duration="4.7" data-track-index="1"
       style="position:absolute;top:48%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:96px;font-weight:800;letter-spacing:-2px;text-align:center;white-space:nowrap">
    Your Title Here
  </div>
  <div id="sub" class="clip" data-start="0.9" data-duration="4.1" data-track-index="0"
       style="position:absolute;top:60%;left:50%;transform:translate(-50%,-50%);color:#9aa6d6;font-size:34px;font-weight:500;text-align:center;white-space:nowrap">
    A subtitle that fades in
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#kicker", { opacity: 0, y: -20, duration: 0.6 }, 0)
      .from("#title", { opacity: 0, y: 50, duration: 1 }, 0.3)
      .from("#sub", { opacity: 0, y: 30, duration: 0.8 }, 0.9);
    window.__timelines = window.__timelines || {};
    window.__timelines["untitled"] = tl;
  </script>
</div>`;

type Tab = "compose" | "timeline" | "media" | "renders";

export function App() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timeline");

  const active = comps.find((c) => c.id === activeId) || null;

  async function loadComps() {
    const rows = await api.get<Composition[]>("/api/compositions");
    setComps(rows);
    setActiveId((id) => id ?? rows[0]?.id ?? null);
  }
  useEffect(() => {
    loadComps();
  }, []);

  async function newComp() {
    const c = await api.send<Composition>("POST", "/api/compositions", {
      name: "Untitled",
      html: STARTER_HTML,
    });
    await loadComps();
    setActiveId(c.id);
    setTab("compose");
  }

  return (
    <div className="h-screen flex flex-col text-neutral-800">
      <header className="flex items-center gap-2 px-5 h-14 border-b border-neutral-200 bg-white shrink-0">
        <Film className="w-5 h-5 text-indigo-600" />
        <span className="font-semibold">Open Video Editor</span>
        <span className="text-neutral-400 text-sm ml-1">HTML → MP4</span>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* composition rail */}
        <aside className="w-64 border-r border-neutral-200 bg-white flex flex-col shrink-0">
          <button
            onClick={newComp}
            className="flex items-center gap-2 m-3 px-3 py-2 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50"
          >
            <Plus className="w-4 h-4" /> New composition
          </button>
          <div className="overflow-y-auto px-2 pb-2">
            {comps.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 ${
                  c.id === activeId ? "bg-indigo-50 text-indigo-700" : "hover:bg-neutral-50"
                }`}
              >
                <div className="truncate font-medium">{c.name}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* main */}
        {active ? (
          <Editor
            key={active.id}
            comp={active}
            tab={tab}
            setTab={setTab}
            onChange={loadComps}
          />
        ) : (
          <div className="flex-1 grid place-items-center text-neutral-400 text-sm">
            Create a composition to start.
          </div>
        )}
      </div>
    </div>
  );
}

// ── editor ───────────────────────────────────────────────────────────

function Editor({
  comp,
  tab,
  setTab,
  onChange,
}: {
  comp: Composition;
  tab: Tab;
  setTab: (t: Tab) => void;
  onChange: () => void;
}) {
  const [html, setHtml] = useState(comp.html);
  const [name, setName] = useState(comp.name);
  const [fps, setFps] = useState(comp.fps);
  const [previewKey, setPreviewKey] = useState(0);
  const [saving, setSaving] = useState(false);

  // Selected clip (by index) for the right-side inspector.
  const [selectedClip, setSelectedClip] = useState<number | null>(null);

  // Playhead state, kept in sync with the preview iframe's master clock.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false); // default paused
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(5);

  // Refs so the (stable) message handler can re-apply state after an iframe reload.
  const timeRef = useRef(0);
  const winRef = useRef<{ start: number; end: number | null } | null>(null);
  const restoreRef = useRef<number | null>(null);

  function post(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage({ target: "hf-preview", ...msg }, "*");
  }

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = e.data;
      if (!m || m.source !== "hf-preview") return;
      if (typeof m.duration === "number") setDuration(m.duration);
      if (m.type === "time" && typeof m.t === "number") {
        setTime(m.t);
        timeRef.current = m.t;
      }
      if (m.type === "select" && typeof m.index === "number") setSelectedClip(m.index); // clicked in the video
      if (m.type === "meta") {
        // iframe (re)loaded — re-apply the loop window and restore the playhead.
        const w = winRef.current;
        post({ type: "window", start: w ? w.start : 0, end: w ? w.end : null });
        if (restoreRef.current != null) {
          post({ type: "seek", t: restoreRef.current });
          restoreRef.current = null;
        }
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seek(t: number) {
    setPlaying(false);
    setTime(t);
    post({ type: "seek", t });
  }
  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    post({ type: next ? "play" : "pause" });
  }

  // The selected clip defines a loop window the preview loops within. Selecting
  // a clip only sets the window — it never moves the playhead (you clicked
  // something you can already see) and never auto-plays.
  const clips = parseClips(html).clips;
  const selClip = selectedClip != null ? clips.find((c) => c.index === selectedClip) ?? null : null;

  useEffect(() => {
    winRef.current = selClip ? { start: selClip.start, end: selClip.start + selClip.duration } : null;
    const w = winRef.current;
    post({ type: "window", start: w ? w.start : 0, end: w ? w.end : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClip]);

  // Spacebar toggles play/pause (unless typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      togglePlay();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function updateClip(index: number, patch: ClipPatch) {
    setHtml((h) => applyClipPatch(h, index, patch));
    // Debounce the preview reload so typing stays smooth; restore the current
    // playhead afterwards so an edit doesn't jump the time either.
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      restoreRef.current = timeRef.current;
      setPreviewKey((k) => k + 1);
    }, 350);
  }

  async function save() {
    setSaving(true);
    try {
      await api.send("PUT", `/api/compositions/${comp.id}`, { name, html, fps });
      setPreviewKey((k) => k + 1); // reload iframe
      setTime(0);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${comp.name}"?`)) return;
    await api.send("DELETE", `/api/compositions/${comp.id}`);
    onChange();
  }

  const { w: vidW, h: vidH } = parseDims(html);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-neutral-50">
      {/* preview (left) + clip inspector (right) — Remotion-style */}
      <div className="flex border-b border-neutral-200">
        <div className="flex-1 min-w-0 p-5">
          {/* box matches the composition's own aspect ratio (no letterbox) */}
          <div className="flex justify-center" style={{ height: "42vh" }}>
            <div
              className="bg-black rounded-xl overflow-hidden border border-neutral-200"
              style={{ aspectRatio: `${vidW} / ${vidH}`, height: "100%", maxWidth: "100%" }}
            >
              <iframe
                ref={iframeRef}
                key={previewKey}
                src={`/api/compositions/${comp.id}/preview`}
                className="w-full h-full"
                title="preview"
              />
            </div>
          </div>
        </div>
        <aside className="w-72 shrink-0 border-l border-neutral-200 bg-white overflow-y-auto">
          {selClip ? (
            <Inspector
              key={selClip.index}
              clip={selClip}
              onChange={(p) => updateClip(selClip.index, p)}
              onClose={() => setSelectedClip(null)}
            />
          ) : (
            <div className="p-4 text-sm text-neutral-500">
              Select a clip — in the timeline or the video — to edit it.
            </div>
          )}
        </aside>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 px-5 pt-4">
        {(["timeline", "compose", "media", "renders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
              tab === t ? "bg-white border border-neutral-200 font-medium" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 pt-3">
        {tab === "compose" && (
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 bg-white"
                placeholder="Composition name"
              />
              <label className="flex items-center gap-2 text-sm text-neutral-500">
                fps
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="px-2 py-2 rounded-lg border border-neutral-200 bg-white"
                >
                  <option value={24}>24</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </label>
            </div>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              className="w-full h-[40vh] px-3 py-2 font-mono text-xs rounded-lg border border-neutral-200 bg-white"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save & preview"}
              </button>
              <button
                onClick={remove}
                className="px-3 py-2 text-sm rounded-lg text-neutral-500 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {tab === "timeline" && (
          <Timeline
            html={html}
            fps={fps}
            time={time}
            duration={duration}
            playing={playing}
            selected={selectedClip}
            onSelect={setSelectedClip}
            onSeek={seek}
            onTogglePlay={togglePlay}
          />
        )}
        {tab === "media" && <MediaPanel />}
        {tab === "renders" && <RendersPanel comp={comp} />}
      </div>
    </main>
  );
}

// ── timeline ─────────────────────────────────────────────────────────

type ClipType = "video" | "image" | "text" | "audio";
interface Clip {
  index: number; // position among .clip elements — stable handle for editing
  start: number;
  duration: number;
  track: number;
  type: ClipType;
  label: string;
  text: string;
  color: string;
  fontSize: string;
  src: string;
}

/** Parse HyperFrames `.clip` elements out of the composition HTML into tracks. */
function parseClips(html: string): { clips: Clip[]; tracks: number } {
  let clips: Clip[] = [];
  let tracks = 1;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    clips = Array.from(doc.querySelectorAll(".clip")).map((el, index) => {
      const tag = el.tagName.toLowerCase();
      const type: ClipType =
        tag === "video" ? "video" : tag === "img" ? "image" : tag === "audio" ? "audio" : "text";
      const text = (el.textContent || "").trim().replace(/\s+/g, " ");
      const label = text.slice(0, 28) || type[0].toUpperCase() + type.slice(1);
      return {
        index,
        start: parseFloat(el.getAttribute("data-start") || "0") || 0,
        duration: parseFloat(el.getAttribute("data-duration") || "0") || 0,
        track: parseInt(el.getAttribute("data-track-index") || "0", 10) || 0,
        type,
        label,
        text,
        color: (el as HTMLElement).style?.color || "",
        fontSize: (el as HTMLElement).style?.fontSize || "",
        src: el.getAttribute("src") || "",
      };
    });
    tracks = Math.max(1, ...clips.map((c) => c.track + 1));
  } catch {
    /* malformed HTML mid-edit — show an empty timeline */
  }
  return { clips, tracks };
}

/** Read the composition canvas size from the root element's data-* attributes. */
function parseDims(html: string): { w: number; h: number } {
  try {
    const root = new DOMParser().parseFromString(html, "text/html").querySelector("[data-composition-id]");
    return {
      w: parseInt(root?.getAttribute("data-width") || "1920", 10) || 1920,
      h: parseInt(root?.getAttribute("data-height") || "1080", 10) || 1080,
    };
  } catch {
    return { w: 1920, h: 1080 };
  }
}

export type ClipPatch = Partial<{
  text: string;
  color: string;
  fontSize: string;
  src: string;
  start: number;
  duration: number;
  track: number;
}>;

/** Apply an inspector edit to clip #index by round-tripping the HTML through the DOM. */
function applyClipPatch(html: string, index: number, patch: ClipPatch): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector("[data-composition-id]");
    const el = doc.querySelectorAll(".clip")[index] as HTMLElement | undefined;
    if (!root || !el) return html;
    if (patch.text !== undefined) el.textContent = patch.text;
    if (patch.color !== undefined) el.style.color = patch.color;
    if (patch.fontSize !== undefined) el.style.fontSize = patch.fontSize;
    if (patch.src !== undefined) el.setAttribute("src", patch.src);
    if (patch.start !== undefined) el.setAttribute("data-start", String(patch.start));
    if (patch.duration !== undefined) el.setAttribute("data-duration", String(patch.duration));
    if (patch.track !== undefined) el.setAttribute("data-track-index", String(patch.track));
    return root.outerHTML;
  } catch {
    return html;
  }
}

const CLIP_BAR: Record<ClipType, string> = {
  video: "bg-blue-500",
  image: "bg-emerald-500",
  text: "bg-violet-500",
  audio: "bg-amber-500",
};
// Selection ring matches the clip's own colour (offset gives a white gap so it reads).
const CLIP_RING: Record<ClipType, string> = {
  video: "ring-blue-600",
  image: "ring-emerald-600",
  text: "ring-violet-600",
  audio: "ring-amber-600",
};
function clipIcon(type: ClipType) {
  const c = "w-3.5 h-3.5 shrink-0";
  if (type === "video") return <Video className={c} />;
  if (type === "image") return <ImageIcon className={c} />;
  if (type === "audio") return <Music className={c} />;
  return <TypeIcon className={c} />;
}
/** Frame timecode MM:SS.FF (Remotion-style). */
function fmtTC(t: number, fps: number) {
  const total = Math.max(0, t);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  let f = Math.round((total - Math.floor(total)) * fps);
  if (f >= fps) f = fps - 1;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(s)}.${p(f)}`;
}

function Timeline({
  html,
  fps,
  time,
  duration,
  playing,
  selected,
  onSelect,
  onSeek,
  onTogglePlay,
}: {
  html: string;
  fps: number;
  time: number;
  duration: number;
  playing: boolean;
  selected: number | null;
  onSelect: (index: number) => void;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const { clips, tracks } = parseClips(html);
  const dur = Math.max(duration, 0.1);
  const rows = Array.from({ length: tracks }, (_, i) => tracks - 1 - i); // highest track on top
  const ticks = Array.from({ length: Math.ceil(dur) }, (_, i) => i + 1).filter((s) => s <= dur + 0.001);
  const pct = (t: number) => `${Math.max(0, Math.min(t / dur, 1)) * 100}%`;

  function seekAt(clientX: number) {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return;
    onSeek(((clientX - r.left) / r.width) * dur);
  }
  function onPointerDown(e: React.PointerEvent) {
    seekAt(e.clientX);
    const move = (ev: PointerEvent) => seekAt(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white text-neutral-800 overflow-hidden select-none">
      {/* controls bar */}
      <div className="flex items-center justify-center px-3 h-9 border-b border-neutral-200">
        <button
          onClick={onTogglePlay}
          className="grid place-items-center w-7 h-7 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex">
        <div className="shrink-0 border-r border-neutral-200 w-28">
          {/* current-time readout in the corner (Remotion-style) */}
          <div className="h-7 flex items-center px-3 border-b border-neutral-200 font-semibold tabular-nums text-sm">
            {fmtTC(time, fps)}
          </div>
          {rows.map((tr) => (
            <div
              key={tr}
              className="h-10 flex items-center px-3 text-xs text-neutral-500 border-b border-neutral-100"
            >
              Track {tr + 1}
            </div>
          ))}
        </div>

        <div className="relative flex-1 cursor-pointer bg-neutral-50" ref={areaRef} onPointerDown={onPointerDown}>
          <div className="relative h-7 border-b border-neutral-200">
            {ticks.map((s) => (
              <div key={s} className="absolute top-0 h-full border-l border-neutral-200" style={{ left: pct(s) }}>
                <span className="absolute left-1 top-1 text-[10px] text-neutral-400">{fmtTC(s, fps)}</span>
              </div>
            ))}
          </div>

          {rows.map((tr) => (
            <div key={tr} className="relative h-10 border-b border-neutral-100">
              {clips
                .filter((c) => c.track === tr)
                .map((c) => (
                  <div
                    key={c.index}
                    onPointerDown={(e) => {
                      e.stopPropagation(); // select, don't scrub
                      onSelect(c.index);
                    }}
                    className={`absolute top-1 bottom-1 rounded-md flex items-center gap-1.5 px-2 text-xs text-white overflow-hidden shadow-sm cursor-pointer ${CLIP_BAR[c.type]} ${
                      c.index === selected ? `ring-2 ring-offset-1 ${CLIP_RING[c.type]}` : ""
                    }`}
                    style={{ left: pct(c.start), width: pct(c.duration) }}
                    title={`${c.label} · ${c.start}s–${c.start + c.duration}s`}
                  >
                    {clipIcon(c.type)}
                    <span className="truncate">{c.label}</span>
                  </div>
                ))}
            </div>
          ))}

          <div className="absolute top-0 bottom-0 w-px bg-indigo-500 pointer-events-none z-10" style={{ left: pct(time) }}>
            <div className="absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-sm bg-indigo-500" />
          </div>
        </div>
      </div>

      {clips.length === 0 && (
        <div className="px-3 py-3 text-xs text-neutral-500">
          No timed clips yet. Add elements with <code>class="clip"</code> + <code>data-start</code> /{" "}
          <code>data-duration</code> / <code>data-track-index</code> in the Compose tab.
        </div>
      )}
    </div>
  );
}

// ── inspector ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full px-2 py-1.5 text-sm rounded-md border border-neutral-200 bg-white";

/** Right-side quick editor for the selected clip — fields depend on the clip type. */
function Inspector({
  clip,
  onChange,
  onClose,
}: {
  clip: Clip;
  onChange: (patch: ClipPatch) => void;
  onClose: () => void;
}) {
  const typeLabel = clip.type[0].toUpperCase() + clip.type.slice(1);
  const num = (v: string) => (v === "" ? 0 : parseFloat(v) || 0);

  return (
    <div className="overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-neutral-200">
        <span className="text-neutral-600">{clipIcon(clip.type)}</span>
        <span className="text-sm font-medium">{typeLabel}</span>
        <span className="text-xs text-neutral-400">· Track {clip.track + 1}</span>
        <button onClick={onClose} className="ml-auto text-neutral-400 hover:text-neutral-700 text-lg leading-none">
          ×
        </button>
      </div>

      <div className="p-3 space-y-3">
        {clip.type === "text" && (
          <>
            <Field label="Text">
              <input className={inputCls} value={clip.text} onChange={(e) => onChange({ text: e.target.value })} />
            </Field>
            <Field label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-8 h-8 rounded border border-neutral-200 bg-white p-0.5"
                  value={toHex(clip.color)}
                  onChange={(e) => onChange({ color: e.target.value })}
                />
                <input
                  className={inputCls}
                  value={clip.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  placeholder="#ffffff"
                />
              </div>
            </Field>
            <Field label="Font size">
              <input
                className={inputCls}
                value={clip.fontSize}
                onChange={(e) => onChange({ fontSize: e.target.value })}
                placeholder="96px"
              />
            </Field>
          </>
        )}

        {(clip.type === "image" || clip.type === "video" || clip.type === "audio") && (
          <Field label="Source">
            <input
              className={inputCls}
              value={clip.src}
              onChange={(e) => onChange({ src: e.target.value })}
              placeholder="assets/your-file"
            />
          </Field>
        )}

        <div className="pt-1 border-t border-neutral-100" />

        <div className="grid grid-cols-3 gap-2">
          <Field label="Start (s)">
            <input
              type="number"
              step="0.1"
              className={inputCls}
              value={clip.start}
              onChange={(e) => onChange({ start: num(e.target.value) })}
            />
          </Field>
          <Field label="Dur (s)">
            <input
              type="number"
              step="0.1"
              className={inputCls}
              value={clip.duration}
              onChange={(e) => onChange({ duration: num(e.target.value) })}
            />
          </Field>
          <Field label="Track">
            <input
              type="number"
              min="0"
              className={inputCls}
              value={clip.track}
              onChange={(e) => onChange({ track: Math.max(0, Math.round(num(e.target.value))) })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/** Best-effort convert a CSS color (hex or rgb) to #rrggbb for the color input. */
function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    const h = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return "#ffffff";
}

// ── media ────────────────────────────────────────────────────────────

function MediaPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setAssets(await api.get<Asset[]>("/api/assets"));
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        await fetch("/api/assets", { method: "POST", body: fd });
      }
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function del(id: string) {
    await api.send("DELETE", `/api/assets/${id}`);
    load();
  }

  function copy(key: string) {
    navigator.clipboard.writeText(`assets/${key}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }

  const isImg = (t: string) => t.startsWith("image/");

  return (
    <div className="max-w-3xl space-y-4">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-neutral-200 bg-white text-neutral-500 text-sm cursor-pointer hover:border-indigo-300"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        Drop a logo or product demo here, or click to upload
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      <p className="text-xs text-neutral-500">
        Reference media in your composition HTML by its path, e.g.{" "}
        <code className="px-1 py-0.5 bg-neutral-100 rounded">&lt;img src="assets/logo.png"&gt;</code>. Only
        referenced assets are shipped to the renderer.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {assets.map((a) => (
          <div key={a.id} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="aspect-video bg-neutral-100 grid place-items-center overflow-hidden">
              {isImg(a.content_type) ? (
                <img src={`/api/uploads/${a.key}`} alt={a.name} className="w-full h-full object-contain" />
              ) : a.content_type.startsWith("video/") ? (
                <video src={`/api/uploads/${a.key}`} className="w-full h-full object-cover" muted />
              ) : (
                <Film className="w-6 h-6 text-neutral-400" />
              )}
            </div>
            <div className="p-2 flex items-center gap-1">
              <code className="flex-1 text-[11px] truncate text-neutral-600">assets/{a.key}</code>
              <button onClick={() => copy(a.key)} className="p-1 text-neutral-400 hover:text-indigo-600" title="Copy path">
                {copied === a.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => del(a.id)} className="p-1 text-neutral-400 hover:text-red-600" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── renders ──────────────────────────────────────────────────────────

function RendersPanel({ comp }: { comp: Composition }) {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [rendering, setRendering] = useState(false);

  async function load() {
    const all = await api.get<RenderJob[]>("/api/renders");
    setJobs(all.filter((j) => j.composition_id === comp.id));
  }
  useEffect(() => {
    load();
  }, [comp.id]);

  async function render() {
    setRendering(true);
    try {
      await api.send("POST", "/api/renders", { composition_id: comp.id });
      await load();
    } catch (e) {
      alert(String(e));
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <button
        onClick={render}
        disabled={rendering}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {rendering ? "Rendering… (this can take a minute)" : "Render MP4"}
      </button>

      <div className="space-y-2">
        {jobs.map((j) => (
          <div key={j.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            {j.status === "completed" && j.output_url ? (
              <video src={j.output_url} controls className="w-full max-w-md rounded-lg bg-black" />
            ) : j.status === "failed" ? (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-words">{j.error || "Render failed"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Rendering…
              </div>
            )}
            <div className="text-[11px] text-neutral-400 mt-2">
              #{j.id} · {new Date(j.created_at + "Z").toLocaleString()}
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-sm text-neutral-400">No renders yet.</p>}
      </div>
    </div>
  );
}
