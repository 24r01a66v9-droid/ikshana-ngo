import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays, Check, ChevronDown, ChevronUp, Download, FileText,
  ImagePlus, Pencil, Plus, Save, Settings2, Trash2, Users, X, ArrowLeft, ArrowRight,
} from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "./ui/feedback";

type QuestionType =
  | "short_text" | "paragraph" | "single_choice" | "multi_choice" | "dropdown"
  | "email" | "phone" | "number" | "date" | "time" | "file_upload"
  | "linear_scale" | "rating" | "multiple_choice_grid" | "checkbox_grid" | "section";

type QuestionSettings = {
  allow_other?: boolean;
  min?: number;
  max?: number;
  step?: number;
  min_label?: string;
  max_label?: string;
  max_files?: number;
  max_size_mb?: number;
  allowed_file_types?: string[];
  rows?: string[];
  columns?: string[];
  require_each_row?: boolean;
  validation?: { rule?: string; value?: string; min?: number; max?: number; error?: string };
  show_if?: { question_id?: number; operator?: "equals" | "not_equals"; value?: string };
  description?: string;
  image_url?: string;
  video_url?: string;
};

type Question = {
  id?: number;
  label: string;
  help_text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  settings: QuestionSettings;
  position?: number;
};

type EventRecord = {
  id: number; slug: string; title: string; summary: string | null; description: string | null;
  poster_url: string | null; starts_at: string | null; ends_at: string | null; venue: string | null;
  fee_amount: number; fee_note: string | null; status: "draft" | "published" | "closed";
  show_on_home: boolean; registration_enabled: boolean; capacity: number | null;
  contact_email: string | null; contact_phone: string | null; registration_url?: string | null; registration_link_label?: string | null; home_message?: string | null; registration_count?: number;
  form_config?: Record<string, any>;
  payment_mode?: "none" | "upi" | "razorpay";
  home_feature_type?: "event" | "special_day";
};

const EMPTY_EVENT = {
  title: "", summary: "", description: "", starts_at: "", ends_at: "", venue: "",
  fee_amount: "0", fee_note: "", capacity: "", contact_email: "", contact_phone: "",
  status: "draft" as EventRecord["status"], show_on_home: false, registration_enabled: false, payment_mode: "none" as "none" | "upi" | "razorpay", home_feature_type: "event" as "event" | "special_day",
  registration_url: "", registration_link_label: "", home_message: "",
};

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "single_choice", label: "Multiple choice" },
  { value: "multi_choice", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "file_upload", label: "File upload" },
  { value: "linear_scale", label: "Linear scale" },
  { value: "rating", label: "Rating" },
  { value: "multiple_choice_grid", label: "Multiple choice grid" },
  { value: "checkbox_grid", label: "Checkbox grid" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "section", label: "Section / page break" },
];

const CHOICE_TYPES = new Set<QuestionType>(["single_choice", "multi_choice", "dropdown"]);
const GRID_TYPES = new Set<QuestionType>(["multiple_choice_grid", "checkbox_grid"]);

const blankQuestion = (type: QuestionType = "short_text"): Question => ({
  label: type === "section" ? "New section" : "", help_text: "", type, options: [], required: false,
  settings: type === "linear_scale" ? { min: 1, max: 5, min_label: "", max_label: "" } :
    type === "rating" ? { max: 5 } :
    GRID_TYPES.has(type) ? { rows: ["Row 1"], columns: ["Option 1", "Option 2"], require_each_row: false } :
    type === "file_upload" ? { max_files: 1, max_size_mb: 10, allowed_file_types: ["image/*", "application/pdf"] } : {},
});

function inputDateTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value); if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datePart(value: string) { return value ? value.slice(0, 10) : ""; }
function timePart(value: string) { return value && value.length >= 16 ? value.slice(11, 16) : ""; }
function combineDateTime(date: string, time: string) { return date ? `${date}T${time || "00:00"}` : ""; }

