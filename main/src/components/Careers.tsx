import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Briefcase, MapPin, Clock, Plus, X, Trash2, Mail, Users, ChevronDown, ChevronLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface JobOpening {
  id: number;
  title: string;
  department: string | null;
  description: string;
  requirements: string | null;
  location: string | null;
  job_type: string;
  contact_email: string | null;
  is_active: boolean;
}

export default function Careers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newJob, setNewJob] = useState({
    title: "",
    department: "",
    description: "",
    requirements: "",
    location: "Hyderabad, Telangana",
    job_type: "volunteer",
    contact_email: "ikshana.4foundation@gmail.com",
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs");
      if (response.ok) setJobs(await response.json());
    } catch (e) {
      console.error("Failed to fetch jobs", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title || !newJob.description || loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJob),
      });

      if (response.ok) {
        await fetchJobs();
        setIsAdding(false);
        setNewJob({
          title: "",
          department: "",
          description: "",
          requirements: "",
          location: "Hyderabad, Telangana",
          job_type: "volunteer",
          contact_email: "ikshana.4foundation@gmail.com",
        });
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add position");
      }
    } catch (e) {
      console.error("Failed to add job", e);
    } finally {
      setLoading(false);
    }
  };

  const removeJob = async (id: number) => {
    if (!confirm("Remove this position?")) return;
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (response.ok) setJobs(jobs.filter((j) => j.id !== id));
    } catch (e) {
      console.error("Failed to delete job", e);
    }
  };

  const jobTypeLabels: Record<string, string> = {
    volunteer: "Volunteer",
    "part-time": "Part-Time",
    "full-time": "Full-Time",
    internship: "Internship",
  };

  return (
    <section id="careers" className="py-32 px-6 bg-[#fffcfc] relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-brand-maroon/[0.02] skew-x-12" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-24">
          {/* back link removed */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h2 className="text-7xl md:text-9xl font-serif tracking-tighter leading-[0.85] text-brand-maroon">
                Careers & <br />
                <span className="italic underline underline-offset-8 decoration-brand-maroon/10">Volunteering</span>
              </h2>
              
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-3 bg-brand-maroon text-white px-10 py-5 rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all shadow-xl self-start"
              >
                <Plus size={18} /> Post Position
              </button>
            )}
          </div>
        </div>

        {/* Join CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 p-8 md:p-12 bg-white rounded-[3rem] text-brand-maroon border border-stone-100"
        >
          <div className="flex items-start gap-6 flex-grow">
            <div className="w-14 h-14 bg-brand-maroon/5 rounded-2xl flex items-center justify-center text-brand-maroon shrink-0">
              <Users size={28} />
            </div>
            <div>
              <h3 className="text-xl font-serif text-brand-maroon mb-2">Interested in joining Ikshana?</h3>
              <p className="text-brand-maroon font-serif text-base leading-relaxed">Be part of a community working together to create meaningful change.</p>
            </div>
          </div>
          <a
            href="https://forms.gle/hfK5yXUjBdG6QKDf8"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 bg-brand-maroon text-white px-6 py-3 rounded-xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all whitespace-nowrap"
          >
            <Mail size={16} /> Apply Now
          </a>
        </motion.div>

        {jobs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-brand-maroon/10 rounded-[3rem]">
            <Briefcase size={48} className="text-brand-maroon/20 mx-auto mb-6" />
            <p className="text-brand-maroon/40 font-serif italic text-xl">No open positions at that moment.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden hover:shadow-xl transition-all duration-500"
              >
                <button
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  className="w-full p-8 sm:p-10 flex items-center justify-between text-left"
                >
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 bg-brand-maroon/5 rounded-2xl flex items-center justify-center text-brand-maroon shrink-0">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-brand-maroon/5 text-brand-maroon text-[9px] font-bold uppercase tracking-widest rounded-full">
                          {jobTypeLabels[job.job_type] || job.job_type}
                        </span>
                        {job.department && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-maroon/70">{job.department}</span>
                        )}
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-serif text-brand-maroon">{job.title}</h3>
                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-brand-maroon/70">
                        {job.location && (
                          <span className="flex items-center gap-1.5"><MapPin size={14} /> {job.location}</span>
                        )}
                        <span className="flex items-center gap-1.5"><Clock size={14} /> Open Position</span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={20} className={`text-brand-maroon/60 shrink-0 transition-transform ${expandedId === job.id ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expandedId === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-8 sm:px-10 pb-10 pt-0 border-t border-stone-50">
                        <div className="grid md:grid-cols-2 gap-10 pt-8">
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/60 mb-4">About the Role</h4>
                            <p className="text-brand-maroon/85 leading-relaxed">{job.description}</p>
                          </div>
                          {job.requirements && (
                            <div>
                              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/60 mb-4">Requirements</h4>
                              <p className="text-brand-maroon/85 leading-relaxed whitespace-pre-line">{job.requirements}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t border-stone-50">
                          {job.contact_email && (
                            <a
                              href={`mailto:${job.contact_email}?subject=Application%20for%20${encodeURIComponent(job.title)}`}
                              className="flex items-center gap-2 bg-brand-maroon text-white px-8 py-3 rounded-xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all"
                            >
                              <Mail size={16} /> Apply via Email
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => removeJob(job.id)}
                              className="flex items-center gap-2 text-brand-maroon/60 hover:text-brand-maroon text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                              <Trash2 size={14} /> Remove Position
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}

        {/* back link removed when no jobs */}

      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdding(false)} className="absolute inset-0 bg-stone-900/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900"><X size={20} /></button>
              <h3 className="text-3xl font-serif text-brand-maroon mb-8">Post Open Position</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Position Title</label>
                  <input required type="text" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon font-serif" placeholder="e.g. Event Coordinator" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Department</label>
                  <input type="text" value={newJob.department} onChange={(e) => setNewJob({ ...newJob, department: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" placeholder="e.g. Outreach, Media" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(jobTypeLabels).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setNewJob({ ...newJob, job_type: key })} className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest ${newJob.job_type === key ? "bg-brand-maroon text-white" : "bg-stone-50 text-stone-400"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Description</label>
                  <textarea required value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} className="w-full border border-stone-200 rounded-2xl p-4 focus:outline-none focus:border-brand-maroon resize-none h-24" placeholder="Role responsibilities and details..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Requirements</label>
                  <textarea value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} className="w-full border border-stone-200 rounded-2xl p-4 focus:outline-none focus:border-brand-maroon resize-none h-24" placeholder="Skills, experience, eligibility..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Location</label>
                  <input type="text" value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Contact Email</label>
                  <input type="email" value={newJob.contact_email} onChange={(e) => setNewJob({ ...newJob, contact_email: e.target.value })} className="w-full border-b border-stone-200 py-3 focus:outline-none focus:border-brand-maroon" />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-brand-maroon text-white py-4 rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all disabled:opacity-50">
                  {loading ? "Publishing..." : "Publish Position"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
