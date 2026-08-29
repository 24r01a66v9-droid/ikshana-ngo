import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, CalendarDays, Camera, PlayCircle, Sparkles, Users, HeartHandshake, BadgeCheck } from "lucide-react";

interface EventCardData {
  id: number;
  date: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
}

const placeholderEvents: EventCardData[] = [
  {
    id: 1,
    date: "Event Date",
    category: "Category Badge",
    title: "Event Title Placeholder",
    description: "Short event description placeholder for your upcoming story, impact, and community moment.",
    tags: ["Impact Tag", "Impact Tag", "Impact Tag"],
  },
  {
    id: 2,
    date: "Event Date",
    category: "Category Badge",
    title: "Event Title Placeholder",
    description: "Short event description placeholder for your upcoming story, impact, and community moment.",
    tags: ["Impact Tag", "Impact Tag", "Impact Tag"],
  },
  {
    id: 3,
    date: "Event Date",
    category: "Category Badge",
    title: "Event Title Placeholder",
    description: "Short event description placeholder for your upcoming story, impact, and community moment.",
    tags: ["Impact Tag", "Impact Tag", "Impact Tag"],
  },
];

function PlaceholderSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200/80 bg-stone-50/70 p-6">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/50">{title}</h4>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

export default function PastEventsShell() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <section className="min-h-screen bg-brand-cream px-6 py-24 text-brand-maroon sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-[3rem] border border-stone-200/70 bg-white/80 p-10 shadow-[0_25px_80px_-35px_rgba(120,37,30,0.35)] backdrop-blur-sm sm:p-14 lg:p-16"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.35em] text-brand-maroon/60">
                <Sparkles size={14} />
                <span>Past Events & Initiatives</span>
              </div>
              <h1 className="text-4xl font-serif leading-tight sm:text-5xl lg:text-6xl">
                Past Events & Initiatives
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-maroon/70 sm:text-xl">
                Placeholder description for the story of our community-led work and impact.
              </p>
            </div>
            <div className="rounded-[2rem] border border-brand-maroon/10 bg-brand-maroon/5 px-6 py-5 text-sm text-brand-maroon/70">
              <p className="font-semibold">Ready for your content</p>
              <p className="mt-2">Replace placeholders with your own event details whenever you are ready.</p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {placeholderEvents.map((event, index) => {
            const isExpanded = expandedId === event.id;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.07 }}
                className="group overflow-hidden rounded-[2.25rem] border border-stone-200/80 bg-white shadow-[0_20px_60px_-30px_rgba(120,37,30,0.35)]"
              >
                <div className="p-7 sm:p-8">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/50">
                    <span>{event.date}</span>
                    <span className="rounded-full bg-brand-maroon/10 px-3 py-1 text-[9px] text-brand-maroon">
                      {event.category}
                    </span>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-dashed border-brand-maroon/15 bg-gradient-to-br from-[#f7e7e2] via-white to-[#f3ece8] p-6">
                    <div className="flex h-40 items-center justify-center rounded-[1.25rem] border border-white/70 bg-white/70">
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-maroon/10 text-brand-maroon">
                          <Camera size={20} />
                        </div>
                        <p className="text-sm font-semibold text-brand-maroon">Cover Image / Video Placeholder</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-brand-maroon/50">Upload media here</p>
                      </div>
                    </div>
                  </div>

                  <h2 className="mt-7 text-3xl font-serif leading-tight text-brand-maroon">
                    {event.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-brand-maroon/70">
                    {event.description}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {event.tags.map((tag, tagIndex) => (
                      <span key={`${event.id}-${tag}-${tagIndex}`} className="rounded-full border border-brand-maroon/10 bg-brand-maroon/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-maroon/70">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="mt-8 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon transition-all hover:gap-3"
                    aria-expanded={isExpanded}
                  >
                    Explore More
                    <ArrowRight size={14} />
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden border-t border-stone-200/70 bg-stone-50/70"
                    >
                      <div className="space-y-5 p-7 sm:p-8">
                        <PlaceholderSection title="Full Event Description">
                          <p className="text-sm leading-relaxed text-brand-maroon/70">
                            Full event description placeholder. Add your complete narrative, story, and community context here.
                          </p>
                        </PlaceholderSection>

                        <div className="grid gap-5 md:grid-cols-2">
                          <PlaceholderSection title="Image Gallery">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="flex h-24 items-center justify-center rounded-[1rem] border border-dashed border-brand-maroon/15 bg-white/70 text-center text-xs uppercase tracking-[0.25em] text-brand-maroon/50">
                                Gallery Item
                              </div>
                              <div className="flex h-24 items-center justify-center rounded-[1rem] border border-dashed border-brand-maroon/15 bg-white/70 text-center text-xs uppercase tracking-[0.25em] text-brand-maroon/50">
                                Gallery Item
                              </div>
                            </div>
                          </PlaceholderSection>

                          <PlaceholderSection title="Video">
                            <div className="flex h-24 items-center justify-center rounded-[1rem] border border-dashed border-brand-maroon/15 bg-white/70 text-center text-xs uppercase tracking-[0.25em] text-brand-maroon/50">
                              <div className="flex items-center gap-2">
                                <PlayCircle size={16} />
                                Video Placeholder
                              </div>
                            </div>
                          </PlaceholderSection>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <PlaceholderSection title="Achievements">
                            <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/70 bg-white/70 p-3 text-sm text-brand-maroon/70">
                              <BadgeCheck size={16} className="text-brand-maroon" />
                              Achievement placeholder
                            </div>
                            <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/70 bg-white/70 p-3 text-sm text-brand-maroon/70">
                              <BadgeCheck size={16} className="text-brand-maroon" />
                              Achievement placeholder
                            </div>
                          </PlaceholderSection>

                          <PlaceholderSection title="Volunteers">
                            <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/70 bg-white/70 p-3 text-sm text-brand-maroon/70">
                              <Users size={16} className="text-brand-maroon" />
                              Volunteer placeholder
                            </div>
                            <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/70 bg-white/70 p-3 text-sm text-brand-maroon/70">
                              <Users size={16} className="text-brand-maroon" />
                              Volunteer placeholder
                            </div>
                          </PlaceholderSection>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <PlaceholderSection title="Funds Raised">
                            <p className="text-sm leading-relaxed text-brand-maroon/70">₹0 placeholder</p>
                          </PlaceholderSection>

                          <PlaceholderSection title="Beneficiaries">
                            <p className="text-sm leading-relaxed text-brand-maroon/70">Beneficiary placeholder</p>
                          </PlaceholderSection>
                        </div>

                        <PlaceholderSection title="Additional Details">
                          <div className="flex items-center gap-3 rounded-[1rem] border border-stone-200/70 bg-white/70 p-3 text-sm text-brand-maroon/70">
                            <HeartHandshake size={16} className="text-brand-maroon" />
                            Additional details placeholder for partners, notes, outcomes, or next steps.
                          </div>
                        </PlaceholderSection>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
