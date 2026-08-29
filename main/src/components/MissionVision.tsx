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
    <section id="about" className="pt-2 pb-16 px-4 sm:pb-24 sm:px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-10 sm:mb-14 lg:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden bg-white p-6 rounded-[2rem] shadow-2xl border border-stone-100 grid md:grid-cols-1 gap-8 sm:p-10 sm:rounded-[3rem] sm:gap-10 lg:p-16 lg:rounded-[5rem] lg:gap-12"
          >
            {/* Giant faint watermark quote mark — pure typographic texture,
                no fill or background color, just a very low-opacity glyph
                for editorial richness. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-6 right-4 select-none font-serif text-[8rem] italic leading-none text-brand-maroon/[0.06] sm:text-[11rem] lg:right-10 lg:text-[14rem]"
            >
              &rdquo;
            </span>

            <div className="relative">
              <div className="flex items-center gap-4 mb-6 sm:gap-6 sm:mb-8">
                <div className="w-12 h-12 bg-brand-maroon text-white rounded-2xl flex items-center justify-center shadow-xl shadow-brand-maroon/25 shrink-0 sm:w-20 sm:h-20 sm:rounded-3xl">
                  <Heart size={22} className="sm:hidden" />
                  <Heart size={36} className="hidden sm:block" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif tracking-tight italic text-brand-maroon whitespace-nowrap sm:text-3xl md:text-4xl">
                    Our Vision &amp; Mission
                  </h2>
                  <div className="mt-1.5 h-[3px] w-12 bg-brand-maroon/25 rounded-full sm:mt-2 sm:w-16" />
                </div>
              </div>

              <ul className="space-y-3.5 text-brand-maroon/80 text-sm leading-relaxed max-w-4xl lg:max-w-none sm:space-y-4 sm:text-base md:text-lg">
                {missionPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-maroon mt-1.5 shrink-0 sm:mt-2.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block"
          >
            <h3 className="text-brand-maroon mb-8 flex items-center justify-center gap-3 opacity-95 sm:mb-12 sm:gap-4 lg:mb-16">
              <div className="h-px w-8 bg-brand-maroon/50 sm:w-12" />
              <span className="font-serif italic text-2xl text-brand-maroon sm:text-3xl md:text-3xl">Our Core Values</span>
              <div className="h-px w-8 bg-brand-maroon/50 sm:w-12" />
            </h3>
          </motion.div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5 lg:gap-8">
            {values.map((value, i) => {
              const isSelected = selectedValue === value.name;
              const isLastOfOddRow = values.length % 2 !== 0 && i === values.length - 1;

              const card = (
                <motion.button
                  type="button"
                  onClick={() => setSelectedValue(value.name)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6 }}
                  className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-[1.4rem] border-2 bg-white p-4 transition-all duration-300 focus:outline-none sm:gap-4 sm:rounded-[2rem] sm:p-6 ${
                    isLastOfOddRow ? "w-[calc(50%-0.375rem)] sm:w-full" : ""
                  } ${
                    isSelected
                      ? "border-brand-maroon shadow-[0_20px_50px_-22px_rgba(128,0,0,0.55)] ring-2 ring-brand-maroon/15"
                      : "border-stone-100 shadow-[0_14px_40px_-26px_rgba(15,15,15,0.25)] hover:border-brand-red/40 hover:shadow-[0_18px_46px_-24px_rgba(194,25,25,0.35)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-1 transition-opacity duration-300 ${
                      isSelected ? "bg-brand-maroon opacity-100" : "bg-brand-red/40 opacity-0 group-hover:opacity-100"
                    }`}
                  />

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-[1.1rem] border-2 transition-all duration-300 sm:h-16 sm:w-16 sm:rounded-[1.6rem] ${
                      isSelected
                        ? "border-brand-maroon text-brand-maroon shadow-[0_10px_24px_-14px_rgba(128,0,0,0.6)]"
                        : "border-brand-red/60 text-brand-red group-hover:border-brand-red group-hover:shadow-[0_8px_20px_-14px_rgba(194,25,25,0.5)]"
                    }`}
                  >
                    <value.icon size={20} className="sm:hidden" />
                    <value.icon size={28} className="hidden sm:block" />
                  </div>

                  <span
                    className={`font-serif text-sm text-center leading-snug transition-colors duration-300 sm:text-xl md:text-2xl ${
                      isSelected ? "text-brand-maroon font-semibold" : "text-brand-maroon/90"
                    }`}
                  >
                    {value.name}
                  </span>
                </motion.button>
              );

              return isLastOfOddRow ? (
                <div key={value.name} className="col-span-2 flex justify-center sm:contents">
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
