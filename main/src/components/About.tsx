import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon,
  Plus,
  X,
  Trash2,
  Pencil,
  Star,
  Eye,
  EyeOff,
  Users,
  HandHeart,
  Sparkles,
  CalendarDays,
  Sprout,
  BookOpen,
  Megaphone,
  Quote,
} from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AboutPhoto {
  id: string;
  url: string;
  caption: string;
  is_featured: boolean;
}

/* ------------------------------------------------------------------ */
/*  Journey timeline — admin-editable                                  */
/* ------------------------------------------------------------------ */
/*
 * Milestones default to this hardcoded list, but are editable by an admin
 * (add / edit / delete via the modal below). Edits are saved to
 * localStorage immediately (so they always persist for this browser) and
 * also synced to /api/milestones (backed by a `milestones` table — see the
 * server route additions) so they persist across devices/browsers too.
 */

const MILESTONE_ICONS = {
  sprout: Sprout,
  handheart: HandHeart,
  bookopen: BookOpen,
  megaphone: Megaphone,
  users: Users,
  sparkles: Sparkles,
  star: Star,
} as const;

type MilestoneIconKey = keyof typeof MILESTONE_ICONS;

interface Milestone {
  id: string;
  year: string;
  title: string;
  description: string;
  iconKey: MilestoneIconKey;
}

const DEFAULT_MILESTONES: Milestone[] = [
  {
    id: "m-2021",
    year: "2021",
    title: "Where it began",
    description:
      "A small group of volunteers came together around one idea: service should be community-led, not charity delivered from a distance.",
    iconKey: "sprout",
  },
  {
    id: "m-2022",
    year: "2022",
    title: "First visits, first bonds",
    description:
      "Regular visits to orphanages and old-age homes began, turning one-off drives into relationships that lasted well beyond a single afternoon.",
    iconKey: "handheart",
  },
  {
    id: "m-2023",
    year: "2023",
    title: "Beyond the visit",
    description:
      "Ikshana started offering direct support for medical treatment and school fees for the families it had come to know.",
    iconKey: "bookopen",
  },
  {
    id: "m-2024",
    year: "2024",
    title: "Raising our voice",
    description:
      "Awareness programs on health, education and elder care brought the wider community into the work, not just the volunteers doing it.",
    iconKey: "megaphone",
  },
  {
    id: "m-2025",
    year: "2025",
    title: "Growing hands",
    description:
      "Volunteer numbers crossed 100, and donation drives became a steady rhythm across the calendar rather than occasional events.",
    iconKey: "users",
  },
  {
    id: "m-2026",
    year: "2026",
    title: "Today",
    description:
      "Ikshana continues as a volunteer-run foundation — still community-led, still shaped by the people it serves.",
    iconKey: "sparkles",
  },
];

const MILESTONES_STORAGE_KEY = "ikshana-journey-milestones";

// Interpolates the timeline dot color from a young, light rose to the full
// brand maroon based on position — a small visual echo of the foundation's
// growth, computed automatically so nobody has to pick colors by hand when
// adding a milestone.
// Every milestone dot, icon chip, and year now share one consistent brand
// color instead of interpolating light-to-dark across the timeline — the
// fading effect made early years look washed out compared to later ones.
const TIMELINE_COLOR = "#7a1f2d";
const getDotColor = (_index: number, _total: number) => TIMELINE_COLOR;

const EMPTY_MILESTONE_FORM = { year: "", title: "", description: "", iconKey: "sprout" as MilestoneIconKey };

/* ------------------------------------------------------------------ */
/*  Animated stat counter                                              */
/* ------------------------------------------------------------------ */

function CountUpStat({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const hasRun = useRef(false);

  return (
    <motion.span
      onViewportEnter={() => {
        if (hasRun.current) return;
        hasRun.current = true;
        const duration = 1200;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(eased * value));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }}
      viewport={{ once: true, margin: "-40px" }}
    >
      {display}
      {suffix}
    </motion.span>
  );
}

const STATS: {
  label: string;
  value: number;
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    label: "Volunteers",
    value: 100,
    icon: Users,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
  },
  {
    label: "Donation Drives",
    value: 30,
    icon: HandHeart,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
  },
  {
    label: "Awareness Programs",
    value: 5,
    icon: Sparkles,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-100",
  },
];

