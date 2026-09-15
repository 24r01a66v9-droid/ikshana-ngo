import type { Express, Request, Response } from "express";
import { createHmac } from "node:crypto";

/**
 * Event registration API.
 *
 * Kept out of server.ts, which is already ~2,500 lines. Everything it needs is
 * injected rather than imported, so this module has no opinion about how the
 * app is wired up.
 *
 * Two halves:
 *   /api/reg/...        public — browse events, register, submit a payment ref
 *   /api/reg/admin/...  admin  — manage events, build forms, verify, export
 *
 * Every route degrades to "feature unavailable" rather than 500ing when the
 * tables from db/pending/2026-09-13_event_registrations.sql haven't been
 * created yet, matching how settings and highlights already behave.
 */

type Deps = {
  app: Express;
  supabase: any;
  authenticateToken: any;
  /**
   * Sets req.user when a valid token is present and passes through when it
   * isn't. The public event-detail route needs this so admins can preview a
   * draft while anonymous visitors still get a 404 for it.
   */
  authenticateOptionalToken: any;
  isAdminUser: (req: any) => boolean;
  isMissingTableError: (error: any) => boolean;
  rateLimit: (opts: { windowMs: number; max: number; key: string }) => any;
  uploadToSupabaseStorage: (file: any, bucket?: string) => Promise<string>;
  upload: any;
  sendRegistrationEmail: (args: {
    to: string;
    name: string;
    eventTitle: string;
    code: string;
    paymentStatus: string;
    amount: number;
  }) => Promise<{ sent: boolean; reason?: string }>;
};

const MISSING =
  "Event registration tables not found — run db/pending/2026-09-13_event_registrations.sql in Supabase.";

const QUESTION_TYPES = new Set([
  "short_text", "paragraph", "single_choice", "multi_choice", "dropdown",
  "email", "phone", "number", "date", "time", "file_upload",
  "linear_scale", "rating", "multiple_choice_grid", "checkbox_grid", "ranking", "likert", "nps", "section",
]);

const CHOICE_TYPES = new Set(["single_choice", "multi_choice", "dropdown", "ranking"]);
const GRID_TYPES = new Set(["multiple_choice_grid", "checkbox_grid", "likert"]);

function normalizeRegistrationUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw || raw === "https://") return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function defaultRegistrationQuestions(eventId: number) {
  return [
    {
      id: -(Math.abs(eventId) * 100 + 1),
      label: "How did you hear about this event?",
      help_text: null,
      type: "single_choice",
      options: ["Instagram", "WhatsApp", "Friend or family", "College or workplace", "Other"],
      required: false,
      position: 0,
      settings: {},
    },
    {
      id: -(Math.abs(eventId) * 100 + 2),
      label: "Anything you'd like us to know?",
      help_text: null,
      type: "paragraph",
      options: [],
      required: false,
      position: 1,
      settings: {},
    },
  ];
}

