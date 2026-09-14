import { motion, useReducedMotion } from "motion/react";
import {
  Pencil,
  Trash2,
  Sprout,
  HandHeart,
  BookOpen,
  Megaphone,
  Users,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface JourneyMilestone {
  id: string;
  year: string;
  title: string;
  description: string;
  iconKey:
    | "sprout"
    | "handheart"
    | "bookopen"
    | "megaphone"
    | "users"
    | "sparkles"
    | "star";
}

interface JourneyTimelineProps {
  milestones: JourneyMilestone[];
  isAdmin: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const MILESTONE_ICONS: Record<JourneyMilestone["iconKey"], LucideIcon> = {
  sprout: Sprout,
  handheart: HandHeart,
  bookopen: BookOpen,
  megaphone: Megaphone,
  users: Users,
  sparkles: Sparkles,
  star: Star,
};

function Actions({
  milestone,
  isAdmin,
  onEdit,
  onDelete,
}: Omit<JourneyTimelineProps, "milestones"> & {
  milestone: JourneyMilestone;
}) {
  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onEdit(milestone.id)}
        aria-label={`Edit the ${milestone.year} milestone`}
        className="grid h-8 w-8 place-items-center rounded-full text-brand-maroon/55 transition hover:bg-brand-maroon/5 hover:text-brand-maroon"
      >
        <Pencil size={13} />
      </button>

      <button
        type="button"
        onClick={() => onDelete(milestone.id)}
        aria-label={`Delete the ${milestone.year} milestone`}
        className="grid h-8 w-8 place-items-center rounded-full text-brand-maroon/55 transition hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Card({
  milestone,
  isAdmin,
  onEdit,
  onDelete,
  tilt = 0,
}: {
  milestone: JourneyMilestone;
  isAdmin: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  tilt?: number;
}) {
  return (
    <div
      className="relative z-10 w-full transform-gpu transition-transform duration-300"
      style={{
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      <article className="relative w-full overflow-hidden rounded-[1.65rem] border border-brand-maroon/[0.11] bg-white px-5 py-5 shadow-[0_20px_55px_-36px_rgba(122,31,45,0.6)] transition duration-300 hover:-translate-y-0.5 hover:border-brand-maroon/20 hover:shadow-[0_26px_65px_-34px_rgba(122,31,45,0.65)] sm:px-7 sm:py-7 lg:px-8 lg:py-7">
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-0 h-[3px] rounded-full bg-gradient-to-r from-brand-maroon via-brand-maroon/65 to-brand-maroon/10 sm:inset-x-8"
      />

      <div className="flex items-start justify-between gap-3 sm:gap-5">
        <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-brand-maroon/15 bg-brand-cream/25 px-3 py-1.5 shadow-[0_6px_18px_-14px_rgba(122,31,45,0.5)] sm:px-4">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-maroon/8 text-brand-maroon">
            <TrendingUp size={13} strokeWidth={2.2} />
          </span>

          <span className="font-sans text-[1.35rem] font-semibold leading-none tracking-[-0.035em] text-brand-maroon sm:text-[1.7rem] lg:text-[1.85rem]">
            {milestone.year}
          </span>
        </div>

        <Actions
          milestone={milestone}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      <h3 className="mt-4 font-serif text-[1.3rem] leading-tight text-brand-maroon sm:text-[1.45rem] lg:text-[1.55rem]">
        {milestone.title}
      </h3>

      <div
        aria-hidden="true"
        className="mt-3 h-[3px] w-10 rounded-full bg-gradient-to-r from-brand-maroon/75 to-brand-maroon/10"
      />

      <p className="mt-4 w-full text-[14.5px] leading-7 text-stone-600 sm:text-[15px] lg:text-[15.5px] lg:leading-7">
        {milestone.description}
      </p>
      </article>
    </div>
  );
}

function TimelineNode({
  icon: Icon,
  size = "desktop",
}: {
  icon: LucideIcon;
  size?: "desktop" | "mobile";
}) {
  const mobile = size === "mobile";

  return (
    <span
      aria-hidden="true"
      className={`relative z-20 grid shrink-0 place-items-center rounded-full border-[3px] border-white bg-brand-maroon text-white shadow-[0_10px_25px_-10px_rgba(122,31,45,0.7)] ring-1 ring-brand-maroon/10 ${
        mobile ? "h-12 w-12" : "h-[3.35rem] w-[3.35rem]"
      }`}
    >
      <Icon
        size={mobile ? 19 : 21}
        strokeWidth={2}
      />
    </span>
  );
}

export default function JourneyTimeline({
  milestones,
  isAdmin,
  onEdit,
  onDelete,
}: JourneyTimelineProps) {
  const reduceMotion = useReducedMotion() ?? false;

  if (!milestones.length) return null;

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.06 },
        transition: {
          duration: 0.45,
          ease: [0.16, 1, 0.3, 1] as const,
        },
      };

  return (
    <motion.div data-testid="journey-timeline" {...reveal}>
      {/* Desktop / tablet
          The spine stays exactly in the centre. Each milestone has a
          connector running from the card edge to the centre of its icon. */}
      <div className="hidden md:block">
        <div className="relative mx-auto w-full max-w-7xl px-1 lg:px-3 xl:px-5">
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-1/2 top-2 w-[2px] -translate-x-1/2 bg-brand-maroon/20"
          />

          <span
            aria-hidden="true"
            className="absolute left-1/2 top-0 z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-maroon shadow-[0_0_0_5px_rgba(122,31,45,0.05)]"
          />

          <div className="space-y-7 lg:space-y-9">
            {milestones.map((milestone, index) => {
              const isRight = index % 2 === 1;
              const Icon =
                MILESTONE_ICONS[milestone.iconKey] ?? Sparkles;

              return (
                <motion.div
                  key={milestone.id}
                  initial={
                    reduceMotion ? undefined : { opacity: 0, y: 12 }
                  }
                  whileInView={
                    reduceMotion ? undefined : { opacity: 1, y: 0 }
                  }
                  viewport={{
                    once: true,
                    margin: "-50px",
                    amount: 0.18,
                  }}
                  transition={{
                    duration: 0.42,
                    delay: Math.min(index * 0.035, 0.18),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center"
                >
                  {/* Left card */}
                  <div className="min-w-0">
                    {!isRight && (
                      <Card
                        milestone={milestone}
                        isAdmin={isAdmin}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        tilt={index % 2 === 0 ? -0.45 : 0.45}
                      />
                    )}
                  </div>

                  {/* Centre node + connector */}
                  <div className="relative flex min-h-full items-center justify-center">
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 h-px -translate-y-1/2 bg-brand-maroon/30 ${
                        isRight
                          ? "left-1/2 right-0"
                          : "left-0 right-1/2"
                      }`}
                    />

                    <TimelineNode icon={Icon} />
                  </div>

                  {/* Right card */}
                  <div className="min-w-0">
                    {isRight && (
                      <Card
                        milestone={milestone}
                        isAdmin={isAdmin}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        tilt={index % 2 === 0 ? -0.45 : 0.45}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <span
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 z-10 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand-maroon shadow-[0_0_0_5px_rgba(122,31,45,0.05)]"
          />
        </div>
      </div>

      {/* Mobile
          On a phone, alternating two-column cards makes the content too
          narrow. Instead, use a true vertical timeline with the spine on
          the left and a full-width card beside it. The icon sits directly
          on the spine and the connector touches its centre. */}
      <div className="md:hidden">
        <div className="relative w-full pl-[4.25rem] pr-1 sm:pl-[4.75rem] sm:pr-2">
          {/* Continuous mobile spine */}
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-6 top-5 w-px bg-brand-maroon/20 sm:left-7"
          />

          {/* Start dot */}
          <span
            aria-hidden="true"
            className="absolute left-6 top-0 z-10 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-brand-maroon sm:left-7"
          />

          <div className="space-y-5 sm:space-y-6">
            {milestones.map((milestone, index) => {
              const Icon =
                MILESTONE_ICONS[milestone.iconKey] ?? Sparkles;

              return (
                <motion.div
                  key={milestone.id}
                  initial={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, y: 10 }
                  }
                  whileInView={
                    reduceMotion
                      ? undefined
                      : { opacity: 1, y: 0 }
                  }
                  viewport={{
                    once: true,
                    margin: "-30px",
                    amount: 0.08,
                  }}
                  transition={{
                    duration: 0.38,
                    delay: Math.min(index * 0.025, 0.12),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative min-w-0"
                >
                  {/* Connector from the centre of the icon to the card */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[-2.25rem] right-full top-1/2 z-0 h-px -translate-y-1/2 bg-brand-maroon/30 sm:left-[-2.5rem]"
                  />

                  {/* Icon sits exactly on the spine */}
                  <span className="pointer-events-none absolute left-[-2.25rem] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 sm:left-[-2.5rem]">
                    <TimelineNode icon={Icon} size="mobile" />
                  </span>

                  <Card
                    milestone={milestone}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    tilt={index % 2 === 0 ? -0.6 : 0.6}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* End dot */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-6 z-10 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand-maroon sm:left-7"
          />
        </div>
      </div>
    </motion.div>
  );
}
