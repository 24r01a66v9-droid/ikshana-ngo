import { useState } from "react";
import { motion } from "motion/react";
import { Heart, ShieldCheck, Users, Star } from "lucide-react";

export default function MissionVision() {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const values = [
    { name: "Compassion", icon: Heart },
    { name: "Transparency", icon: Users },
    { name: "Accountability", icon: ShieldCheck },
    { name: "Dignity for All", icon: Users },
    { name: "Service Before Self", icon: Star },
  ];

  const missionPoints = [
    "To support children in orphanages and care for elderly in old-age homes.",
    "To provide financial assistance for medical treatments and education.",
    "To inspire youth to participate in meaningful social service.",
    "To build a society where no child is deprived of education, no elderly person feels neglected, and communities come together to uplift one another.",
  ];

  return (
    <section
      id="mission-vision"
      className="relative overflow-hidden px-4 pt-2 pb-16 sm:px-6 sm:pb-24"
    >
      <style>{`
        /*
         * CORE VALUES AUTO-HIGHLIGHT
         * ---------------------------------------------
         * One complete pass = 5000ms.
         * Each card is offset by 1000ms.
         *
         * This is CSS-only: React does not drive the timing or
         * repeatedly re-render the cards.
         */

        @keyframes coreValueHighlight {
          0%,
          14% {
            border-color: rgb(128 0 0);
            box-shadow:
              0 18px 45px -22px rgba(128, 0, 0, 0.55),
              0 0 0 2px rgba(128, 0, 0, 0.10);
            transform: translateY(-3px);
          }

          18% {
            border-color: rgb(128 0 0);
            box-shadow:
              0 18px 45px -22px rgba(128, 0, 0, 0.55),
              0 0 0 2px rgba(128, 0, 0, 0.10);
            transform: translateY(-3px);
          }

          22%,
          100% {
            border-color: rgb(245 245 244);
            box-shadow: 0 14px 40px -26px rgba(15, 15, 15, 0.25);
            transform: translateY(0);
          }
        }

        @keyframes coreValueIcon {
          0%,
          18% {
            border-color: rgb(128 0 0);
            color: rgb(128 0 0);
            transform: scale(1.07);
          }

          22%,
          100% {
            border-color: rgb(194 25 25 / 0.60);
            color: rgb(194 25 25);
            transform: scale(1);
          }
        }

        @keyframes coreValueAccent {
          0%,
          18% {
            opacity: 1;
            transform: scaleX(1);
          }

          22%,
          100% {
            opacity: 0;
            transform: scaleX(0);
          }
        }

        @keyframes coreValueText {
          0%,
          18% {
            font-weight: 600;
            color: rgb(128 0 0);
          }

          22%,
          100% {
            font-weight: 400;
            color: rgb(128 0 0 / 0.90);
          }
        }

        .core-value-auto {
          animation: coreValueHighlight 5000ms cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
          will-change: transform, border-color, box-shadow;
        }

        .core-value-auto-icon {
          animation: coreValueIcon 5000ms cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
          will-change: transform, border-color;
        }

        .core-value-auto-accent {
          animation: coreValueAccent 5000ms cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
          will-change: transform, opacity;
        }

        .core-value-auto-text {
          animation: coreValueText 5000ms cubic-bezier(0.4, 0, 0.2, 1)
            infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .core-value-auto,
          .core-value-auto-icon,
          .core-value-auto-accent,
          .core-value-auto-text {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Vision & Mission */}
        <div className="mb-10 sm:mb-14 lg:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative grid gap-8 overflow-hidden rounded-[2rem] border border-stone-100 bg-white p-6 shadow-2xl sm:gap-10 sm:rounded-[3rem] sm:p-10 lg:gap-12 lg:rounded-[5rem] lg:p-16"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-4 select-none font-serif text-[8rem] italic leading-none text-brand-maroon/[0.06] sm:text-[11rem] lg:right-10 lg:text-[14rem]"
            >
              &rdquo;
            </span>

            <div className="relative">
              <div className="mb-6 flex items-center gap-4 sm:mb-8 sm:gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-maroon text-white shadow-xl shadow-brand-maroon/25 sm:h-20 sm:w-20 sm:rounded-3xl">
                  <Heart size={22} className="sm:hidden" />
                  <Heart size={36} className="hidden sm:block" />
                </div>

                <div>
                  <h2 className="whitespace-nowrap font-serif text-2xl italic tracking-tight text-brand-maroon sm:text-3xl md:text-4xl">
                    Our Vision &amp; Mission
                  </h2>

                  <div className="mt-1.5 h-[3px] w-12 rounded-full bg-brand-maroon/25 sm:mt-2 sm:w-16" />
                </div>
              </div>

              <ul className="max-w-4xl space-y-3.5 text-sm leading-6 text-brand-maroon/90 sm:space-y-4 sm:text-base sm:leading-7 md:text-lg md:leading-8 lg:max-w-none">
                {missionPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-maroon sm:mt-2.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Core Values */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block"
          >
            <h3 className="mb-8 flex items-center justify-center gap-3 text-brand-maroon opacity-95 sm:mb-12 sm:gap-4 lg:mb-16">
              <div className="h-px w-8 bg-brand-maroon/50 sm:w-12" />

              <span className="font-serif text-2xl italic text-brand-maroon sm:text-3xl md:text-3xl">
                Our Core Values
              </span>

              <div className="h-px w-8 bg-brand-maroon/50 sm:w-12" />
            </h3>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5 lg:gap-8">
            {values.map((value, i) => {
              const isSelected = selectedValue === value.name;

              const isLastOfOddRow =
                values.length % 2 !== 0 && i === values.length - 1;

              const card = (
                <motion.button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedValue(value.name)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.45,
                  }}
                  whileHover={{ y: -6 }}
                  whileTap={{ scale: 0.98 }}
                  className={`core-value-auto group relative flex flex-col items-center gap-3 overflow-hidden rounded-[1.4rem] border-2 bg-white p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon/40 sm:gap-4 sm:rounded-[2rem] sm:p-6 ${
                    isLastOfOddRow
                      ? "w-[calc(50%-0.375rem)] sm:w-full"
                      : ""
                  }`}
                  style={{
                    animationDelay: `${i * 1000}ms`,
                  }}
                >
                  {/* Automatic highlight indicator */}
                  <span
                    aria-hidden="true"
                    className="core-value-auto-accent absolute inset-x-0 top-0 h-1 bg-brand-maroon"
                    style={{
                      animationDelay: `${i * 1000}ms`,
                      transformOrigin: "center",
                    }}
                  />

                  {/* Icon */}
                  <div
                    className={`core-value-auto-icon flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-2 sm:h-16 sm:w-16 sm:rounded-[1.6rem] ${
                      isSelected
                        ? "border-brand-maroon text-brand-maroon shadow-[0_10px_24px_-14px_rgba(128,0,0,0.6)]"
                        : "border-brand-red/60 text-brand-red"
                    }`}
                    style={{
                      animationDelay: `${i * 1000}ms`,
                    }}
                  >
                    <value.icon size={20} className="sm:hidden" />
                    <value.icon size={28} className="hidden sm:block" />
                  </div>

                  {/* Value name */}
                  <span
                    className={`core-value-auto-text font-serif text-center text-sm leading-snug sm:text-xl md:text-2xl ${
                      isSelected ? "font-semibold text-brand-maroon" : ""
                    }`}
                    style={{
                      animationDelay: `${i * 1000}ms`,
                    }}
                  >
                    {value.name}
                  </span>

                  {/* Manual click selection indicator */}
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-2 h-1 w-5 rounded-full bg-brand-maroon/25"
                    />
                  )}
                </motion.button>
              );

              return isLastOfOddRow ? (
                <div
                  key={value.name}
                  className="col-span-2 flex justify-center sm:contents"
                >
                  {card}
                </div>
              ) : (
                <div key={value.name} className="contents">
                  {card}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
