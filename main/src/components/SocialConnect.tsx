import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type SocialLink = {
  name: string;
  url: string;
  icon: ReactNode;
};

const socialLinks: SocialLink[] = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/ikshana_official",
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 sm:h-[21px] sm:w-[21px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      >
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle
          cx="17.25"
          cy="6.75"
          r="1"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/company/ikshana-foundation",
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 sm:h-[21px] sm:w-[21px]"
        fill="currentColor"
      >
        <path d="M6.4 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM4.95 10h2.9v9h-2.9v-9Zm4.75 0h2.78v1.23h.04c.39-.74 1.34-1.51 2.76-1.51 2.95 0 3.49 1.94 3.49 4.47V19h-2.9v-4.28c0-1.02-.02-2.33-1.42-2.33-1.42 0-1.64 1.1-1.64 2.26V19H9.7v-9Z" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/@IKSHANAFOUNDATION",
    icon: (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5 sm:h-[21px] sm:w-[21px]"
        fill="currentColor"
      >
        <path d="M23.3 6.45a2.9 2.9 0 0 0-2.05-2.06C19.58 4 12 4 12 4s-7.58 0-9.25.39A2.9 2.9 0 0 0 .7 6.45 30.1 30.1 0 0 0 .3 12a30.1 30.1 0 0 0 .4 5.55 2.9 2.9 0 0 0 2.05 2.06C4.42 20 12 20 12 20s7.58 0 9.25-.39a2.9 2.9 0 0 0 2.05-2.06A30.1 30.1 0 0 0 23.7 12a30.1 30.1 0 0 0-.4-5.55ZM9.6 15.55v-7.1l6.15 3.55-6.15 3.55Z" />
      </svg>
    ),
  },
];

export default function SocialConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[60] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-6"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-label="Connect with Ikshana"
            className="
              absolute bottom-[calc(100%+12px)] right-0
              w-[calc(100vw-2rem)] max-w-[360px]
              overflow-hidden rounded-[1.35rem]
              border border-brand-maroon/10
              bg-[#fffcfc]
              p-4
              shadow-[0_22px_60px_rgba(92,0,0,0.14)]
              sm:bottom-[calc(100%+14px)]
              sm:w-[360px]
              sm:rounded-[1.5rem]
              sm:p-5
            "
          >
            <div
              aria-hidden="true"
              className="absolute -bottom-2 right-7 h-4 w-4 rotate-45 border-b border-r border-brand-maroon/10 bg-[#fffcfc]"
            />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-maroon/45 sm:text-[10px]">
                  Follow our journey
                </p>
                <h3 className="mt-1 font-serif text-[1.45rem] italic leading-tight text-brand-maroon sm:text-[1.6rem]">
                  Connect with Ikshana
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close social media links"
                className="
                  flex h-9 w-9 shrink-0 items-center justify-center
                  rounded-full border border-brand-maroon/10
                  text-brand-maroon/65
                  transition-all duration-200
                  hover:border-brand-maroon/20
                  hover:bg-brand-maroon/5
                  hover:text-brand-maroon
                "
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="my-4 h-px bg-brand-maroon/10 sm:my-5" />

            <div className="space-y-2.5 sm:space-y-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    group flex min-h-[60px] items-center gap-3
                    rounded-[1rem]
                    border border-brand-maroon/10
                    bg-white
                    px-3
                    transition-all duration-200
                    hover:-translate-y-0.5
                    hover:border-brand-maroon/20
                    hover:bg-[#fffafa]
                    hover:shadow-[0_8px_24px_rgba(92,0,0,0.07)]
                    sm:min-h-[64px]
                    sm:gap-3.5
                    sm:rounded-[1.1rem]
                    sm:px-4
                  "
                >
                  <span
                    className="
                      flex h-10 w-10 shrink-0 items-center justify-center
                      rounded-full
                      border border-brand-maroon/10
                      bg-brand-maroon/[0.055]
                      text-brand-maroon
                      transition-all duration-200
                      group-hover:border-brand-maroon
                      group-hover:bg-brand-maroon
                      group-hover:text-white
                      group-hover:scale-105
                      sm:h-11 sm:w-11
                    "
                  >
                    {social.icon}
                  </span>

                  <span
                    className="
                      flex-1 min-w-0
                      font-sans text-[15px] font-medium
                      tracking-[-0.01em]
                      text-brand-maroon
                      sm:text-base
                    "
                  >
                    {social.name}
                  </span>

                  <span
                    className="
                      flex h-8 w-8 shrink-0 items-center justify-center
                      rounded-full
                      border border-brand-maroon/10
                      text-brand-maroon/55
                      transition-all duration-200
                      group-hover:border-brand-maroon
                      group-hover:bg-brand-maroon
                      group-hover:text-white
                      sm:h-9 sm:w-9
                    "
                  >
                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.8}
                      className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </span>
                </a>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 sm:mt-5">
              <span className="h-px flex-1 bg-brand-maroon/10" />
              <span className="whitespace-nowrap text-[7px] font-bold uppercase tracking-[0.28em] text-brand-maroon/35 sm:text-[8px]">
                Ikshana Foundation
              </span>
              <span className="h-px flex-1 bg-brand-maroon/10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={
          isOpen
            ? "Close social media links"
            : "Connect with Ikshana on social media"
        }
        aria-expanded={isOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        className="
          group relative flex h-14 w-14 items-center justify-center
          rounded-full border-[3px] border-white
          bg-brand-maroon text-white
          shadow-[0_12px_30px_rgba(128,0,0,0.25)]
          ring-1 ring-brand-maroon/10
          transition-shadow
          hover:shadow-[0_16px_38px_rgba(128,0,0,0.32)]
          sm:h-16 sm:w-16
        "
      >
        {!isOpen && (
          <span
            aria-hidden="true"
            className="
              absolute inset-1 rounded-full border border-white/30
              opacity-0 transition-all duration-200
              group-hover:scale-110 group-hover:opacity-100
            "
          />
        )}

        {isOpen ? (
          <X size={25} strokeWidth={1.8} />
        ) : (
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            className="relative h-8 w-8 sm:h-9 sm:w-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="24" r="5.5" />
            <circle cx="36" cy="12" r="5.5" />
            <circle cx="36" cy="36" r="5.5" />
            <path d="M17 21.5L31 14.5" />
            <path d="M17 26.5L31 33.5" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
