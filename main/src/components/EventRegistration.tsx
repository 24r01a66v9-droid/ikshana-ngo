import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, FileUp, IndianRupee, Loader2, MapPin, QrCode, Ticket, Upload, Users } from "lucide-react";

type QuestionSettings = {
  allow_other?: boolean; min?: number; max?: number; min_label?: string; max_label?: string;
  max_files?: number; max_size_mb?: number; allowed_file_types?: string[];
  rows?: string[]; columns?: string[]; require_each_row?: boolean;
  validation?: { rule?: string; value?: string; min?: number; max?: number };
  show_if?: { question_id?: number; operator?: "equals" | "not_equals"; value?: string };
  image_url?: string; video_url?: string;
};

type Question = { id: number; label: string; help_text: string | null; type: string; options: string[]; required: boolean; position: number; settings?: QuestionSettings };
type EventRecord = { id: number; slug: string; title: string; summary: string | null; description: string | null; poster_url: string | null; starts_at: string | null; ends_at: string | null; venue: string | null; fee_amount: number; fee_note: string | null; status: "published" | "closed"; registration_enabled: boolean; capacity: number | null; contact_email?: string | null; contact_phone?: string | null; payment_mode?: "none" | "upi" | "razorpay"; form_config?: Record<string, any> };

type AnswerValue = string | string[] | Record<string, string | string[]>;

function formatWhen(startsAt: string | null, endsAt: string | null, showTime = true) {
  if (!startsAt) return null; const start = new Date(startsAt); if (Number.isNaN(start.getTime())) return null;
  const date = start.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (!showTime) return date;
  const time = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (endsAt) { const end = new Date(endsAt); if (!Number.isNaN(end.getTime()) && end.toDateString() === start.toDateString()) return `${date} · ${time}–${end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`; }
  return `${date} · ${time}`;
}

