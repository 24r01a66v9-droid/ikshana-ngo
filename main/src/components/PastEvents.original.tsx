import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Palette, PenTool, Image as ImageIcon, Heart, ShieldCheck, X, Award, ArrowRight, Upload, Trash2, Camera } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface EventPhoto {
  id: string;
  url: string;
  title?: string;
  caption?: string;
  is_featured: boolean;
}

interface Activity {
  name: string;
  icon: any;
  description: string;
}

interface Event {
  id?: string;
  title: string;
  date: string;
  occasion: string;
  description: string;
  activities: Activity[];
  acknowledgments?: string;
  image?: string | null;
}

const ADMIN_EMAILS = ["24r01a66v9@cmrithyderabad.edu.in"];

function getActivityIcon(icon: unknown) {
  if (typeof icon === "function") {
    return icon;
  }

  if (typeof icon === "string") {
    const normalized = icon.toLowerCase();
    switch (normalized) {
      case "pentool":
        return PenTool;
      case "heart":
        return Heart;
      case "shieldcheck":
        return ShieldCheck;
      case "award":
        return Award;
      case "imageicon":
        return ImageIcon;
      case "palette":
      default:
        return Palette;
    }
  }

  return Palette;
}

function normalizeActivities(activities: unknown): Activity[] {
  if (Array.isArray(activities)) {
    return activities.map((activity: any) => ({
      name: typeof activity?.name === "string" ? activity.name : "",
      icon: getActivityIcon(activity?.icon),
      description: typeof activity?.description === "string" ? activity.description : "",
    }));
  }

  if (typeof activities === "string") {
    return activities
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((activityLine) => ({
        name: activityLine,
        icon: Palette,
        description: activityLine,
      }));
  }

  return [];
}

