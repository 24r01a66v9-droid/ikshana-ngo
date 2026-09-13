import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

const SUGGESTIONS = [
  { label: "Events", to: "/past-events" },
  { label: "Team Archive", to: "/gallery" },
  { label: "Founders & Team", to: "/founders-team" },
  { label: "Sponsors & Support", to: "/sponsors" },
  { label: "Careers", to: "/careers" },
  { label: "Reviews", to: "/reviews" },
];

/**
 * Catch-all route.
 *
 * Until now an unmatched path rendered nothing at all — just the navbar over
 * an empty white page, with no indication anything had gone wrong. That is
 * exactly what visitors saw when the Events page linked to "/team-archive",
 * a route that never existed.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <section className="flex min-h-[70vh] items-center px-5 pb-24 pt-36 sm:px-6 sm:pt-44">
      <div className="mx-auto w-full max-w-xl text-center">
        <span className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-panel bg-brand-maroon/8 text-brand-maroon">
          <Compass size={26} strokeWidth={1.7} />
        </span>

        <p className="text-label text-brand-maroon/70">Page not found</p>

        <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-brand-maroon sm:text-5xl">
          There's nothing at this address
        </h1>

        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-brand-maroon/65">
          We couldn't find{" "}
          <code className="rounded-chip bg-brand-maroon/6 px-1.5 py-0.5 font-mono text-[13px] text-brand-maroon/80">
            {pathname}
          </code>
          . It may have been moved, or the link that brought you here may be out
          of date.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          {SUGGESTIONS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="focus-ring inline-flex min-h-11 items-center rounded-full border border-brand-maroon/15 bg-white px-5 text-[13px] font-medium text-brand-maroon/80 shadow-rest transition-colors hover:border-brand-maroon/40 hover:text-brand-maroon"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          to="/"
          className="focus-ring mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-maroon px-6 text-label text-white transition-colors hover:bg-stone-900"
        >
          <ArrowLeft size={15} />
          Back to home
        </Link>
      </div>
    </section>
  );
}