export default function EventRegistration() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const initialEvent = (location.state as any)?.featuredEvent as EventRecord | undefined;
  const [event, setEvent] = useState<EventRecord | null>(initialEvent || null); const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"form" | "payment" | "done">("form"); const [registrationCode, setRegistrationCode] = useState("");
  const [paymentMode, setPaymentMode] = useState<"none" | "upi" | "razorpay">("none");
  const [razorpayOrder, setRazorpayOrder] = useState<{ order_id: string; amount: number; currency: string; key_id: string } | null>(null);
  const [paymentReference, setPaymentReference] = useState(""); const [upiId, setUpiId] = useState(""); const [upiName, setUpiName] = useState(""); const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(!initialEvent); const [saving, setSaving] = useState(false); const [paymentSaving, setPaymentSaving] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eventRes = await fetch(`/api/reg/events/${encodeURIComponent(slug)}`);
        const body = await eventRes.json().catch(() => ({})); if (!eventRes.ok || !body?.event) throw new Error(body?.error || "Event not found.");
        if (!cancelled) { setEvent(body.event); setQuestions(Array.isArray(body.questions) ? body.questions : []); }
        // Payment settings are not needed to render the form. Load them only when
        // the visitor actually reaches the UPI payment step.
        if (!cancelled && initialEvent && body?.event?.id !== initialEvent.id) setEvent(body.event);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load this event."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const when = useMemo(() => formatWhen(event?.starts_at || null, event?.ends_at || null, event?.form_config?.show_time !== false), [event]);
  const fee = Number(event?.fee_amount || 0); const registrationOpen = Boolean(event?.status === "published" && event?.registration_enabled);
  const setAnswer = (id: number, value: AnswerValue) => setAnswers((current) => ({ ...current, [String(id)]: value }));

  const isVisible = (q: Question) => {
    const rule = q.settings?.show_if; if (!rule?.question_id) return true;
    const actual = answers[String(rule.question_id)]; const values = Array.isArray(actual) ? actual.map(String) : [String(actual ?? "")];
    return rule.operator === "not_equals" ? !values.includes(String(rule.value ?? "")) : values.includes(String(rule.value ?? ""));
  };

  const submitRegistration = async (e: FormEvent) => {
    e.preventDefault(); if (!event) return; setError(""); setSaving(true);
    try {
      const payload = { full_name: fullName, email, phone, answers: questions.filter(isVisible).filter((q) => q.type !== "section").map((q) => ({ question_id: q.id, value: answers[String(q.id)] ?? (q.type === "multi_choice" ? [] : q.type.includes("grid") ? {} : q.type === "file_upload" ? [] : "") })) };
      const res = await fetch(`/api/reg/events/${encodeURIComponent(event.slug)}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body?.error || "Couldn't complete registration.");
      setRegistrationCode(body.registration_code);
      setPaymentMode(body.payment_mode || (Number(body.payment_amount || 0) > 0 ? "upi" : "none"));
      setRazorpayOrder(body.razorpay || null);
      setStep(body.payment_status === "pending" ? "payment" : "done");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't complete registration."); }
    finally { setSaving(false); }
  };


  useEffect(() => {
    if (step !== "payment" || paymentMode !== "razorpay" || !razorpayOrder) return;
    let cancelled = false;
    const openCheckout = async () => {
      try {
        const scriptId = "razorpay-checkout-script";
        if (!document.getElementById(scriptId)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script"); script.id = scriptId; script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Unable to load the payment checkout.")); document.body.appendChild(script);
          });
        }
        if (cancelled) return;
        const Razorpay = (window as any).Razorpay;
        if (!Razorpay) throw new Error("Payment checkout is unavailable right now.");
        const checkout = new Razorpay({
          key: razorpayOrder.key_id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: "Ikshana Foundation",
          description: event?.title || "Event registration",
          order_id: razorpayOrder.order_id,
          theme: { color: "#7a1f2d" },
          prefill: { name: fullName, email, contact: phone },
          handler: async (response: any) => {
            try {
              setPaymentSaving(true); setError("");
              const verify = await fetch(`/api/reg/registrations/${encodeURIComponent(registrationCode)}/razorpay/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) });
              const body = await verify.json().catch(() => ({}));
              if (!verify.ok) throw new Error(body?.error || "Payment verification failed.");
              setStep("done");
            } catch (e) { setError(e instanceof Error ? e.message : "Payment verification failed."); }
            finally { setPaymentSaving(false); }
          },
          modal: { ondismiss: () => setError("Payment window closed. You can try again below.") },
        });
        checkout.open();
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to open payment checkout."); }
    };
    openCheckout();
    return () => { cancelled = true; };
  }, [step, paymentMode, razorpayOrder, registrationCode, fullName, email, phone, event?.title]);

  useEffect(() => {
    if (step !== "payment" || paymentMode !== "upi") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const s = (await res.json().catch(() => ({}))).settings || {};
        if (!cancelled) { setUpiId(String(s.donate_upi_id || "")); setUpiName(String(s.donate_upi_payee_name || "Ikshana Foundation")); setQrUrl(String(s.donate_qr_url || "")); }
      } catch { /* payment settings are optional until UPI is selected */ }
    })();
    return () => { cancelled = true; };
  }, [step, paymentMode]);

  const submitPayment = async () => {
    setError(""); if (paymentReference.trim().length < 4) { setError("Enter the transaction ID / UTR from your payment app."); return; }
    setPaymentSaving(true);
    try { const res = await fetch(`/api/reg/registrations/${encodeURIComponent(registrationCode)}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: paymentReference.trim() }) }); const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body?.error || "Couldn't submit the payment reference."); setStep("done"); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't submit the payment reference."); }
    finally { setPaymentSaving(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center bg-[#fffcfc] text-brand-maroon"><Loader2 className="animate-spin" /></div>;
  if (error && !event) return <div className="min-h-[60vh] bg-[#fffcfc] px-5 py-24 text-center"><p className="font-serif text-2xl text-brand-maroon">{error}</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-maroon px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-white"><ArrowLeft size={14} /> Back to Home</Link></div>;
  if (!event) return null;

  return <main className="min-h-screen bg-[#fffcfc] px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32">
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link to="/" className="group inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-maroon/10 bg-white px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-maroon shadow-sm transition hover:-translate-x-0.5 hover:border-brand-maroon/20 hover:bg-brand-cream/45"><ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to Home</Link>
        <span className="hidden max-w-[45%] truncate rounded-full bg-brand-cream px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-maroon sm:inline-flex">{event.title}</span>
      </div>

      {step === "form" && registrationOpen && <form onSubmit={submitRegistration} className="grid items-start gap-5 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <section className="hidden overflow-hidden rounded-[2rem] border border-brand-maroon/10 bg-white shadow-[0_24px_75px_-45px_rgba(122,31,45,.32)] lg:sticky lg:top-24 lg:block">
          {event.poster_url ? <div className="flex max-h-[500px] items-center justify-center bg-white p-4 sm:p-5"><img src={event.poster_url} alt={`Poster for ${event.title}`} className="max-h-[470px] w-full rounded-[1.3rem] object-contain" /></div> : <div className="flex h-44 items-center justify-center bg-brand-cream/40"><Ticket size={42} className="text-brand-maroon/25" /></div>}
          <div className="border-t border-brand-maroon/10 p-5 sm:p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-maroon px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white"><Ticket size={12} /> Registration open</span>
            <h1 className="mt-4 font-serif text-3xl font-light leading-tight text-brand-maroon">{event.title}</h1>
            {event.summary && <p className="mt-3 text-sm leading-6 text-stone-600">{event.summary}</p>}
            <div className="mt-5 space-y-2.5">
              {when && <Info icon={<CalendarDays size={16} />} label="When" value={when} />}
              {event.venue && <Info icon={<MapPin size={16} />} label="Where" value={event.venue} />}
              {fee > 0 && <Info icon={<IndianRupee size={16} />} label="Registration" value={`₹${fee.toLocaleString("en-IN")}`} />}
              {event.capacity && <Info icon={<Users size={16} />} label="Capacity" value={`${event.capacity} registrations`} />}
            </div>
            {(event.contact_email || event.contact_phone) && <div className="mt-4 border-t border-brand-maroon/10 pt-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-maroon/55">Contact</p><div className="mt-1.5 flex flex-col gap-1 text-xs"><a className="break-all font-medium text-brand-maroon hover:underline" href={event.contact_email ? `mailto:${event.contact_email}` : undefined}>{event.contact_email}</a>{event.contact_phone && <a className="font-medium text-brand-maroon hover:underline" href={`tel:${event.contact_phone}`}>{event.contact_phone}</a>}</div></div>}
          </div>
        </section>

        <section className="rounded-[2rem] border border-brand-maroon/10 bg-white p-5 shadow-[0_24px_75px_-45px_rgba(122,31,45,.25)] sm:p-8 lg:p-10">
          <div className="border-b border-brand-maroon/10 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-maroon/55">Registration form</p>
              <span className="rounded-full bg-brand-cream px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-maroon">Ikshana</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl font-light text-brand-maroon sm:text-3xl">Tell us a little about you</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Complete the details below. Required questions are marked with <span className="font-semibold text-brand-maroon">*</span>.</p>
          </div>

          <div className="mt-6 rounded-2xl bg-brand-cream/35 p-4 sm:p-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-maroon/55">Your details</p>
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required><input required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" /></Field>
              <Field label="Email" required><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" /></Field>
              <Field label="Phone"><input value={phone} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} className="form-input" /></Field>
            </div>
          </div>

          <div className="mt-7 space-y-5">
            {questions.map((q, index) => isVisible(q) ? <QuestionField key={q.id} question={q} index={index} value={answers[String(q.id)]} onChange={(value) => setAnswer(q.id, value)} slug={event.slug} /> : null)}
          </div>

          {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
          <div className="mt-8 flex flex-col gap-3 border-t border-brand-maroon/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-stone-500">{fee > 0 && (event.payment_mode || "upi") !== "none" ? `Registration fee: ₹${fee.toLocaleString("en-IN")}. Payment comes next.` : "Review your answers before submitting."}</p>
            <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-maroon px-7 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-lg shadow-brand-maroon/15 transition hover:-translate-y-0.5 hover:bg-stone-900 disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? "Submitting…" : fee > 0 && (event.payment_mode || "upi") !== "none" ? "Continue to payment" : "Complete registration"}<ArrowRight size={16} /></button>
          </div>
        </section>
      </form>}

      {step === "form" && !registrationOpen && <section className="mx-auto max-w-4xl rounded-[2rem] border border-brand-maroon/10 bg-white p-8 text-center shadow-sm sm:p-12"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-cream text-brand-maroon"><Ticket size={20} /></span><h1 className="mt-5 font-serif text-3xl text-brand-maroon">{event.title}</h1><p className="mt-3 text-sm text-stone-500">Registration is currently closed.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-maroon transition hover:bg-brand-maroon hover:text-white"><ArrowLeft size={14} /> Return home</Link></section>}

      {step === "payment" && <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-maroon/10 bg-white p-6 shadow-[0_24px_75px_-45px_rgba(122,31,45,.25)] sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-maroon text-white"><IndianRupee size={18} /></span><div><p className="text-label text-brand-maroon/55">Registration payment</p><h2 className="font-serif text-2xl text-brand-maroon">Complete your payment</h2></div></div><span className="rounded-full bg-brand-cream px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-maroon">{paymentMode === "razorpay" ? "Secure online payment" : "UPI payment"}</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-brand-cream/65 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-maroon/55">Registration ID</p><p className="mt-1 font-mono text-lg font-bold tracking-wider text-brand-maroon">{registrationCode}</p></div><div className="rounded-2xl bg-brand-cream/65 p-4"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-maroon/55">Amount due</p><p className="mt-1 font-serif text-2xl text-brand-maroon">₹{fee.toLocaleString("en-IN")}</p></div></div>
        {paymentMode === "razorpay" ? <div className="mt-6 rounded-[1.5rem] border border-brand-maroon/10 bg-[#fffcfc] p-5 sm:p-6"><p className="text-sm leading-6 text-stone-600">A secure Razorpay checkout will open automatically. Your registration is confirmed only after the payment is verified.</p><button type="button" disabled={paymentSaving || !razorpayOrder} onClick={() => { const button = document.querySelector<HTMLButtonElement>("[data-open-razorpay]"); button?.click(); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-maroon px-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50">{paymentSaving ? <Loader2 size={16} className="animate-spin" /> : null} Pay securely with Razorpay</button><RazorpayRetry order={razorpayOrder} registrationCode={registrationCode} fullName={fullName} email={email} phone={phone} eventTitle={event.title} onSuccess={() => setStep("done")} onError={setError} /></div> : <div className="mt-6 rounded-[1.5rem] border border-brand-maroon/10 bg-[#fffcfc] p-5 sm:p-6"><div className="grid gap-6 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">{qrUrl ? <img src={qrUrl} alt="UPI payment QR code" className="mx-auto h-[190px] w-[190px] rounded-2xl border border-brand-maroon/10 object-contain bg-white p-2" /> : <div className="mx-auto flex h-[190px] w-[190px] items-center justify-center rounded-2xl bg-brand-cream text-brand-maroon/35"><QrCode size={42} /></div>}<div className="text-sm text-stone-600"><p>Pay the exact amount using UPI.</p>{upiId && <p className="mt-2 rounded-xl bg-brand-cream/55 px-3 py-2 font-mono font-semibold text-brand-maroon">{upiId}</p>}<p className="mt-2">{upiName}</p>{event.fee_note && <p className="mt-3 text-xs leading-5 text-brand-maroon/65">{event.fee_note}</p>}<p className="mt-4 text-xs leading-5 text-stone-500">After paying, enter the transaction ID / UTR. Your registration is saved immediately and the Ikshana team verifies the payment.</p></div></div><label className="mt-6 block"><span className="text-label text-brand-maroon/55">Transaction ID / UTR *</span><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="form-input mt-1.5" placeholder="Enter the reference from your UPI app" /></label><button type="button" onClick={submitPayment} disabled={paymentSaving} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-maroon px-7 text-[10px] font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50">{paymentSaving && <Loader2 size={16} className="animate-spin" />} Submit payment reference <ArrowRight size={15} /></button></div>}
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p>}
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-maroon/60 hover:text-brand-maroon"><ArrowLeft size={14} /> Back to Home</Link>
      </section>}

      {step === "done" && <section className="mx-auto max-w-3xl rounded-[2rem] border border-brand-maroon/10 bg-white p-8 text-center shadow-[0_24px_75px_-45px_rgba(122,31,45,.25)] sm:p-12"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-maroon text-white"><CheckCircle2 size={30} /></span><p className="mt-6 text-label text-brand-maroon/55">Registration successful</p><h2 className="mt-1 font-serif text-3xl text-brand-maroon">You're on the list.</h2><div className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600"><RichText text={String(event.form_config?.confirmation_message || "Thank you. Your registration has been received.")} /></div><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">Keep this registration ID. {paymentMode === "upi" ? "Your payment reference has been submitted and will be verified by the Ikshana team." : paymentMode === "razorpay" ? "Your payment was completed and verified successfully." : "There is nothing more you need to pay."}</p><div className="mx-auto mt-6 inline-flex rounded-2xl bg-brand-cream px-6 py-4 font-mono text-xl font-bold tracking-wider text-brand-maroon">{registrationCode}</div><p className="mt-5 text-xs text-stone-500">A confirmation email is sent when SMTP is configured.</p><Link to="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-maroon transition hover:bg-brand-maroon hover:text-white"><ArrowLeft size={14} /> Back to Home</Link></section>}
    </div>
    <style>{`.form-input{width:100%;border-radius:1rem;border:1px solid rgba(122,31,45,.12);background:#fff;padding:.85rem .95rem;font-size:.92rem;line-height:1.4;color:#4a3937;outline:none;transition:border-color .2s,box-shadow .2s}.form-input:focus{border-color:rgba(122,31,45,.45);box-shadow:0 0 0 3px rgba(122,31,45,.07)}.form-input::placeholder{color:rgba(74,57,55,.38)}`}</style>
  </main>;
}

function RichText({ text }: { text: string }) {
  const lines = String(text || "").split(/\r?\n/);
  const renderInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g).filter(Boolean);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("__") && part.endsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
      return <span key={index}>{part}</span>;
    });
  };
  const nodes: ReactNode[] = [];
  let bullets: string[] = []; let numbers: string[] = [];
  const flush = () => { if (bullets.length) { nodes.push(<ul key={`ul-${nodes.length}`} className="my-1 list-disc space-y-1 pl-5">{bullets.map((x, i) => <li key={i}>{renderInline(x)}</li>)}</ul>); bullets = []; } if (numbers.length) { nodes.push(<ol key={`ol-${nodes.length}`} className="my-1 list-decimal space-y-1 pl-5">{numbers.map((x, i) => <li key={i}>{renderInline(x)}</li>)}</ol>); numbers = []; } };
  lines.forEach((line) => { if (/^\s*-\s+/.test(line)) { if (numbers.length) flush(); bullets.push(line.replace(/^\s*-\s+/, "")); } else if (/^\s*\d+\.\s+/.test(line)) { if (bullets.length) flush(); numbers.push(line.replace(/^\s*\d+\.\s+/, "")); } else { flush(); nodes.push(<div key={`line-${nodes.length}`} className={line ? "min-h-[1.1em]" : "h-2"}>{renderInline(line)}</div>); } });
  flush(); return <>{nodes}</>;
}