export default function About() {
  const { user } = useAuth();
  const normalizedRole = user?.role?.toLowerCase();
  const isAdmin = Boolean(
    normalizedRole === "admin" ||
    (user?.email && user.email === "24r01a66v9@cmrithyderabad.edu.in")
  );
  const [photos, setPhotos] = useState<AboutPhoto[]>([]);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [featuredPhotoId, setFeaturedPhotoId] = useState<string | null>(null);
  const [showFeaturedImage, setShowFeaturedImage] = useState(true);
  const [bigPhoto, setBigPhoto] = useState<string | null>(null);

  const [milestones, setMilestones] = useState<Milestone[]>(DEFAULT_MILESTONES);
  const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE_FORM);

  const fetchPhotos = async () => {
    try {
      const response = await fetch("/api/photos");
      if (response.ok) {
        const data = await response.json();
        // Keep the archive limited to 'about' photos
        const aboutPhotos = data
          .filter((p: any) => p.category === 'about')
          .map((p: any) => ({ ...p, caption: p.caption || p.title || "About Photo" }));
        setPhotos(aboutPhotos);

        // Only use `hero` images for the top featured banner. This prevents
        // about/team photos from showing above the mission/vision section.
        const hero = data.find((p: any) => p.category === 'hero');
        if (hero) {
          setFeaturedImage(hero.url);
          setFeaturedPhotoId(hero.id);
        } else {
          setFeaturedImage(null);
          setFeaturedPhotoId(null);
        }

        // big photo preference: hero > first about
        if (hero) setBigPhoto(hero.url);
        else if (aboutPhotos.length) setBigPhoto(aboutPhotos[0].url);
        else setBigPhoto(null);
      }
    } catch (e) {
      console.error("Failed to fetch about photos", e);
    }
  }; 

  // Load photos from API on mount
  useEffect(() => {
    fetchPhotos();
  }, []);

  // Load journey milestones: try the backend first, fall back to whatever
  // was last saved locally, and fall back again to the hardcoded defaults.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/milestones");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setMilestones([...data].sort((a, b) => a.year.localeCompare(b.year)));
            return;
          }
        }
      } catch (e) {
        console.warn("No /api/milestones endpoint yet — using local data.", e);
      }

      try {
        const stored = window.localStorage.getItem(MILESTONES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) setMilestones(parsed);
        }
      } catch {}
    })();
  }, []);

  const persistMilestones = (updated: Milestone[]) => {
    const sorted = [...updated].sort((a, b) => a.year.localeCompare(b.year));
    setMilestones(sorted);
    window.localStorage.setItem(MILESTONES_STORAGE_KEY, JSON.stringify(sorted));
    return sorted;
  };

  const openAddMilestone = () => {
    setEditingMilestoneId(null);
    setMilestoneForm(EMPTY_MILESTONE_FORM);
    setIsMilestoneFormOpen(true);
  };

  const openEditMilestone = (milestone: Milestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneForm({
      year: milestone.year,
      title: milestone.title,
      description: milestone.description,
      iconKey: milestone.iconKey,
    });
    setIsMilestoneFormOpen(true);
  };

  const closeMilestoneForm = () => {
    setIsMilestoneFormOpen(false);
    setEditingMilestoneId(null);
    setMilestoneForm(EMPTY_MILESTONE_FORM);
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneForm.year.trim() || !milestoneForm.title.trim()) return;

    const payload = {
      year: milestoneForm.year.trim(),
      title: milestoneForm.title.trim(),
      description: milestoneForm.description.trim(),
      iconKey: milestoneForm.iconKey,
    };

    const updated = editingMilestoneId
      ? milestones.map((m) => (m.id === editingMilestoneId ? { ...m, ...payload } : m))
      : [...milestones, { id: `m-${Date.now()}`, ...payload }];

    persistMilestones(updated);

    try {
      const url = editingMilestoneId ? `/api/milestones/${editingMilestoneId}` : "/api/milestones";
      await fetch(url, buildAuthRequestInit({
        method: editingMilestoneId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
    } catch (err) {
      console.warn("Milestone saved locally; /api/milestones is not available yet.", err);
    }

    closeMilestoneForm();
  };

  const removeMilestone = async (id: string) => {
    if (!window.confirm("Delete this milestone?")) return;
    persistMilestones(milestones.filter((m) => m.id !== id));
    try {
      await fetch(`/api/milestones/${id}`, buildAuthRequestInit({ method: "DELETE" }));
    } catch (err) {
      console.warn("Milestone deleted locally; /api/milestones is not available yet.", err);
    }
  };

  const featurePhoto = async (id: string) => {
    try {
      const response = await fetch(`/api/photos/${id}/feature`, buildAuthRequestInit({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "about" }),
      }));
      if (response.ok) {
        fetchPhotos();
      }
    } catch (e) {
      console.error("Failed to feature photo", e);
    }
  };

  const removePhoto = async (id: string) => {
    try {
      const response = await fetch(`/api/photos/${id}`, buildAuthRequestInit({ method: "DELETE" }));
      if (response.ok) {
        setPhotos(photos.filter(p => p.id !== id));
        if (photos.find(p => p.id === id)?.url === featuredImage) {
          setFeaturedImage(null);
        }
      }
    } catch (e) {
      console.error("Failed to delete about photo", e);
    }
  };

  // Repeat the archive photos enough times to fill a smooth, seamless
  // marquee loop (translateX(-50%) only looks seamless if the track is an
  // exact double of itself), and scale the animation duration to the number
  // of tiles so the scroll speed feels similar regardless of how many
  // photos have been uploaded.
  let marqueeRepeat = photos.length > 0 ? Math.max(2, Math.ceil(10 / photos.length)) : 0;
  if (marqueeRepeat % 2 !== 0) marqueeRepeat += 1;
  const marqueePhotos = photos.length > 0
    ? Array.from({ length: marqueeRepeat }, () => photos).flat()
    : [];
  const marqueeDuration = Math.max(22, marqueePhotos.length * 2.5);

  return (
    <section id="about" className="pt-24 pb-8 px-4 sm:pt-32 sm:pb-14 sm:px-6 bg-white overflow-hidden">
      <style>{`
        @keyframes ikshana-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ikshana-marquee-track {
          animation: ikshana-marquee linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ikshana-marquee-track {
            animation: none !important;
          }
        }
      `}</style>

      {featuredImage && showFeaturedImage && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="relative -mx-4 mb-8 sm:-mx-6 sm:mb-12 lg:-mx-10"
        >
          {/* No forced aspect ratio and no fixed height: the box's height is
              simply whatever the image's own natural aspect ratio produces
              at 100% width. That's the only way to guarantee both "never
              cropped" and "no colored letterbox bands" at once, on every
              device and orientation — including "Desktop site" mode in a
              mobile browser, since this is driven purely by width, never
              viewport height. loading="eager" + fetchPriority="high" keep
              this, the very first image on the page, from popping in late. */}
          <div className="relative w-full overflow-hidden rounded-b-[2rem] bg-brand-maroon/5 sm:rounded-b-[2.5rem] sm:shadow-2xl">
            <div className="absolute right-4 top-4 z-10 flex gap-2 sm:right-6 sm:top-6">
              {isAdmin && featuredImage && (
                <button
                  onClick={() => setShowFeaturedImage(!showFeaturedImage)}
                  className="p-2 rounded-lg bg-white/90 text-brand-maroon shadow-lg backdrop-blur-sm transition-colors hover:bg-white"
                  title={showFeaturedImage ? "Hide featured image" : "Show featured image"}
                >
                  {showFeaturedImage ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              )}
              {isAdmin && featuredImage && featuredPhotoId && (
                <button
                  onClick={() => removePhoto(featuredPhotoId)}
                  className="p-2 rounded-lg bg-red-600/90 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-red-600"
                  title="Remove featured image"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <img
              src={featuredImage}
              alt="About Featured"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="relative block h-auto w-full"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
      )}

      <div className="relative mx-auto max-w-[96rem]">
        <div className="pointer-events-none absolute -top-10 right-0 h-[500px] w-[500px] rounded-full bg-brand-maroon opacity-[0.02] blur-[160px]" />

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="relative rounded-[1.75rem] border border-brand-maroon/10 bg-white p-4 shadow-[0_30px_90px_-30px_rgba(91,63,212,0.22)] sm:p-6 lg:p-8"
        >
          {/* Mission statement — full-width quote treatment so it no longer
              reads as a short line stranded on the left with dead space to
              the right. */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="relative mb-16 flex gap-4 border-l-4 border-brand-maroon/25 pl-5 sm:mb-20 sm:gap-6 sm:pl-8"
          >
            <Quote
              size={34}
              className="hidden shrink-0 -scale-x-100 text-brand-maroon/15 sm:block"
              aria-hidden="true"
            />
            <p className="w-full font-serif text-lg font-medium italic leading-relaxed text-brand-maroon sm:text-xl lg:text-2xl lg:leading-relaxed">
              We work to support communities in need, raise awareness about important social causes,
              and inspire people to come together for a better tomorrow.
            </p>
          </motion.div>

          {/* Founding badges + impact strip */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="mb-20 sm:mb-28"
          >
            <div className="mb-8 flex flex-nowrap items-center justify-center gap-2 sm:mb-10 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-maroon/20 bg-brand-maroon/[0.07] px-3.5 py-2.5 text-[11px] font-medium text-brand-maroon sm:gap-2 sm:px-5 sm:py-3 sm:text-base">
                <CalendarDays size={15} className="shrink-0 text-brand-maroon sm:h-[17px] sm:w-[17px]" />
                Est. 2021
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-maroon/20 bg-brand-maroon/[0.07] px-3.5 py-2.5 text-[11px] font-medium text-brand-maroon sm:gap-2 sm:px-5 sm:py-3 sm:text-base">
                <HandHeart size={15} className="shrink-0 text-brand-maroon sm:h-[17px] sm:w-[17px]" />
                Community-led service
              </span>
            </div>

            {/* Stats: one unified card with divider lines. Numbers use a
                medium-weight sans-serif with tabular figures for a clean,
                confident look without reading as heavy/bold; icons sit in
                a colored badge so they don't get lost next to the large
                numbers. */}
            <div className="grid grid-cols-3 divide-x divide-brand-maroon/10 overflow-hidden rounded-[1.5rem] border border-brand-maroon/10 bg-white shadow-sm sm:rounded-[2rem]">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-2 px-2 py-7 text-center sm:gap-3.5 sm:py-11"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-12 sm:w-12 ${stat.iconBg}`}>
                      <Icon size={18} className={`${stat.iconColor} sm:h-6 sm:w-6`} strokeWidth={2.25} />
                    </span>
                    <h3 className="font-sans text-3xl font-medium not-italic leading-none tracking-tight text-brand-maroon [font-variant-numeric:tabular-nums] sm:text-5xl lg:text-6xl">
                      <CountUpStat value={stat.value} suffix="+" />
                    </h3>
                    <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-brand-maroon/70 sm:text-xs sm:tracking-[0.16em]">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* The Ikshana Journey — signature timeline, 2021 to today */}
          <div className="relative mb-20 sm:mb-28">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 top-40 h-[420px] w-[420px] rounded-full bg-brand-maroon opacity-[0.03] blur-[140px]"
            />

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="relative mb-12 sm:mb-16"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-[3px] w-12 rounded-full bg-brand-maroon/60" />
                    <span className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-maroon sm:text-base">
                      Our Story
                    </span>
                  </div>
                  <h2 className="font-serif text-4xl italic text-brand-maroon sm:text-5xl">The Ikshana Journey</h2>
                </div>

                {isAdmin && (
                  <button
                    onClick={openAddMilestone}
                    className="inline-flex items-center gap-2 self-start rounded-full bg-brand-maroon px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-maroon/20 transition hover:bg-stone-900 sm:self-auto"
                  >
                    <Plus size={15} />
                    Add Milestone
                  </button>
                )}
              </div>
              <p className="mt-4 max-w-none text-base leading-7 text-brand-maroon/75 sm:text-lg sm:leading-8">
                Five years, one idea carried forward by volunteers: show up, keep showing up, and let the community lead.
              </p>
            </motion.div>

            <div className="relative">
              {/* Spine: a single solid brand-maroon line with a soft glow,
                  capped top and bottom with small circles so it reads as a
                  deliberately designed timeline rather than a stray rule.
                  Every node along it shares one color (TIMELINE_COLOR)
                  rather than fading in from a lighter tint at 2021. */}
              <div
                aria-hidden="true"
                className="absolute left-4 top-2 bottom-2 w-[3px] rounded-full sm:left-1/2 sm:-translate-x-1/2"
                style={{
                  backgroundColor: TIMELINE_COLOR,
                  opacity: 0.35,
                  boxShadow: `0 0 16px 0 ${TIMELINE_COLOR}33`,
                }}
              />
              <span
                aria-hidden="true"
                className="absolute left-4 top-2 z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full sm:left-1/2"
                style={{ backgroundColor: TIMELINE_COLOR }}
              />

              <div className="space-y-6 sm:space-y-8">
                {milestones.map((milestone, index) => {
                  const Icon = MILESTONE_ICONS[milestone.iconKey] ?? Sparkles;
                  const isRight = index % 2 === 1;
                  const dotColor = getDotColor(index, milestones.length);

                  return (
                    <motion.div
                      key={milestone.id}
                      initial={{ y: 24, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                      className={`relative flex flex-col gap-2 pl-14 sm:flex-row sm:items-center sm:gap-0 sm:pl-0 ${
                        isRight ? "sm:flex-row-reverse" : ""
                      }`}
                    >
                      {/* Dot */}
                      <div
                        aria-hidden="true"
                        className="absolute left-4 top-3 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white shadow-lg sm:left-1/2 sm:top-1/2 sm:h-[3.25rem] sm:w-[3.25rem] sm:-translate-y-1/2"
                        style={{ backgroundColor: dotColor }}
                      >
                        <Icon size={19} className="text-white sm:h-[22px] sm:w-[22px]" strokeWidth={2.25} />
                      </div>

                      {/* Connector stub linking the dot straight to its card so
                          the two sides of the zigzag don't feel disconnected */}
                      <span
                        aria-hidden="true"
                        className={`absolute top-1/2 hidden h-[3px] w-8 -translate-y-1/2 sm:block ${
                          isRight ? "left-1/2" : "right-1/2"
                        }`}
                        style={{ backgroundColor: dotColor }}
                      />

                      <div className={`sm:w-1/2 ${isRight ? "sm:pl-10" : "sm:pr-10"}`}>
                        <div className="group relative overflow-hidden rounded-[1.75rem] border border-brand-maroon/10 bg-white p-7 shadow-[0_18px_40px_-26px_rgba(122,31,45,0.28)] transition-all hover:-translate-y-1.5 hover:shadow-[0_28px_54px_-22px_rgba(122,31,45,0.32)] sm:rounded-[2.25rem] sm:p-9">
                          {/* Soft color bloom in the corner — adds richness
                              without any extra text or labels */}
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
                            style={{ backgroundColor: dotColor, opacity: 0.07 }}
                          />

                          <span
                            aria-hidden="true"
                            className="absolute inset-x-7 top-0 h-[3px] rounded-full sm:inset-x-9"
                            style={{ background: `linear-gradient(90deg, ${dotColor}, ${dotColor}30)` }}
                          />

                          {isAdmin && (
                            <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => openEditMilestone(milestone)}
                                className="rounded-full border border-brand-maroon/10 bg-white p-1.5 text-brand-maroon shadow-sm transition hover:bg-brand-maroon hover:text-white"
                                title="Edit milestone"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMilestone(milestone.id)}
                                className="rounded-full border border-brand-maroon/10 bg-white p-1.5 text-brand-maroon shadow-sm transition hover:bg-brand-maroon hover:text-white"
                                title="Delete milestone"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}

                          <span
                            className="relative block font-sans text-2xl font-medium not-italic tracking-tight [font-variant-numeric:tabular-nums] sm:text-4xl"
                            style={{ color: dotColor }}
                          >
                            {milestone.year}
                          </span>
                          <h4 className="relative mt-3 text-xl font-semibold text-brand-maroon sm:text-2xl">{milestone.title}</h4>
                          <span
                            aria-hidden="true"
                            className="relative mb-3 mt-1.5 block h-[3px] w-10 rounded-full"
                            style={{ background: `linear-gradient(90deg, ${dotColor}, ${dotColor}20)` }}
                          />
                          <p className="relative text-sm leading-6 text-brand-maroon/90 sm:text-base sm:leading-7 md:text-lg md:leading-8">
                            {milestone.description}
                          </p>
                        </div>
                      </div>
                      <div className="hidden sm:block sm:w-1/2" aria-hidden="true" />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Auto-scrolling gallery of moments from the archive */}
          {marqueePhotos.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="mb-20 sm:mb-28"
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-10 bg-brand-maroon/40" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-maroon/50">
                  Moments So Far
                </span>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-brand-maroon/10 bg-brand-maroon/5 py-6">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent sm:w-24" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent sm:w-24" />

                <div
                  className="ikshana-marquee-track flex w-max gap-4 px-4 hover:[animation-play-state:paused] sm:gap-6"
                  style={{ animationDuration: `${marqueeDuration}s` }}
                >
                  {marqueePhotos.map((photo, index) => (
                    <div
                      key={`${photo.id}-${index}`}
                      className="relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl shadow-sm sm:h-52 sm:w-72"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* About Archive Section */}
          <div className="space-y-8">
            {photos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                  {photos.map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-stone-100 border border-stone-100"
                    >
                      <img 
                        src={photo.url} 
                        alt={photo.caption}
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-maroon/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                        <p className="text-white font-serif text-sm mb-4 leading-tight">{photo.caption}</p>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => featurePhoto(photo.id)}
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${photo.is_featured ? 'bg-brand-maroon text-white' : 'bg-white/20 backdrop-blur-md text-white hover:bg-brand-maroon'}`}
                              title="Set as Main Image"
                            >
                              <Star size={16} fill={photo.is_featured ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => removePhoto(photo.id)}
                              className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-brand-maroon transition-colors"
                              title="Remove from archive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Add / edit milestone modal */}
      <AnimatePresence>
        {isMilestoneFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMilestoneForm}
              className="absolute inset-0 bg-stone-900/70 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-brand-maroon/10 px-7 py-5 sm:px-8">
                <h3 className="font-serif text-2xl text-brand-maroon sm:text-3xl">
                  {editingMilestoneId ? "Edit Milestone" : "Add Milestone"}
                </h3>
                <button
                  type="button"
                  onClick={closeMilestoneForm}
                  className="rounded-full border border-brand-maroon/15 bg-white p-2.5 text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleMilestoneSubmit} className="flex-1 space-y-6 overflow-y-auto px-7 py-7 sm:px-8">
                <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-brand-maroon/50">
                      Year
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="2027"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base font-serif focus:border-brand-maroon focus:outline-none"
                      value={milestoneForm.year}
                      onChange={(e) => setMilestoneForm((prev) => ({ ...prev, year: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-brand-maroon/50">
                      Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="A short headline for this year"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base font-serif focus:border-brand-maroon focus:outline-none"
                      value={milestoneForm.title}
                      onChange={(e) => setMilestoneForm((prev) => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-brand-maroon/50">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What happened this year?"
                    className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 focus:border-brand-maroon focus:outline-none"
                    value={milestoneForm.description}
                    onChange={(e) => setMilestoneForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-brand-maroon/50">
                    Icon
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(MILESTONE_ICONS) as MilestoneIconKey[]).map((key) => {
                      const Icon = MILESTONE_ICONS[key];
                      const active = milestoneForm.iconKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMilestoneForm((prev) => ({ ...prev, iconKey: key }))}
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                            active
                              ? "border-brand-maroon bg-brand-maroon text-white"
                              : "border-stone-200 bg-stone-50 text-brand-maroon/60 hover:border-brand-maroon/30"
                          }`}
                        >
                          <Icon size={17} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-brand-maroon py-4 text-xs font-bold uppercase tracking-[0.3em] text-white shadow-lg shadow-brand-maroon/20 transition hover:bg-stone-900"
                >
                  {editingMilestoneId ? "Update Milestone" : "Save Milestone"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
