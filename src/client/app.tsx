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

// Starter composition for "New" — a title reveal with two clips on track 0 and
// a GSAP timeline, so the preview and timeline aren't empty. Lives here as a
// string (not a DB seed) so it goes in via the normal parameterized insert.
const STARTER_HTML = `<div id="root" data-composition-id="untitled" data-start="0" data-width="1920" data-height="1080"
     style="width:1920px;height:1080px;background:#0b1020;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif">
  <div id="title" class="clip" data-start="0" data-duration="5" data-track-index="0"
       style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:96px;font-weight:800;letter-spacing:-2px;text-align:center;white-space:nowrap">
    Your Title Here
  </div>
  <div id="sub" class="clip" data-start="0" data-duration="5" data-track-index="0"
       style="position:absolute;top:58%;left:50%;transform:translate(-50%,-50%);color:#7c8cff;font-size:36px;font-weight:500;text-align:center;white-space:nowrap">
    A subtitle that fades in
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#title", { opacity: 0, y: 50, duration: 1 }, 0.3);
    tl.from("#sub", { opacity: 0, y: 30, duration: 0.8 }, 0.9);
    window.__timelines = window.__timelines || {};
    window.__timelines["untitled"] = tl;
  </script>
</div>`;

type Tab = "compose" | "media" | "renders";

export function App() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("compose");

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

  // Playhead state, kept in sync with the preview iframe's master clock.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(5);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const m = e.data;
      if (!m || m.source !== "hf-preview") return;
      if (typeof m.duration === "number") setDuration(m.duration);
      if (m.type === "time" && typeof m.t === "number") setTime(m.t);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function post(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage({ target: "hf-preview", ...msg }, "*");
  }
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

  async function save() {
    setSaving(true);
    try {
      await api.send("PUT", `/api/compositions/${comp.id}`, { name, html, fps });
      setPreviewKey((k) => k + 1); // reload iframe
      setPlaying(true);
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

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-neutral-50">
      {/* preview */}
      <div className="p-5 pb-0">
        <div className="aspect-video w-full max-h-[38vh] mx-auto bg-black rounded-xl overflow-hidden border border-neutral-200">
          <iframe
            ref={iframeRef}
            key={previewKey}
            src={`/api/compositions/${comp.id}/preview`}
            className="w-full h-full"
            title="preview"
          />
        </div>
      </div>

      {/* timeline */}
      <div className="px-5 pt-3">
        <Timeline
          html={html}
          time={time}
          duration={duration}
          playing={playing}
          onSeek={seek}
          onTogglePlay={togglePlay}
        />
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 px-5 pt-4">
        {(["compose", "media", "renders"] as Tab[]).map((t) => (
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

        {tab === "media" && <MediaPanel />}
        {tab === "renders" && <RendersPanel comp={comp} />}
      </div>
    </main>
  );
}

// ── timeline ─────────────────────────────────────────────────────────

type ClipType = "video" | "image" | "text" | "audio";
interface Clip {
  start: number;
  duration: number;
  track: number;
  type: ClipType;
  label: string;
}

/** Parse HyperFrames `.clip` elements out of the composition HTML into tracks. */
function parseClips(html: string): { clips: Clip[]; tracks: number } {
  let clips: Clip[] = [];
  let tracks = 1;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    clips = Array.from(doc.querySelectorAll(".clip")).map((el) => {
      const tag = el.tagName.toLowerCase();
      const type: ClipType =
        tag === "video" ? "video" : tag === "img" ? "image" : tag === "audio" ? "audio" : "text";
      const label =
        (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28) ||
        type[0].toUpperCase() + type.slice(1);
      return {
        start: parseFloat(el.getAttribute("data-start") || "0") || 0,
        duration: parseFloat(el.getAttribute("data-duration") || "0") || 0,
        track: parseInt(el.getAttribute("data-track-index") || "0", 10) || 0,
        type,
        label,
      };
    });
    tracks = Math.max(1, ...clips.map((c) => c.track + 1));
  } catch {
    /* malformed HTML mid-edit — show an empty timeline */
  }
  return { clips, tracks };
}

const CLIP_BAR: Record<ClipType, string> = {
  video: "bg-blue-600/90 border-blue-400",
  image: "bg-emerald-700/90 border-emerald-500",
  text: "bg-violet-500/90 border-violet-300",
  audio: "bg-amber-600/90 border-amber-400",
};
function clipIcon(type: ClipType) {
  const c = "w-3.5 h-3.5 shrink-0";
  if (type === "video") return <Video className={c} />;
  if (type === "image") return <ImageIcon className={c} />;
  if (type === "audio") return <Music className={c} />;
  return <TypeIcon className={c} />;
}
const fmtTime = (s: number) => `00:${String(Math.round(s)).padStart(2, "0")}`;

function Timeline({
  html,
  time,
  duration,
  playing,
  onSeek,
  onTogglePlay,
}: {
  html: string;
  time: number;
  duration: number;
  playing: boolean;
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-200 overflow-hidden select-none">
      <div className="flex items-center gap-3 px-3 h-10 border-b border-neutral-800">
        <button
          onClick={onTogglePlay}
          className="grid place-items-center w-7 h-7 rounded-md bg-neutral-800 hover:bg-neutral-700"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="text-xs tabular-nums text-neutral-400">
          {time.toFixed(2)}s / {dur.toFixed(2)}s
        </span>
      </div>

      <div className="flex">
        <div className="shrink-0 border-r border-neutral-800 w-28">
          <div className="h-7 border-b border-neutral-800" />
          {rows.map((tr) => (
            <div
              key={tr}
              className="h-10 flex items-center px-3 text-xs text-neutral-400 border-b border-neutral-800/60"
            >
              Track {tr + 1}
            </div>
          ))}
        </div>

        <div className="relative flex-1 cursor-pointer" ref={areaRef} onPointerDown={onPointerDown}>
          <div className="relative h-7 border-b border-neutral-800">
            {ticks.map((s) => (
              <div key={s} className="absolute top-0 h-full border-l border-neutral-800" style={{ left: pct(s) }}>
                <span className="absolute left-1 top-1 text-[10px] text-neutral-500">{fmtTime(s)}</span>
              </div>
            ))}
          </div>

          {rows.map((tr) => (
            <div key={tr} className="relative h-10 border-b border-neutral-800/60">
              {clips
                .filter((c) => c.track === tr)
                .map((c, i) => (
                  <div
                    key={i}
                    className={`absolute top-1 bottom-1 rounded-md border flex items-center gap-1.5 px-2 text-xs text-white overflow-hidden ${CLIP_BAR[c.type]}`}
                    style={{ left: pct(c.start), width: pct(c.duration) }}
                    title={`${c.label} · ${c.start}s–${c.start + c.duration}s`}
                  >
                    {clipIcon(c.type)}
                    <span className="truncate">{c.label}</span>
                  </div>
                ))}
            </div>
          ))}

          <div className="absolute top-0 bottom-0 w-px bg-sky-400 pointer-events-none" style={{ left: pct(time) }}>
            <div className="absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-sm bg-sky-400" />
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
