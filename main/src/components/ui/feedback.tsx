import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, Trash2, X } from "lucide-react";

/**
 * On-brand replacements for window.alert() and window.confirm().
 *
 * The site had 29 native dialog calls across nine components. Besides looking
 * nothing like the rest of the site, `confirm()` is genuinely dangerous on a
 * phone: it renders as a tiny system sheet whose default button is easy to hit
 * by accident, and it blocks the whole JS thread while open.
 *
 * Usage:
 *   const { toast, confirm } = useFeedback();
 *   toast("Event saved");
 *   toast("Couldn't reach the server", { tone: "error" });
 *   if (await confirm({ title: "Delete this event?", tone: "danger" })) { ... }
 */

type Tone = "success" | "error" | "info";

type ToastOptions = { tone?: Tone; duration?: number };

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type FeedbackApi = {
  toast: (message: string, options?: ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used inside <FeedbackProvider>");
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Toasts                                                             */
/* ------------------------------------------------------------------ */

type ToastRecord = { id: number; message: string; tone: Tone };

const TONE_STYLES: Record<Tone, { icon: typeof Info; ring: string; iconClass: string }> = {
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-200/80 bg-white",
    iconClass: "text-emerald-600",
  },
  error: {
    icon: AlertTriangle,
    ring: "border-red-200/80 bg-white",
    iconClass: "text-red-600",
  },
  info: {
    icon: Info,
    ring: "border-brand-maroon/15 bg-white",
    iconClass: "text-brand-maroon",
  },
};

function ToastStack({
  toasts,
  onDismiss,
  reduceMotion,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: number) => void;
  reduceMotion: boolean;
}) {
  return (
    <div
      // aria-live so screen readers announce these; pointer-events-none on the
      // container so the stack never blocks clicks on the page behind it.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[500] flex flex-col items-center gap-2 px-4 pb-5 sm:inset-x-auto sm:right-6 sm:items-end sm:px-0 sm:pb-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.tone];
          const Icon = style.icon;
          return (
            <motion.div
              key={toast.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border px-4 py-3.5 shadow-lift ${style.ring}`}
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${style.iconClass}`} />
              <p className="flex-1 text-[13.5px] leading-snug text-brand-maroon/85">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss"
                className="focus-ring -m-1 shrink-0 rounded-full p-1 text-brand-maroon/70 transition-colors hover:text-brand-maroon"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirm dialog                                                     */
/* ------------------------------------------------------------------ */

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

function ConfirmDialog({
  pending,
  onSettle,
  reduceMotion,
}: {
  pending: PendingConfirm;
  onSettle: (value: boolean) => void;
  reduceMotion: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const danger = pending.tone === "danger";

  useEffect(() => {
    // Remember what had focus so it can be handed back on close — otherwise
    // focus falls to the top of the document and keyboard users lose their place.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSettle(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onSettle]);

  return (
    // The root has to be a motion component: AnimatePresence drives exit
    // animations through its direct child, so a plain <div> here would make the
    // dialog vanish instantly instead of fading out.
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[400] flex items-end justify-center p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={() => onSettle(false)}
        aria-hidden="true"
        className="absolute inset-0 bg-stone-950/55 backdrop-blur-[3px]"
      />

      <motion.div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={pending.body ? bodyId : undefined}
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        // Bottom sheet on phones so the buttons sit under the thumb, centred
        // card from sm: up.
        className="relative w-full max-w-md rounded-t-feature bg-white p-6 pb-7 shadow-lift sm:rounded-feature sm:p-7"
      >
        <span
          aria-hidden="true"
          className={`mb-5 flex h-11 w-11 items-center justify-center rounded-panel ${
            danger ? "bg-red-50 text-red-600" : "bg-brand-maroon/8 text-brand-maroon"
          }`}
        >
          {danger ? <Trash2 size={20} strokeWidth={1.8} /> : <Info size={20} strokeWidth={1.8} />}
        </span>

        <h2 id={titleId} className="font-serif text-2xl leading-tight text-brand-maroon">
          {pending.title}
        </h2>

        {pending.body && (
          <p id={bodyId} className="mt-2.5 text-[14.5px] leading-relaxed text-brand-maroon/70">
            {pending.body}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="focus-ring inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-brand-maroon/15 bg-white px-5 text-label text-brand-maroon/75 transition-colors hover:border-brand-maroon/35 hover:text-brand-maroon"
          >
            {pending.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onSettle(true)}
            className={`focus-ring inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-label text-white transition-colors ${
              danger ? "bg-red-700 hover:bg-red-800" : "bg-brand-maroon hover:bg-stone-900"
            }`}
          >
            {pending.confirmLabel || (danger ? "Delete" : "Confirm")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const tone = options?.tone ?? "success";
      // Errors stay put longer — they usually carry an instruction.
      const duration = options?.duration ?? (tone === "error" ? 7000 : 4000);

      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = useCallback(
    (value: boolean) => {
      setPending((current) => {
        current?.resolve(value);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      pendingTimers.forEach((timer) => clearTimeout(timer));
      pendingTimers.clear();
    };
  }, []);

  const api = useMemo<FeedbackApi>(() => ({ toast, confirm }), [toast, confirm]);

  const overlays =
    typeof document === "undefined"
      ? null
      : createPortal(
          <>
            <ToastStack toasts={toasts} onDismiss={dismiss} reduceMotion={reduceMotion} />
            <AnimatePresence>
              {pending && (
                <ConfirmDialog pending={pending} onSettle={settle} reduceMotion={reduceMotion} />
              )}
            </AnimatePresence>
          </>,
          document.body,
        );

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {overlays}
    </FeedbackContext.Provider>
  );
}