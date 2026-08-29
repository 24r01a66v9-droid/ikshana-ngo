import { Instagram, Linkedin, Mail, MapPin, ArrowUpRight } from "lucide-react";
import Logo from "./Logo";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/past-events" },
  { label: "Founders & Team", href: "/founders-team" },
  { label: "Team Archive", href: "/gallery" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "Careers", href: "/careers" },
  { label: "Reviews", href: "/reviews" },
];

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-brand-maroon px-5 py-8 text-white sm:px-8 sm:py-14 lg:px-10 lg:py-16 xl:px-16 xl:py-20"
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/20" />
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-32 h-80 w-80 rounded-full border border-white/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid gap-7 sm:gap-12 lg:grid-cols-[1.25fr_1fr_1fr] lg:gap-12 xl:gap-16">
          <section>
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.9rem] bg-white shadow-xl sm:h-16 sm:w-16 sm:rounded-[1.2rem] lg:h-[4.5rem] lg:w-[4.5rem]">
                <Logo className="h-8 w-8 sm:h-11 sm:w-11 lg:h-12 lg:w-12" />
              </div>

              <div>
                <div className="font-serif text-lg font-black tracking-[0.18em] sm:text-2xl sm:tracking-[0.28em] lg:text-3xl">
                  IKSHANA
                </div>
                <div className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.35em] text-white/60 sm:mt-1 sm:text-[8px] sm:tracking-[0.48em] lg:text-[9px]">
                  Foundation
                </div>
              </div>
            </div>

            <p className="mt-3 max-w-2xl font-serif text-sm italic leading-[1.4] text-white/85 sm:mt-7 sm:text-xl sm:leading-8 lg:text-[1.45rem] lg:leading-10">
              Fostering compassionate leaders, creators, and change-makers who
              support those in need, spread awareness, and create a better
              tomorrow.
            </p>
          </section>

          <section>
            <div className="mb-3 sm:mb-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/75 sm:text-[10px] sm:tracking-[0.3em] lg:text-[11px]">
                Explore
              </p>
              <h2 className="mt-1 font-serif text-lg italic text-white sm:text-2xl lg:text-3xl">
                Navigate
              </h2>
            </div>

            {/* Mobile: rounded pill chips that wrap to fit their own label
                width — matches the filter-tab language used elsewhere on
                the site instead of a plain underlined list. Swaps for the
                original bordered card grid from `sm` up. */}
            <nav className="flex flex-wrap gap-2 sm:hidden">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-white/85 transition-all active:scale-95 active:bg-white/[0.16]"
                >
                  {link.label}
                  <ArrowUpRight size={10} className="opacity-50" />
                </a>
              ))}
            </nav>

            <nav className="hidden sm:grid sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-2">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="group flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-[9px] font-bold uppercase tracking-[0.1em] text-white/85 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.13] hover:text-white"
                >
                  <span>{link.label}</span>
                  <ArrowUpRight
                    size={13}
                    className="shrink-0 opacity-40 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </a>
              ))}
            </nav>
          </section>

          <section>
            <div className="mb-3 sm:mb-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/75 sm:text-[10px] sm:tracking-[0.3em] lg:text-[11px]">
                Reach Us
              </p>
              <h2 className="mt-1 font-serif text-lg italic text-white sm:text-2xl lg:text-3xl">
                Contact
              </h2>
            </div>

            {/* space-y-3 gives Email/Location/Follow a real gap on mobile
                and on any width below `md`; the grid/space-y resets below
                take over the gap once the columns above them do. */}
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:block lg:space-y-3">
              <a
                href="mailto:ikshana.4foundation@gmail.com"
                className="group flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3 transition-all hover:border-white/25 hover:bg-white/[0.1] sm:rounded-xl sm:p-3.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] transition-colors group-hover:bg-white group-hover:text-brand-maroon sm:h-9 sm:w-9">
                  <Mail size={13} className="sm:hidden" />
                  <Mail size={15} className="hidden sm:block" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-white/40 sm:tracking-[0.22em]">
                    Email
                  </span>
                  <span className="mt-0.5 block break-all font-serif text-xs italic text-white/85 sm:text-base lg:text-lg">
                    ikshana.4foundation@gmail.com
                  </span>
                </span>
              </a>

              <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-3 sm:rounded-xl sm:border-white/10 sm:p-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] sm:h-9 sm:w-9">
                  <MapPin size={13} className="sm:hidden" />
                  <MapPin size={15} className="hidden sm:block" />
                </span>
                <span>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-white/40 sm:tracking-[0.22em]">
                    Location
                  </span>
                  <span className="mt-0.5 block font-serif text-xs italic text-white/85 sm:text-base lg:text-lg">
                    Hyderabad, Telangana
                  </span>
                </span>
              </div>

              <div className="pt-1 sm:pt-2 md:col-span-2 lg:col-span-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/65 sm:tracking-[0.28em]">
                  Follow Ikshana
                </p>

                <div className="mt-2.5 flex gap-2 sm:mt-3 sm:gap-2.5">
                  <a
                    href="https://www.instagram.com/ikshana_official/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ikshana on Instagram"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75 transition-all hover:-translate-y-1 hover:bg-white hover:text-brand-maroon sm:h-10 sm:w-10"
                  >
                    <Instagram size={16} className="sm:hidden" />
                    <Instagram size={18} className="hidden sm:block" />
                  </a>

                  <a
                    href="https://www.linkedin.com/company/ikshana-foundation/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ikshana on LinkedIn"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75 transition-all hover:-translate-y-1 hover:bg-white hover:text-brand-maroon sm:h-10 sm:w-10"
                  >
                    <Linkedin size={16} className="sm:hidden" />
                    <Linkedin size={18} className="hidden sm:block" />
                  </a>

                  <a
                    href="https://www.youtube.com/@IKSHANAFOUNDATION"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ikshana on YouTube"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75 transition-all hover:-translate-y-1 hover:bg-white hover:text-brand-maroon sm:h-10 sm:w-10"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="sm:hidden">
                      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.7.6 9.4.6 9.4.6s7.7 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.6 15.5v-7l6 3.5-6 3.5Z" />
                    </svg>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="hidden sm:block">
                      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.4.6A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.7.6 9.4.6 9.4.6s7.7 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8ZM9.6 15.5v-7l6 3.5-6 3.5Z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 sm:mt-12 sm:pt-7">
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-white/[0.055] px-5 py-4 text-center shadow-[0_12px_35px_rgba(0,0,0,0.1)] sm:px-8 sm:py-5">
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-white/20 sm:w-14" />
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 sm:text-[10px] sm:tracking-[0.3em]">
                Since 2021
              </span>
              <span className="h-px w-8 bg-white/20 sm:w-14" />
            </div>

            <p className="mt-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 sm:text-[11px] sm:tracking-[0.18em]">
              © {new Date().getFullYear()} Ikshana Foundation. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