function asSettings(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function visibleByCondition(question: any, answersById: Map<number, any>): boolean {
  const rule = asSettings(question.settings).show_if;
  if (!rule?.question_id) return true;
  const actual = answersById.get(Number(rule.question_id));
  const expected = String(rule.value ?? "");
  const values = Array.isArray(actual) ? actual.map(String) : [String(actual ?? "")];
  return rule.operator === "not_equals" ? !values.includes(expected) : values.includes(expected);
}

function validateQuestionValue(q: any, value: any): string | null {
  const settings = asSettings(q.settings);
  const empty = Array.isArray(value) ? value.length === 0 : value === "" || value === null || value === undefined;
  if (q.required && empty) return `"${q.label}" is required.`;
  if (empty || q.type === "section") return null;

  if (CHOICE_TYPES.has(q.type) && q.type !== "ranking") {
    const allowed = new Set((q.options || []).map((o: any) => String(o)));
    const chosen = Array.isArray(value) ? value.map(String) : [String(value)];
    const bad = chosen.find((v) => !allowed.has(v));
    if (bad !== undefined && !settings.allow_other) return `"${bad}" is not an option for "${q.label}".`;
  }

  if (q.type === "ranking") {
    const chosen = Array.isArray(value) ? value.map(String) : [];
    const options = (q.options || []).map(String);
    const ranks = chosen.map((v: string) => Number(v.split("::")[1])).filter(Number.isFinite);
    if (chosen.length !== options.length || new Set(chosen.map((v: string) => v.split("::")[0])).size !== options.length || new Set(ranks).size !== ranks.length) return `Please rank every option in "${q.label}" without duplicate ranks.`;
  }

  if (q.type === "nps") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 10) return `Choose a score from 0 to 10 for "${q.label}".`;
  }

  if (q.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return `"${q.label}" must be a number.`;
    if (settings.validation?.min !== undefined && n < Number(settings.validation.min)) return `"${q.label}" must be at least ${settings.validation.min}.`;
    if (settings.validation?.max !== undefined && n > Number(settings.validation.max)) return `"${q.label}" must be at most ${settings.validation.max}.`;
  }

  if (q.type === "linear_scale" || q.type === "rating") {
    const n = Number(value);
    const min = Number(settings.min ?? 1);
    const max = Number(settings.max ?? (q.type === "rating" ? 5 : 5));
    if (!Number.isInteger(n) || n < min || n > max) return `Choose a value from ${min} to ${max} for "${q.label}".`;
  }

  if (q.type === "multiple_choice_grid" || q.type === "checkbox_grid") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return `Please complete "${q.label}".`;
    const rows = (settings.rows || []).filter(Boolean);
    const columns = new Set((settings.columns || []).filter(Boolean).map(String));
    if (settings.require_each_row && rows.some((row: string) => { const v = value[row]; return Array.isArray(v) ? v.length === 0 : !v; })) return `Please answer every row in "${q.label}".`;
    for (const row of rows) {
      const selected = Array.isArray(value[row]) ? value[row] : [value[row]];
      for (const item of selected.filter(Boolean)) if (!columns.has(String(item))) return `Invalid answer in "${q.label}".`;
    }
  }

  if (q.type === "file_upload") {
    const files = Array.isArray(value) ? value : [value];
    const maxFiles = Math.max(1, Number(settings.max_files || 1));
    if (files.length > maxFiles) return `You can upload at most ${maxFiles} file(s) for "${q.label}".`;
  }

  if (typeof value === "string") {
    if (value.length > 2000) return `"${q.label}" is too long.`;
    const rule = settings.validation;
    if (rule?.rule === "min_length" && value.length < Number(rule.value || 0)) return `"${q.label}" is too short.`;
    if (rule?.rule === "max_length" && value.length > Number(rule.value || 0)) return `"${q.label}" is too long.`;
    if (rule?.rule === "contains" && !value.includes(String(rule.value || ""))) return `"${q.label}" must contain the required text.`;
    if (rule?.rule === "not_contains" && value.includes(String(rule.value || ""))) return `"${q.label}" contains text that is not allowed.`;
  }
  return null;
}

/** Turns a title into a URL-safe slug. */
function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

