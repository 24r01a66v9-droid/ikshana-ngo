import { motion } from "motion/react";
import { Linkedin, Share2, Heart } from "lucide-react";

export default function SupportUs() {
  return (
    <section id="support" className="py-32 px-6 bg-brand-maroon relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-10"
        >
          <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center border border-white/20 shadow-2xl group hover:rotate-12 transition-transform duration-500">
            <Share2 size={48} className="text-white" />
          </div>
          <h2 className="text-6xl md:text-8xl font-serif text-white tracking-tighter leading-none italic">Boost Our <br />Mission</h2>
          <p className="text-2xl text-white/80 leading-relaxed font-serif italic max-w-3xl">
            "Help us reach more people! Follow, Like, Share, and <span className="text-white font-bold underline underline-offset-8 decoration-white/30">Repost</span> our updates on LinkedIn to spread hope and amplify our impact."
          </p>
          <div className="flex flex-col sm:flex-row gap-6 mt-8">
            <a 
              href="https://www.linkedin.com/company/ikshana-foundation/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-12 py-6 bg-white text-brand-maroon rounded-2xl font-bold tracking-widest uppercase text-[10px] flex items-center gap-3 hover:bg-stone-100 hover:scale-105 transition-all shadow-2xl shadow-black/20"
            >
              <Linkedin size={20} />
              Follow on LinkedIn
            </a>
            <a 
              href="#contact"
              className="px-12 py-6 border-2 border-white/30 text-white rounded-2xl font-bold tracking-widest uppercase text-[10px] flex items-center gap-3 hover:bg-white/10 hover:border-white transition-all"
            >
              <Heart size={20} />
              Support Our Cause
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
