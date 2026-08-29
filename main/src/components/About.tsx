import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ImageIcon,
  Plus,
  X,
  Upload,
  Trash2,
  Pencil,
  Camera,
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
 * also POSTed to /api/milestones if that endpoint exists on the backend —
 * if it doesn't yet, the page still works, it just won't sync across
 * devices until that endpoint is added.
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
const lerpHexColor = (from: string, to: string, t: number) => {
  const f = parseInt(from.slice(1), 16);
  const g = parseInt(to.slice(1), 16);
  const fr = (f >> 16) & 255, fg = (f >> 8) & 255, fb = f & 255;
  const gr = (g >> 16) & 255, gg = (g >> 8) & 255, gb = g & 255;
  const r = Math.round(fr + (gr - fr) * t);
  const gCh = Math.round(fg + (gg - fg) * t);
  const b = Math.round(fb + (gb - fb) * t);
  return `#${((1 << 24) + (r << 16) + (gCh << 8) + b).toString(16).slice(1)}`;
};
const getDotColor = (index: number, total: number) =>
  lerpHexColor("#f2b9c4", "#7a1f2d", total <= 1 ? 1 : index / (total - 1));

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
  iconBg: string;
  iconColor: string;
  accent: string;
  border: string;
}[] = [
  {
    label: "Volunteers",
    value: 100,
    icon: Users,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    accent: "bg-amber-300",
    border: "border-amber-100",
  },
  {
    label: "Donation Drives",
    value: 30,
    icon: HandHeart,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    accent: "bg-rose-300",
    border: "border-rose-100",
  },
  {
    label: "Awareness Programs",
    value: 5,
    icon: Sparkles,
    iconBg: "bg-teal-100",
    iconColor: "text-teal-600",
    accent: "bg-teal-300",
    border: "border-teal-100",
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
  const [isAdding, setIsAdding] = useState(false);
  const [newPhoto, setNewPhoto] = useState({ caption: "", category: "about", file: null as File | null });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewPhoto({ ...newPhoto, file: e.target.files[0] });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setNewPhoto({ ...newPhoto, file: e.dataTransfer.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhoto.file) return;

    const formData = new FormData();
    formData.append("file", newPhoto.file);
    formData.append("title", newPhoto.caption || "About Moment");
    formData.append("category", newPhoto.category);
    formData.append("date", new Date().toLocaleDateString());
    // Only mark uploads as featured when the user explicitly chose the `hero` section
    formData.append("is_featured", newPhoto.category === "hero" ? "true" : "false");

    try {
      const response = await fetch("/api/photos", buildAuthRequestInit({
        method: "POST",
        body: formData,
      }));

      if (response.ok) {
        const result = await response.json();
        // If the upload was for the hero/main image, update the featured display.
        if (newPhoto.category === "hero") {
          setFeaturedImage(result.url);
          setFeaturedPhotoId(result.id);
          setShowFeaturedImage(true);
        }

        // Add to archive locally and then refresh from server. About-category uploads
        // will no longer override the featured image at the top of the page.
        setPhotos(prev => [{ id: result.id, url: result.url, caption: newPhoto.caption || "About Moment", is_featured: newPhoto.category === "hero" }, ...prev]);
        fetchPhotos();
        setIsAdding(false);
        setNewPhoto({ caption: "", category: "about", file: null });
      } else {
        const errorData = await response.json();
        alert(`Upload failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Failed to upload about photo", e);
      alert("An error occurred during upload. Please try again.");
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
    <section id="about" className="py-24 px-4 sm:py-32 sm:px-6 bg-white overflow-hidden">
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
          className="relative -mx-4 mb-16 sm:-mx-6 lg:-mx-10"
        >
          {/* Mobile: object-contain (full photo, nothing cropped) inside a
              shorter box, with a blurred copy of the same image filling the
              background so there's no stark empty letterboxing. Desktop
              keeps the tall, cinematic object-cover banner. */}
          <div className="relative h-[46vh] overflow-hidden rounded-b-[2rem] bg-brand-maroon/5 shadow-2xl sm:h-[85vh] sm:rounded-b-[2.5rem] lg:h-[92vh]">
            <img
              src={featuredImage}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl sm:hidden"
            />
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
              className="relative h-full w-full object-contain sm:object-cover"
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
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 max-w-3xl text-lg leading-relaxed text-brand-maroon/80 italic sm:mb-20 sm:text-xl"
          >
            We work to support communities in need, raise awareness about important social causes, and inspire people to come together for a better tomorrow.
          </motion.p>

          {/* Founding badges + impact strip */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="mb-20 sm:mb-28"
          >
            <div className="mb-8 flex flex-wrap items-center justify-center gap-3 sm:mb-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-maroon/15 bg-brand-maroon/5 px-5 py-3 text-sm font-semibold text-brand-maroon/80 sm:text-base">
                <CalendarDays size={17} className="text-brand-maroon" />
                Est. 2021
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-maroon/15 bg-brand-maroon/5 px-5 py-3 text-sm font-semibold text-brand-maroon/80 sm:text-base">
                <HandHeart size={17} className="text-brand-maroon" />
                Community-led service
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    whileHover={{ y: -4 }}
                    className={`relative overflow-hidden rounded-[1.35rem] border bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-lg sm:rounded-[1.75rem] sm:p-8 ${stat.border}`}
                  >
                    <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${stat.accent}`} />
                    <div className={`mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl sm:mb-4 sm:h-14 sm:w-14 ${stat.iconBg}`}>
                      <Icon size={18} className={`${stat.iconColor} sm:h-6 sm:w-6`} />
                    </div>
                    <h3 className="font-serif text-2xl text-brand-maroon sm:text-4xl lg:text-5xl">
                      <CountUpStat value={stat.value} suffix="+" />
                    </h3>
                    <p className="mt-1.5 text-[8px] font-bold uppercase leading-tight tracking-wider text-brand-maroon/45 sm:mt-2 sm:text-[10px] sm:tracking-[0.15em]">
                      {stat.label}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* The Ikshana Journey — signature timeline, 2021 to today */}
          <div className="mb-20 sm:mb-28">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="mb-12 flex flex-col gap-4 sm:mb-16 sm:flex-row sm:items-end sm:justify-between"
            >
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-px w-10 bg-brand-maroon/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-maroon/50">
                    Our Story
                  </span>
                </div>
                <h2 className="font-serif text-4xl text-brand-maroon sm:text-5xl">The Ikshana Journey</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-brand-maroon/60 sm:text-base">
                  Five years, one idea carried forward by volunteers: show up, keep showing up, and let the community lead.
                </p>
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
            </motion.div>

            <div className="relative">
              {/* Spine: lightens at the start (2021) and deepens toward the
                  brand maroon at the end (today), a small visual echo of the
                  foundation's own growth. */}
              <div
                aria-hidden="true"
                className="absolute left-[15px] top-2 bottom-2 w-px sm:left-1/2 sm:-translate-x-1/2"
                style={{ background: "linear-gradient(to bottom, #f2b9c4, #7a1f2d)" }}
              />

              <div className="space-y-8 sm:space-y-12">
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
                      className={`relative flex flex-col gap-2 pl-10 sm:flex-row sm:items-center sm:gap-0 sm:pl-0 ${
                        isRight ? "sm:flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className="absolute left-[7px] top-3 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white shadow-md sm:left-1/2 sm:top-1/2 sm:-translate-y-1/2"
                        style={{ backgroundColor: dotColor }}
                      >
                        <Icon size={11} className="text-white" />
                      </div>

                      <div className={`sm:w-1/2 ${isRight ? "sm:pl-10" : "sm:pr-10"}`}>
                        <div className="group relative rounded-[1.5rem] border border-brand-maroon/10 bg-white p-5 shadow-[0_14px_34px_-22px_rgba(91,63,212,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_44px_-20px_rgba(91,63,212,0.35)] sm:rounded-[1.75rem] sm:p-7">
                          {isAdmin && (
                            <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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

                          <span className="font-serif text-2xl sm:text-3xl" style={{ color: dotColor }}>
                            {milestone.year}
                          </span>
                          <h4 className="mt-1.5 text-base font-bold text-brand-maroon sm:text-lg">{milestone.title}</h4>
                          <p className="mt-1.5 text-sm leading-6 text-brand-maroon/65">{milestone.description}</p>
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-maroon/50">
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
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-px w-10 bg-brand-maroon/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-maroon/50">
                    Faces &amp; Moments
                  </span>
                </div>
                <h3 className="font-serif text-2xl text-brand-maroon sm:text-3xl">The people behind the work</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-brand-maroon/60">
                  A closer look at the volunteers, events, and everyday moments that make up Ikshana.
                </p>
              </div>

              {isAdmin && (
                <button 
                  onClick={() => { setNewPhoto({ caption: "", category: "about", file: null }); setIsAdding(true); }}
                  className="flex items-center gap-3 bg-brand-maroon text-white px-8 py-5 rounded-full font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all shadow-xl shadow-brand-maroon/20 self-start"
                >
                  <Camera size={16} />
                  Add Team Photo
                </button>
              )}
            </motion.div>

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

      {/* Upload Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl"
            >
              <button 
                onClick={() => setIsAdding(false)}
                className="absolute top-8 right-8 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-10">
                <span className="text-brand-red font-bold tracking-widest uppercase text-[10px] mb-2 block">Foundation Archive</span>
                <h3 className="text-4xl font-serif">Add Team Photo</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="group">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Section</label>
                  <div className="flex gap-3">
                    <div>
                      <span className="px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest bg-brand-maroon text-white shadow-lg shadow-brand-maroon/20">About Archive</span>
                      <p className="text-[10px] text-stone-400 mt-2">Team photos are always saved to the About archive and won't replace the page hero.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3">Caption</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g., Founding team meeting, 2021"
                    className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all font-serif"
                    value={newPhoto.caption}
                    onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })}
                  />
                </div>

                <div 
                  className={`relative border-2 border-dashed rounded-[2.5rem] p-10 transition-all flex flex-col items-center justify-center text-center group ${
                    dragActive ? "border-brand-red bg-brand-red/5" : "border-stone-100 bg-stone-50 hover:bg-stone-100/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {newPhoto.file ? (
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 rounded-[1.5rem] overflow-hidden mb-6 shadow-xl border-4 border-white">
                        <img 
                          src={URL.createObjectURL(newPhoto.file)} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-stone-900 font-serif text-xs mb-2">{newPhoto.file.name}</p>
                      <button 
                        type="button"
                        onClick={() => setNewPhoto({ ...newPhoto, file: null })}
                        className="text-brand-red text-[10px] font-bold uppercase tracking-widest hover:underline"
                      >
                        Replace Image
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-stone-300 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                        <Upload size={20} />
                      </div>
                      <p className="text-stone-500 text-xs mb-2 font-serif">
                        Drop a team memory here
                      </p>
                      <p className="text-stone-400 text-[10px] uppercase tracking-widest">
                        or <span className="text-brand-red font-bold cursor-pointer">browse files</span>
                      </p>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                      />
                    </>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={!newPhoto.file}
                  className="w-full bg-stone-900 text-white py-6 rounded-2xl font-bold tracking-[0.2em] uppercase text-[10px] hover:bg-brand-red transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                >
                  {newPhoto.category === "hero" ? "Save as Hero" : "Save to Archive"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
