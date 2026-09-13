import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";

/**
 * The small key/value store behind the Donate panel, the journey video and the
 * contact details.
 *
 * Provided once at the app root rather than fetched per component: the navbar,
 * the donate panel and the video embed all need it, and three independent
 * fetches of the same tiny payload on every page load is waste that shows up
 * as three network rows in devtools for no benefit.
 *
 * `available` is false until db/pending/2026-09-06_site_features.sql has been
 * run. That is a normal state, not an error — the API deliberately returns
 * `available: false` with HTTP 200 so features can hide themselves rather than
 * render broken.
 */

export type SiteSettings = Record<string, string>;

export type SiteSettingsState = {
  settings: SiteSettings;
  available: boolean;
  loading: boolean;
  error: string | null;
  hint: string | null;
  /** True when there is enough information to actually accept a donation. */
  donationsConfigured: boolean;
  reload: () => Promise<void>;
  save: (changes: SiteSettings) => Promise<void>;
};

const SiteSettingsContext = createContext<SiteSettingsState | null>(null);

const DONATION_KEYS = [
  "donate_upi_id",
  "donate_bank_account_no",
  "donate_bank_ifsc",
  "donate_bank_account_name",
  "donate_bank_name",
  "donate_bank_branch",
];

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const body = await response.json();
      setAvailable(Boolean(body?.available));
      setSettings(body?.settings || {});
      setHint(body?.hint || null);
    } catch (err) {
      console.error("Failed to load site settings", err);
      setError("Couldn't load site settings.");
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const save = useCallback(async (changes: SiteSettings) => {
    const response = await fetch(
      "/api/settings",
      buildAuthRequestInit({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changes }),
      }),
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Couldn't save (${response.status})`);
    }
    // Merge locally rather than refetching, so every consumer updates at once.
    setSettings((current) => ({ ...current, ...changes }));
  }, []);

  const donationsConfigured = useMemo(
    () => available && DONATION_KEYS.some((k) => (settings[k] || "").trim().length > 0),
    [available, settings],
  );

  const value = useMemo<SiteSettingsState>(
    () => ({ settings, available, loading, error, hint, donationsConfigured, reload, save }),
    [settings, available, loading, error, hint, donationsConfigured, reload, save],
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): SiteSettingsState {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used inside <SiteSettingsProvider>");
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds a UPI payment intent URI.
 *
 * `upi://pay` is handled by GPay, PhonePe, Paytm and friends on a phone. On a
 * desktop it resolves to nothing, which is why the panel always shows the QR
 * and the bank details rather than relying on this alone.
 */
export function buildUpiUri(upiId: string, payeeName: string, amount?: string): string | null {
  const pa = upiId.trim();
  if (!pa) return null;
  const params = new URLSearchParams({ pa, cu: "INR" });
  if (payeeName.trim()) params.set("pn", payeeName.trim());
  const clean = (amount || "").replace(/[^\d.]/g, "");
  if (clean && Number(clean) > 0) params.set("am", clean);
  return `upi://pay?${params.toString()}`;
}

/**
 * Extracts a YouTube video id from any form someone might paste: a watch URL,
 * a youtu.be link, /embed/, /live/, /shorts/, or a bare 11-character id.
 *
 * Returns null rather than guessing, so a bad paste surfaces as an error in
 * the admin form instead of an iframe that silently shows nothing.
 */
export function extractYouTubeId(input: string): string | null {
  const value = (input || "").trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const match = url.pathname.match(/\/(embed|live|shorts|v)\/([\w-]{11})/);
      if (match) return match[2];
    }
  } catch {
    return null;
  }
  return null;
}