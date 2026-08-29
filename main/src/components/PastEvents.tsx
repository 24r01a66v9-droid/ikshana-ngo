import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Palette, PenTool, Image as ImageIcon, Heart, ShieldCheck, X, Award, ArrowRight, Upload, Trash2, Camera } from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
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
  const normalizedRole = user?.role?.toLowerCase();
  const isAdmin = Boolean(
    normalizedRole === "admin" ||
    (user?.email && ADMIN_EMAILS.includes(user.email))
  );
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventPhotos, setEventPhotos] = useState<EventPhoto[]>([]);
  const [apiBase, setApiBase] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadCaptions, setUploadCaptions] = useState<string[]>(["", "", ""]);
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
  const [newEventUploadFile, setNewEventUploadFile] = useState<File | null>(null);
  const [newEventUploadCaption, setNewEventUploadCaption] = useState("");
  const [showUploadOnOpen, setShowUploadOnOpen] = useState(false);
  const newEventFileRef = useRef<HTMLInputElement>(null);
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
      description: "Team Ikshana has conducted a donation drive to support Bommu Lakhmi Garu, who was battling a serious pulmonary disease. The drive raised ₹40,000 through campus donation booths while spreading awareness about cancer and related diseases.",
      activities: [
        { name: "₹40,000 Raised", icon: Heart, description: "" },
        { name: "Campus Donation Drive", icon: Palette, description: "" },
        { name: "Cancer Awareness", icon: ShieldCheck, description: "" },
      ],
      acknowledgments: "Special thanks to all students and faculty who supported the drive.",
      image: null,
    },
    {
      title: "Visit to Gundla Pochampalley",
      date: "June 1st, 2024",
      occasion: "Educational Awareness & Community Support",
      description: "Our team visited Gundla Pochampalley village to promote the importance of education. Through door-to-door awareness, engaging activities, and the distribution of stationery, chocolates, and drinks, the team encouraged children to value education while bringing joy and support to the community.",
      activities: [
        { name: "Education Awareness", icon: Heart, description: "" },
        { name: "Community Outreach", icon: Palette, description: "" },
        { name: "Stationery Distribution", icon: ShieldCheck, description: "" },
      ],
      acknowledgments: "Thanks to all volunteers who supported this outreach.",
      image: null,
    },
    {
      title: "Seasons of Care",
      date: "June 6th, 2026",
      occasion: "Weather Support & Community Relief",
      description: "We conducted Seasons of Care, a seasonal donation drive in Hyderabad, supporting vulnerable communities affected by extreme heat and rain. The team distributed umbrellas, raincoats, and essential items, spreading kindness, comfort, and hope.",
      activities: [
        { name: "Weather Relief", icon: Heart, description: "" },
        { name: "Umbrella & Raincoat Distribution", icon: Palette, description: "" },
        { name: "Community Support", icon: ShieldCheck, description: "" },
      ],
      acknowledgments: "Thanks to all who contributed to Seasons of Care.",
      image: null,
    },
    {
      title: "Go with the Flow",
      date: "August 30th, 2018",
      occasion: "Menstrual Health Awareness & Community Support",
      description: "Team IKSHANA hosted \"Go With The Flow\" to break menstrual health taboos and promote open conversations around menstruation. The initiative included the donation of sanitary napkins to girl orphanages, supporting menstrual hygiene, dignity, and well-being.",
      activities: [
        {
          name: "Awareness & Education",
          icon: ShieldCheck,
          description: "Hosted open discussions about menstrual health, dispelling myths and misconceptions about menstruation while promoting a positive and informed outlook on this natural process."
        },
        {
          name: "Donation Drive",
          icon: Heart,
          description: "Organized a collection drive for sanitary napkins and other menstrual hygiene products to donate to girl orphanages, addressing the crucial need for hygienic menstrual product access."
        },
        {
          name: "Community Engagement",
          icon: Palette,
          description: "Encouraged participants to contribute to the cause, emphasizing how small acts of kindness can profoundly impact the lives of young girls, ensuring their dignity, comfort, and overall well-being."
        },
        {
          name: "Breaking Stigma",
          icon: Award,
          description: "Worked to destigmatize menstruation and create meaningful conversations around menstrual health, exemplifying Team IKSHANA's commitment to addressing fundamental social issues with compassion and inclusivity."
        }
      ],
      acknowledgments: "Special thanks to all Team IKSHANA members and volunteers who dedicated their efforts to make this important initiative a success. We extend our gratitude to everyone who participated in discussions, contributed to the donation drive, and helped break societal taboos around menstrual health. Together, we've demonstrated that compassion and awareness can transform lives and foster a more inclusive community.",
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
      const base = apiBase ?? '';
      const photosUrl = `${base}/api/photos?sub_category=${encodeURIComponent(title)}`;
      const response = await fetch(photosUrl);
      if (!response.ok) throw new Error("Failed to load photos");
      const data = await response.json();
      setEventPhotos(Array.isArray(data) ? data : []);
    } catch (error) {
      setPhotoError("Unable to load event gallery right now.");
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Discover a working backend base URL (probes common dev ports). Caches result in state.
  useEffect(() => {
    if (apiBase !== null) return;
    let cancelled = false;

    const timeout = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const probe = async () => {
      if (typeof window === 'undefined') {
        setApiBase('');
        return;
      }
      const proto = window.location.protocol;
      const host = window.location.hostname;
      const ports = [window.location.port || '3000', '3000', '3001', '3002', '3003', '3004'];

      for (const p of ports) {
        try {
          const url = `${proto}//${host}:${p}/health`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          const resp = await fetch(url, { signal: controller.signal, credentials: 'include' }).catch(() => null);
          clearTimeout(timer);
          if (resp && resp.ok) {
            const text = await resp.text().catch(() => '');
            if (!cancelled) {
              setApiBase(`${proto}//${host}:${p}`);
              return;
            }
          }
        } catch (e) {
          // ignore and try next
        }
        await timeout(100);
      }

      // fallback to empty (relative) so app still attempts relative calls
      if (!cancelled) setApiBase('');
    };

    probe();
    return () => { cancelled = true; };
  }, [apiBase]);

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

    // Optimistically save locally
    setEditedEvents((prev) => ({ ...prev, [editingEvent.id!]: updatedEvent }));

    // If this event exists on the server, persist the change
    try {
      const isServerEvent = serverEvents.some((ev) => String(ev.id) === String(editingEvent.id));
      if (isServerEvent && editingEvent.id) {
        const resp = await fetch(`/api/events/${editingEvent.id}`, buildAuthRequestInit({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updatedEvent.title,
            date: updatedEvent.date,
            occasion: updatedEvent.occasion,
            description: updatedEvent.description,
            acknowledgments: updatedEvent.acknowledgments,
            activities: updatedEvent.activities,
          }),
        }));

        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          throw new Error(err?.error || `Failed to update event (${resp.status})`);
        }

        const saved = await resp.json().catch(() => null);
        // Replace serverEvents entry with returned value when possible
        if (saved) {
          setServerEvents((prev) => prev.map((ev) => (String(ev.id) === String(editingEvent.id) ? { ...ev, ...(saved || {}) } : ev)));
        }
      }
      setSaveMessage("Event saved");
    } catch (err: any) {
      console.error("Failed to persist edited event:", err);
      setSaveMessage("Failed to save event to server");
    } finally {
      // persist local edits to localStorage for offline fallback (use latest local state)
      try {
        const latestLocal = { ...(editedEvents || {}), [editingEvent.id!]: updatedEvent };
        window.localStorage.setItem("ikshana_edited_events", JSON.stringify(latestLocal));
        setEditedEvents(latestLocal);
      } catch (e) {}

      setEditingEvent(null);
      setEditingActivities("");
    }
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
    // If admin attached a photo while creating this event, upload it to the event gallery
    if (isAdmin && newEventUploadFile) {
      try {
        const formData = new FormData();
        formData.append("file", newEventUploadFile);
        formData.append("title", newEventUploadCaption || newRecord.title);
        formData.append("category", "event");
        formData.append("sub_category", newRecord.title);
        formData.append("date", newRecord.date || new Date().toLocaleDateString());

        const resp = await fetch("/api/photos", buildAuthRequestInit({
          method: "POST",
          body: formData,
        }));

        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          console.error("New event photo upload failed", err);
        }
      } catch (err) {
        console.error("Failed to upload new event photo", err);
      }
    }

    setShowAddEventForm(false);
    setNewEvent({ title: "", date: "", occasion: "", description: "", acknowledgments: "", activities: "" });
    setNewEventUploadFile(null);
    setNewEventUploadCaption("");
  };

  const openEditEvent = (event: Event) => {
    if (!isAdmin) return;
    setEditingEvent(event);
    setEditingActivities(event.activities.map((activity) => `${activity.name}: ${activity.description}`).join("\n"));
  };

  const deleteEvent = async (eventId: string) => {
    if (!isAdmin) return;

    const isServerEvent = serverEvents.some((ev) => String(ev.id) === String(eventId));

    if (isServerEvent) {
      try {
        const resp = await fetch(`/api/events/${eventId}`, buildAuthRequestInit({ method: "DELETE" }));
        if (!resp.ok) {
          const err = await resp.json().catch(() => null);
          throw new Error(err?.error || `Failed to delete event (${resp.status})`);
        }
      } catch (err: any) {
        console.error("Failed to delete event on server:", err);
        alert(err?.message || "Failed to delete event on server");
        return;
      }
    }

    setDeletedEventIds((prev) => [...prev, eventId]);
    setServerEvents((prev) => prev.filter((event) => String(event.id) !== String(eventId)));
  };

  const handleEventPhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || uploadFiles.length === 0 || !selectedEvent || uploadingMultiple) return;

    setUploadingMultiple(true);
    
    try {
      // Upload all selected files
      const uploadPromises = uploadFiles.map((file, index) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", uploadCaptions[index] || selectedEvent.title);
        formData.append("category", "event");
        formData.append("sub_category", selectedEvent.title);
        formData.append("date", selectedEvent.date);

        return fetch(`${apiBase || ''}/api/photos`, buildAuthRequestInit({
          method: "POST",
          body: formData,
        }));
      });

      const responses = await Promise.all(uploadPromises);
      
      for (const response of responses) {
        if (!response.ok) {
          const text = await response.text().catch(() => null);
          console.error("Event photo upload failed", { status: response.status, statusText: response.statusText, body: text });
          const errorData = text ? (() => {
            try { return JSON.parse(text); } catch { return { error: text }; }
          })() : null;
          throw new Error(errorData?.error || `Upload failed (${response.status})`);
        }
      }

      await fetchEventPhotos(selectedEvent.title);
      setUploadFiles([]);
      setUploadCaptions(["", "", ""]);
    } catch (error) {
      console.error("Failed to upload event photos", error);
      const message = (error instanceof Error && error.message) ? error.message : String(error);
      if (message.toLowerCase().includes("fetch failed") || message.toLowerCase().includes("networkerror") || message.toLowerCase().includes("failed to fetch")) {
        alert("Upload failed: network error communicating with the server. Ensure the dev server is running (npm --prefix ./hahaaaaa-main run dev) and try again. See console for details.");
      } else {
        alert(`Upload failed: ${message}`);
      }
    } finally {
      setUploadingMultiple(false);
    }
  };

  return (
    <section id="past-events" className="pt-32 md:pt-40 pb-24 px-6 bg-brand-cream min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl md:text-7xl font-serif text-brand-maroon leading-tight">
            Our Featured Events & Initiatives
          </h1>
        </div>

        {isAdmin && (
          <div className="mb-6 flex justify-center">
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

            {isAdmin && (
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-maroon">Attach Cover Photo (optional)</p>
                <div className="mt-3 flex items-center gap-4">
                  <div
                    className="flex cursor-pointer items-center gap-3 rounded-[1rem] border border-dashed border-stone-300 p-3 text-center transition hover:border-brand-maroon/40"
                    onClick={() => newEventFileRef.current?.click()}
                  >
                    {newEventUploadFile ? (
                      <img src={URL.createObjectURL(newEventUploadFile)} alt="preview" className="h-20 w-20 rounded-md object-cover" />
                    ) : (
                      <Upload size={20} className="text-stone-400" />
                    )}
                    <input
                      ref={newEventFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && setNewEventUploadFile(e.target.files[0])}
                    />
                    <div>
                      <p className="text-sm text-brand-maroon/70">Click to attach an event photo</p>
                      <p className="text-xs text-stone-400">Will be saved to the event gallery after creating the event</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={newEventUploadCaption}
                    onChange={(e) => setNewEventUploadCaption(e.target.value)}
                    className="flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-brand-maroon outline-none focus:border-brand-maroon"
                  />
                </div>
              </div>
            )}

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

        {editingEvent && (
          <form onSubmit={saveEditedEvent} className="mb-16 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-serif text-brand-maroon">Edit Event</h3>
              <button type="button" onClick={() => { setEditingEvent(null); setEditingActivities(""); }} className="text-stone-400 hover:text-brand-maroon">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Title</span>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) => handleEditEventChange("title", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Event title"
                />
              </label>

              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Date</span>
                <input
                  type="text"
                  value={editingEvent.date}
                  onChange={(e) => handleEditEventChange("date", e.target.value)}
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
                  value={editingEvent.occasion}
                  onChange={(e) => handleEditEventChange("occasion", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Brief occasion name"
                />
              </label>

              <label className="block">
                <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Acknowledgments</span>
                <input
                  type="text"
                  value={editingEvent.acknowledgments || ""}
                  onChange={(e) => handleEditEventChange("acknowledgments", e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  placeholder="Optional note or thanks"
                />
              </label>
            </div>

            <label className="mt-6 block">
              <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Description</span>
              <textarea
                value={editingEvent.description}
                onChange={(e) => handleEditEventChange("description", e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                placeholder="Detailed event description"
              />
            </label>

            <label className="mt-6 block">
              <span className="text-sm text-brand-maroon uppercase tracking-[0.2em] font-bold">Activities</span>
              <textarea
                value={editingActivities}
                onChange={(e) => setEditingActivities(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                placeholder="Enter one activity per line, format: Name: Description"
              />
            </label>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-maroon px-8 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-stone-900"
              >
                Save Changes
              </button>
              <button type="button" onClick={() => { setEditingEvent(null); setEditingActivities(""); }} className="text-brand-maroon/70">Cancel</button>
              {saveMessage && <span className="text-sm text-brand-maroon/70">{saveMessage}</span>}
            </div>
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
                  <p className="mt-6 text-lg leading-relaxed text-brand-maroon/80">{event.description}</p>

                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="mt-8 inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon transition-all hover:gap-4"
                  >
                    View Event Gallery
                    <ArrowRight size={14} />
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setSelectedEvent(event); setShowUploadOnOpen(true); }}
                      className="ml-4 mt-8 inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon transition-all hover:border-brand-maroon hover:bg-brand-maroon hover:text-white"
                    >
                      <Camera size={14} />
                      Add Photos
                    </button>
                  )}

                  {isAdmin && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openEditEvent(event)}
                        className="rounded-full bg-brand-maroon px-5 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-stone-900"
                      >
                        Edit Event
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id!)}
                        className="rounded-full border border-stone-300 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon transition-all hover:border-brand-maroon hover:bg-brand-maroon hover:text-white"
                      >
                        Delete Event
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-stone-200/70 bg-brand-maroon/5 p-6 text-sm text-brand-maroon/80 lg:min-w-[280px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">Highlights</p>
                  <div className="mt-4">
                    <p className="text-sm leading-relaxed">
                      {(() => {
                        const items = event.activities.slice(0, 3).map(a => a.name).filter(Boolean);
                        if (items.length === 0) return "";
                        return `• ${items.join(' • ')}`;
                      })()}
                    </p>
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
                <button onClick={() => { setSelectedEvent(null); setShowUploadOnOpen(false); setUploadFiles([]); setUploadCaptions(["", "", ""]); }} className="rounded-full bg-stone-100 p-3 text-stone-500 transition-all hover:bg-brand-maroon hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[calc(90vh-180px)] overflow-y-auto p-8">
                {/* Photo Gallery Grid */}
                {eventPhotos.length > 0 && (
                  <div className="mb-8">
                    <div className={`grid gap-6 ${eventPhotos.length === 1 ? 'grid-cols-1' : eventPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {eventPhotos.slice(0, 3).map((photo, idx) => (
                        <div key={idx} className="rounded-[1.25rem] overflow-hidden bg-stone-100">
                          <img src={photo.url} alt={photo.title || selectedEvent.title} className="w-full h-48 object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!eventPhotos.length && !selectedEvent.image && (
                  <div className="mb-8 h-64 w-full rounded-[1.25rem] bg-stone-100" />
                )}

                {!eventPhotos.length && selectedEvent.image && (
                  <div className="mb-8">
                    <img src={selectedEvent.image} alt={selectedEvent.title} className="w-full h-64 rounded-[1.25rem] object-cover" />
                  </div>
                )}

                {isAdmin && showUploadOnOpen && (
                  <form onSubmit={handleEventPhotoUpload} className="w-full bg-white rounded-lg p-6 border border-stone-200">
                    <p className="mb-4 text-sm font-bold text-brand-maroon uppercase tracking-widest">Upload Up to 3 Images</p>
                    <div className="space-y-4">
                      {[0, 1, 2].map((index) => (
                        <div key={index} className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200">
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  const newFiles = [...uploadFiles];
                                  newFiles[index] = e.target.files[0];
                                  setUploadFiles(newFiles.filter((f, i) => i < 3));
                                }
                              }} 
                              className="hidden" 
                            />
                            <div className="px-4 py-2 rounded-lg border border-stone-300 bg-stone-50 text-sm text-brand-maroon font-bold hover:bg-stone-100 transition-colors">
                              Choose Image {index + 1}
                            </div>
                          </label>
                          {uploadFiles[index] && (
                            <>
                              <img src={URL.createObjectURL(uploadFiles[index])} alt={`preview ${index}`} className="h-12 w-12 rounded-md object-cover" />
                              <input
                                type="text"
                                placeholder="Caption (optional)"
                                value={uploadCaptions[index] || ""}
                                onChange={(e) => {
                                  const newCaptions = [...uploadCaptions];
                                  newCaptions[index] = e.target.value;
                                  setUploadCaptions(newCaptions);
                                }}
                                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newFiles = uploadFiles.filter((_, i) => i !== index);
                                  const newCaptions = uploadCaptions.filter((_, i) => i !== index);
                                  setUploadFiles(newFiles);
                                  setUploadCaptions([...newCaptions, ""]);
                                }}
                                className="text-red-600 hover:text-red-700 font-bold text-sm"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <button 
                        type="submit" 
                        disabled={uploadFiles.length === 0 || uploadingMultiple} 
                        className="rounded-full bg-brand-maroon px-6 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white disabled:opacity-60 hover:bg-stone-900 transition-colors"
                      >
                        {uploadingMultiple ? `Uploading ${uploadFiles.length} image${uploadFiles.length !== 1 ? 's' : ''}...` : `Upload ${uploadFiles.length} Image${uploadFiles.length !== 1 ? 's' : ''}`}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowUploadOnOpen(false); setUploadFiles([]); setUploadCaptions(["", "", ""]); }} 
                        className="rounded-full border border-stone-300 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon hover:bg-stone-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
