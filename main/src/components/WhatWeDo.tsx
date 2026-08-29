import { motion } from "motion/react";
import { Home, HeartPulse, GraduationCap, Users2 } from "lucide-react";

export default function WhatWeDo() {
  const services = [
    {
      title: "Orphanage Support",
      icon: Home,
      description: "Providing food, groceries, clothes, educational materials, and emotional support to children in need.",
      details: ["Food & Groceries", "Clothes & Essentials", "Study Materials", "Social Support"]
    },
    {
      title: "Old-Age Home Support",
      icon: Users2,
      description: "Contributing groceries, hygiene kits, blankets, and most importantly, companionship to our elders.",
      details: ["Hygiene Kits", "Blankets & Clothing", "Emotional Care", "Companionship"]
    },
    {
      title: "Medical Assistance",
      icon: HeartPulse,
      description: "Offering monetary support to individuals who cannot afford treatments, medicines, or emergency care.",
      details: ["Treatment Costs", "Medicine Support", "Emergency Expenses", "Healthcare Access"]
    },
    {
      title: "Educational Support",
      icon: GraduationCap,
      description: "Helping underprivileged students continue their education through fees, books, and study materials.",
      details: ["School/College Fees", "Books & Stationery", "Mentorship", "Continuing Education"]
    }
  ];

  return (
    <section className="py-32 px-6 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center gap-4"
          >
            <span className="text-brand-maroon font-bold tracking-[0.3em] uppercase text-[10px] mb-2">Our Impact Areas</span>
            <h2 className="text-6xl md:text-7xl font-serif tracking-tighter text-brand-maroon">What We <span className="italic text-brand-maroon/40">Do</span></h2>
            <div className="h-[1px] w-24 bg-brand-maroon/20 mt-4"></div>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-12 rounded-[4rem] border border-stone-50 bg-stone-50/50 hover:bg-white hover:shadow-2xl hover:border-brand-maroon/10 transition-all duration-700 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-maroon/[0.02] rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 group-hover:bg-brand-maroon/[0.05] transition-colors" />
              
              <div className="flex flex-col lg:flex-row items-start gap-10 relative z-10">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white transition-all duration-700 shrink-0 shadow-xl shadow-stone-200/50 group-hover:shadow-brand-maroon/30 group-hover:-rotate-6">
                  <service.icon size={36} />
                </div>
                <div>
                  <h3 className="text-3xl font-serif mb-6 group-hover:text-brand-maroon transition-colors text-brand-maroon">{service.title}</h3>
                  <p className="text-brand-maroon/60 mb-10 leading-relaxed text-lg italic">
                    "{service.description}"
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {service.details.map((detail) => (
                      <span key={detail} className="px-5 py-2 bg-white text-brand-maroon/40 text-[10px] font-bold uppercase tracking-widest rounded-full border border-stone-100 group-hover:border-brand-maroon/20 group-hover:text-brand-maroon transition-all">
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
