import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, Handshake, Megaphone, Plus, X, Trash2, Mail, Phone, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Sponsor {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  type: string;
  contact_email: string | null;
  contact_phone: string | null;
}

const typeConfig: Record<string, { icon: typeof Heart; label: string; color: string }> = {
  sponsor: { icon: Handshake, label: "Partner", color: "bg-blue-50 text-blue-700" },
  donation: { icon: Heart, label: "Donation Drive", color: "bg-rose-50 text-rose-700" },
  advertisement: { icon: Megaphone, label: "Advertisement", color: "bg-amber-50 text-amber-700" },
};

export default function Sponsors() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newSponsor, setNewSponsor] = useState({
    name: "",
    description: "",
    logo_url: "",
    website_url: "",
    type: "sponsor",
    contact_email: "ikshana.4foundation@gmail.com",
    contact_phone: "",
  });

  useEffect(() => {
    fetchSponsors();
  }, []);

  const fetchSponsors = async () => {
    try {
      const response = await fetch("/api/sponsors");
      if (response.ok) setSponsors(await response.json());
    } catch (e) {
      console.error("Failed to fetch sponsors", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSponsor.name || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSponsor),
      });

      if (response.ok) {
        await fetchSponsors();
        setIsAdding(false);
        setNewSponsor({
          name: "",
          description: "",
          logo_url: "",
          website_url: "",
          type: "sponsor",
          contact_email: "ikshana.4foundation@gmail.com",
          contact_phone: "",
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add entry");
      }
    } catch (e) {
      console.error("Failed to add sponsor", e);
    } finally {
      setLoading(false);
    }
  };

  const removeSponsor = async (id: number) => {
    if (!confirm("Remove this entry?")) return;
    try {
      const response = await fetch(`/api/sponsors/${id}`, { method: "DELETE" });
      if (response.ok) setSponsors(sponsors.filter((s) => s.id !== id));
    } catch (e) {
      console.error("Failed to delete sponsor", e);
    }
  };

  return (
    <section id="sponsors" className="py-32 px-6 bg-brand-cream relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-16">
          {/* back link removed */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h2 className="mt-6 text-7xl md:text-9xl font-serif tracking-tighter leading-[0.85] text-brand-maroon">
                Sponsors & <br />
                <span className="italic underline underline-offset-8 decoration-brand-maroon/10">Support</span>
              </h2>
              
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-3 bg-brand-maroon text-white px-10 py-5 rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all shadow-xl self-start"
              >
                <Plus size={18} /> Add Entry
              </button>
            )}
          </div>
        </div>

        {/* Donation Call CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 p-12 bg-brand-maroon rounded-[3rem] text-white flex flex-col lg:flex-row items-start lg:items-start justify-between gap-8 lg:gap-12"
        >
          <div className="flex-grow">
            <p className="text-white/70 text-lg font-serif max-w-xl">
              Reach out to partner with Ikshana through sponsorships or support our donation drives. Together, we can amplify our impact and make a lasting difference.
            </p>
          </div>
          <a
            href="mailto:ikshana.4foundation@gmail.com"
            className="flex items-center gap-3 bg-white text-brand-maroon px-8 py-4 rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-100 transition-all whitespace-nowrap shrink-0 mt-4 lg:mt-0"
          >
            <Mail size={18} /> Email Us
          </a>
        </motion.div>

        {sponsors.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-brand-maroon/10 rounded-[3rem]">
            <Handshake size={48} className="text-brand-maroon/20 mx-auto mb-6" />
            <p className="text-brand-maroon/40 font-serif italic text-xl">Sponsor and partner listings will appear here.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sponsors.map((sponsor, i) => {
              const config = typeConfig[sponsor.type] || typeConfig.sponsor;
              const TypeIcon = config.icon;
              return (
                <motion.div
                  key={sponsor.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-white rounded-[2.5rem] p-10 border border-stone-100 hover:shadow-2xl transition-all duration-500"
                >
                  {isAdmin && (
                    <button
                      onClick={() => removeSponsor(sponsor.id)}
                      className="absolute top-4 right-4 w-9 h-9 bg-stone-50 text-brand-maroon rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-stone-900 hover:text-white transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <div className="flex items-start gap-6 mb-6">
                    {sponsor.logo_url ? (
                      <img src={sponsor.logo_url} alt={sponsor.name} className="w-16 h-16 rounded-2xl object-cover border border-stone-100" />
                    ) : (
                      <div className="w-16 h-16 bg-brand-maroon/5 rounded-2xl flex items-center justify-center text-brand-maroon">
                        <TypeIcon size={28} />
                      </div>
                    )}
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest mb-2 ${config.color}`}>
                        {config.label}
                      </span>
                      <h3 className="text-2xl font-serif text-brand-maroon">{sponsor.name}</h3>
                    </div>
                  </div>

                  {sponsor.description && (
                    <p className="text-brand-maroon/60 leading-relaxed mb-6">{sponsor.description}</p>
                  )}

                  <div className="space-y-3 pt-6 border-t border-stone-50">
                    {sponsor.contact_email && (
                      <a href={`mailto:${sponsor.contact_email}`} className="flex items-center gap-3 text-sm text-brand-maroon/60 hover:text-brand-maroon transition-colors">
                        <Mail size={14} /> {sponsor.contact_email}
                      </a>
                    )}
                    {sponsor.contact_phone && (
                      <a href={`tel:${sponsor.contact_phone}`} className="flex items-center gap-3 text-sm text-brand-maroon/60 hover:text-brand-maroon transition-colors">
                        <Phone size={14} /> {sponsor.contact_phone}
                      </a>
                    )}
                    {sponsor.website_url && (
                      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-brand-maroon hover:underline">
                        <ExternalLink size={14} /> Visit Website
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-stone-900/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900"><X size={20} /></button>
              <h3 className="text-3xl font-serif text-brand-maroon mb-8">Add Sponsor / Ad</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Name / Organization</label>
                  <input required type="text" value={newSponsor.name} onChange={(e) => setNewSponsor({ ...newSponsor, name: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon font-serif" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(typeConfig).map(([key, cfg]) => (
                      <button key={key} type="button" onClick={() => setNewSponsor({ ...newSponsor, type: key })} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${newSponsor.type === key ? "bg-brand-maroon text-white" : "bg-stone-50 text-stone-400"}`}>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Description</label>
                  <textarea value={newSponsor.description} onChange={(e) => setNewSponsor({ ...newSponsor, description: e.target.value })} className="w-full border border-stone-200 rounded-2xl p-4 focus:outline-none focus:border-brand-maroon resize-none h-24" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Logo URL (optional)</label>
                  <input type="url" value={newSponsor.logo_url} onChange={(e) => setNewSponsor({ ...newSponsor, logo_url: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Website URL (optional)</label>
                  <input type="url" value={newSponsor.website_url} onChange={(e) => setNewSponsor({ ...newSponsor, website_url: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Contact Email</label>
                  <input type="email" value={newSponsor.contact_email} onChange={(e) => setNewSponsor({ ...newSponsor, contact_email: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Contact Phone (optional)</label>
                  <input type="tel" value={newSponsor.contact_phone} onChange={(e) => setNewSponsor({ ...newSponsor, contact_phone: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-brand-maroon text-white py-4 rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all disabled:opacity-50">
                  {loading ? "Saving..." : "Publish Entry"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
