import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, Upload, CheckCircle2, Search, FileText, X, Heart, MapPin, Calendar, Trash2, Edit3, Clock, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SeekHelp() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [checkContact, setCheckContact] = useState("");
  const [statusResult, setStatusResult] = useState<any>(null);
  const [statusError, setStatusError] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [fetchingRequests, setFetchingRequests] = useState(true);
  const [editingRequest, setEditingRequest] = useState<any>(null);

  useEffect(() => {
    fetchAllRequests();
  }, []);

  const fetchAllRequests = async () => {
    try {
      const response = await fetch("/api/medical-requests");
      if (response.ok) {
        const data = await response.json();
        // Filter out expired requests for non-admins
        const now = new Date();
        const filtered = isAdmin ? data : data.filter((req: any) => {
          if (!req.expiry_date) return true;
          return new Date(req.expiry_date) > now;
        });
        setAllRequests(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch all requests", error);
    } finally {
      setFetchingRequests(false);
    }
  };

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this request?")) return;
    
    setActionLoading(id);
    try {
      const response = await fetch(`/api/medical-request/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSuccessMessage("Request deleted successfully");
        await fetchAllRequests();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to delete request");
      }
    } catch (error) {
      console.error("Failed to delete request", error);
      alert("Failed to delete request. Check console.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/medical-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        setSuccessMessage(`Status updated to ${status}`);
        await fetchAllRequests();
        setEditingRequest(null);
      } else {
        const err = await response.json();
        alert(err.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateExpiry = async (id: number, expiry_date: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/medical-request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiry_date }),
      });
      if (response.ok) {
        setSuccessMessage(expiry_date ? `Expiry set to ${expiry_date}` : "Expiry cleared");
        await fetchAllRequests();
        setEditingRequest(null);
      } else {
        const err = await response.json();
        alert(err.error || "Failed to update expiry");
      }
    } catch (error) {
      console.error("Failed to update expiry", error);
      alert("Failed to update expiry.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map((f: File) => f.name);
      setSelectedFiles(names);
    }
  };

  const handleCheckStatus = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkContact) return;
    setCheckingStatus(true);
    setStatusError("");
    setStatusResult(null);
    try {
      const response = await fetch(`/api/medical-request/${checkContact}`);
      if (response.ok) {
        const data = await response.json();
        setStatusResult(data);
      } else {
        const err = await response.json();
        setStatusError(err.error || "No request found");
      }
    } catch (error) {
      setStatusError("Failed to check status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    // Handle files - convert to base64
    const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
    const files = fileInput?.files;
    
    const filePromises = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        filePromises.push(new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        }));
      }
    }

    try {
      const base64Files = await Promise.all(filePromises);
      data.documents = JSON.stringify(base64Files); // Store as JSON array of base64 strings

      const response = await fetch("/api/medical-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitted(true);
        setSelectedFiles([]);
        fetchAllRequests(); // Refresh the list
      }
    } catch (error) {
      console.error("Error submitting request:", error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section id="seek-help" className="py-24 px-6 bg-stone-50">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-12 rounded-[3rem] pill-shadow"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-serif mb-4">Request Received</h2>
            <p className="text-stone-600 mb-8">
              We have received your medical emergency request. Our team will review the details and contact you as soon as possible.
            </p>
            <button 
              onClick={() => setSubmitted(false)}
              className="text-brand-maroon font-bold uppercase tracking-widest text-sm hover:underline"
            >
              Submit another request
            </button>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="seek-help" className="py-32 px-6 bg-white relative overflow-hidden">
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm"
          >
            <CheckCircle2 size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute top-0 left-0 w-64 h-64 bg-brand-maroon/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-start relative z-10">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-4 mb-6"
          >
            <div className="h-[1px] w-12 bg-brand-maroon"></div>
            <span className="text-brand-maroon font-bold tracking-[0.2em] uppercase text-[10px]">Emergency Support</span>
          </motion.div>
            <h2 className="text-6xl md:text-7xl font-serif mb-10 tracking-tighter leading-none text-brand-maroon">Seek Medical <br /><span className="italic text-brand-maroon/40">Help</span></h2>
            {isAdmin && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-maroon/10 text-brand-maroon rounded-full mb-8 border border-brand-maroon/20">
                <Users size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Admin Management Mode Active</span>
              </div>
            )}
          <p className="text-brand-maroon/70 text-xl mb-12 leading-relaxed border-l-4 border-brand-maroon/10 pl-8 italic">
            If you or someone you know is facing a medical emergency and needs financial or logistical support, please fill out this form. Ikshana Foundation is committed to standing by those in need.
          </p>
          
          <div className="space-y-8 mb-16">
            <motion.div 
              whileHover={{ x: 10 }}
              className="flex gap-6 p-8 bg-brand-cream rounded-[2.5rem] shadow-sm border border-brand-maroon/5"
            >
              <div className="w-16 h-16 bg-brand-maroon text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-maroon/20">
                <AlertCircle size={32} />
              </div>
              <div>
                <h4 className="text-xl font-serif font-bold mb-2 text-brand-maroon">Verified Requests</h4>
                <p className="text-brand-maroon/60">All requests undergo a rigorous verification process to ensure help reaches the right people at the right time.</p>
              </div>
            </motion.div>
            <motion.div 
              whileHover={{ x: 10 }}
              className="flex gap-6 p-8 bg-brand-cream rounded-[2.5rem] shadow-sm border border-brand-maroon/5"
            >
              <div className="w-16 h-16 bg-brand-maroon text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-maroon/20">
                <Upload size={32} />
              </div>
              <div>
                <h4 className="text-xl font-serif font-bold mb-2 text-brand-maroon">Document Support</h4>
                <p className="text-brand-maroon/60">Please keep hospital bills, prescriptions, and ID proofs ready for verification. Digital copies are required.</p>
              </div>
            </motion.div>
          </div>

          {/* Check Status Form */}
          <div className="bg-stone-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-maroon/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
            <h3 className="text-2xl font-serif mb-6 flex items-center gap-3 text-white">
              <Search size={24} className="text-brand-maroon" />
              Check Request Status
            </h3>
            <form onSubmit={handleCheckStatus} className="flex gap-3 relative z-10">
              <input 
                type="tel" 
                placeholder="Enter Contact Number"
                value={checkContact}
                onChange={(e) => setCheckContact(e.target.value)}
                className="flex-1 px-6 py-4 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-maroon/50 text-white placeholder:text-stone-500 transition-all"
              />
              <button 
                disabled={checkingStatus}
                className="px-8 py-4 bg-brand-maroon text-white rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-white hover:text-stone-900 transition-all disabled:opacity-50 shadow-lg shadow-brand-maroon/20"
              >
                {checkingStatus ? "..." : "Check"}
              </button>
            </form>

            <AnimatePresence>
              {statusResult && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-6 pt-6 border-t border-stone-100 overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Patient</p>
                      <p className="font-bold">{statusResult.patient_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        statusResult.status === 'pending' ? 'bg-amber-100 text-amber-600' : 
                        statusResult.status === 'verified' ? 'bg-emerald-100 text-emerald-600' : 
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {statusResult.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 p-3 rounded-lg mb-4">
                    {statusResult.emergency_details.substring(0, 100)}...
                  </p>
                  
                  {statusResult.documents && (
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Documents</p>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          try {
                            const docs = JSON.parse(statusResult.documents);
                            return Array.isArray(docs) ? docs.map((doc: string, i: number) => (
                              <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200">
                                <img src={doc} alt={`Doc ${i+1}`} className="w-full h-full object-cover" />
                              </div>
                            )) : null;
                          } catch (e) {
                            return <span className="text-[10px] text-stone-400 italic">No previews available</span>;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setStatusResult(null)}
                    className="mt-4 text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-brand-maroon flex items-center gap-1"
                  >
                    <X size={12} /> Close
                  </button>

                  {isAdmin && (
                    <div className={`mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-2 transition-opacity ${actionLoading === statusResult.id ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                      <button 
                        onClick={() => handleUpdateStatus(statusResult.id, 'pending')}
                        className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-1"
                      >
                        {actionLoading === statusResult.id ? <Clock size={10} className="animate-spin" /> : null}
                        Reset
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(statusResult.id, 'verified')}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                      >
                        {actionLoading === statusResult.id ? <Clock size={10} className="animate-spin" /> : null}
                        Verify
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(statusResult.id, 'completed')}
                        className="px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all flex items-center gap-1"
                      >
                        {actionLoading === statusResult.id ? <Clock size={10} className="animate-spin" /> : null}
                        Complete
                      </button>
                      <button 
                        onClick={() => {
                          const date = prompt("Enter expiry date (YYYY-MM-DD) or leave empty to clear:", statusResult.expiry_date || "");
                          if (date !== null) handleUpdateExpiry(statusResult.id, date);
                        }}
                        className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-1"
                      >
                        {actionLoading === statusResult.id ? <Clock size={10} className="animate-spin" /> : null}
                        Set Expiry
                      </button>
                      <button 
                        onClick={async () => {
                          await handleDelete(statusResult.id);
                          setStatusResult(null);
                        }}
                        className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all ml-auto"
                      >
                        {actionLoading === statusResult.id ? <Clock size={10} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
              {statusError && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-xs text-brand-maroon font-medium"
                >
                  {statusError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="bg-white p-8 md:p-12 rounded-[3rem] pill-shadow"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Patient Name</label>
                <input 
                  required
                  name="patient_name"
                  type="text" 
                  placeholder="Full Name"
                  className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all text-brand-maroon placeholder:text-brand-maroon/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Contact Number</label>
                <input 
                  required
                  name="contact_number"
                  type="tel" 
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all text-brand-maroon placeholder:text-brand-maroon/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Hospital Name & Location</label>
              <input 
                name="hospital_name"
                type="text" 
                placeholder="Hospital Details"
                className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all text-brand-maroon placeholder:text-brand-maroon/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Emergency Details</label>
              <textarea 
                required
                name="emergency_details"
                rows={4}
                placeholder="Describe the medical emergency and what kind of support is needed..."
                className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all resize-none text-brand-maroon placeholder:text-brand-maroon/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Required Amount (Optional)</label>
              <input 
                name="required_amount"
                type="text" 
                placeholder="e.g. ₹50,000"
                className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all text-brand-maroon placeholder:text-brand-maroon/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-brand-maroon/40">Upload Documents (Prescriptions/Bills)</label>
              <div className="relative">
                <input 
                  name="documents"
                  type="file" 
                  multiple
                  onChange={handleFileChange}
                  className="w-full px-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-maroon/20 outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-maroon/10 file:text-brand-maroon hover:file:bg-brand-maroon/20 cursor-pointer text-brand-maroon/40"
                />
              </div>
              <AnimatePresence>
                {selectedFiles.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap gap-2 mt-3"
                  >
                    {selectedFiles.map((name, i) => (
                      <span key={i} className="flex items-center gap-1 px-3 py-1 bg-brand-maroon/5 text-brand-maroon rounded-full text-[10px] font-medium">
                        <FileText size={10} />
                        {name.length > 15 ? name.substring(0, 12) + '...' : name}
                      </span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-5 bg-brand-maroon text-white rounded-2xl font-bold tracking-widest uppercase text-[10px] hover:bg-stone-900 transition-all disabled:opacity-50 shadow-xl shadow-brand-maroon/20"
            >
              {loading ? "Submitting..." : "Submit Help Request"}
            </button>
            <p className="text-[10px] text-center text-brand-maroon/40 uppercase tracking-widest">
              By submitting, you agree to our verification process.
            </p>
          </form>
        </motion.div>
      </div>

      {/* Public Requests Section */}
      <div className="max-w-7xl mx-auto mt-32 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="h-[1px] w-12 bg-brand-maroon"></div>
              <span className="text-brand-maroon font-bold tracking-[0.2em] uppercase text-[10px]">Community Support</span>
            </motion.div>
            <h2 className="text-5xl md:text-6xl font-serif tracking-tighter leading-none text-brand-maroon">Active <br /><span className="italic text-brand-maroon/40">Requests</span></h2>
          </div>
          <div className="flex flex-col items-end gap-4">
            <p className="text-brand-maroon/60 max-w-md italic text-right">
              "Every request represents a life in need. Explore active cases and see how our community is coming together to support one another."
            </p>
            <button 
              onClick={() => fetchAllRequests()}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-maroon hover:text-stone-900 transition-colors"
            >
              <Clock size={14} /> Refresh List
            </button>
          </div>
        </div>

        {fetchingRequests ? (
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-stone-50 rounded-[2.5rem] animate-pulse" />
            ))}
          </div>
        ) : allRequests.length === 0 ? (
          <div className="text-center py-24 bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200">
            <Heart size={48} className="text-stone-200 mx-auto mb-6" />
            <h3 className="text-2xl font-serif text-brand-maroon/40">No active requests at the moment</h3>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {allRequests.map((req, idx) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-8 rounded-[2.5rem] pill-shadow border border-brand-maroon/5 group hover:border-brand-maroon/20 transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-brand-maroon/5 text-brand-maroon rounded-2xl flex items-center justify-center">
                    <Heart size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 
                      req.status === 'verified' ? 'bg-emerald-100 text-emerald-600' : 
                      req.status === 'completed' ? 'bg-blue-100 text-blue-600' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {req.status}
                    </span>
                    {req.expiry_date && (
                      <span className="text-[9px] text-brand-maroon/40 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Clock size={10} /> Exp: {new Date(req.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="text-2xl font-serif text-brand-maroon mb-2">{req.patient_name}</h4>
                <div className="flex items-center gap-2 text-brand-maroon/40 text-[10px] uppercase tracking-widest font-bold mb-4">
                  <MapPin size={12} />
                  {req.hospital_name || "Location Not Specified"}
                </div>

                <p className="text-brand-maroon/60 text-sm leading-relaxed mb-6 line-clamp-3 italic">
                  "{req.emergency_details}"
                </p>

                <div className="pt-6 border-t border-stone-100 flex justify-between items-center">
                  <div className="text-brand-maroon font-bold text-lg">
                    {req.required_amount || "Support Needed"}
                  </div>
                  <div className="flex items-center gap-2 text-brand-maroon/30 text-[10px] font-mono">
                    <Calendar size={12} />
                    {new Date(req.created_at).toLocaleDateString()}
                  </div>
                </div>

                {isAdmin && (
                  <div className={`mt-6 pt-6 border-t border-stone-100 flex flex-wrap gap-2 transition-opacity ${actionLoading === req.id ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <button 
                      onClick={() => handleUpdateStatus(req.id, 'pending')}
                      className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-1"
                    >
                      {actionLoading === req.id ? <Clock size={10} className="animate-spin" /> : null}
                      Reset
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(req.id, 'verified')}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-1"
                    >
                      {actionLoading === req.id ? <Clock size={10} className="animate-spin" /> : null}
                      Verify
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(req.id, 'completed')}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-1"
                    >
                      {actionLoading === req.id ? <Clock size={10} className="animate-spin" /> : null}
                      Complete
                    </button>
                    <button 
                      onClick={() => {
                        const date = prompt("Enter expiry date (YYYY-MM-DD) or leave empty to clear:", req.expiry_date || "");
                        if (date !== null) handleUpdateExpiry(req.id, date);
                      }}
                      className="px-3 py-1.5 bg-stone-50 text-stone-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-all flex items-center gap-1"
                    >
                      {actionLoading === req.id ? <Clock size={10} className="animate-spin" /> : null}
                      Set Expiry
                    </button>
                    <button 
                      onClick={() => handleDelete(req.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all ml-auto"
                    >
                      {actionLoading === req.id ? <Clock size={10} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
