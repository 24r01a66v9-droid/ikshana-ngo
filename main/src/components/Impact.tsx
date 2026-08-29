import { motion } from "motion/react";

export default function Impact() {
  const stats = [
    { label: "Founding Volunteers", value: "15+" },
    { label: "Year Established", value: "2021" },
    { label: "Medical Cases Assisted", value: "45+" },
    { label: "Students Supported", value: "30+" },
    { label: "Donation Drives", value: "25+" },
  ];

  return (
    <section className="py-32 px-6 bg-stone-950 text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-brand-maroon rounded-full blur-[160px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-4"
          >
            <span className="text-brand-maroon font-bold tracking-[0.4em] uppercase text-[10px] mb-2">Real Numbers</span>
            <h2 className="text-6xl md:text-7xl font-serif tracking-tighter text-white">Our Growing <span className="italic text-brand-maroon">Impact</span></h2>
            <div className="h-[1px] w-24 bg-brand-maroon/40 mt-4"></div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center group"
            >
              <div className="relative inline-block mb-6">
                <h3 className="text-6xl md:text-7xl font-serif text-white group-hover:text-brand-maroon transition-colors duration-500">{stat.value}</h3>
                <div className="absolute -bottom-2 left-0 w-0 h-1 bg-brand-maroon group-hover:w-full transition-all duration-500" />
              </div>
              <p className="text-brand-maroon/60 text-[10px] uppercase tracking-[0.2em] font-bold leading-relaxed max-w-[120px] mx-auto">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