export default function PastEvents() {
  const { user } = useAuth();
  const isAdmin = Boolean(
    user?.role === "admin" ||
    (user?.email && ADMIN_EMAILS.includes(user.email))
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventPhotos, setEventPhotos] = useState<EventPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [editedEvents, setEditedEvents] = useState<Record<string, Event>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = window.localStorage.getItem("ikshana_edited_events");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [deletedEventIds, setDeletedEventIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem("ikshana_deleted_events");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [serverEvents, setServerEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    occasion: "",
    description: "",
    acknowledgments: "",
    activities: "",
  });
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingActivities, setEditingActivities] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUuid = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `event-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-4)}`;
  };

  const normalizeId = (text: string, index: number) =>
    `${text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}-${index}`;

  const events: Event[] = [
    {
      title: "Donation Drive for World Cancer Awareness Day",
      date: "November 9th, 2024",
      occasion: "Cancer Awareness & Medical Support",
      description: "On November 9, 2024, Ikshana Student Organization hosted a donation drive on campus to raise funds for Bommu Lakhmi Garu, a patient suffering from a serious pulmonary disease. The event aimed to raise ₹3,000,000 but successfully garnered ₹40,000, showcasing strong support from students and faculty. Donation booths were set up across the campus, and engaging activities like tug of war, relay races, quiz competitions, and raffle draws were organized to encourage participation. The drive not only aimed to raise funds but also to raise awareness about cancer and related diseases.",
      activities: [
        {
          name: "Donation Booths",
          icon: Heart,
          description: "Multiple donation booths were strategically set up across the campus to collect contributions from students and faculty members."
        },
        {
          name: "Engaging Activities",
          icon: Palette,
          description: "Fun and competitive activities including tug of war, relay races, quiz competitions, and raffle draws were organized to encourage participation and raise funds."
        },
        {
          name: "Awareness Campaign",
          icon: ShieldCheck,
          description: "The drive raised awareness about cancer and related diseases, helping the college community understand the importance of health and support for medical causes."
        }
      ],
      acknowledgments: "Special thanks to all students and faculty who came forward to raise their helping hand for this noble cause. The overwhelming support raised ₹40,000 for Bommu Lakhmi Garu's medical treatment.",
      image: null
    },
    {
      title: "SIDDHI 3.0",
      date: "September 11th, 2024",
      occasion: "Vinayaka Chavithi Celebration",
      description: "On September 11, 2024, Ikshana organized a Vinayaka Chavithi celebration at CMRIT, where 2nd and 3rd-year students participated in various creative and intellectual competitions. The event blended tradition with modern thought, featuring idol making, essay writing, debate, and a quiz, focusing on themes like spirituality, science, and mythology. The judging panel consisting of faculty members evaluated participants based on creativity, depth, and knowledge. The event successfully celebrated the festival, fostering a sense of community and inspiring future celebrations with its blend of creativity and intellectual discourse.",
      activities: [
        {
          name: "Idol Making",
          icon: Palette,
          description: "Students showcased their creativity by crafting beautiful Ganesha idols in various forms, expressing devotion and artistic skill."
        },
        {
          name: "Essay Writing & Debate",
          icon: PenTool,
          description: "Students explored deeper cultural and scientific ideas through essay writing on themes like spirituality, science, mythology, while engaging in intellectual debates on topics such as Science vs Spirituality and the true meaning of happiness."
        },
        {
          name: "Quiz Competition",
          icon: Award,
          description: "A quiz focused on mythology and cultural knowledge, testing students' understanding of traditional wisdom and contemporary relevance."
        }
      ],
      acknowledgments: "Special thanks to all faculty members who served as judges and mentors, and to all 203 participants who made this celebration a memorable success.",
      image: null
    },
    {
      title: "Visit to Gundla Pochampalley",
      date: "June 1st, 2024",
      occasion: "Educational Awareness & Community Support",
      description: "On June 1st, 2024, the Ikshana team visited Gundla Pochampalley village to promote the importance of education. They began by going door-to-door, educating families about the significance of children's education. Afterward, they gathered the children for engaging entertainment activities, including dance and singing performances, while reinforcing the value of learning. The team distributed chocolates and drinks to the children, followed by the distribution of essential stationery items such as books, pens, and other supplies to support their studies. The visit was a successful initiative that not only spread awareness about education but also brought joy and support to the community.",
      activities: [
        {
          name: "Door-to-Door Education",
          icon: Heart,
          description: "Team members visited homes in Gundla Pochampalley to educate families about the significance and importance of children's education."
        },
        {
          name: "Entertainment & Engagement",
          icon: Palette,
          description: "Organized engaging entertainment activities including dance and singing performances to keep children entertained while reinforcing the value of learning."
        },
        {
          name: "Distribution of Supplies",
          icon: ShieldCheck,
          description: "Distributed chocolates, drinks, and essential stationery items including books, pens, and other supplies to support children's educational pursuits."
        }
      ],
      acknowledgments: "Thanks to all 33 volunteers who participated in this initiative and helped spread awareness and support to the community.",
      image: null
    }
  ];

  const allEvents = [...events, ...serverEvents];

  const mergedEvents = allEvents.map((event, index) => ({
    ...event,
    id: event.id || normalizeId(event.title, index),
    activities: normalizeActivities(event.activities),
  }));

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        const response = await fetch("/api/events");
        if (!response.ok) throw new Error("Failed to load events");
        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        setServerEvents(normalized as Event[]);
      } catch (error) {
        setEventsError("Unable to load event data right now.");
      } finally {
        setEventsLoading(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    fetchEventPhotos(selectedEvent.title);
  }, [selectedEvent]);

  const fetchEventPhotos = async (title: string) => {
    try {
      setLoadingPhotos(true);
      setPhotoError(null);
      const response = await fetch(`/api/photos?sub_category=${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error("Failed to load photos");
      const data = await response.json();
      setEventPhotos(Array.isArray(data) ? data : []);
    } catch (error) {
      setPhotoError("Unable to load event gallery right now.");
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleShowAddEvent = () => {
    setShowAddEventForm(true);
    setSaveMessage(null);
  };

  const handleNewEventChange = (field: string, value: string) => {
    setNewEvent((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditEventChange = (field: string, value: string) => {
    setEditingEvent((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveEditedEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const updatedEvent = {
      ...editingEvent,
      activities: normalizeActivities(editingActivities),
    };

    setEditedEvents((prev) => ({ ...prev, [editingEvent.id!]: updatedEvent }));
    setEditingEvent(null);
    setEditingActivities("");
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.date.trim() || !newEvent.description.trim()) {
      alert("Please provide at least a title, date, and description for the new event.");
      return;
    }

    const newRecord = {
      title: newEvent.title.trim(),
      date: newEvent.date.trim(),
      occasion: newEvent.occasion.trim(),
      description: newEvent.description.trim(),
      acknowledgments: newEvent.acknowledgments.trim(),
      activities: normalizeActivities(newEvent.activities),
    };

    setServerEvents((prev) => [newRecord, ...prev]);
    setShowAddEventForm(false);
    setNewEvent({ title: "", date: "", occasion: "", description: "", acknowledgments: "", activities: "" });
  };

  const openEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditingActivities(event.activities.map((activity) => `${activity.name}: ${activity.description}`).join("\n"));
  };

  const deleteEvent = async (eventId: string) => {
    setDeletedEventIds((prev) => [...prev, eventId]);
    setServerEvents((prev) => prev.filter((event) => event.id !== eventId));
  };

  return (
    <section id="past-events" className="py-24 px-6 bg-brand-cream min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-brand-maroon/10 text-brand-maroon text-[10px] font-bold uppercase tracking-[0.3em]">
            Past Events & Initiatives
          </div>
          <h1 className="text-5xl md:text-7xl font-serif text-brand-maroon leading-tight">
            Moments That Moved Us
          </h1>
          <p className="text-brand-maroon/60 text-lg md:text-xl max-w-3xl mx-auto mt-6 leading-relaxed">
            A collection of the initiatives, outreach programs, and celebrations that shaped our journey and strengthened our community.
          </p>
        </div>

        {isAdmin && (
          <div className="mb-12 flex justify-center">
            <button
              onClick={handleShowAddEvent}
              className="inline-flex items-center gap-2 rounded-full bg-brand-maroon px-8 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white shadow-lg shadow-brand-maroon/20 transition-all hover:bg-stone-900"
            >
              <Camera size={16} />
              Add New Event
            </button>
          </div>
        )}

        {showAddEventForm && (
          <form onSubmit={createEvent} className="mb-16 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-serif text-brand-maroon">Add New Event</h3>
              <button type="button" onClick={() => setShowAddEventForm(false)} className="text-stone-400 hover:text-brand-maroon">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Title</span>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => handleNewEventChange("title", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Event title"
                />
              </label>

              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Date</span>
                <input
                  type="text"
                  value={newEvent.date}
                  onChange={(e) => handleNewEventChange("date", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="e.g. July 20th, 2025"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Occasion</span>
                <input
                  type="text"
                  value={newEvent.occasion}
                  onChange={(e) => handleNewEventChange("occasion", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Brief occasion name"
                />
              </label>

              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Acknowledgments</span>
                <input
                  type="text"
                  value={newEvent.acknowledgments}
                  onChange={(e) => handleNewEventChange("acknowledgments", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Optional note or thanks"
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Description</span>
              <textarea
                value={newEvent.description}
                onChange={(e) => handleNewEventChange("description", e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                placeholder="Detailed event description"
              />
            </label>

            <label className="mt-6 block">
              <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Activities</span>
              <textarea
                value={newEvent.activities}
                onChange={(e) => handleNewEventChange("activities", e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                placeholder="Enter one activity per line"
              />
            </label>

            <button
              type="submit"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-maroon px-8 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-stone-900"
            >
              Save Event
            </button>
          </form>
        )}

        <div className="space-y-20">
          {mergedEvents.map((event, eventIdx) => (
            <div key={`${event.title}-${eventIdx}`} className="rounded-[2.5rem] border border-stone-200/70 bg-white p-8 shadow-[0_25px_80px_-40px_rgba(120,37,30,0.32)] sm:p-10 lg:p-12">
              <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-4 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/50">
                    <span>{event.date}</span>
                    <span className="rounded-full bg-brand-maroon/10 px-3 py-1 text-[9px] text-brand-maroon">
                      {event.occasion}
                    </span>
                  </div>
                  <h2 className="text-3xl font-serif text-brand-maroon sm:text-4xl">{event.title}</h2>
                  <p className="mt-6 text-lg leading-relaxed text-brand-maroon/70">{event.description}</p>

                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="mt-8 inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon transition-all hover:gap-4"
                  >
                    View Full Event Details
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="rounded-[2rem] border border-stone-200/70 bg-brand-maroon/5 p-6 text-sm text-brand-maroon/70 lg:min-w-[280px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">Highlights</p>
                  <div className="mt-4 space-y-3">
                    {event.activities.slice(0, 3).map((activity, index) => (
                      <div key={`${activity.name}-${index}`} className="flex items-start gap-3">
                        <div className="mt-1 rounded-full bg-white p-2 text-brand-maroon shadow-sm">
                          <Heart size={12} />
                        </div>
                        <p className="text-sm leading-relaxed">{activity.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/90 p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-brand-cream shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-stone-200/70 bg-white p-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">{selectedEvent.occasion}</p>
                  <h3 className="mt-3 text-3xl font-serif text-brand-maroon">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="rounded-full bg-stone-100 p-3 text-stone-500 transition-all hover:bg-brand-maroon hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[calc(90vh-180px)] overflow-y-auto p-8">
                <p className="text-lg leading-relaxed text-brand-maroon/80">{selectedEvent.description}</p>

                <div className="mt-10 grid gap-6 md:grid-cols-2">
                  <div className="rounded-[2rem] border border-stone-200/70 bg-white p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">Activities</p>
                    <div className="mt-6 space-y-4">
                      {selectedEvent.activities.map((activity, index) => (
                        <div key={`${activity.name}-${index}`} className="flex gap-3">
                          <div className="rounded-full bg-brand-maroon/10 p-2 text-brand-maroon">
                            <Heart size={14} />
                          </div>
                          <div>
                            <p className="font-serif text-brand-maroon">{activity.name}</p>
                            <p className="mt-1 text-sm leading-relaxed text-brand-maroon/60">{activity.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-stone-200/70 bg-white p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">Event Gallery</p>
                    {loadingPhotos ? (
                      <p className="mt-6 text-sm text-brand-maroon/60">Loading gallery...</p>
                    ) : photoError ? (
                      <p className="mt-6 text-sm text-brand-maroon/60">{photoError}</p>
                    ) : eventPhotos.length > 0 ? (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        {eventPhotos.map((photo) => (
                          <img key={photo.id} src={photo.url} alt={photo.caption || selectedEvent.title} className="h-32 w-full rounded-[1.25rem] object-cover" />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-6 text-sm text-brand-maroon/60">No photos available yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
