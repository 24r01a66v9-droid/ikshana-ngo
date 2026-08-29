import { motion } from "motion/react";
import { ArrowRight, Heart, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function Hero() {
  const mottoSteps = [
    "your little help",
    "our passion to help",
    "someone's hope",
  ];

  const [mottoStepIndex, setMottoStepIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMottoStepIndex((previous) => (previous + 1) % mottoSteps.length);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [mottoStepIndex]);

  return (
    <section className="relative overflow-hidden bg-[#fffcfc]">
      <div className="mx-auto w-[94%] max-w-7xl px-1 sm:px-2 lg:px-4">
        <div className="relative overflow-hidden rounded-b-[2.5rem]">
          <div className="absolute left-0 top-0 h-1.5 w-full bg-brand-maroon/75" />

          <div
            className="
              flex
              justify-center
              px-0
              pt-28
              pb-16
              sm:pt-28
              sm:pb-20
              md:pt-32
              md:pb-24
              lg:pt-32
              lg:pb-28
              xl:min-h-[100svh]
              xl:items-start
              xl:pt-36
              xl:pb-32
              2xl:pt-36
              2xl:pb-32
            "
          >
            <div className="relative z-10 w-full max-w-6xl text-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.65 }}
                className="mx-auto mb-6 inline-flex items-center gap-2.5 rounded-full border border-brand-maroon/15 bg-white px-4 py-2.5 shadow-sm sm:mb-8 lg:mb-9"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-maroon text-white">
                  <Heart size={13} fill="currentColor" />
                </span>

                <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-brand-maroon sm:text-[10px]">
                  Student-led organization
                </span>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.8 }}
              >
                <div className="relative mx-auto w-fit max-w-full px-4 sm:px-8">

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-7 top-2 h-10 w-10 sm:-left-2 sm:top-0 sm:h-12 sm:w-12"
                  >
                    <span className="absolute left-0 top-5 h-5 w-1 rotate-[-35deg] rounded-full bg-brand-maroon/20 sm:h-10 sm:w-1.5" />
                    <span className="absolute left-3 top-2 h-4 w-1 rotate-[-18deg] rounded-full bg-brand-maroon/20 sm:left-5 sm:top-0 sm:h-8 sm:w-1.5" />
                    <span className="absolute left-6 top-0 h-3.5 w-1 rotate-[8deg] rounded-full bg-brand-maroon/20 sm:left-10 sm:top-[-4px] sm:h-6 sm:w-1.5" />
                  </div>

                  <h1
                    className="
                      font-serif
                      font-light
                      leading-[0.88]
                      tracking-[-0.045em]
                      text-brand-maroon
                      text-[3.35rem]
                      max-[380px]:text-[2.95rem]
                      sm:text-[4.7rem]
                      md:text-[5.8rem]
                      lg:text-[6.25rem]
                      xl:text-[7rem]
                      2xl:text-[7.5rem]
                    "
                  >
                    <span className="block whitespace-nowrap">
                      Supporting{" "}
                      <span className="relative inline-block italic">
                        Lives
                        <span
                          aria-hidden="true"
                          className="
                            absolute
                            bottom-[0.02em]
                            left-0
                            h-[0.055em]
                            w-full
                            rounded-full
                            bg-brand-maroon/20
                          "
                        />
                      </span>
                      ,
                    </span>

                    <span className="relative mt-2 block whitespace-nowrap italic sm:mt-1">
                      Spreading Hope
                      <span
                        aria-hidden="true"
                        className="
                          absolute
                          -right-5
                          bottom-[0.08em]
                          h-2.5
                          w-2.5
                          rounded-full
                          bg-brand-maroon/25
                          sm:h-3
                          sm:w-3
                        "
                      />
                    </span>
                  </h1>

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-2 bottom-0 h-10 w-14 sm:-right-5 sm:h-16 sm:w-24"
                  >
                    <div className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-brand-maroon/20 sm:h-3 sm:w-3" />
                    <div className="absolute right-0 top-3 h-7 w-12 rounded-br-[2rem] border-b-2 border-r-2 border-dashed border-brand-maroon/15 sm:right-2 sm:top-4 sm:h-12 sm:w-20 sm:rounded-br-[3rem]" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.7 }}
                className="mx-auto mt-10 w-full max-w-6xl sm:mt-12"
              >
                <div className="relative mx-auto w-full overflow-hidden rounded-[1.75rem] border border-brand-maroon/10 bg-white px-4 py-5 text-left shadow-[0_18px_55px_rgba(112,0,0,0.07)] sm:px-8 sm:py-8 lg:px-10 lg:py-9">
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-brand-maroon" />

                  <div className="min-w-0 pl-3 sm:pl-4">
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-brand-maroon/75 sm:mb-4 sm:text-sm">
                      <Sparkles size={13} />
                      Our motto
                    </div>

                    <div
                      aria-live="polite"
                      className="
                        w-full
                        font-serif
                        text-[clamp(1.18rem,5.35vw,1.65rem)]
                        font-medium
                        italic
                        leading-[1.15]
                        text-brand-maroon
                        max-[380px]:text-[1.48rem]
                        sm:text-2xl
                        md:text-[2.15rem]
                        lg:text-[2.55rem]
                      "
                    >

                      <div className="hidden w-full items-center justify-center gap-3 sm:gap-5 md:flex">
                        {mottoSteps.map((step, index) => {
                          const isVisible = index <= mottoStepIndex;

                          return (
                            <div key={step} className="flex shrink-0 items-center gap-3 sm:gap-5">
                              <motion.span
                                initial={false}
                                animate={{
                                  opacity: isVisible ? 1 : 0,
                                  y: isVisible ? 0 : 8,
                                }}
                                transition={{ duration: 0.2 }}
                                className={`inline-block ${
                                  isVisible ? "visible" : "invisible"
                                }`}
                              >
                                {step}
                              </motion.span>

                              {index < mottoSteps.length - 1 && (
                                <motion.span
                                  aria-hidden="true"
                                  initial={false}
                                  animate={{
                                    opacity: index < mottoStepIndex ? 1 : 0,
                                    scale: index < mottoStepIndex ? 1 : 0.8,
                                  }}
                                  transition={{ duration: 0.2 }}
                                  className="shrink-0 not-italic font-normal"
                                >
                                  {index === 0 ? "+" : "="}
                                </motion.span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex w-full flex-col items-center justify-center gap-3 px-1 text-center md:hidden">
                        <div className="flex w-full flex-nowrap items-center justify-center gap-x-2 px-0.5 max-[380px]:gap-x-1">
                          <motion.span
                            initial={false}
                            animate={{
                              opacity: mottoStepIndex >= 0 ? 1 : 0,
                              y: mottoStepIndex >= 0 ? 0 : 8,
                            }}
                            transition={{ duration: 0.2 }}
                            className="shrink-0 whitespace-nowrap"
                          >
                            {mottoSteps[0]}
                          </motion.span>

                          <motion.span
                            aria-hidden="true"
                            initial={false}
                            animate={{
                              opacity: mottoStepIndex >= 1 ? 1 : 0,
                              scale: mottoStepIndex >= 1 ? 1 : 0.8,
                            }}
                            transition={{ duration: 0.2 }}
                            className={`shrink-0 not-italic ${
                              mottoStepIndex >= 1 ? "visible" : "invisible"
                            }`}
                          >
                            +
                          </motion.span>

                          <motion.span
                            initial={false}
                            animate={{
                              opacity: mottoStepIndex >= 1 ? 1 : 0,
                              y: mottoStepIndex >= 1 ? 0 : 8,
                            }}
                            transition={{ duration: 0.2 }}
                            className={`shrink-0 ${
                              mottoStepIndex >= 1 ? "visible" : "invisible"
                            }`}
                          >
                            {mottoSteps[1]}
                          </motion.span>
                        </div>

                        <div className="flex w-full items-center justify-center gap-3 max-[380px]:gap-2">
                          <motion.span
                            aria-hidden="true"
                            initial={false}
                            animate={{
                              opacity: mottoStepIndex >= 2 ? 1 : 0,
                              scale: mottoStepIndex >= 2 ? 1 : 0.8,
                            }}
                            transition={{ duration: 0.2 }}
                            className={`shrink-0 not-italic ${
                              mottoStepIndex >= 2 ? "visible" : "invisible"
                            }`}
                          >
                            =
                          </motion.span>

                          <motion.span
                            initial={false}
                            animate={{
                              opacity: mottoStepIndex >= 2 ? 1 : 0,
                              y: mottoStepIndex >= 2 ? 0 : 8,
                            }}
                            transition={{ duration: 0.2 }}
                            className={`shrink-0 ${
                              mottoStepIndex >= 2 ? "visible" : "invisible"
                            }`}
                          >
                            {mottoSteps[2]}
                          </motion.span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-1.5 sm:mt-4">
                      {mottoSteps.map((_, index) => (
                        <span
                          key={index}
                          aria-hidden="true"
                          className={`h-1.5 rounded-full transition-all duration-300 sm:h-2 ${
                            index <= mottoStepIndex
                              ? "w-6 bg-brand-maroon"
                              : "w-1.5 bg-brand-maroon/15"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
                className="mx-auto mt-8 max-w-4xl text-center font-serif text-lg font-medium italic leading-relaxed text-brand-maroon/80 sm:mt-9 sm:text-xl lg:text-[1.4rem] xl:text-[1.5rem]"
              >
                Ikshana is a community-driven social service initiative dedicated
                to supporting those who need it most through compassion and
                responsibility.
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.7 }}
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-4 lg:flex-nowrap"
              >
                <a
                  href="/about"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-brand-maroon/20 bg-white px-7 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-maroon transition-all hover:border-brand-maroon hover:bg-brand-maroon hover:text-white sm:w-auto sm:min-w-[140px]"
                >
                  About
                  <ArrowRight size={15} />
                </a>

                <a
                  href="/careers"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand-maroon px-7 text-[10px] font-bold uppercase tracking-[0.22em] text-white shadow-xl shadow-brand-maroon/20 transition-all hover:-translate-y-0.5 hover:bg-stone-900 sm:w-auto sm:min-w-[220px]"
                >
                  Join Our Community
                  <ArrowRight size={15} />
                </a>

                <a
                  href="/sponsors"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-brand-maroon/20 bg-white px-7 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-maroon transition-all hover:border-brand-maroon hover:bg-brand-maroon hover:text-white sm:w-auto sm:min-w-[190px]"
                >
                  Support Our Cause
                  <ArrowRight size={15} />
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