export default function EventAdminPanel() {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const isAdmin = Boolean(user?.role?.toLowerCase() === "admin" || user?.email === "24r01a66v9@cmrithyderabad.edu.in");
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_EVENT);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({ confirmation_message: "Thank you. Your registration has been received." });
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [tab, setTab] = useState<"event" | "form" | "registrations">("event");
  const [saving, setSaving] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [posterUploading, setPosterUploading] = useState(false);
  const [pendingPoster, setPendingPoster] = useState<File | null>(null);
  const [homeSlides, setHomeSlides] = useState<Array<{ poster_url: string; message?: string }>>([]);
  const slideFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);

  useEffect(() => { if (open && isAdmin) loadEvents(); }, [open, isAdmin]);

  const loadEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/reg/admin/events", buildAuthRequestInit());
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Couldn't load event management.");
      setEvents(body.events || []);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't load events.", { tone: "error" }); }
    finally { setLoadingEvents(false); }
  };

  const selectEvent = async (event: EventRecord) => {
    setSelectedId(event.id); setTab("event"); setPendingPoster(null);
    setDraft({
      title: event.title || "", summary: event.summary || "", description: event.description || "",
      starts_at: inputDateTime(event.starts_at), ends_at: inputDateTime(event.ends_at), venue: event.venue || "",
      fee_amount: String(event.fee_amount ?? 0), fee_note: event.fee_note || "",
      capacity: event.capacity == null ? "" : String(event.capacity), contact_email: event.contact_email || "",
      contact_phone: event.contact_phone || "", registration_url: event.registration_url || "", registration_link_label: event.registration_link_label || "", home_message: event.home_message || "", status: event.status, show_on_home: Boolean(event.show_on_home),
      registration_enabled: Boolean(event.registration_enabled), payment_mode: event.payment_mode || (Number(event.fee_amount || 0) > 0 ? "upi" : "none"), home_feature_type: event.home_feature_type || "event",
    });
    const nextFormConfig: Record<string, any> = { confirmation_message: "Thank you. Your registration has been received.", show_time: true, ...(event.form_config || {}) };
    const configuredSlides = Array.isArray(nextFormConfig.home_slides) ? nextFormConfig.home_slides.filter((slide: any) => slide && typeof slide.poster_url === "string" && slide.poster_url.trim()).map((slide: any) => ({ poster_url: slide.poster_url, message: String(slide.message || "") })) : [];
    setHomeSlides(configuredSlides.length ? configuredSlides : (event.poster_url ? [{ poster_url: event.poster_url, message: "" }] : []));
    setFormConfig(nextFormConfig);
    /* keep the draft shape above stable */
    setDraft((current) => ({ ...current, registration_enabled: Boolean(event.registration_enabled), payment_mode: event.payment_mode || (Number(event.fee_amount || 0) > 0 ? "upi" : "none"), home_feature_type: event.home_feature_type || "event" }));
    await loadEventDetails(event.id, event.slug);
  };

  const startNew = () => {
    setSelectedId(null); setDraft(EMPTY_EVENT); setQuestions([]); setFormConfig({ confirmation_message: "Thank you. Your registration has been received.", show_time: true }); setHomeSlides([]); setRegistrations([]); setPendingPoster(null); setTab("event");
  };

  const loadEventDetails = async (id: number, slug?: string) => {
    setLoadingDetails(true);
    try {
      const [eventRes, regRes] = await Promise.all([
        fetch(`/api/reg/events/${slug || events.find((e) => e.id === id)?.slug || ""}`, buildAuthRequestInit()),
        fetch(`/api/reg/admin/events/${id}/registrations`, buildAuthRequestInit()),
      ]);
      const eventBody = await eventRes.json().catch(() => ({}));
      const regBody = await regRes.json().catch(() => ({}));
      if (eventRes.ok) setQuestions(eventBody.questions || []);
      if (regRes.ok) setRegistrations(regBody.registrations || []);
    } catch { toast("Couldn't load the event details.", { tone: "error" }); }
    finally { setLoadingDetails(false); }
  };

  const saveHomeSlides = async (slides: Array<{ poster_url: string; message?: string }>) => {
    if (!selectedId) return;
    const nextConfig = { ...formConfig, home_slides: slides };
    setFormConfig(nextConfig);
    try {
      const res = await fetch(`/api/reg/admin/events/${selectedId}`, buildAuthRequestInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_config: nextConfig }) }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Couldn't save Home posters.");
      toast("Home posters updated.", { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save Home posters.", { tone: "error" }); }
  };

  const uploadHomeSlides = async (files: File[]) => {
    if (!selectedId) { toast("Create the poster feature first, then add more posters.", { tone: "error" }); return; }
    const selectedFiles = files.filter((file) => file && file.type.startsWith("image/"));
    if (!selectedFiles.length) return;
    setPosterUploading(true);
    try {
      let latestSlides = [...homeSlides];
      for (const file of selectedFiles) {
        const form = new FormData(); form.append("file", file);
        const res = await fetch(`/api/reg/admin/events/${selectedId}/home-slide`, buildAuthRequestInit({ method: "POST", body: form }));
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `Poster upload failed for ${file.name}.`);
        latestSlides = Array.isArray(body.home_slides)
          ? body.home_slides.filter((slide: any) => slide && typeof slide.poster_url === "string" && slide.poster_url.trim()).map((slide: any) => ({ poster_url: slide.poster_url, message: String(slide.message || "") }))
          : [...latestSlides, { poster_url: body.poster_url, message: "" }];
      }
      setHomeSlides(latestSlides);
      setFormConfig((current) => ({ ...current, home_slides: latestSlides }));
      toast(`${selectedFiles.length} poster${selectedFiles.length === 1 ? "" : "s"} added to the Home carousel.`, { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Poster upload failed.", { tone: "error" }); }
    finally { setPosterUploading(false); }
  };

  const updateHomeSlide = (index: number, patch: Partial<{ poster_url: string; message: string }>) => setHomeSlides((current) => current.map((slide, i) => i === index ? { ...slide, ...patch } : slide));
  const moveHomeSlide = (index: number, direction: -1 | 1) => setHomeSlides((current) => { const next = index + direction; if (next < 0 || next >= current.length) return current; const copy = [...current]; [copy[index], copy[next]] = [copy[next], copy[index]]; return copy; });
  const removeHomeSlide = async (index: number) => { const next = homeSlides.filter((_, i) => i !== index); setHomeSlides(next); await saveHomeSlides(next); };

  const uploadPoster = async (file: File, eventId = selectedId) => {
    if (!eventId) { setPendingPoster(file); return; }
    setPosterUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch(`/api/reg/admin/events/${eventId}/poster`, buildAuthRequestInit({ method: "POST", body: form }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Poster upload failed.");
      setEvents((current) => current.map((e) => e.id === eventId ? { ...e, poster_url: body.poster_url } : e));
      if (draft.home_feature_type === "special_day") {
        const nextSlides = homeSlides.length ? homeSlides.map((slide, index) => index === 0 ? { ...slide, poster_url: body.poster_url } : slide) : [{ poster_url: body.poster_url, message: "" }];
        setHomeSlides(nextSlides);
        const nextConfig = { ...formConfig, home_slides: nextSlides };
        setFormConfig(nextConfig);
        await fetch(`/api/reg/admin/events/${eventId}`, buildAuthRequestInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_config: nextConfig }) }));
      }
      toast("Poster updated.", { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Poster upload failed.", { tone: "error" }); }
    finally { setPosterUploading(false); }
  };

  const saveEvent = async () => {
    if (!String(draft.title || "").trim()) { toast(draft.home_feature_type === "special_day" ? "Add an internal title for this special-day poster." : "Add an event title first.", { tone: "error" }); return; }
    setSaving(true);
    try {
      const payload = {
        ...draft, starts_at: draft.starts_at || null, ends_at: draft.ends_at || null,
        fee_amount: Number(draft.fee_amount || 0), capacity: draft.capacity ? Number(draft.capacity) : null,
        form_config: { ...formConfig, show_time: formConfig.show_time !== false },
      };
      const res = await fetch(selectedId ? `/api/reg/admin/events/${selectedId}` : "/api/reg/admin/events", buildAuthRequestInit({
        method: selectedId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Couldn't save the event.");
      const event = body.event;
      await loadEvents();
      if (!selectedId && event) {
        const posterToUpload = pendingPoster;
        setSelectedId(event.id); await selectEvent(event);
        if (posterToUpload) { setPendingPoster(null); await uploadPoster(posterToUpload, event.id); }
        toast("Event draft created. You can now build the registration form.", { tone: "success" });
      } else {
        toast("Event settings saved.", { tone: "success" });
      }
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save the event.", { tone: "error" }); }
    finally { setSaving(false); }
  };

  const saveQuestions = async () => {
    if (!selectedId) { toast("Save the event draft first, then build its form.", { tone: "error" }); return; }
    const invalid = questions.find((q) => !String(q.label || "").trim() || (CHOICE_TYPES.has(q.type) && q.options.filter(Boolean).length < 1) || (GRID_TYPES.has(q.type) && ((q.settings.rows || []).filter(Boolean).length < 1 || (q.settings.columns || []).filter(Boolean).length < 1)));
    if (invalid) { toast("Every item needs a title; choices and grids need their options.", { tone: "error" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/reg/admin/events/${selectedId}/questions`, buildAuthRequestInit({
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questions.map((q) => ({ ...q, label: q.label.trim(), help_text: String(q.help_text || "").trim(), options: q.options.map((o) => o.trim()).filter(Boolean) })) }),
      }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Couldn't save the form.");
      setQuestions(body.questions || []);
      const configRes = await fetch(`/api/reg/admin/events/${selectedId}`, buildAuthRequestInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_config: formConfig }) }));
      const configBody = await configRes.json().catch(() => ({}));
      if (!configRes.ok) throw new Error(configBody?.error || "Questions were saved, but the form settings could not be saved.");
      toast("Registration form saved.", { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save the form.", { tone: "error" }); }
    finally { setSaving(false); }
  };

  const removeEvent = async () => {
    if (!selected) return;
    const ok = await confirm({ title: `Delete "${selected.title}"?`, body: "This permanently removes the event, its form and its registrations.", confirmLabel: "Delete event", tone: "danger" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/reg/admin/events/${selected.id}`, buildAuthRequestInit({ method: "DELETE" }));
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body?.error || "Couldn't delete the event.");
      startNew(); await loadEvents(); toast("Event deleted.", { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete the event.", { tone: "error" }); }
  };

  const downloadCsv = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/reg/admin/events/${selectedId}/registrations.csv`, buildAuthRequestInit());
      if (!res.ok) throw new Error("Couldn't export registrations.");
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `${selected?.slug || "event"}-registrations.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't export registrations.", { tone: "error" }); }
  };

  const deleteRegistration = async (id: number) => {
    const ok = await confirm({ title: "Delete this registration?", body: "This permanently removes the registration and its stored answers. This cannot be undone.", confirmLabel: "Delete registration", tone: "danger" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/reg/admin/registrations/${id}`, buildAuthRequestInit({ method: "DELETE" }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Couldn't delete the registration.");
      setRegistrations((current) => current.filter((row) => row.id !== id));
      toast("Registration deleted.", { tone: "success" });
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete the registration.", { tone: "error" }); }
  };

  const updatePayment = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/reg/admin/registrations/${id}`, buildAuthRequestInit({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_status: status }) }));
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body?.error || "Couldn't update payment.");
      setRegistrations((current) => current.map((row) => row.id === id ? { ...row, ...body.registration } : row));
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't update payment.", { tone: "error" }); }
  };

  const setQuestion = (index: number, patch: Partial<Question>) => setQuestions((current) => current.map((q, i) => i === index ? { ...q, ...patch } : q));
  const moveQuestion = (index: number, direction: -1 | 1) => { const next = index + direction; if (next < 0 || next >= questions.length) return; const copy = [...questions]; [copy[index], copy[next]] = [copy[next], copy[index]]; setQuestions(copy); };
  const addQuestion = (type: QuestionType = "short_text") => setQuestions((current) => [...current, blankQuestion(type)]);

  // These hooks must run on every render, including the non-admin render.
  // Keeping them below the admin early-return would change the hook order
  // when the auth state resolves from a non-admin to an admin user.
  const pendingPosterPreview = useMemo(() => pendingPoster ? URL.createObjectURL(pendingPoster) : "", [pendingPoster]);
  useEffect(() => () => {
    if (pendingPosterPreview) URL.revokeObjectURL(pendingPosterPreview);
  }, [pendingPosterPreview]);
  const posterPreview = pendingPosterPreview || selected?.poster_url || "";

  if (!isAdmin) return null;

  return <>
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-3 sm:px-6 sm:py-4">
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-maroon shadow-sm transition hover:-translate-y-0.5 hover:border-brand-maroon hover:bg-brand-maroon hover:text-white">
        <Settings2 size={15} /> Manage Home feature
      </button>
    </div>

    <AnimatePresence>
      {open && <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-5">
        <motion.button type="button" aria-label="Close" className="absolute inset-0 bg-stone-950/65 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
        <motion.div initial={{ opacity: 0, y: 20, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .99 }} className="relative flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.6rem] bg-[#fffdfc] shadow-2xl sm:rounded-[2rem]">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-brand-maroon/10 px-4 py-4 sm:px-7 sm:py-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-maroon/55">Home feature</p><h2 className="mt-1 font-serif text-2xl font-light text-brand-maroon sm:text-3xl">Manage Home feature</h2></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-brand-maroon/10 bg-white p-2.5 text-brand-maroon hover:bg-brand-maroon hover:text-white"><X size={17} /></button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="border-b border-brand-maroon/10 bg-brand-cream/35 p-3 sm:p-4 lg:border-b-0 lg:border-r lg:p-5">
              <button type="button" onClick={startNew} className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-maroon px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white"><Plus size={15} /> New event</button>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(96vh-145px)] lg:space-y-2 lg:overflow-y-auto">
                {loadingEvents ? <p className="px-2 py-4 text-sm text-stone-500">Loading events…</p> : events.length === 0 ? <p className="px-2 py-4 text-sm leading-6 text-stone-500">No registration events yet. Create your first event.</p> : events.map((event) => <button key={event.id} type="button" onClick={() => selectEvent(event)} className={`min-w-[210px] rounded-2xl border p-3 text-left transition lg:min-w-0 ${selectedId === event.id ? "border-brand-maroon bg-white shadow-sm" : "border-transparent bg-white/45 hover:border-brand-maroon/10 hover:bg-white"}`}>
                  <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 font-serif text-[15px] font-semibold text-brand-maroon">{event.title}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${event.status === "published" ? "bg-emerald-50 text-emerald-700" : event.status === "closed" ? "bg-stone-100 text-stone-500" : "bg-amber-50 text-amber-700"}`}>{event.status}</span></div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-brand-maroon/50"><span className="flex items-center gap-1"><Users size={11} /> {event.registration_count ?? 0}</span><span className="flex items-center gap-1"><Pencil size={10} /> Edit</span></div>
                </button>)}
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {!selectedId && <div className="mb-5 rounded-[1.4rem] border border-brand-maroon/10 bg-brand-cream/50 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-maroon/55">Start here</p><h3 className="mt-1 font-serif text-xl text-brand-maroon">Create your event announcement</h3><p className="mt-2 text-sm leading-6 text-stone-600">Choose whether this Home feature is an event or a special-day poster, then add the content visitors should see.</p></div>}

              <div className="mb-6 flex flex-wrap gap-2 border-b border-brand-maroon/10 pb-3">
                {[["event", "Event details"], ["form", "Registration form"], ["registrations", `Registrations (${registrations.length})`]].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value as typeof tab)} disabled={!selectedId || String(draft.registration_url || "").trim().length > 0 || (draft.home_feature_type === "special_day" && value !== "event")} className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition ${tab === value ? "bg-brand-maroon text-white" : "bg-brand-cream text-brand-maroon hover:bg-brand-maroon/10"} disabled:cursor-not-allowed disabled:opacity-35`}>{label}</button>)}
              </div>

              {tab === "event" && <div className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                  <div className="space-y-5">
                    <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="form-builder-label">Basic information</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Field label="Home feature type">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button type="button" onClick={() => setDraft({ ...draft, home_feature_type: "event", registration_enabled: draft.registration_enabled })} className={`rounded-2xl border p-3 text-left transition ${draft.home_feature_type === "event" ? "border-brand-maroon bg-brand-cream/35" : "border-brand-maroon/10 bg-white hover:bg-brand-cream/20"}`}><span className="block text-sm font-semibold text-brand-maroon">Upcoming event</span><span className="mt-1 block text-xs leading-5 text-stone-500">Event details, registration and payment.</span></button>
                            <button type="button" onClick={() => setDraft({ ...draft, home_feature_type: "special_day", registration_enabled: false, payment_mode: "none" })} className={`rounded-2xl border p-3 text-left transition ${draft.home_feature_type === "special_day" ? "border-brand-maroon bg-brand-cream/35" : "border-brand-maroon/10 bg-white hover:bg-brand-cream/20"}`}><span className="block text-sm font-semibold text-brand-maroon">Special day / celebration</span><span className="mt-1 block text-xs leading-5 text-stone-500">Poster-first Home feature with no registration.</span></button>
                          </div>
                        </Field>
                        <Field label={draft.home_feature_type === "special_day" ? "Internal title" : "Event name"}><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="admin-input" placeholder={draft.home_feature_type === "special_day" ? "Engineers' Day 2026" : "Siddhi 5.0"} /></Field>
                        {draft.home_feature_type !== "special_day" && <Field label="Short announcement"><input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} className="admin-input" placeholder="A short line visitors can read before the details." /></Field>}
                        {draft.home_feature_type !== "special_day" && <Field label="Description"><textarea rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="admin-input resize-y" placeholder="Optional. Add only information that is not already clear from the poster." /></Field>}
                        {draft.home_feature_type === "special_day" && <Field label="Home message (optional)"><input value={draft.home_message} onChange={(e) => setDraft({ ...draft, home_message: e.target.value })} className="admin-input" placeholder="Wishing you a Happy Engineers' Day from the Ikshana family." /></Field>}
                        {draft.home_feature_type === "special_day" && selectedId && <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-brand-cream/25 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="form-builder-label">Home poster collection</p><p className="mt-1 text-xs leading-5 text-stone-500">Add one or more celebration posters. They rotate automatically on Home; visitors can also use the arrows and dots.</p></div><button type="button" onClick={() => slideFileRef.current?.click()} disabled={posterUploading} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-brand-maroon px-4 text-[9px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"><ImagePlus size={14} /> Add posters</button><input ref={slideFileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => { const files = Array.from(e.target.files || []); if (files.length) await uploadHomeSlides(files); e.currentTarget.value = ""; }} /></div>{homeSlides.length === 0 ? <p className="mt-4 text-xs text-stone-500">Your main poster will be used automatically until you add more posters.</p> : <div className="mt-4 space-y-3">{homeSlides.map((slide, index) => <div key={`${slide.poster_url}-${index}`} className="rounded-2xl border border-brand-maroon/10 bg-white p-3"><div className="flex gap-3"><img src={slide.poster_url} alt="" className="h-24 w-16 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-[0.15em] text-brand-maroon/60">Poster {index + 1}</span><div className="flex items-center gap-1"><button type="button" aria-label="Move poster left" onClick={() => setHomeSlides((current) => { const next = index - 1; if (next < 0) return current; const copy=[...current]; [copy[index],copy[next]]=[copy[next],copy[index]]; return copy; })} className="rounded-lg p-1.5 text-brand-maroon hover:bg-brand-cream disabled:opacity-30" disabled={index===0}><ArrowLeft size={13}/></button><button type="button" aria-label="Move poster right" onClick={() => setHomeSlides((current) => { const next = index + 1; if (next >= current.length) return current; const copy=[...current]; [copy[index],copy[next]]=[copy[next],copy[index]]; return copy; })} className="rounded-lg p-1.5 text-brand-maroon hover:bg-brand-cream disabled:opacity-30" disabled={index===homeSlides.length-1}><ArrowRight size={13}/></button><button type="button" onClick={() => removeHomeSlide(index)} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"><Trash2 size={13}/></button></div></div><input value={slide.message || ""} onChange={(e) => updateHomeSlide(index, { message: e.target.value })} onBlur={() => saveHomeSlides(homeSlides)} className="admin-input mt-2" placeholder="Optional message for this poster" /></div></div></div>)}<button type="button" onClick={() => saveHomeSlides(homeSlides)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-4 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-maroon"><Save size={13}/> Save poster order & messages</button></div>}</div>}
                      </div>
                    </div>

                    {draft.home_feature_type !== "special_day" && <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5">
                      <p className="form-builder-label">When & where</p>
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Start date"><input type="date" value={datePart(draft.starts_at)} onChange={(e) => setDraft({ ...draft, starts_at: combineDateTime(e.target.value, timePart(draft.starts_at)) })} className="admin-input" /></Field>
                          <Field label="Start time (optional)"><input type="time" value={timePart(draft.starts_at)} disabled={formConfig.show_time === false} onChange={(e) => setDraft({ ...draft, starts_at: combineDateTime(datePart(draft.starts_at), e.target.value) })} className="admin-input disabled:cursor-not-allowed disabled:opacity-45" /></Field>
                          <Field label="End date (optional)"><input type="date" value={datePart(draft.ends_at)} onChange={(e) => setDraft({ ...draft, ends_at: combineDateTime(e.target.value, timePart(draft.ends_at)) })} className="admin-input" /></Field>
                          <Field label="End time (optional)"><input type="time" value={timePart(draft.ends_at)} disabled={formConfig.show_time === false} onChange={(e) => setDraft({ ...draft, ends_at: combineDateTime(datePart(draft.ends_at), e.target.value) })} className="admin-input disabled:cursor-not-allowed disabled:opacity-45" /></Field>
                        </div>
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-maroon/10 bg-brand-cream/25 px-4 py-3">
                          <div><p className="text-sm font-semibold text-brand-maroon">Show time to visitors</p><p className="mt-0.5 text-xs leading-5 text-stone-500">Turn this off when the date is enough. The stored event date remains unchanged.</p></div>
                          <button type="button" role="switch" aria-checked={formConfig.show_time !== false} onClick={() => setFormConfig({ ...formConfig, show_time: formConfig.show_time === false })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${formConfig.show_time !== false ? "bg-brand-maroon" : "bg-stone-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${formConfig.show_time !== false ? "left-6" : "left-1"}`} /></button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Venue"><input value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} className="admin-input" placeholder="CMRIT / Auditorium / Online" /></Field>
                          <Field label="Capacity (optional)"><input type="number" min="1" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} className="admin-input" placeholder="Unlimited" /></Field>
                        </div>
                      </div>
                    </div>}

                    {draft.home_feature_type !== "special_day" && <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div><p className="form-builder-label">Payment</p><p className="mt-1 text-xs leading-5 text-stone-500">If the fee is ₹0, no payment step is shown to visitors.</p></div>
                        {Number(draft.fee_amount || 0) > 0 && <span className="rounded-full bg-brand-cream px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-maroon">Paid event</span>}
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Registration fee (₹)"><input type="number" min="0" value={draft.fee_amount} onChange={(e) => { const value = e.target.value; setDraft({ ...draft, fee_amount: value, payment_mode: Number(value || 0) > 0 && draft.payment_mode === "none" ? "upi" : draft.payment_mode }); }} className="admin-input" /></Field>
                        <Field label="Payment collection"><select value={Number(draft.fee_amount || 0) > 0 ? draft.payment_mode : "none"} disabled={Number(draft.fee_amount || 0) <= 0} onChange={(e) => setDraft({ ...draft, payment_mode: e.target.value as any })} className="admin-input disabled:bg-brand-cream/35"><option value="none">No payment</option><option value="upi">UPI / UTR — manual verification</option><option value="razorpay">Razorpay — automatic payment</option></select></Field>
                        <Field label="Fee note"><input value={draft.fee_note} onChange={(e) => setDraft({ ...draft, fee_note: e.target.value })} className="admin-input" placeholder="Optional — e.g. Includes event kit" /></Field>
                        <div className="rounded-2xl bg-brand-cream/45 p-3 text-xs leading-5 text-stone-600">{Number(draft.fee_amount || 0) <= 0 ? "Free event: visitors go straight from registration to the success screen." : draft.payment_mode === "razorpay" ? "Razorpay: visitors pay immediately after submitting the form; payment is verified automatically." : "UPI: visitors see the QR/UPI details after registration and submit their UTR. You verify it from Registrations."}</div>
                      </div>
                    </div>}

                    <div className={`grid gap-3 ${draft.home_feature_type === "special_day" ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
                      <Toggle label="Show on Home page" description={draft.home_feature_type === "special_day" ? "Use this as the single featured special-day poster on Home." : "Use this as the single upcoming-event announcement on Home."} checked={draft.show_on_home} onChange={(checked) => setDraft({ ...draft, show_on_home: checked })} />
                      {draft.home_feature_type !== "special_day" && <Toggle label="Registration open" description="Show Register and accept new submissions." checked={draft.registration_enabled} onChange={(checked) => setDraft({ ...draft, registration_enabled: checked })} />}
                    </div>

                    {draft.home_feature_type !== "special_day" && <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-4"><div><p className="form-builder-label">Registration method</p><p className="mt-1 text-xs leading-5 text-stone-500">Choose the Ikshana form or send visitors to an external registration page.</p></div><span className="rounded-full bg-brand-cream px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-maroon">{String(draft.registration_url || "").trim() ? "External" : "Ikshana form"}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setDraft({ ...draft, registration_url: "", registration_link_label: "" })} className={`rounded-2xl border p-4 text-left transition ${!String(draft.registration_url || "").trim() ? "border-brand-maroon bg-brand-cream/35" : "border-brand-maroon/10 bg-white"}`}><span className="block text-sm font-semibold text-brand-maroon">Ikshana registration form</span><span className="mt-1 block text-xs leading-5 text-stone-500">Use the built-in Google-Forms-style form.</span></button><button type="button" onClick={() => setDraft({ ...draft, registration_url: draft.registration_url || "https://" })} className={`rounded-2xl border p-4 text-left transition ${String(draft.registration_url || "").trim() ? "border-brand-maroon bg-brand-cream/35" : "border-brand-maroon/10 bg-white"}`}><span className="block text-sm font-semibold text-brand-maroon">External registration link</span><span className="mt-1 block text-xs leading-5 text-stone-500">Use Google Forms, Microsoft Forms, a partner site, or another registration page.</span></button></div>{String(draft.registration_url || "").trim() && <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Registration link"><input value={draft.registration_url} onChange={(e) => setDraft({ ...draft, registration_url: e.target.value })} className="admin-input" placeholder="https://forms.google.com/..." /></Field><Field label="Button text"><input value={draft.registration_link_label} onChange={(e) => setDraft({ ...draft, registration_link_label: e.target.value })} className="admin-input" placeholder="Register for this event" /></Field></div>}</div>}

                    <div className="rounded-[1.4rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5">
                      <p className="form-builder-label">Publishing{draft.home_feature_type !== "special_day" ? " & contact" : ""}</p>
                      <div className={`mt-4 grid gap-4 ${draft.home_feature_type === "special_day" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                        <Field label="Publishing"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EventRecord["status"] })} className="admin-input"><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></Field>
                        {draft.home_feature_type !== "special_day" && <><Field label="Contact email"><input value={draft.contact_email} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} className="admin-input" placeholder="events@ikshana.org" /></Field><Field label="Contact phone"><input value={draft.contact_phone} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} className="admin-input" placeholder="Optional" /></Field></>}
                      </div>
                    </div>
                  </div>

                  <div className="xl:sticky xl:top-0 xl:self-start">
                    <div className="overflow-hidden rounded-[1.5rem] border border-brand-maroon/10 bg-white shadow-sm">
                      <div className="border-b border-brand-maroon/10 bg-brand-cream/30 px-4 py-3">
                        <p className="form-builder-label">Primary poster</p>
                      </div>
                      <div className="flex min-h-[330px] items-center justify-center bg-[#fffaf8] p-4 sm:min-h-[430px]">{posterPreview ? <img src={posterPreview} alt="Event poster preview" className="max-h-[430px] w-full rounded-2xl object-contain" /> : <div className="text-center text-brand-maroon/30"><ImagePlus className="mx-auto" size={40} /><p className="mt-2 text-xs">Choose a poster</p></div>}</div>
                      <div className="border-t border-brand-maroon/10 p-4">
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={posterUploading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-maroon px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"><ImagePlus size={15} /> {posterUploading ? "Uploading…" : selectedId ? "Replace poster" : "Choose poster"}</button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPoster(f); e.currentTarget.value = ""; }} />
                        {pendingPoster && <p className="mt-2 text-center text-xs leading-5 text-stone-500">Poster selected. It will upload automatically when you create the event draft.</p>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-brand-maroon/10 pt-5">
                  <button type="button" onClick={saveEvent} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-maroon px-6 text-[10px] font-bold uppercase tracking-[0.15em] text-white shadow-sm disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : selectedId ? (draft.home_feature_type === "special_day" ? "Save poster feature" : "Save event") : (draft.home_feature_type === "special_day" ? "Create poster feature" : "Create event draft")}</button>
                  {selectedId && <button type="button" onClick={removeEvent} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-200 px-5 text-[10px] font-bold uppercase tracking-[0.15em] text-red-700 hover:bg-red-50"><Trash2 size={15} /> Delete</button>}
                  {!selectedId && <span className="self-center text-xs text-stone-500">After saving, you can publish the Home feature and, for events, build the registration form.</span>}
                </div>
              </div>}

              {tab === "form" && <FormBuilder selectedId={selectedId} questions={questions} saving={saving} loading={loadingDetails} setQuestion={setQuestion} moveQuestion={moveQuestion} addQuestion={addQuestion} setQuestions={setQuestions} saveQuestions={saveQuestions} formConfig={formConfig} setFormConfig={setFormConfig} />}

              {tab === "registrations" && selectedId && <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-maroon/55">Live registrations</p><h3 className="mt-1 font-serif text-2xl text-brand-maroon">{registrations.length} people</h3></div><button type="button" onClick={downloadCsv} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-maroon"><Download size={15} /> Export CSV</button></div>{loadingDetails ? <p className="text-sm text-stone-500">Loading…</p> : registrations.length === 0 ? <div className="rounded-2xl border border-dashed border-brand-maroon/15 p-8 text-center text-sm text-stone-500">No registrations yet.</div> : <div className="overflow-x-auto rounded-2xl border border-brand-maroon/10"><table className="min-w-[820px] w-full text-left text-sm"><thead className="bg-brand-cream text-[10px] font-bold uppercase tracking-wider text-brand-maroon/60"><tr><th className="px-4 py-3">Registrant</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Registered</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-brand-maroon/10">{registrations.map((row) => <tr key={row.id}><td className="px-4 py-4"><div className="font-medium text-brand-maroon">{row.full_name}</div><div className="mt-1 text-xs text-stone-500">{row.registration_code}</div></td><td className="px-4 py-4 text-stone-600">{row.email}<br />{row.phone || "—"}</td><td className="px-4 py-4 text-xs text-stone-500">{new Date(row.created_at).toLocaleString("en-IN")}</td><td className="px-4 py-4"><span className="rounded-full bg-brand-cream px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-maroon">{row.payment_status}</span>{row.payment_reference && <div className="mt-2 text-xs text-stone-500">Ref: {row.payment_reference}</div>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{row.payment_status === "submitted" && <><button type="button" onClick={() => updatePayment(row.id, "verified")} className="rounded-full bg-emerald-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white"><Check size={12} className="mr-1 inline" />Verify</button><button type="button" onClick={() => updatePayment(row.id, "rejected")} className="rounded-full border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700">Reject</button></>}<button type="button" onClick={() => deleteRegistration(row.id)} className="rounded-full border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700"><Trash2 size={12} className="mr-1 inline" />Delete</button></div></td></tr>)}</tbody></table></div>}</div>}
            </main>
          </div>
        </motion.div>
      </div>}
    </AnimatePresence>

    <style>{`.admin-input{width:100%;border-radius:1rem;border:1px solid rgba(122,31,45,.12);background:#fff;padding:.72rem .9rem;font-size:.9rem;line-height:1.35rem;color:#4a3937;outline:none}.admin-input:focus{border-color:rgba(122,31,45,.45);box-shadow:0 0 0 3px rgba(122,31,45,.07)}.form-builder-label{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(122,31,45,.55)}`}</style>
  </>;
}

function FormBuilder({ selectedId, questions, saving, loading, setQuestion, moveQuestion, addQuestion, setQuestions, saveQuestions, formConfig, setFormConfig }: any) {
  if (!selectedId) return <div className="rounded-[1.5rem] border border-dashed border-brand-maroon/15 bg-brand-cream/30 p-8 text-center"><FileText className="mx-auto text-brand-maroon/35" size={32} /><h3 className="mt-3 font-serif text-xl text-brand-maroon">Save the event draft first</h3><p className="mt-2 text-sm leading-6 text-stone-500">Once the draft exists, this tab becomes the full form builder.</p></div>;
  return <div className="space-y-5">
    <div className="rounded-2xl border border-brand-maroon/10 bg-brand-cream/50 p-4 text-sm leading-6 text-stone-600">Build a flexible registration form with text, choices, file uploads, scales, ratings, grids, date/time, validation, required fields, sections and conditional questions. The visitor sees the same order and the same Ikshana styling.</div>
    <div className="rounded-[1.5rem] border border-brand-maroon/10 bg-white p-4 shadow-sm sm:p-5"><p className="form-builder-label">After submission</p><div className="mt-2"><RichTextEditor value={String(formConfig?.confirmation_message || "")} onChange={(value) => setFormConfig({ ...formConfig, confirmation_message: value })} placeholder="Thank you. Your registration has been received." /></div><p className="mt-2 text-xs leading-5 text-stone-500">This message appears after a successful registration. The Ikshana website theme is always used automatically.</p></div>
    {loading && <p className="text-sm text-stone-500">Loading form…</p>}
    <div className="space-y-4">{questions.map((q: Question, index: number) => <QuestionEditor key={q.id ?? `new-${index}`} selectedId={selectedId} question={q} index={index} questions={questions} setQuestion={setQuestion} moveQuestion={moveQuestion} setQuestions={setQuestions} />)}</div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => addQuestion()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-maroon"><Plus size={15} /> Add question</button><button type="button" onClick={() => addQuestion("section")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-maroon"><Plus size={15} /> Add section</button><button type="button" onClick={saveQuestions} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-maroon px-6 text-[10px] font-bold uppercase tracking-[0.14em] text-white disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : "Save form"}</button></div>
  </div>;
}

function QuestionEditor({ selectedId, question: q, index, questions, setQuestion, moveQuestion, setQuestions }: any) {
  const choice = CHOICE_TYPES.has(q.type); const grid = GRID_TYPES.has(q.type); const section = q.type === "section";
  const patchSettings = (patch: QuestionSettings) => setQuestion(index, { settings: { ...(q.settings || {}), ...patch } });
  const addArrayItem = (key: "options" | "rows" | "columns") => { const current = key === "options" ? q.options : (q.settings?.[key] || []); const next = [...current, ""]; key === "options" ? setQuestion(index, { options: next }) : patchSettings({ [key]: next }); };
  const removeArrayItem = (key: "options" | "rows" | "columns", i: number) => { const current = key === "options" ? q.options : (q.settings?.[key] || []); const next = current.filter((_: string, n: number) => n !== i); key === "options" ? setQuestion(index, { options: next }) : patchSettings({ [key]: next }); };
  const changeArrayItem = (key: "options" | "rows" | "columns", i: number, value: string) => { const current = key === "options" ? q.options : (q.settings?.[key] || []); const next = current.map((v: string, n: number) => n === i ? value : v); key === "options" ? setQuestion(index, { options: next }) : patchSettings({ [key]: next }); };

  return <div className={`rounded-[1.5rem] border p-4 shadow-sm sm:p-5 ${section ? "border-brand-maroon/20 bg-brand-cream/40" : "border-brand-maroon/10 bg-white"}`}>
    <div className="flex items-start gap-3"><div className="mt-1 flex flex-col gap-1"><button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} className="rounded-full p-1 text-brand-maroon disabled:opacity-20"><ChevronUp size={15} /></button><button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} className="rounded-full p-1 text-brand-maroon disabled:opacity-20"><ChevronDown size={15} /></button></div><div className="min-w-0 flex-1 space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]"><RichTextEditor value={q.label} onChange={(value) => setQuestion(index, { label: value })} placeholder={section ? "Section title" : "Question title"} compact /><select value={q.type} onChange={(e) => setQuestion(index, { type: e.target.value as QuestionType, options: CHOICE_TYPES.has(e.target.value as QuestionType) ? (q.options?.length ? q.options : ["Option 1", "Option 2"]) : [], settings: blankQuestion(e.target.value as QuestionType).settings })} className="admin-input">{QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      <RichTextEditor value={String(q.help_text || "")} onChange={(value) => setQuestion(index, { help_text: value })} placeholder={section ? "Section description (optional)" : "Description / help text (optional)"} />

      <QuestionMediaEditor selectedId={selectedId} settings={q.settings || {}} onChange={patchSettings} />

      {choice && <div className="space-y-2"><p className="form-builder-label">Options</p>{q.options.map((o: string, i: number) => <div key={i} className="flex gap-2"><input value={o} onChange={(e) => changeArrayItem("options", i, e.target.value)} className="admin-input" placeholder={`Option ${i + 1}`} /><button type="button" onClick={() => removeArrayItem("options", i)} className="rounded-xl border border-stone-200 px-3 text-stone-500"><Trash2 size={14} /></button></div>)}<button type="button" onClick={() => addArrayItem("options")} className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-maroon">+ Add option</button><label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={Boolean(q.settings?.allow_other)} onChange={(e) => patchSettings({ allow_other: e.target.checked })} className="accent-brand-maroon" /> Allow “Other”</label></div>}

      {grid && <div className="grid gap-4 sm:grid-cols-2"><ArrayEditor title="Rows" values={q.settings?.rows || []} onAdd={() => addArrayItem("rows")} onRemove={(i) => removeArrayItem("rows", i)} onChange={(i, v) => changeArrayItem("rows", i, v)} /><ArrayEditor title="Columns" values={q.settings?.columns || []} onAdd={() => addArrayItem("columns")} onRemove={(i) => removeArrayItem("columns", i)} onChange={(i, v) => changeArrayItem("columns", i, v)} /><label className="flex items-center gap-2 text-sm text-stone-600 sm:col-span-2"><input type="checkbox" checked={Boolean(q.settings?.require_each_row)} onChange={(e) => patchSettings({ require_each_row: e.target.checked })} className="accent-brand-maroon" /> Require a response for every row</label></div>}

      {q.type === "linear_scale" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Minimum"><input type="number" value={q.settings?.min ?? 1} onChange={(e) => patchSettings({ min: Number(e.target.value) })} className="admin-input" /></Field><Field label="Maximum"><input type="number" value={q.settings?.max ?? 5} onChange={(e) => patchSettings({ max: Number(e.target.value) })} className="admin-input" /></Field><Field label="Min label"><input value={q.settings?.min_label || ""} onChange={(e) => patchSettings({ min_label: e.target.value })} className="admin-input" /></Field><Field label="Max label"><input value={q.settings?.max_label || ""} onChange={(e) => patchSettings({ max_label: e.target.value })} className="admin-input" /></Field></div>}
      {q.type === "rating" && <div className="max-w-[180px]"><Field label="Rating scale"><select value={q.settings?.max ?? 5} onChange={(e) => patchSettings({ max: Number(e.target.value) })} className="admin-input">{[3,4,5,6,7,8,9,10].map((n) => <option key={n}>{n}</option>)}</select></Field></div>}
      {q.type === "file_upload" && <div className="grid gap-3 sm:grid-cols-3"><Field label="Max files"><input type="number" min="1" max="10" value={q.settings?.max_files ?? 1} onChange={(e) => patchSettings({ max_files: Number(e.target.value) })} className="admin-input" /></Field><Field label="Max size (MB)"><input type="number" min="1" max="25" value={q.settings?.max_size_mb ?? 10} onChange={(e) => patchSettings({ max_size_mb: Number(e.target.value) })} className="admin-input" /></Field><Field label="Allowed types"><input value={(q.settings?.allowed_file_types || []).join(", ")} onChange={(e) => patchSettings({ allowed_file_types: e.target.value.split(",").map((v: string) => v.trim()).filter(Boolean) })} className="admin-input" placeholder="image/*, application/pdf" /></Field></div>}
      {q.type === "number" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Minimum"><input type="number" value={q.settings?.validation?.min ?? ""} onChange={(e) => patchSettings({ validation: { ...(q.settings?.validation || {}), min: e.target.value === "" ? undefined : Number(e.target.value) } })} className="admin-input" /></Field><Field label="Maximum"><input type="number" value={q.settings?.validation?.max ?? ""} onChange={(e) => patchSettings({ validation: { ...(q.settings?.validation || {}), max: e.target.value === "" ? undefined : Number(e.target.value) } })} className="admin-input" /></Field></div>}
      {(q.type === "short_text" || q.type === "paragraph" || q.type === "email" || q.type === "phone") && <div className="grid gap-3 sm:grid-cols-2"><Field label="Validation"><select value={q.settings?.validation?.rule || ""} onChange={(e) => patchSettings({ validation: { ...(q.settings?.validation || {}), rule: e.target.value } })} className="admin-input"><option value="">No extra validation</option><option value="min_length">Minimum length</option><option value="max_length">Maximum length</option><option value="contains">Must contain</option><option value="not_contains">Must not contain</option></select></Field>{q.settings?.validation?.rule && <Field label="Rule value"><input value={q.settings?.validation?.value || ""} onChange={(e) => patchSettings({ validation: { ...(q.settings?.validation || {}), value: e.target.value } })} className="admin-input" /></Field>}</div>}

      {!section && <div className="flex flex-wrap items-center gap-x-5 gap-y-3"><label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={q.required} onChange={(e) => setQuestion(index, { required: e.target.checked })} className="accent-brand-maroon" /> Required</label><details className="text-sm text-stone-600"><summary className="cursor-pointer list-none inline-flex items-center gap-2"><Settings2 size={14} /> Conditional display</summary><div className="mt-3 grid gap-2 rounded-xl bg-brand-cream/50 p-3 sm:grid-cols-[1fr_160px_1fr]"><select value={q.settings?.show_if?.question_id || ""} onChange={(e) => patchSettings({ show_if: { ...(q.settings?.show_if || {}), question_id: e.target.value ? Number(e.target.value) : undefined } })} className="admin-input"><option value="">Always show</option>{questions.filter((x: Question) => x.id && x.id !== q.id && x.type !== "section").map((x: Question) => <option key={x.id} value={x.id}>{x.label}</option>)}</select><select value={q.settings?.show_if?.operator || "equals"} onChange={(e) => patchSettings({ show_if: { ...(q.settings?.show_if || {}), operator: e.target.value as any } })} className="admin-input"><option value="equals">equals</option><option value="not_equals">does not equal</option></select><input value={q.settings?.show_if?.value || ""} onChange={(e) => patchSettings({ show_if: { ...(q.settings?.show_if || {}), value: e.target.value } })} className="admin-input" placeholder="Answer" /></div></details></div>}
    </div><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => setQuestions((current: Question[]) => { const copy = [...current]; copy.splice(index + 1, 0, { ...q, id: undefined, label: q.label ? `${q.label} (copy)` : "", options: [...(q.options || [])], settings: { ...(q.settings || {}) } }); return copy; })} title="Duplicate" className="rounded-full p-2 text-stone-400 hover:bg-brand-cream hover:text-brand-maroon"><FileText size={15} /></button><button type="button" onClick={() => setQuestions((current: Question[]) => current.filter((_, i) => i !== index))} title="Delete" className="rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></div></div>
  </div>;
}


function RichTextEditor({ value, onChange, placeholder, compact = false }: { value: string; onChange: (value: string) => void; placeholder: string; compact?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const apply = (kind: "bold" | "italic" | "underline" | "bullet" | "number") => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let replacement = selected;
    if (kind === "bold") replacement = selected ? `**${selected}**` : "**bold text**";
    if (kind === "italic") replacement = selected ? `*${selected}*` : "*italic text*";
    if (kind === "underline") replacement = selected ? `__${selected}__` : "__underlined text__";
    if (kind === "bullet") replacement = selected ? selected.split("\n").map((line) => `- ${line}`).join("\n") : "- List item";
    if (kind === "number") replacement = selected ? selected.split("\n").map((line, i) => `${i + 1}. ${line}`).join("\n") : "1. List item";
    const next = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => { el.focus(); const cursor = start + replacement.length; el.setSelectionRange(cursor, cursor); });
  };
  return <div className="overflow-hidden rounded-2xl border border-brand-maroon/10 bg-white focus-within:border-brand-maroon/35 focus-within:ring-2 focus-within:ring-brand-maroon/5">
    <div className="flex flex-wrap items-center gap-1 border-b border-brand-maroon/10 bg-brand-cream/35 px-2 py-1.5">
      <button type="button" onClick={() => apply("bold")} title="Bold" className="rounded-lg px-2 py-1 text-sm font-bold text-brand-maroon hover:bg-white">B</button>
      <button type="button" onClick={() => apply("italic")} title="Italic" className="rounded-lg px-2 py-1 text-sm italic text-brand-maroon hover:bg-white">I</button>
      <button type="button" onClick={() => apply("underline")} title="Underline" className="rounded-lg px-2 py-1 text-sm underline text-brand-maroon hover:bg-white">U</button>
      <button type="button" onClick={() => apply("bullet")} title="Bulleted list" className="rounded-lg px-2 py-1 text-sm text-brand-maroon hover:bg-white">•</button>
      <button type="button" onClick={() => apply("number")} title="Numbered list" className="rounded-lg px-2 py-1 text-sm text-brand-maroon hover:bg-white">1.</button>
      {!compact && <span className="ml-auto px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-brand-maroon/40">Basic formatting</span>}
    </div>
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={compact ? 2 : 3} className="block w-full resize-y border-0 px-3 py-2.5 text-sm leading-6 text-stone-700 outline-none" placeholder={placeholder} />
  </div>;
}

function QuestionMediaEditor({ selectedId, settings, onChange }: { selectedId: number; settings: QuestionSettings; onChange: (patch: QuestionSettings) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch(`/api/reg/admin/events/${selectedId}/question-image`, buildAuthRequestInit({ method: "POST", body: form }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Question image upload failed.");
      onChange({ image_url: body.image_url });
    } catch (e) { alert(e instanceof Error ? e.message : "Question image upload failed."); }
    finally { setUploading(false); }
  };
  return <div className="rounded-2xl border border-brand-maroon/10 bg-brand-cream/25 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="form-builder-label">Question media</p><label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-brand-maroon"> <ImagePlus size={13} /> {uploading ? "Uploading…" : settings.image_url ? "Replace image" : "Add image"}<input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} /></label></div>
    {settings.image_url && <div className="mt-3 flex items-start gap-3"><img src={settings.image_url} alt="Question" className="h-20 w-28 rounded-xl object-cover" /><button type="button" onClick={() => onChange({ image_url: "" })} className="text-[9px] font-bold uppercase tracking-[0.12em] text-red-700">Remove</button></div>}
    <div className="mt-3"><input value={settings.video_url || ""} onChange={(e) => onChange({ video_url: e.target.value })} className="admin-input" placeholder="Optional YouTube video URL" /></div>
    {!settings.image_url && <p className="mt-2 text-[11px] leading-5 text-stone-500">Add an image to visually introduce this question or section. Images use the same website theme around them.</p>}
  </div>;
}

function ArrayEditor({ title, values, onAdd, onRemove, onChange }: any) { return <div><p className="form-builder-label mb-2">{title}</p><div className="space-y-2">{values.map((v: string, i: number) => <div key={i} className="flex gap-2"><input value={v} onChange={(e) => onChange(i, e.target.value)} className="admin-input" placeholder={`${title.slice(0,-1)} ${i + 1}`} /><button type="button" onClick={() => onRemove(i)} className="rounded-xl border border-stone-200 px-3 text-stone-500"><Trash2 size={14} /></button></div>)}</div><button type="button" onClick={onAdd} className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-maroon">+ Add {title.toLowerCase().slice(0, -1)}</button></div>; }

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-label text-brand-maroon/55">{label}</span>{children}</label>; }
function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-brand-maroon/10 bg-white p-4">
    <span className="min-w-0"><span className="block text-sm font-semibold text-brand-maroon">{label}</span><span className="mt-1 block text-xs leading-5 text-stone-500">{description}</span></span>
    <span className="flex shrink-0 items-center gap-2">
      <span className={`relative h-7 w-12 rounded-full p-1 transition ${checked ? "bg-brand-maroon" : "bg-stone-200"}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
      <span className={`w-7 text-right text-[9px] font-bold uppercase tracking-[0.12em] ${checked ? "text-brand-maroon" : "text-stone-400"}`}>{checked ? "On" : "Off"}</span>
    </span>
  </label>;
}
