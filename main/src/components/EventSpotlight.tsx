import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, FileText, IndianRupee, Mail,
  MapPin, Megaphone, Phone, Sparkles, Users,
} from "lucide-react";

type HomeSlide = { poster_url: string; message?: string | null };
type FeaturedEvent = {
  id: number; slug: string; title: string; summary: string | null; description?: string | null;
  poster_url: string | null; starts_at: string | null; ends_at: string | null; venue: string | null;
  fee_amount: number; fee_note?: string | null; capacity?: number | null;
  contact_email?: string | null; contact_phone?: string | null;
  registration_url?: string | null; registration_link_label?: string | null;
  home_message?: string | null;
  status?: "published" | "closed"; registration_enabled?: boolean;
  home_feature_type?: "event" | "special_day"; form_config?: Record<string, any>;
};

function formatWhen(startsAt: string | null, endsAt: string | null, showTime = true): string | null {
  if (!startsAt) return null;
  const start = new Date(startsAt); if (Number.isNaN(start.getTime())) return null;
  const date = start.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  if (!showTime) return date;
  const time = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const end = endsAt ? new Date(endsAt) : null;
  if (end && !Number.isNaN(end.getTime()) && end.toDateString() === start.toDateString()) {
    return `${date} · ${time}–${end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${date} · ${time}`;
}

const ANNOUNCEMENTS = [
  "Come together. Participate. Support a greater cause.",
  "Gather. Participate. Make an impact.",
  "Every participation helps us extend support where it matters most.",
];

export default function EventSpotlight() {
  const [event, setEvent] = useState<FeaturedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/reg/featured");
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        if (!cancelled) setEvent(body?.event ?? null);
      } catch { if (!cancelled) setEvent(null); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setAnnouncementIndex((i) => (i + 1) % ANNOUNCEMENTS.length), 2200);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const specialDay = event?.home_feature_type === "special_day";
  const configuredSlides = Array.isArray(event?.form_config?.home_slides)
    ? event.form_config.home_slides.filter((s: any) => s && typeof s.poster_url === "string" && s.poster_url.trim()).map((s: any) => ({ poster_url: s.poster_url, message: String(s.message || "") })) as HomeSlide[]
    : [];
  const slides: HomeSlide[] = configuredSlides.length ? configuredSlides : (event?.poster_url ? [{ poster_url: event.poster_url, message: "" }] : []);

  useEffect(() => {
    if (slideIndex >= slides.length && slides.length) setSlideIndex(0);
  }, [slideIndex, slides.length]);

  useEffect(() => {
    if (!specialDay || slides.length < 2 || reduceMotion) return;
    const timer = window.setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), 4800);
    return () => window.clearInterval(timer);
  }, [specialDay, slides.length, reduceMotion]);

  if (loading || !event) return null;

  const activeSlide = slides[Math.min(slideIndex, Math.max(0, slides.length - 1))];
  const when = formatWhen(event.starts_at, event.ends_at, event.form_config?.show_time !== false);
  const fee = Number(event.fee_amount || 0);
  const canRegister = !specialDay && event.status === "published" && event.registration_enabled === true;
  const description = event.description?.trim();
  const summary = event.summary?.trim();
  const goToSlide = (index: number) => setSlideIndex((index + slides.length) % slides.length);
  const specialMessage = activeSlide?.message?.trim() || event.home_message?.trim() || `Wishing you a joyful ${event.title} from the Ikshana family.`;

  return (
    <section id="upcoming-event" aria-labelledby="upcoming-event-title" className="bg-[#fffcfc] px-4 pb-2 pt-2 sm:px-6 sm:pb-3 sm:pt-3 lg:pt-4">
      <motion.div
        {...(reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.05 }, transition: { duration: 0.5 } })}
        className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-brand-maroon/12 bg-white shadow-[0_28px_80px_-48px_rgba(122,31,45,.38)]"
      >
        <div className={`relative overflow-hidden border-b border-brand-maroon/10 px-5 py-4 sm:px-8 sm:py-5 ${specialDay ? "bg-[radial-gradient(circle_at_12%_50%,rgba(122,31,45,.10),transparent_30%),radial-gradient(circle_at_88%_20%,rgba(196,145,82,.10),transparent_24%),linear-gradient(135deg,#fff9f5,#fff) ]" : "bg-[radial-gradient(circle_at_0%_50%,rgba(122,31,45,.10),transparent_30%),linear-gradient(135deg,#fff9f5,#fff) ]"}`}>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-brand-maroon" />
          <div className="relative flex items-center gap-4 sm:gap-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white shadow-[0_12px_30px_-14px_rgba(122,31,45,.95)] sm:h-13 sm:w-13">
              {specialDay ? <Sparkles size={19} /> : <Megaphone size={19} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-brand-maroon sm:text-[10px]">{specialDay ? "From the Ikshana family" : "Upcoming Event"}</p>
              <div className="relative mt-1 min-h-[1.65rem] overflow-hidden" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={`${specialDay ? "special" : "event"}-${announcementIndex}`} initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }} transition={{ duration: 0.28 }} className="font-serif text-lg font-medium italic leading-relaxed text-brand-maroon/80 sm:text-xl lg:text-[1.4rem] xl:text-[1.5rem]">
                    {specialDay
                      ? [
                          specialMessage,
                          `Celebrating ${event.title} with gratitude, joy and togetherness.`,
                          `Warm wishes from everyone at Ikshana on ${event.title}.`,
                        ][announcementIndex]
                      : ANNOUNCEMENTS[announcementIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

        <h2 id="upcoming-event-title" className="sr-only">{specialDay ? "Special day at Ikshana" : `Upcoming event: ${event.title}`}</h2>

        {specialDay ? (
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(122,31,45,.06),transparent_34%),#fffdfb] px-1 py-2 sm:px-3 sm:py-3 lg:px-5 lg:py-4">
            <div className="pointer-events-none absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full border border-brand-maroon/8" />
            <div className="pointer-events-none absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 rounded-full border border-brand-maroon/6" />
            {slides.length ? <div className="relative mx-auto max-w-2xl">
              <div className="relative flex items-center justify-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={activeSlide?.poster_url || slideIndex} initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.32 }} className="w-full">
                    {activeSlide && <PosterDisplay src={activeSlide.poster_url} alt={`${event.title} poster`} special />}
                  </motion.div>
                </AnimatePresence>
                {slides.length > 1 && <>
                  <button type="button" aria-label="Previous poster" onClick={() => goToSlide(slideIndex - 1)} className="absolute left-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-brand-maroon/15 bg-white/95 text-brand-maroon shadow-lg transition hover:bg-brand-maroon hover:text-white sm:left-3"><ChevronLeft size={20} /></button>
                  <button type="button" aria-label="Next poster" onClick={() => goToSlide(slideIndex + 1)} className="absolute right-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-brand-maroon/15 bg-white/95 text-brand-maroon shadow-lg transition hover:bg-brand-maroon hover:text-white sm:right-3"><ChevronRight size={20} /></button>
                </>}
              </div>
              {slides.length > 1 && <div className="mt-3 flex items-center justify-center gap-2">{slides.map((slide, index) => <button key={`${slide.poster_url}-${index}`} type="button" aria-label={`Show poster ${index + 1}`} aria-current={index === slideIndex} onClick={() => goToSlide(index)} className={`h-2 rounded-full transition-all ${index === slideIndex ? "w-7 bg-brand-maroon" : "w-2 bg-brand-maroon/25 hover:bg-brand-maroon/45"}`} />)}</div>}
            </div> : <EmptyPoster />}
          </div>
        ) : (
          (() => {
            const hasDetails = Boolean(summary || description || when || event.venue || fee > 0 || event.capacity || event.contact_email || event.contact_phone || event.fee_note);
            if (!hasDetails) {
              return (
                <div className="bg-white px-3 py-3 sm:px-5 sm:py-4 lg:px-8 lg:py-5">
                  <div className="flex flex-col items-center justify-center gap-4 sm:gap-5">
                    {event.poster_url ? <PosterDisplay src={event.poster_url} alt={`Poster for ${event.title}`} compact centered /> : <EmptyPoster />}
                    <div className="flex justify-center">
                      {canRegister && event.registration_url ? <a href={event.registration_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-maroon px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-maroon/15">{event.registration_link_label?.trim() || "Register for this event"} <ExternalLink size={15} /></a> : canRegister ? <Link to={`/events/${event.slug}`} state={{ featuredEvent: event }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-maroon px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-maroon/15">Register for this event <ArrowRight size={15} /></Link> : <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-brand-cream/45 px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-maroon"><Clock3 size={15} /> {event.status === "closed" ? "Registration closed" : "Registration opens soon"}</span>}
                    </div>
                  </div>
                </div>
              );
            }
            return (
          <div className="grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
            {event.poster_url ? (
              <div className="flex items-center justify-center bg-white p-2 sm:p-3 lg:border-r lg:border-brand-maroon/10">
                <PosterDisplay src={event.poster_url} alt={`Poster for ${event.title}`} compact />
              </div>
            ) : <div className="flex min-h-[240px] items-center justify-center bg-brand-cream/30 lg:border-r lg:border-brand-maroon/10"><EmptyPoster /></div>}

            <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7 lg:p-9">
              {summary && <div className="flex items-start gap-3 rounded-[1.25rem] border border-brand-maroon/10 bg-brand-cream/35 p-4 sm:p-5"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-maroon shadow-sm"><Megaphone size={18} /></span><p className="max-w-2xl font-serif text-lg font-medium italic leading-relaxed text-brand-maroon/80 sm:text-xl lg:text-[1.4rem] xl:text-[1.5rem]">{summary}</p></div>}
              {description && description !== summary && <div className="mt-4 flex items-start gap-3 rounded-[1.25rem] border border-brand-maroon/8 bg-white p-4 sm:p-5"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-maroon"><FileText size={18} /></span><p className="whitespace-pre-line text-base leading-relaxed text-stone-600 sm:text-lg lg:text-xl">{description}</p></div>}
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                {when && <Info icon={<CalendarDays size={17} />} label="When" value={when} />}
                {event.venue && <Info icon={<MapPin size={17} />} label="Where" value={event.venue} />}
                {fee > 0 && <Info icon={<IndianRupee size={17} />} label="Registration" value={`₹${fee.toLocaleString("en-IN")}`} />}
                {event.capacity && <Info icon={<Users size={17} />} label="Capacity" value={`${event.capacity} registrations`} />}
              </dl>
              {fee > 0 && event.fee_note && <p className="mt-3 rounded-xl bg-brand-cream/50 px-3 py-2.5 text-xs leading-5 text-brand-maroon/70">{event.fee_note}</p>}
              {(event.contact_email || event.contact_phone) && <ContactBlock email={event.contact_email} phone={event.contact_phone} />}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {canRegister && event.registration_url ? <a href={event.registration_url} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-maroon px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-maroon/15 transition hover:-translate-y-0.5 hover:bg-stone-900">{event.registration_link_label?.trim() || "Register for this event"} <ExternalLink size={15} /></a> : canRegister ? <Link to={`/events/${event.slug}`} state={{ featuredEvent: event }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-maroon px-6 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-maroon/15 transition hover:-translate-y-0.5 hover:bg-stone-900">Register for this event <ArrowRight size={15} /></Link> : <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-maroon/15 bg-brand-cream/45 px-5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-maroon"><Clock3 size={15} /> {event.status === "closed" ? "Registration closed" : "Registration opens soon"}</span>}
              </div>
            </div>
          </div>
            );
          })()
        )}
      </motion.div>
    </section>
  );
}

function ContactBlock({ email, phone }: { email?: string | null; phone?: string | null }) {
  return <div className="mt-4 rounded-[1.25rem] border border-brand-maroon/10 bg-[#fffcfc] p-3.5 sm:p-4">
    <div className="flex items-center gap-2 text-brand-maroon"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-cream"><Megaphone size={13} /></span><span className="text-[9px] font-bold uppercase tracking-[0.2em]">Contact details</span></div>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {email && <a className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-medium text-brand-maroon hover:bg-brand-cream/40" href={`mailto:${email}`}><Mail size={14} className="shrink-0" /><span className="break-all">{email}</span></a>}
      {phone && <a className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-medium text-brand-maroon" href={`tel:${phone}`}><Phone size={14} className="shrink-0" /><span>{phone}</span></a>}
    </div>
  </div>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-[1.25rem] border border-brand-maroon/10 bg-[#fffcfc] p-4 sm:p-5"><div className="flex items-center gap-2 text-brand-maroon/60">{icon}<span className="text-[9px] font-bold uppercase tracking-[0.2em]">{label}</span></div><p className="mt-2 break-words text-base font-semibold leading-relaxed text-brand-maroon sm:text-lg">{value}</p></div>;
}

function EmptyPoster() { return <div className="flex min-h-[230px] w-full items-center justify-center bg-brand-cream/30 text-brand-maroon/30"><Megaphone size={40} /></div>; }

function PosterDisplay({ src, alt, compact = false, special = false, centered = false }: { src: string; alt: string; compact?: boolean; special?: boolean; centered?: boolean }) {
  return <div className={`relative isolate flex w-full items-center justify-center overflow-hidden bg-brand-cream/10 ${centered ? "max-w-2xl" : ""}`}>
    <img src={src} alt={alt} loading="lazy" decoding="async" className={`relative z-10 block h-auto w-auto max-w-full rounded-[1.25rem] object-contain ${special ? "max-h-[500px]" : compact ? "max-h-[440px]" : "max-h-[540px]"}`} />
  </div>;
}