/** RFC4180-safe CSV cell: quote it, and double any quotes inside. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function registerEventRoutes({
  app,
  supabase,
  authenticateToken,
  authenticateOptionalToken,
  isAdminUser,
  isMissingTableError,
  rateLimit,
  uploadToSupabaseStorage,
  upload,
  sendRegistrationEmail,
}: Deps) {
  const unavailable = (res: Response) =>
    res.status(503).json({ error: MISSING, available: false });

  const fail = (res: Response, error: any, message: string) => {
    if (isMissingTableError(error)) return unavailable(res);
    console.error(message, error);
    return res.status(500).json({ error: message });
  };

  const requireAdmin = (req: any, res: Response): boolean => {
    if (!isAdminUser(req)) {
      res.status(403).json({ error: "Admin access required" });
      return false;
    }
    return true;
  };

  /* ====================================================================== */
  /*  PUBLIC                                                                */
  /* ====================================================================== */

  /** Events a visitor may see: published or closed, never drafts. */
  app.get("/api/reg/events", async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from("reg_events")
        .select("id, slug, title, summary, poster_url, starts_at, ends_at, venue, fee_amount, status, capacity")
        .in("status", ["published", "closed"])
        .order("starts_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return res.json({ available: true, events: data || [] });
    } catch (error) {
      if (isMissingTableError(error)) return res.json({ available: false, events: [] });
      return fail(res, error, "Failed to load events");
    }
  });

  /** The single event flagged for the Home page, or null. */
  app.get("/api/reg/featured", async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from("reg_events")
        .select("id, slug, title, summary, description, poster_url, starts_at, ends_at, venue, fee_amount, fee_note, capacity, status, registration_enabled, payment_mode, contact_email, contact_phone, registration_url, registration_link_label, home_message, home_feature_type, form_config")
        .eq("show_on_home", true)
        .eq("status", "published")
        .limit(1);
      if (error) throw error;
      return res.json({ available: true, event: data?.[0] ?? null });
    } catch (error) {
      if (isMissingTableError(error)) return res.json({ available: false, event: null });
      return fail(res, error, "Failed to load the featured event");
    }
  });

  /** The single published event selected for the About page announcement. */
  app.get("/api/reg/about-featured", async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from("reg_events")
        .select("id, slug, title, summary, description, poster_url, starts_at, ends_at, venue, fee_amount, fee_note, capacity, status, show_on_about, registration_enabled")
        .eq("show_on_about", true)
        .in("status", ["published", "closed"])
        .limit(1);
      if (error) throw error;
      return res.json({ available: true, event: data?.[0] ?? null });
    } catch (error) {
      if (isMissingTableError(error)) return res.json({ available: false, event: null });
      return fail(res, error, "Failed to load the About page event");
    }
  });

  /** One event plus its form. Drafts are admin-only. */
  app.get("/api/reg/events/:slug", authenticateOptionalToken, async (req: any, res: Response) => {
    try {
      const { data: events, error } = await supabase
        .from("reg_events")
        .select("*")
        .eq("slug", String(req.params.slug))
        .limit(1);
      if (error) throw error;

      const event = events?.[0];
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (event.status === "draft" && !isAdminUser(req)) {
        return res.status(404).json({ error: "Event not found" });
      }

      const { data: questions, error: qErr } = await supabase
        .from("reg_questions")
        .select("id, label, help_text, type, options, required, position, settings")
        .eq("event_id", event.id)
        .order("position", { ascending: true });
      if (qErr) throw qErr;

      // Registration count so the UI can show "X registered" / capacity full.
      const { count } = await supabase
        .from("reg_registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id);

      return res.json({
        available: true,
        event,
        questions: (questions && questions.length) ? questions : defaultRegistrationQuestions(Number(event.id)),
        registeredCount: count ?? 0,
      });
    } catch (error) {
      return fail(res, error, "Failed to load the event");
    }
  });

  /**
   * Register for an event.
   *
   * Rate limited because it is an unauthenticated write that creates rows and
   * sends email. Validation is server-side and does not trust the client's idea
   * of which questions were required — it re-reads them from the database.
   */
  app.post(
    "/api/reg/events/:slug/upload",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 30, key: "event-file-upload" }),
    upload.single("file"),
    async (req: any, res: Response) => {
      if (!req.file) return res.status(400).json({ error: "No file received." });
      const mime = String(req.file.mimetype || "").toLowerCase();
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
      if (!allowed.has(mime)) return res.status(400).json({ error: "This file type is not allowed." });
      if (Number(req.file.size || 0) > 25 * 1024 * 1024) return res.status(400).json({ error: "File is too large (25 MB maximum)." });
      try {
        const { data: events } = await supabase.from("reg_events").select("id, status, registration_enabled").eq("slug", String(req.params.slug)).limit(1);
        const event = events?.[0];
        if (!event || event.status !== "published" || event.registration_enabled !== true) return res.status(409).json({ error: "Registration for this event is currently closed." });
        const ext = String(req.file.originalname || "").split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
        const path = `${event.id}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("event-uploads").upload(path, req.file.buffer, { contentType: mime, upsert: false });
        if (uploadError) throw uploadError;
        const { data: signed, error: signedError } = await supabase.storage.from("event-uploads").createSignedUrl(path, 60 * 60);
        if (signedError) throw signedError;
        return res.json({ success: true, path, url: signed?.signedUrl || "" });
      } catch (error) { return fail(res, error, "Failed to upload the file"); }
    },
  );

  async function createRazorpayOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
    const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
    if (!keyId || !keySecret) throw new Error("Razorpay is enabled for this event, but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.");
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt, notes }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.description || "Unable to create the Razorpay order.");
    return { id: String(body.id), amount: Number(body.amount), currency: String(body.currency || "INR"), keyId };
  }

  app.post(
    "/api/reg/events/:slug/register",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 8, key: "event-register" }),
    async (req: Request, res: Response) => {
      const fullName = String((req.body as any)?.full_name || "").trim();
      const email = String((req.body as any)?.email || "").trim().toLowerCase();
      const phone = String((req.body as any)?.phone || "").trim();
      const submitted = (req.body as any)?.answers;

      if (!fullName || fullName.length > 120) {
        return res.status(400).json({ error: "Please enter your name." });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: "Please enter a valid email address." });
      }
      if (phone && !/^[0-9+\-()\s]{6,20}$/.test(phone)) {
        return res.status(400).json({ error: "Please enter a valid phone number." });
      }

      try {
        const { data: events, error } = await supabase
          .from("reg_events")
          .select("*")
          .eq("slug", String(req.params.slug))
          .limit(1);
        if (error) throw error;

        const event = events?.[0];
        if (!event) return res.status(404).json({ error: "Event not found" });
        if (event.status !== "published" || event.registration_enabled !== true || event.home_feature_type === "special_day" || event.registration_url) {
          return res.status(409).json({ error: "Registration for this event is currently closed." });
        }

        if (event.capacity) {
          const { count } = await supabase
            .from("reg_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id);
          if ((count ?? 0) >= event.capacity) {
            return res.status(409).json({ error: "This event is full." });
          }
        }

        const { data: storedQuestions, error: qErr } = await supabase
          .from("reg_questions")
          .select("id, label, type, options, required, position, settings")
          .eq("event_id", event.id)
          .order("position", { ascending: true });
        if (qErr) throw qErr;
        const questions = (storedQuestions && storedQuestions.length) ? storedQuestions : defaultRegistrationQuestions(Number(event.id));

        // Build the answer snapshot from the event's questions, not the client's.
        const byId = new Map<number, any>();
        (Array.isArray(submitted) ? submitted : []).forEach((a: any) => {
          if (a && a.question_id !== undefined) byId.set(Number(a.question_id), a.value);
        });

        const answers: any[] = [];
        for (const q of questions || []) {
          if (q.type === "section") continue;
          if (!visibleByCondition(q, byId)) continue;
          let value = byId.get(Number(q.id));
          if (q.type === "multi_choice" || q.type === "ranking") value = Array.isArray(value) ? value.map((v: any) => String(v)) : [];
          else if (GRID_TYPES.has(q.type)) value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
          else if (q.type === "file_upload") value = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
          else value = value === null || value === undefined ? "" : String(value).trim();

          const validationError = validateQuestionValue(q, value);
          if (validationError) return res.status(400).json({ error: validationError });
          answers.push({ question_id: q.id, label: q.label, type: q.type, value });
        }

        const fee = Number(event.fee_amount || 0);
        let paymentMode = event.payment_mode || (fee > 0 ? "upi" : "none");
        if (fee <= 0) paymentMode = "none";
        if (fee > 0 && !["upi", "razorpay"].includes(paymentMode)) {
          return res.status(409).json({ error: "This paid event has no payment method configured. Please contact the event organizer." });
        }
        const paymentStatus = fee > 0 ? "pending" : "not_required";

        // Atomic per-event sequence — see next_registration_number() in the
        // migration. A max()+1 in JS here is the classic duplicate-code race.
        const { data: seq, error: seqErr } = await supabase.rpc("next_registration_number", {
          p_event_id: event.id,
        });
        if (seqErr) throw seqErr;
        const year = new Date().getFullYear();
        const code = `IKS-${year}-${String(seq).padStart(4, "0")}`;

        const { data: inserted, error: insErr } = await supabase
          .from("reg_registrations")
          .insert([
            {
              event_id: event.id,
              registration_code: code,
              full_name: fullName,
              email,
              phone: phone || null,
              answers,
              payment_status: paymentStatus,
              payment_amount: fee,
              payment_method: paymentMode,
            },
          ])
          .select();

        if (insErr) {
          // 23505 = unique violation, i.e. this email already registered.
          if (String(insErr.code) === "23505") {
            return res
              .status(409)
              .json({ error: "That email address has already registered for this event." });
          }
          throw insErr;
        }

        const registration = inserted?.[0];
        let razorpayOrder: { id: string; amount: number; currency: string; keyId: string } | null = null;
        if (registration && paymentStatus === "pending" && paymentMode === "razorpay") {
          try {
            razorpayOrder = await createRazorpayOrder(fee, code, { event_id: String(event.id), registration_code: code });
            await supabase.from("reg_registrations").update({ payment_order_id: razorpayOrder.id }).eq("id", registration.id);
          } catch (paymentError) {
            await supabase.from("reg_registrations").delete().eq("id", registration.id);
            throw paymentError;
          }
        }

        // Email must never be able to fail the registration itself.
        let emailSent = false;
        try {
          const result = await sendRegistrationEmail({
            to: email,
            name: fullName,
            eventTitle: event.title,
            code,
            paymentStatus,
            amount: fee,
          });
          emailSent = result.sent;
          if (emailSent) {
            await supabase
              .from("reg_registrations")
              .update({ email_sent: true })
              .eq("id", registration.id);
          }
        } catch (mailError) {
          console.error("Registration saved but the confirmation email failed:", mailError);
        }

        return res.json({
          success: true,
          registration_code: code,
          payment_status: paymentStatus,
          payment_amount: fee,
          payment_mode: paymentMode,
          razorpay: razorpayOrder ? { order_id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, key_id: razorpayOrder.keyId } : null,
          email_sent: emailSent,
        });
      } catch (error) {
        return fail(res, error, "Failed to complete registration");
      }
    },
  );

  app.post(
    "/api/reg/registrations/:code/razorpay/verify",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 12, key: "event-razorpay-verify" }),
    async (req: Request, res: Response) => {
      const paymentId = String((req.body as any)?.razorpay_payment_id || "").trim();
      const orderId = String((req.body as any)?.razorpay_order_id || "").trim();
      const signature = String((req.body as any)?.razorpay_signature || "").trim();
      if (!paymentId || !orderId || !signature) return res.status(400).json({ error: "Incomplete payment confirmation." });
      const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
      if (!secret) return res.status(503).json({ error: "Razorpay is not configured on the server." });
      try {
        const { data: rows, error } = await supabase
          .from("reg_registrations")
          .select("id, payment_status, payment_order_id, payment_amount, event_id")
          .eq("registration_code", String(req.params.code).toUpperCase())
          .limit(1);
        if (error) throw error;
        const reg = rows?.[0];
        if (!reg) return res.status(404).json({ error: "Registration not found." });
        if (reg.payment_status === "verified") return res.json({ success: true, payment_status: "verified" });
        if (reg.payment_order_id !== orderId) return res.status(400).json({ error: "Payment order does not match this registration." });
        const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
        if (expected !== signature) return res.status(400).json({ error: "Payment verification failed." });

        const { error: updateError } = await supabase
          .from("reg_registrations")
          .update({ payment_reference: paymentId, payment_status: "verified", payment_note: "Verified by Razorpay", verified_at: new Date().toISOString(), verified_by: "razorpay" })
          .eq("id", reg.id);
        if (updateError) throw updateError;
        return res.json({ success: true, payment_status: "verified" });
      } catch (error) {
        return fail(res, error, "Failed to verify the payment");
      }
    },
  );

  /** The registrant submits their UPI/bank reference after paying. */
  app.post(
    "/api/reg/registrations/:code/payment",
    rateLimit({ windowMs: 60 * 60 * 1000, max: 12, key: "event-payment" }),
    async (req: Request, res: Response) => {
      const reference = String((req.body as any)?.reference || "").trim();
      if (reference.length < 4 || reference.length > 80) {
        return res
          .status(400)
          .json({ error: "Enter the transaction or UTR reference from your payment app." });
      }

      try {
        const { data: rows, error } = await supabase
          .from("reg_registrations")
          .select("id, payment_status")
          .eq("registration_code", String(req.params.code).toUpperCase())
          .limit(1);
        if (error) throw error;

        const reg = rows?.[0];
        if (!reg) return res.status(404).json({ error: "Registration not found" });
        if (reg.payment_status === "verified") {
          return res.status(409).json({ error: "This payment is already verified." });
        }
        if (reg.payment_status === "not_required") {
          return res.status(409).json({ error: "This event is free — no payment is needed." });
        }

        const { error: updErr } = await supabase
          .from("reg_registrations")
          .update({ payment_reference: reference, payment_status: "submitted" })
          .eq("id", reg.id);
        if (updErr) throw updErr;

        return res.json({ success: true, payment_status: "submitted" });
      } catch (error) {
        return fail(res, error, "Failed to record the payment reference");
      }
    },
  );

  /** Lets someone re-check their own registration by code. */
  app.get(
    "/api/reg/registrations/:code",
    rateLimit({ windowMs: 10 * 60 * 1000, max: 20, key: "reg-lookup" }),
    async (req: Request, res: Response) => {
      try {
        const { data, error } = await supabase
          .from("reg_registrations")
          // Deliberately narrow: a registration code is guessable enough that
          // this must not hand back phone numbers or free-text answers.
          .select("registration_code, full_name, payment_status, payment_amount, created_at, event_id")
          .eq("registration_code", String(req.params.code).toUpperCase())
          .limit(1);
        if (error) throw error;
        if (!data?.length) return res.status(404).json({ error: "Registration not found" });

        const reg = data[0];
        const { data: ev } = await supabase
          .from("reg_events")
          .select("title, slug, starts_at, venue")
          .eq("id", reg.event_id)
          .limit(1);

        const { event_id, ...safe } = reg;
        return res.json({ registration: safe, event: ev?.[0] ?? null });
      } catch (error) {
        return fail(res, error, "Failed to look up that registration");
      }
    },
  );

  /* ====================================================================== */
  /*  ADMIN                                                                 */
  /* ====================================================================== */

  app.get("/api/reg/admin/events", authenticateToken, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { data, error } = await supabase
        .from("reg_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Attach a registration count per event so the list is useful at a glance.
      const withCounts = await Promise.all(
        (data || []).map(async (event: any) => {
          const { count } = await supabase
            .from("reg_registrations")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id);
          return { ...event, registration_count: count ?? 0 };
        }),
      );

      return res.json({ available: true, events: withCounts });
    } catch (error) {
      if (isMissingTableError(error)) return res.json({ available: false, events: [] });
      return fail(res, error, "Failed to load events");
    }
  });

  app.post("/api/reg/admin/events", authenticateToken, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "An event needs a title." });

    try {
      // Ensure the slug is unique by suffixing a counter rather than failing.
      const base = slugify(title) || "event";
      let slug = base;
      for (let attempt = 2; attempt < 50; attempt++) {
        const { data: clash } = await supabase
          .from("reg_events")
          .select("id")
          .eq("slug", slug)
          .limit(1);
        if (!clash?.length) break;
        slug = `${base}-${attempt}`;
      }

      const { data, error } = await supabase
        .from("reg_events")
        .insert([
          {
            slug,
            title,
            summary: String(req.body?.summary || "").trim() || null,
            description: String(req.body?.description || "").trim() || null,
            starts_at: req.body?.starts_at || null,
            ends_at: req.body?.ends_at || null,
            venue: String(req.body?.venue || "").trim() || null,
            fee_amount: Number(req.body?.fee_amount || 0),
            fee_note: String(req.body?.fee_note || "").trim() || null,
            payment_mode: ["none", "upi", "razorpay"].includes(String(req.body?.payment_mode)) ? String(req.body.payment_mode) : "none",
            home_feature_type: String(req.body?.home_feature_type || "event") === "special_day" ? "special_day" : "event",
            capacity: req.body?.capacity ? Number(req.body.capacity) : null,
            contact_email: String(req.body?.contact_email || "").trim() || null,
            contact_phone: String(req.body?.contact_phone || "").trim() || null,
            registration_url: normalizeRegistrationUrl(req.body?.registration_url),
            registration_link_label: String(req.body?.registration_link_label || "").trim() || null,
            home_message: String(req.body?.home_message || "").trim() || null,
            status: "draft",
            show_on_home: Boolean(req.body?.show_on_home),
            show_on_about: Boolean(req.body?.show_on_about),
            registration_enabled: String(req.body?.home_feature_type || "event") === "special_day" ? false : req.body?.registration_enabled !== false,
            form_config: asSettings(req.body?.form_config),
            created_by: String(req.user?.email || "admin"),
          },
        ])
        .select();
      if (error) throw error;
      return res.json({ success: true, event: data?.[0] });
    } catch (error) {
      return fail(res, error, "Failed to create the event");
    }
  });

  app.patch("/api/reg/admin/events/:id", authenticateToken, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);

    const patch: Record<string, any> = {};
    const text = (k: string) => {
      if (req.body?.[k] !== undefined) patch[k] = String(req.body[k]).trim() || null;
    };
    ["title", "summary", "description", "venue", "fee_note", "contact_email", "contact_phone", "poster_url", "registration_link_label", "home_message"].forEach(text);
    if (req.body?.registration_url !== undefined) patch.registration_url = normalizeRegistrationUrl(req.body.registration_url);
    if (req.body?.starts_at !== undefined) patch.starts_at = req.body.starts_at || null;
    if (req.body?.ends_at !== undefined) patch.ends_at = req.body.ends_at || null;
    if (req.body?.fee_amount !== undefined) patch.fee_amount = Number(req.body.fee_amount) || 0;
    if (req.body?.payment_mode !== undefined) {
      const paymentMode = String(req.body.payment_mode);
      if (!["none", "upi", "razorpay"].includes(paymentMode)) return res.status(400).json({ error: "Unknown payment method." });
      patch.payment_mode = paymentMode;
    }
    if (req.body?.capacity !== undefined) patch.capacity = req.body.capacity ? Number(req.body.capacity) : null;
    if (req.body?.form_config !== undefined) {
      const nextFormConfig = { ...asSettings(req.body.form_config) };
      delete nextFormConfig.home_slides;
      patch.form_config = nextFormConfig;
    }
    if (req.body?.home_feature_type !== undefined) {
      const featureType = String(req.body.home_feature_type);
      if (!["event", "special_day"].includes(featureType)) return res.status(400).json({ error: "Unknown Home feature type." });
      patch.home_feature_type = featureType;
      if (featureType === "special_day") {
        patch.registration_enabled = false;
        patch.payment_mode = "none";
      }
    }

    if (req.body?.status !== undefined) {
      const status = String(req.body.status);
      if (!["draft", "published", "closed"].includes(status)) {
        return res.status(400).json({ error: "Unknown status." });
      }
      patch.status = status;
    }

    if (Object.keys(patch).length === 0 &&
        req.body?.show_on_home === undefined &&
        req.body?.show_on_about === undefined &&
        req.body?.registration_enabled === undefined) {
      return res.status(400).json({ error: "Nothing to update." });
    }

    if (req.body?.registration_enabled !== undefined) {
      patch.registration_enabled = Boolean(req.body.registration_enabled);
    }
    // Special-day Home features are poster-only and can never accept registrations.
    if (patch.home_feature_type === "special_day") {
      patch.registration_enabled = false;
      patch.payment_mode = "none";
      patch.registration_url = null;
      patch.registration_link_label = null;
    }
    if (req.body?.registration_url !== undefined && normalizeRegistrationUrl(req.body.registration_url)) {
      patch.registration_enabled = Boolean(req.body?.registration_enabled ?? true);
    }

    try {
      // Only one event may be featured on each surface. The database migration
      // also enforces this with partial unique indexes.
      if (req.body?.show_on_home === true) {
        await supabase
          .from("reg_events")
          .update({ show_on_home: false })
          .eq("show_on_home", true)
          .neq("id", id);
        patch.show_on_home = true;
      } else if (req.body?.show_on_home === false) {
        patch.show_on_home = false;
      }

      if (req.body?.show_on_about === true) {
        await supabase
          .from("reg_events")
          .update({ show_on_about: false })
          .eq("show_on_about", true)
          .neq("id", id);
        patch.show_on_about = true;
      } else if (req.body?.show_on_about === false) {
        patch.show_on_about = false;
      }

      const { data, error } = await supabase
        .from("reg_events")
        .update(patch)
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: "Event not found" });
      return res.json({ success: true, event: data[0] });
    } catch (error) {
      return fail(res, error, "Failed to update the event");
    }
  });

  app.delete("/api/reg/admin/events/:id", authenticateToken, async (req: any, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      // Questions and registrations cascade from the FK.
      const { error } = await supabase.from("reg_events").delete().eq("id", Number(req.params.id));
      if (error) throw error;
      return res.json({ success: true });
    } catch (error) {
      return fail(res, error, "Failed to delete the event");
    }
  });

  app.post(
    "/api/reg/admin/events/:id/poster",
    authenticateToken,
    upload.single("file"),
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      if (!req.file) return res.status(400).json({ error: "No file received." });
      try {
        const url = await uploadToSupabaseStorage(req.file, "photos");
        const { data, error } = await supabase
          .from("reg_events")
          .update({ poster_url: url })
          .eq("id", Number(req.params.id))
          .select();
        if (error) throw error;
        return res.json({ success: true, poster_url: url, event: data?.[0] });
      } catch (error) {
        return fail(res, error, "Failed to upload the poster");
      }
    },
  );

  app.post(
    "/api/reg/admin/events/:id/question-image",
    authenticateToken,
    upload.single("file"),
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      if (!req.file) return res.status(400).json({ error: "No image received." });
      const mime = String(req.file.mimetype || "").toLowerCase();
      if (!mime.startsWith("image/")) return res.status(400).json({ error: "Question images must be image files." });
      if (Number(req.file.size || 0) > 8 * 1024 * 1024) return res.status(400).json({ error: "Question image is too large (8 MB maximum)." });
      try {
        const url = await uploadToSupabaseStorage(req.file, "photos");
        return res.json({ success: true, image_url: url });
      } catch (error) {
        return fail(res, error, "Failed to upload the question image");
      }
    },
  );

  /**
   * Replace an event's whole question set in one call.
   *
   * Reordering, deleting and editing in a form builder are naturally a single
   * "here is the new list" operation. Diffing individual rows would mean three
   * endpoints and a client that has to sequence them correctly; this cannot
   * leave the form half-updated.
   */
  app.put(
    "/api/reg/admin/events/:id/questions",
    authenticateToken,
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      const eventId = Number(req.params.id);
      const incoming = req.body?.questions;
      if (!Array.isArray(incoming)) {
        return res.status(400).json({ error: "Expected { questions: [...] }." });
      }
      if (incoming.length > 60) {
        return res.status(400).json({ error: "That's more than 60 questions — please trim the form." });
      }

      const rows: any[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const q = incoming[i] || {};
        const label = String(q.label || "").trim();
        const type = String(q.type || "short_text");
        if (!label) return res.status(400).json({ error: `Question ${i + 1} needs a label.` });
        if (label.length > 300) return res.status(400).json({ error: `Question ${i + 1} label is too long.` });
        if (!QUESTION_TYPES.has(type)) {
          return res.status(400).json({ error: `Question ${i + 1} has an unknown type "${type}".` });
        }

        let options: string[] = [];
        if (CHOICE_TYPES.has(type)) {
          options = (Array.isArray(q.options) ? q.options : []).map((o: any) => String(o).trim()).filter(Boolean);
          if (!options.length) return res.status(400).json({ error: `"${label}" needs at least one option.` });
          if (new Set(options).size !== options.length) return res.status(400).json({ error: `"${label}" has duplicate options.` });
        }
        const settings = asSettings(q.settings);
        if (GRID_TYPES.has(type)) {
          settings.rows = Array.isArray(settings.rows) ? settings.rows.map(String).map((x: string) => x.trim()).filter(Boolean) : [];
          settings.columns = Array.isArray(settings.columns) ? settings.columns.map(String).map((x: string) => x.trim()).filter(Boolean) : [];
          if (!settings.rows.length || !settings.columns.length) return res.status(400).json({ error: `"${label}" needs at least one row and one column.` });
        }
        if (type === "section") {
          settings.description = String(settings.description ?? q.help_text ?? "").trim();
        }
        if (settings.image_url) {
          settings.image_url = String(settings.image_url).trim().slice(0, 1000);
        }
        if (settings.video_url) {
          settings.video_url = String(settings.video_url).trim().slice(0, 500);
        }

        rows.push({
          event_id: eventId,
          label,
          help_text: String(q.help_text || "").trim() || null,
          type,
          options,
          required: Boolean(q.required),
          position: i,
          settings,
        });
      }

      try {
        const { data: existing, error: existingErr } = await supabase
          .from("reg_questions")
          .select("id")
          .eq("event_id", eventId);
        if (existingErr) throw existingErr;

        const existingIds = new Set((existing || []).map((r: any) => Number(r.id)));
        const incomingIds = new Set(rows.map((r: any, i: number) => Number(incoming[i]?.id)).filter((id: number) => existingIds.has(id)));
        const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
        if (idsToDelete.length) {
          const { error: delErr } = await supabase.from("reg_questions").delete().in("id", idsToDelete);
          if (delErr) throw delErr;
        }

        for (let i = 0; i < rows.length; i++) {
          const incomingQuestion = incoming[i] || {};
          const id = Number(incomingQuestion.id);
          const row = rows[i];
          if (existingIds.has(id)) {
            const { error: updateErr } = await supabase.from("reg_questions").update({
              label: row.label, help_text: row.help_text, type: row.type, options: row.options,
              required: row.required, position: row.position, settings: row.settings,
            }).eq("id", id).eq("event_id", eventId);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await supabase.from("reg_questions").insert(row);
            if (insertErr) throw insertErr;
          }
        }

        const { data } = await supabase
          .from("reg_questions")
          .select("id, label, help_text, type, options, required, position, settings")
          .eq("event_id", eventId)
          .order("position", { ascending: true });

        return res.json({ success: true, questions: data || [] });
      } catch (error) {
        return fail(res, error, "Failed to save the form");
      }
    },
  );

  app.get(
    "/api/reg/admin/events/:id/registrations",
    authenticateToken,
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      try {
        const { data, error } = await supabase
          .from("reg_registrations")
          .select("*")
          .eq("event_id", Number(req.params.id))
          .order("created_at", { ascending: false });
        if (error) throw error;
        return res.json({ available: true, registrations: data || [] });
      } catch (error) {
        if (isMissingTableError(error)) return res.json({ available: false, registrations: [] });
        return fail(res, error, "Failed to load registrations");
      }
    },
  );

  /**
   * CSV export.
   *
   * Columns are derived from the event's current questions, then each row is
   * filled from that registration's own answer snapshot — so a registration
   * made before a question existed simply has an empty cell rather than
   * shifting every column to the right.
   *
   * Opens cleanly in Excel: UTF-8 BOM so Devanagari and ₹ don't mojibake, and
   * CRLF line endings.
   */
  app.get(
    "/api/reg/admin/events/:id/registrations.csv",
    authenticateToken,
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      const eventId = Number(req.params.id);
      try {
        const { data: events } = await supabase
          .from("reg_events")
          .select("slug, title")
          .eq("id", eventId)
          .limit(1);
        const event = events?.[0];

        const { data: questions } = await supabase
          .from("reg_questions")
          .select("id, label, position")
          .eq("event_id", eventId)
          .order("position", { ascending: true });

        const { data: regs, error } = await supabase
          .from("reg_registrations")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const header = [
          "Registration code",
          "Name",
          "Email",
          "Phone",
          "Registered at",
          "Payment status",
          "Amount",
          "Payment reference",
          ...(questions || []).map((q: any) => q.label),
        ];

        const lines = [header.map(csvCell).join(",")];

        for (const r of regs || []) {
          const byId = new Map<number, any>();
          (r.answers || []).forEach((a: any) => byId.set(Number(a.question_id), a.value));
          lines.push(
            [
              r.registration_code,
              r.full_name,
              r.email,
              r.phone || "",
              new Date(r.created_at).toLocaleString("en-IN"),
              r.payment_status,
              r.payment_amount,
              r.payment_reference || "",
              ...(questions || []).map((q: any) => byId.get(Number(q.id)) ?? ""),
            ]
              .map(csvCell)
              .join(","),
          );
        }

        const filename = `${event?.slug || "event"}-registrations.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        // BOM first so Excel detects UTF-8.
        return res.send("﻿" + lines.join("\r\n"));
      } catch (error) {
        return fail(res, error, "Failed to export registrations");
      }
    },
  );

  /** Admin marks a payment verified or rejected. */
  app.patch(
    "/api/reg/admin/registrations/:id",
    authenticateToken,
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      const status = String(req.body?.payment_status || "");
      if (!["pending", "submitted", "verified", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Unknown payment status." });
      }
      try {
        const patch: Record<string, any> = {
          payment_status: status,
          payment_note: String(req.body?.payment_note || "").trim() || null,
        };
        if (status === "verified") {
          patch.verified_at = new Date().toISOString();
          patch.verified_by = String(req.user?.email || "admin");
        } else {
          patch.verified_at = null;
          patch.verified_by = null;
        }

        const { data, error } = await supabase
          .from("reg_registrations")
          .update(patch)
          .eq("id", Number(req.params.id))
          .select();
        if (error) throw error;
        if (!data?.length) return res.status(404).json({ error: "Registration not found" });
        return res.json({ success: true, registration: data[0] });
      } catch (error) {
        return fail(res, error, "Failed to update the payment status");
      }
    },
  );

  app.delete(
    "/api/reg/admin/registrations/:id",
    authenticateToken,
    async (req: any, res: Response) => {
      if (!requireAdmin(req, res)) return;
      try {
        const { error } = await supabase
          .from("reg_registrations")
          .delete()
          .eq("id", Number(req.params.id));
        if (error) throw error;
        return res.json({ success: true });
      } catch (error) {
        return fail(res, error, "Failed to delete the registration");
      }
    },
  );

}