function QuestionMedia({ settings }: { settings: QuestionSettings }) {
  const image = settings.image_url;
  const video = settings.video_url;
  let videoId = "";
  try { const url = new URL(video || ""); videoId = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") || (url.pathname.match(/\/embed\/([^/]+)/)?.[1] || ""); } catch { /* ignore invalid URL */ }
  if (!image && !videoId) return null;
  return <div className="space-y-3">{image && <img src={image} alt="Form question" loading="lazy" className="max-h-[360px] w-full rounded-2xl border border-brand-maroon/10 object-contain bg-brand-cream/20" />}{videoId && <div className="overflow-hidden rounded-2xl border border-brand-maroon/10 bg-black"><div className="aspect-video"><iframe title="Form video" src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div></div>}</div>;
}

function RazorpayRetry({ order, registrationCode, fullName, email, phone, eventTitle, onSuccess, onError }: { order: { order_id: string; amount: number; currency: string; key_id: string } | null; registrationCode: string; fullName: string; email: string; phone: string; eventTitle: string; onSuccess: () => void; onError: (message: string) => void }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (!order) return; setOpening(true);
    try {
      const scriptId = "razorpay-checkout-script";
      if (!document.getElementById(scriptId)) await new Promise<void>((resolve, reject) => { const script = document.createElement("script"); script.id = scriptId; script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Unable to load the payment checkout.")); document.body.appendChild(script); });
      const Razorpay = (window as any).Razorpay; if (!Razorpay) throw new Error("Payment checkout is unavailable right now.");
      const checkout = new Razorpay({ key: order.key_id, amount: order.amount, currency: order.currency, name: "Ikshana Foundation", description: eventTitle, order_id: order.order_id, theme: { color: "#7a1f2d" }, prefill: { name: fullName, email, contact: phone }, handler: async (response: any) => { try { const verify = await fetch(`/api/reg/registrations/${encodeURIComponent(registrationCode)}/razorpay/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) }); const body = await verify.json().catch(() => ({})); if (!verify.ok) throw new Error(body?.error || "Payment verification failed."); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : "Payment verification failed."); } finally { setOpening(false); } }, modal: { ondismiss: () => setOpening(false) } }); checkout.open();
    } catch (e) { setOpening(false); onError(e instanceof Error ? e.message : "Unable to open payment checkout."); }
  };
  return <button data-open-razorpay type="button" onClick={open} disabled={opening || !order} className="hidden">{opening ? "Opening…" : "Pay"}</button>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-brand-maroon/10 bg-[#fffcfc] p-3"><div className="flex items-center gap-2 text-brand-maroon/60">{icon}<span className="text-[9px] font-bold uppercase tracking-[0.18em]">{label}</span></div><p className="mt-1.5 text-sm font-medium leading-6 text-brand-maroon">{value}</p></div>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-label text-brand-maroon/55"><RichText text={`${label}${required ? " *" : ""}`} /></span>{children}</label>; }

function QuestionField({ question, index, value, onChange, slug }: { question: Question; index: number; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; slug: string }) {
  const q = question; const settings = q.settings || {}; const label = `${index + 1}. ${q.label}${q.required ? " *" : ""}`; const val = value as any;
  if (q.type === "section") return <div className="border-t border-brand-maroon/10 pt-5"><QuestionMedia settings={settings} /><h3 className="font-serif text-xl text-brand-maroon"><RichText text={q.label} /></h3>{q.help_text && <div className="mt-1 text-sm leading-6 text-stone-500"><RichText text={q.help_text} /></div>}</div>;
  const media = <QuestionMedia settings={settings} />;
  if (q.type === "paragraph") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><textarea required={q.required} rows={4} value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
  if (q.type === "email") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><input required={q.required} type="email" value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
  if (q.type === "phone") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><input required={q.required} type="tel" value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
  if (q.type === "number") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><input required={q.required} type="number" min={settings.validation?.min} max={settings.validation?.max} value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
  if (q.type === "date" || q.type === "time") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><input required={q.required} type={q.type} value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
  if (q.type === "dropdown") return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><select required={q.required} value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input"><option value="">Select an option</option>{q.options.map((o) => <option key={o} value={o}>{o}</option>)}{settings.allow_other && <option value="">Other — type below</option>}</select>{settings.allow_other && <input className="form-input mt-2" placeholder="Other" onChange={(e) => onChange(e.target.value)} />}</Field></div>;
  if (q.type === "ranking") return <div className="space-y-3">{media}<RankingField question={q} value={val} onChange={onChange} /></div>;
  if (q.type === "single_choice" || q.type === "multi_choice") return <div className="space-y-3">{media}<ChoiceField question={q} index={index} value={val} onChange={onChange} /></div>;
  if (q.type === "nps") { return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-11">{Array.from({ length: 11 }, (_, n) => <button type="button" key={n} onClick={() => onChange(String(n))} className={`min-h-10 rounded-xl border text-xs font-semibold ${String(val || "") === String(n) ? "border-brand-maroon bg-brand-maroon text-white" : "border-brand-maroon/15 bg-white text-brand-maroon"}`}>{n}</button>)}</div><div className="mt-2 flex justify-between gap-4 text-xs text-stone-500"><span>{settings.min_label || "Not likely"}</span><span>{settings.max_label || "Extremely likely"}</span></div></Field></div>; }
  if (q.type === "linear_scale") { const min = Number(settings.min ?? 1), max = Number(settings.max ?? 5); return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><div className="mt-2 overflow-x-auto"><div className="flex min-w-max items-end gap-3">{Array.from({ length: Math.max(1, max - min + 1) }, (_, i) => min + i).map((n) => <label key={n} className="flex w-10 flex-col items-center gap-2 text-xs text-stone-500"><span>{n}</span><input type="radio" name={`q-${q.id}`} required={q.required && n === min} checked={String(val || "") === String(n)} onChange={() => onChange(String(n))} className="accent-brand-maroon" /></label>)}</div><div className="mt-2 flex justify-between text-xs text-stone-500"><span>{settings.min_label}</span><span>{settings.max_label}</span></div></div></Field></div>; }
  if (q.type === "rating") { const max = Number(settings.max ?? 5); return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><div className="mt-2 flex flex-wrap gap-2">{Array.from({ length: max }, (_, i) => i + 1).map((n) => <button type="button" key={n} onClick={() => onChange(String(n))} className={`h-10 w-10 rounded-full border text-sm ${String(val || "") === String(n) ? "border-brand-maroon bg-brand-maroon text-white" : "border-brand-maroon/15 bg-white text-brand-maroon"}`}>{n}</button>)}</div></Field></div>; }
  if (q.type === "multiple_choice_grid" || q.type === "checkbox_grid") return <div className="space-y-3">{media}<GridField question={q} value={val} onChange={onChange} /></div>;
  if (q.type === "file_upload") return <div className="space-y-3">{media}<FileUploadField question={q} value={val} onChange={onChange} slug={slug} /></div>;
  return <div className="space-y-3">{media}<Field label={label}><Help text={q.help_text} /><input required={q.required} value={String(val || "")} onChange={(e) => onChange(e.target.value)} className="form-input" /></Field></div>;
}

function RankingField({ question, value, onChange }: any) { const q = question; const selected = Array.isArray(value) ? value : []; const update = (option: string, rank: string) => { const next = [...selected.filter((x: string) => !x.startsWith(`${option}::`)), `${option}::${rank}`]; onChange(next); }; return <Field label={q.label}><Help text={q.help_text} /><div className="mt-2 space-y-2">{q.options.map((option: string) => { const current = selected.find((x: string) => x.startsWith(`${option}::`))?.split("::")[1] || ""; return <div key={option} className="flex items-center justify-between gap-3 rounded-xl border border-brand-maroon/10 p-3"><span className="text-sm text-stone-700">{option}</span><select value={current} onChange={(e) => update(option, e.target.value)} className="form-input max-w-24 py-2"><option value="">Rank</option>{q.options.map((_: string, i: number) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div>; })}</div></Field>; }

function ChoiceField({ question, index, value, onChange }: any) { const q = question; const selected = Array.isArray(value) ? value : []; const isMulti = q.type === "multi_choice"; const set = (option: string, checked: boolean) => { if (isMulti) onChange(checked ? [...selected, option] : selected.filter((v: string) => v !== option)); else onChange(option); }; return <Field label={`${index + 1}. ${q.label}${q.required ? " *" : ""}`}><Help text={q.help_text} /><div className="space-y-2">{q.options.map((o: string) => <label key={o} className="flex items-center gap-3 rounded-xl border border-brand-maroon/10 p-3 text-sm text-stone-600"><input type={isMulti ? "checkbox" : "radio"} name={`q-${q.id}`} checked={isMulti ? selected.includes(o) : value === o} onChange={(e) => set(o, e.target.checked)} required={q.required && !isMulti} className="accent-brand-maroon" />{o}</label>)}{q.settings?.allow_other && <input className="form-input" placeholder="Other" onChange={(e) => { const custom = e.target.value; if (isMulti) onChange(custom ? [...selected.filter((v: string) => !v.startsWith("Other: ")), `Other: ${custom}`] : selected.filter((v: string) => !v.startsWith("Other: "))); else onChange(custom ? `Other: ${custom}` : ""); }} />}</div></Field>; }

function GridField({ question, value, onChange }: any) { const q = question; const rows = q.settings?.rows || []; const columns = q.settings?.columns || []; const current = value && typeof value === "object" && !Array.isArray(value) ? value : {}; const update = (row: string, selected: string, checked: boolean) => { const next = { ...current }; if (q.type === "checkbox_grid") { const existing = Array.isArray(next[row]) ? next[row] as string[] : []; next[row] = checked ? [...existing, selected] : existing.filter((v) => v !== selected); } else next[row] = selected; onChange(next); }; return <Field label={q.label}><Help text={q.help_text} /><div className="mt-2 overflow-x-auto rounded-xl border border-brand-maroon/10"><table className="min-w-[560px] w-full text-sm"><thead><tr><th className="p-3 text-left text-xs text-stone-500"> </th>{columns.map((c: string) => <th key={c} className="p-3 text-center text-xs font-medium text-stone-500">{c}</th>)}</tr></thead><tbody className="divide-y divide-brand-maroon/10">{rows.map((r: string) => <tr key={r}><td className="p-3 font-medium text-brand-maroon">{r}</td>{columns.map((c: string) => { const rowVal = current[r]; const checked = Array.isArray(rowVal) ? rowVal.includes(c) : rowVal === c; return <td key={c} className="p-3 text-center"><input type={q.type === "checkbox_grid" ? "checkbox" : "radio"} name={`grid-${q.id}-${r}`} checked={checked} onChange={(e) => update(r, c, e.target.checked)} className="accent-brand-maroon" /></td>; })}</tr>)}</tbody></table></div></Field>; }

function FileUploadField({ question, value, onChange, slug }: any) {
  const [uploading, setUploading] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const files = Array.isArray(value) ? value : [];
  const settings = question.settings || {};
  const accept = (settings.allowed_file_types || ["image/*", "application/pdf"]).join(",");
  const maxFiles = Number(settings.max_files || 1);
  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    const chosen = Array.from(list).slice(0, Math.max(0, maxFiles - files.length));
    setUploading(true);
    try {
      const paths: string[] = [...files];
      const nextLinks: Record<string, string> = { ...links };
      for (const file of chosen) {
        if (file.size > Number(settings.max_size_mb || 10) * 1024 * 1024) throw new Error(`${file.name} is too large.`);
        const form = new FormData(); form.append("file", file);
        const res = await fetch(`/api/reg/events/${encodeURIComponent(slug)}/upload`, { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "File upload failed.");
        paths.push(body.path); nextLinks[body.path] = body.url;
      }
      setLinks(nextLinks); onChange(paths.slice(0, maxFiles));
    } catch (e) { alert(e instanceof Error ? e.message : "File upload failed."); }
    finally { setUploading(false); }
  };
  return <Field label={`${question.label}${question.required ? " *" : ""}`}><Help text={question.help_text} /><label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-maroon/20 bg-brand-cream/25 p-6 text-sm text-brand-maroon hover:bg-brand-cream/50"><Upload size={18} />{uploading ? "Uploading…" : files.length >= maxFiles ? "Maximum files selected" : `Choose file${maxFiles > 1 ? "s" : ""}`}<input type="file" multiple={maxFiles > 1} accept={accept} disabled={files.length >= maxFiles || uploading} onChange={(e) => onFiles(e.target.files)} className="hidden" /></label>{files.length > 0 && <div className="mt-2 space-y-1">{files.map((path: string) => links[path] ? <a key={path} href={links[path]} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-brand-maroon underline"><FileUp size={13} /> Uploaded file</a> : <span key={path} className="flex items-center gap-2 text-xs text-stone-500"><FileUp size={13} /> File uploaded</span>)}</div>}</Field>; }
function Help({ text }: { text: string | null | undefined }) { return text ? <div className="mb-2 text-xs leading-5 text-stone-500"><RichText text={text} /></div> : null; }
