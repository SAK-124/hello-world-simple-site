import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes" }] }),
  component: NotesPage,
});

type Note = { id: string; content: string; updated_at: string };

function NotesPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [noteId, setNoteId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dark, setDark] = useState(false);
  const contentRef = useRef("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localWriteRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("notes")
      .select("id, content, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    let note = data as Note | null;
    if (!note) {
      const { data: created, error: createError } = await supabase
        .from("notes")
        .insert({ user_id: user.id, content: "" })
        .select("id, content, updated_at")
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }
      note = created;
    }

    setNoteId(note.id);
    setContent(note.content);
    contentRef.current = note.content;
    setUpdatedAt(note.updated_at);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!noteId) return;
    const channel = supabase
      .channel(`notes-sync-${noteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notes", filter: `id=eq.${noteId}` },
        (payload) => {
          if (Date.now() - localWriteRef.current < 2000) return;
          const next = payload.new as Note;
          setContent(next.content);
          contentRef.current = next.content;
          setUpdatedAt(next.updated_at);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function queueSave(nextContent: string) {
    if (!noteId) return;
    setContent(nextContent);
    contentRef.current = nextContent;
    setSaving(true);
    setError(null);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      localWriteRef.current = Date.now();
      const { data, error: saveError } = await supabase
        .from("notes")
        .update({ content: contentRef.current })
        .eq("id", noteId)
        .select("updated_at")
        .single();

      if (saveError) setError(saveError.message);
      else if (data) setUpdatedAt(data.updated_at);
      setSaving(false);
    }, 500);
  }

  async function flushSave() {
    if (!noteId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaving(true);
    localWriteRef.current = Date.now();
    const { data, error: saveError } = await supabase
      .from("notes")
      .update({ content: contentRef.current })
      .eq("id", noteId)
      .select("updated_at")
      .single();

    if (saveError) setError(saveError.message);
    else if (data) setUpdatedAt(data.updated_at);
    setSaving(false);
  }

  async function signOut() {
    await flushSave();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to clipboard");
    }
  }

  function downloadTxt() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `note-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    if (!content) return;
    if (!confirm("Clear all text in this note?")) return;
    queueSave("");
  }

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const lines = content ? content.split("\n").length : 0;
    const minutes = Math.max(1, Math.round(words / 220));
    return { words, chars, lines, minutes };
  }, [content]);

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[oklch(0.7_0.18_280)] opacity-30 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-[oklch(0.75_0.15_200)] opacity-25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[oklch(0.78_0.16_330)] opacity-20 blur-3xl" />
      </div>

      <main
        className={`mx-auto flex min-h-screen flex-col px-4 py-6 transition-all duration-500 ${
          focusMode ? "max-w-3xl" : "max-w-5xl"
        }`}
      >
        {/* Header */}
        {!focusMode && (
          <header className="mb-6 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.65_0.2_280)] to-[oklch(0.7_0.18_330)] shadow-lg shadow-[oklch(0.65_0.2_280)]/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Notes</h1>
                <p className="text-xs text-muted-foreground">Your thoughts, autosaved.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconBtn onClick={() => setDark((d) => !d)} title="Toggle theme">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </IconBtn>
              <div
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_240)] to-[oklch(0.65_0.2_300)] text-xs font-semibold text-white shadow"
                title={user.email ?? ""}
              >
                {initials}
              </div>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm backdrop-blur transition hover:bg-card hover:shadow-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </header>
        )}

        {/* Editor card */}
        <section className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-xl shadow-black/5 backdrop-blur-xl animate-scale-in">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <StatusPill saving={saving} error={error} updatedAt={updatedAt} />
            </div>
            <div className="flex items-center gap-1">
              <IconBtn onClick={copyAll} title="Copy all" disabled={!content}>
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </IconBtn>
              <IconBtn onClick={downloadTxt} title="Download .txt" disabled={!content}>
                <Download className="h-4 w-4" />
              </IconBtn>
              <IconBtn onClick={clearAll} title="Clear note" disabled={!content}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
              <div className="mx-1 h-5 w-px bg-border" />
              <IconBtn onClick={() => setFocusMode((f) => !f)} title={focusMode ? "Exit focus" : "Focus mode"}>
                {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </IconBtn>
            </div>
          </div>

          {/* Editor */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <textarea
              autoFocus
              value={content}
              onChange={(e) => queueSave(e.target.value)}
              onBlur={flushSave}
              placeholder="Start typing your thoughts…"
              spellCheck={false}
              className="flex-1 resize-none bg-transparent px-6 py-6 text-[16px] leading-relaxed outline-none placeholder:text-muted-foreground/60 sm:px-10 sm:py-8 sm:text-[17px]"
              style={{ minHeight: "55vh" }}
            />
          )}

          {/* Footer stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <Stat label="Words" value={stats.words} />
              <Stat label="Chars" value={stats.chars} />
              <Stat label="Lines" value={stats.lines} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[oklch(0.65_0.2_280)] to-[oklch(0.7_0.18_330)]" />
              ~{stats.minutes} min read
            </div>
          </div>
        </section>

        {!focusMode && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
            Press <kbd className="rounded border border-border bg-card/60 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> nothing — just keep typing. Everything saves automatically.
          </p>
        )}
      </main>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-mono text-sm font-semibold text-foreground">{value.toLocaleString()}</span>
      <span>{label}</span>
    </span>
  );
}

function StatusPill({
  saving,
  error,
  updatedAt,
}: {
  saving: boolean;
  error: string | null;
  updatedAt: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
        <CloudOff className="h-3.5 w-3.5" />
        {error}
      </span>
    );
  }
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400">
      <Cloud className="h-3.5 w-3.5" />
      {updatedAt ? `Saved ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Saved"}
    </span>
  );
}
