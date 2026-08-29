import { ArrowRight } from "lucide-react";

const events = [
  {
    title: "Donation Drive for World Cancer Awareness Day",
    date: "November 9th, 2024",
    occasion: "Cancer Awareness & Medical Support",
    description:
      "A campus-wide donation drive held to support a patient in need and raise awareness about cancer and medical care.",
  },
  {
    title: "SIDDHI 3.0",
    date: "September 11th, 2024",
    occasion: "Vinayaka Chavithi Celebration",
    description:
      "A vibrant celebration that blended culture, creativity, and community engagement through competitions and student participation.",
  },
  {
    title: "Visit to Gundla Pochampalley",
    date: "June 1st, 2024",
    occasion: "Educational Awareness & Community Support",
    description:
      "Ikshana visited the village to spread awareness about education and support children with books, stationery, and joy.",
  },
];

export default function PastEventsSimple() {
  return (
    <section className="min-h-screen bg-brand-cream px-6 py-24 text-brand-maroon">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-brand-maroon/60">
            Our Journey
          </p>
          <h1 className="mb-6 text-4xl font-serif leading-tight sm:text-6xl">
            Past Events & Initiatives
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-brand-maroon/70">
            These are the community-driven initiatives and events that have shaped Ikshana’s mission of service, compassion, and impact.
          </p>
        </div>

        <div className="space-y-8">
          {events.map((event) => (
            <article
              key={event.title}
              className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-maroon/50">
                  {event.date}
                </span>
                <span className="rounded-full bg-brand-maroon/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon">
                  {event.occasion}
                </span>
              </div>
              <h2 className="mb-4 text-2xl font-serif sm:text-3xl">{event.title}</h2>
              <p className="mb-6 max-w-3xl text-base leading-relaxed text-brand-maroon/70">
                {event.description}
              </p>
              {/* back link removed */}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
