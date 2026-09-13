import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  PenTool,
  Image as ImageIcon,
  Heart,
  HandCoins,
  ShieldCheck,
  Umbrella,
  CloudRain,
  Users,
  X,
  Award,
  Upload,
  Camera,
  CalendarDays,
  Tag,
  Images,
  Pencil,
  Trash2,
} from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "./ui/feedback";

interface Activity {
  name: string;
  icon: any;
  description: string;
}

interface Event {
  id?: number | string;
  event_date?: string | null;
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
      case "handcoins":
        return HandCoins;
      case "umbrella":
        return Umbrella;
      case "cloudrain":
        return CloudRain;
      case "users":
        return Users;
      // "palette" kept for backward compatibility with any activities saved
      // earlier under that key — it now maps to a plain checkmark instead of
      // the paint-palette icon, which looked like a cookie at small sizes.
      case "palette":
      default:
        return CheckCircle2;
    }
  }

  return CheckCircle2;
}

function getDisplayActivityIcon(eventTitle: string, activityName: string) {
  const normalizedEvent = eventTitle.trim().toLowerCase();
  const normalizedActivity = activityName.trim().toLowerCase();

  // Keep the three meaningful icons for the "Go with the Flow" initiative.
  // All other events use a simple checkmark for a consistent visual language.
  if (normalizedEvent === "go with the flow") {
    if (normalizedActivity === "awareness & education") return ShieldCheck;
    if (normalizedActivity === "donation drive") return Heart;
    if (normalizedActivity === "community engagement") return Users;
  }

  return CheckCircle2;
}

function normalizeActivities(activities: unknown): Activity[] {
  if (Array.isArray(activities)) {
    return activities
      .map((activity: any) => {
        const name = typeof activity?.name === "string" ? activity.name.trim() : "";
        const description = typeof activity?.description === "string" ? activity.description.trim() : "";
        return {
          name,
          icon: getActivityIcon(activity?.icon),
          // Older records sometimes stored the activity name as its own
          // description. Treat that as an empty description so editing does
          // not turn "Name" into "Name: Name" and then repeat the value.
          description: description === name ? "" : description,
        };
      })
      .filter((activity) => activity.name || activity.description);
  }

  if (typeof activities === "string") {
    return activities
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((activityLine) => {
        const separator = activityLine.indexOf(":");
        if (separator > 0) {
          const name = activityLine.slice(0, separator).trim();
          const description = activityLine.slice(separator + 1).trim();
          return {
            name,
            icon: CheckCircle2,
            description: description === name ? "" : description,
          };
        }
        return { name: activityLine, icon: CheckCircle2, description: "" };
      });
  }

  return [];
}

function formatDateForEvent(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (!Number.isFinite(date.getTime())) return value;

  const monthName = date.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const dayNumber = Number(day);
  const suffix =
    dayNumber % 10 === 1 && dayNumber !== 11
      ? "st"
      : dayNumber % 10 === 2 && dayNumber !== 12
        ? "nd"
        : dayNumber % 10 === 3 && dayNumber !== 13
          ? "rd"
          : "th";

  return `${monthName} ${dayNumber}${suffix}, ${year}`;
}

function getDatePickerValue(value: string) {
  const match = value.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/i,
  );
  if (!match) return "";

  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };

  const month = months[match[1].toLowerCase()];
  const day = String(Number(match[2])).padStart(2, "0");

  return `${match[3]}-${month}-${day}`;
}

function eventMatchKey(event: Pick<Event, "title" | "date">) {
  return `${String(event.title || "").trim().toLowerCase()}::${String(event.date || "").trim().toLowerCase()}`;
}

// Cover photo + count for an event, looked up from the Team Archive by
// matching title (case-insensitive). This is the *only* connection between
// the two pages now — Events no longer stores or uploads its own photos, it
// just reads whatever's already in the Team Archive for a matching title.
type ArchiveMatch = { url: string; count: number };

// Keep the event photo click behavior: clicking a cover photo opens the
// matching event in Team Archive, where the full photo collection can be viewed.
const TEAM_ARCHIVE_PATH = "/gallery";

export default function PastEvents() {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const normalizedRole = user?.role?.toLowerCase();
  const isAdmin = Boolean(
    normalizedRole === "admin" ||
    (user?.email && ADMIN_EMAILS.includes(user.email))
  );

  const [archiveByTitle, setArchiveByTitle] = useState<Record<string, ArchiveMatch>>({});
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [serverEvents, setServerEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
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
  const [editingOriginalKey, setEditingOriginalKey] = useState<string | null>(null);
  const [editingOriginalTitle, setEditingOriginalTitle] = useState<string | null>(null);
  const [editingOriginalDate, setEditingOriginalDate] = useState<string | null>(null);



  // Supabase is the single source of truth for events. Keep the UI ordered by
  // the actual event date, not by created_at or by the order returned from storage.
  const mergedEvents = serverEvents
    .filter((event) => event?.id !== undefined && event?.id !== null)
    .map((event) => ({
      ...event,
      activities: normalizeActivities(event.activities),
    }))
    .sort((a, b) => {
      const parseSortableDate = (event: Event) => {
        if (event.event_date) {
          const time = new Date(`${event.event_date}T00:00:00Z`).getTime();
          if (Number.isFinite(time)) return time;
        }

        const match = String(event.date || '').match(
          /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})$/i,
        );
        if (!match) return 0;

        const months: Record<string, number> = {
          january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        };
        const month = months[match[1].toLowerCase()];
        const parsed = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
        return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
      };

      return parseSortableDate(b) - parseSortableDate(a);
    });

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

  // Pull the Team Archive's photos once and index them by title so each
  // event card can show a real cover photo + count without maintaining its
  // own separate copy of the images.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/photos?category=gallery");
        if (!response.ok) return;
        const rows = await response.json();
        if (!Array.isArray(rows)) return;

        const byKey: Record<string, { url: string; order: number; count: number }> = {};
        rows.forEach((row: any) => {
          const key = String(row.title || "").trim().toLowerCase();
          if (!key) return;
          const order = Number(row.photo_order ?? 0);
          if (!byKey[key]) {
            byKey[key] = { url: row.url, order, count: 1 };
          } else {
            byKey[key].count += 1;
            if (order < byKey[key].order) {
              byKey[key].url = row.url;
              byKey[key].order = order;
            }
          }
        });

        const cleaned: Record<string, ArchiveMatch> = {};
        Object.entries(byKey).forEach(([key, value]) => {
          cleaned[key] = { url: value.url, count: value.count };
        });
        setArchiveByTitle(cleaned);
      } catch (error) {
        console.error("Failed to load Team Archive photos for events", error);
      }
    })();
  }, []);

  const handleShowAddEvent = () => {
    setShowAddEventForm(true);
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

    const currentKey = eventMatchKey(editingEvent);
    const originalTitle = String(editingOriginalTitle || "").trim().toLowerCase();
    const persistedEvent =
      serverEvents.find((event) => /^\d+$/.test(String(event.id)) && String(event.id) === String(editingEvent.id)) ||
      (editingOriginalKey
        ? serverEvents.find((event) => eventMatchKey(event) === editingOriginalKey)
        : undefined) ||
      serverEvents.find((event) => eventMatchKey(event) === currentKey) ||
      (originalTitle
        ? serverEvents.find((event) => String(event.title || "").trim().toLowerCase() === originalTitle)
        : undefined);

    const persistedId = persistedEvent?.id;

    if (!persistedId || !/^\d+$/.test(String(persistedId))) {
      toast(
        "This event is not yet stored in Supabase. Add/import the event there before editing it.",
        { tone: "error" },
      );
      return;
    }

    try {
      const resp = await fetch(
        `/api/events/${encodeURIComponent(String(persistedId))}`,
        buildAuthRequestInit({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: updatedEvent.title,
            date: updatedEvent.date,
            occasion: updatedEvent.occasion,
            description: updatedEvent.description,
            acknowledgments: updatedEvent.acknowledgments,
            activities: updatedEvent.activities,
            originalTitle: editingOriginalTitle,
            originalDate: editingOriginalDate,
          }),
        }),
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `Failed to update event (${resp.status})`);
      }

      const saved = await resp.json().catch(() => null);
      const savedEvent = saved?.event || saved;

      if (!savedEvent?.id) {
        throw new Error("The server did not return the updated event.");
      }

      setServerEvents((prev) =>
        prev.map((ev) =>
          String(ev.id) === String(persistedId)
            ? { ...ev, ...savedEvent }
            : ev,
        ),
      );

      toast("Event updated successfully.", { tone: "success" });
      setEditingEvent(null);
      setEditingOriginalKey(null);
      setEditingOriginalTitle(null);
      setEditingOriginalDate(null);
      setEditingActivities("");
    } catch (err: any) {
      console.error("Failed to persist edited event:", err);
      toast(err?.message || "Failed to save the event.", { tone: "error" });
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEvent.title.trim() || !newEvent.date.trim() || !newEvent.description.trim()) {
      toast("An event needs at least a title, a date and a description.", { tone: "error" });
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

    try {
      const resp = await fetch(
        "/api/events",
        buildAuthRequestInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newRecord),
        }),
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `Failed to create event (${resp.status})`);
      }

      const saved = await resp.json().catch(() => null);
      const savedEvent = saved?.event || saved;

      if (!savedEvent?.id) {
        throw new Error("The server did not return the new event.");
      }

      setServerEvents((prev) => [savedEvent, ...prev]);
      setShowAddEventForm(false);
      setNewEvent({
        title: "",
        date: "",
        occasion: "",
        description: "",
        acknowledgments: "",
        activities: "",
      });
      toast("Event created successfully.", { tone: "success" });
    } catch (err: any) {
      console.error("Failed to create event:", err);
      toast(err?.message || "Failed to create the event.", { tone: "error" });
    }
  };

  const openEditEvent = (event: Event) => {
    if (!isAdmin) return;
    setEditingOriginalKey(eventMatchKey(event));
    setEditingOriginalTitle(event.title);
    setEditingOriginalDate(event.date);
    setEditingEvent(event);
    setEditingActivities(
      event.activities
        .map((activity) => {
          const name = activity.name.trim();
          const description = activity.description.trim();
          return description && description !== name ? `${name}: ${description}` : name;
        })
        .filter(Boolean)
        .join("\n"),
    );
  };

  const deleteEvent = async (event: Event) => {
    if (!isAdmin) return;

    const eventTitleKey = String(event.title || "").trim().toLowerCase();
    const persistedEvent =
      serverEvents.find((item) => /^\d+$/.test(String(item.id)) && String(item.id) === String(event.id)) ||
      serverEvents.find((item) => eventMatchKey(item) === eventMatchKey(event)) ||
      serverEvents.find((item) => String(item.title || "").trim().toLowerCase() === eventTitleKey);
    const persistedId = persistedEvent?.id;

    if (!persistedId || !/^\d+$/.test(String(persistedId))) {
      toast(
        "This event is not yet stored in Supabase, so it cannot be deleted permanently.",
        { tone: "error" },
      );
      return;
    }

    const confirmed = await confirm({
      title: `Delete "${event.title}"?`,
      body: "This removes the event from the public page. Photos in Team Archive are not affected.",
      confirmLabel: "Delete event",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      const resp = await fetch(
        `/api/events/${encodeURIComponent(String(persistedId))}`,
        buildAuthRequestInit({ method: "DELETE" }),
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `Failed to delete event (${resp.status})`);
      }

      setServerEvents((prev) =>
        prev.filter((item) => String(item.id) !== String(persistedId)),
      );

      toast("Event deleted successfully.", { tone: "success" });
    } catch (err: any) {
      console.error("Failed to delete event:", err);
      toast(err?.message || "Failed to delete the event.", { tone: "error" });
    }
  };

  return (
    <section
      id="past-events"
      className="min-h-screen bg-[#fffcfc] px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-28 xl:px-10 2xl:px-12"
    >
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto flex max-w-7xl flex-col rounded-[1.75rem] border border-brand-maroon/10 bg-white p-3 shadow-[0_30px_90px_-30px_rgba(91,63,212,0.12)] sm:p-6 lg:p-8 xl:p-10"
      >
        <header className="px-1 pb-4 pt-2 sm:pb-5 sm:pt-1">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <h1 className="font-serif text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-brand-maroon sm:text-4xl md:text-5xl lg:text-[3.5rem]">
              Our{" "}
              <span className="relative inline-block italic">
                Events
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[0.08em] left-0 h-[0.06em] w-full rounded-full bg-brand-maroon/20"
                />
              </span>{" "}
              &amp; Initiatives
            </h1>
            {isAdmin && (
              <button
                type="button"
                onClick={handleShowAddEvent}
                className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2.5 rounded-full bg-brand-maroon px-6 text-label text-white shadow-rest transition-all duration-200 hover:-translate-y-0.5 hover:bg-stone-900 hover:shadow-lg sm:mt-6"
              >
                <Camera size={16} />
                Add New Event
              </button>
            )}
          </div>
        </header>

        <div className="mt-2">
          {showAddEventForm && (
          <form onSubmit={createEvent} className="mb-8 rounded-[2rem] border border-brand-maroon/10 bg-white p-6 shadow-xl sm:mb-10 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-serif text-brand-maroon">Add New Event</h3>
              <button type="button" onClick={() => setShowAddEventForm(false)} className="text-stone-500 hover:text-brand-maroon">
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
                  type="date"
                  value={getDatePickerValue(newEvent.date)}
                  onChange={(e) =>
                    handleNewEventChange("date", formatDateForEvent(e.target.value))
                  }
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  aria-label="Choose event date"
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

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-brand-maroon/70">
              <Images size={14} className="mt-0.5 shrink-0" />
              Photos aren't attached here — add them to Team Archive with the same title as this event and
              they'll show up on this card automatically.
            </p>

            <button
              type="submit"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-brand-maroon px-8 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-stone-900"
            >
              Save Event
            </button>
          </form>
        )}


        {eventsLoading && (
          <p className="mb-8 text-center text-sm text-brand-maroon/70">Loading events…</p>
        )}
        {eventsError && (
          <p className="mb-8 text-center text-sm text-brand-maroon/70">{eventsError}</p>
        )}

        <div className="space-y-7 sm:space-y-8">
          {mergedEvents.map((event) => {
            const isEditing =
              editingEvent !== null &&
              String(editingEvent.id) === String(event.id);

            if (isEditing) {
              return (
                <motion.div
                  key={`edit-${String(event.id)}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
          <form
            onSubmit={saveEditedEvent}
            className="rounded-[2rem] border border-brand-maroon/10 bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-serif text-brand-maroon">Edit Event</h3>
              <button type="button" onClick={() => { setEditingEvent(null); setEditingOriginalKey(null); setEditingOriginalTitle(null); setEditingOriginalDate(null); setEditingActivities(""); }} className="text-stone-500 hover:text-brand-maroon">
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
                  type="date"
                  value={getDatePickerValue(editingEvent.date)}
                  onChange={(e) =>
                    handleEditEventChange("date", formatDateForEvent(e.target.value))
                  }
                  className="mt-2 w-full rounded-3xl border border-stone-200 px-4 py-3 text-sm text-brand-maroon focus:outline-none focus:border-brand-maroon"
                  aria-label="Choose event date"
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

            <div className="mt-4 flex items-center gap-4 border-t border-brand-maroon/[0.08] pt-4 sm:mt-5 sm:pt-4">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-maroon px-8 py-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-all hover:bg-stone-900"
              >
                Save Changes
              </button>
              <button type="button" onClick={() => { setEditingEvent(null); setEditingOriginalKey(null); setEditingOriginalTitle(null); setEditingOriginalDate(null); setEditingActivities(""); }} className="text-brand-maroon/70">Cancel</button>
            </div>
          </form>
                </motion.div>
              );
            }

            const archiveMatch = archiveByTitle[event.title.trim().toLowerCase()];

            return (
              <motion.div
                key={String(event.id)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4 }}
                className="group relative overflow-hidden rounded-[2rem] border border-brand-maroon/12 bg-white shadow-[0_24px_70px_-34px_rgba(120,37,30,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_32px_90px_-34px_rgba(120,37,30,0.32)] sm:rounded-[2.35rem]"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-brand-maroon/80 via-brand-maroon/35 to-transparent"
                />

                <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch">
                  {/* Desktop: the grid row is sized by the content column, so the
                      image is exactly the same height as the content. Mobile keeps
                      a controlled image ratio so cards remain compact. */}
                  <div className="relative min-h-0 bg-[#fffaf7] p-3 sm:p-4 lg:p-5">
                    <Link
                      to={archiveMatch ? `${TEAM_ARCHIVE_PATH}?event=${encodeURIComponent(event.title)}` : "#"}
                      onClick={(e) => {
                        if (!archiveMatch) e.preventDefault();
                      }}
                      onPointerEnter={() => {
                        if (archiveMatch?.url) {
                          const img = new Image();
                          img.decoding = "async";
                          img.src = archiveMatch.url;
                        }
                      }}
                      onTouchStart={() => {
                        if (archiveMatch?.url) {
                          const img = new Image();
                          img.src = archiveMatch.url;
                        }
                      }}
                      className={`relative block aspect-[4/3] overflow-hidden rounded-[1.55rem] border border-brand-maroon/12 bg-stone-100 shadow-[0_14px_38px_-22px_rgba(120,37,30,0.45)] lg:absolute lg:inset-5 lg:aspect-auto ${
                        archiveMatch ? "cursor-pointer" : "cursor-default"
                      }`}
                      aria-label={archiveMatch ? `View photos for ${event.title}` : undefined}
                    >
                      {archiveMatch ? (
                        <img
                          src={archiveMatch.url}
                          alt={event.title}
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-maroon/55">
                          <ImageIcon size={32} strokeWidth={1.5} />
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">No photos yet</span>
                        </div>
                      )}

                      {archiveMatch && (
                        <>
                          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-stone-950/65 px-3 py-1.5 text-[10px] font-semibold text-white shadow-lg backdrop-blur">
                            <Images size={12} />
                            {archiveMatch.count} photo{archiveMatch.count !== 1 ? "s" : ""}
                          </span>
                          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-stone-950/55 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300 group-hover:opacity-100 sm:left-4 sm:top-4">
                            <Images size={12} />
                            View photos
                          </span>
                        </>
                      )}
                    </Link>
                  </div>

                  {/* Content column */}
                  <div className="relative flex min-w-0 flex-col justify-center border-t border-brand-maroon/[0.08] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-9 xl:p-10">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full border border-brand-maroon/[0.07]" />
                    <div aria-hidden="true" className="pointer-events-none absolute bottom-7 right-7 hidden h-16 w-16 rounded-full border border-brand-maroon/[0.08] lg:block" />

                    <div className="relative flex flex-wrap items-center gap-2">
                      <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-maroon/10 bg-brand-cream/70 px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.17em] text-brand-maroon/90 sm:text-[10px]">
                        <CalendarDays size={13} strokeWidth={1.8} className="shrink-0" />
                        <span className="truncate">{event.date}</span>
                      </span>
                      {event.occasion && (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-brand-maroon/[0.08] px-3.5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-brand-maroon sm:text-[10px]">
                          <Tag size={12} strokeWidth={1.8} className="shrink-0" />
                          <span className="truncate">{event.occasion}</span>
                        </span>
                      )}
                    </div>

                    <div className="relative mt-5 h-px w-12 bg-brand-maroon/25" />

                    <h2 className="relative mt-5 max-w-3xl font-serif text-[1.85rem] font-medium leading-[1.08] tracking-[-0.025em] text-brand-maroon sm:text-3xl lg:text-[2.55rem]">
                      {event.title}
                    </h2>

                    {event.description && (
                      <p className="relative mt-5 max-w-3xl text-[0.98rem] font-normal leading-7 text-stone-600 sm:mt-6 sm:text-[1.02rem] sm:leading-7">
                        {event.description}
                      </p>
                    )}

                    {event.activities.length > 0 && (
                      <div className="relative mt-6 border-t border-brand-maroon/[0.08] pt-5 sm:mt-7 sm:pt-6">
                        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-brand-maroon/70">Impact &amp; Activities</p>
                        <div className="grid grid-cols-1 divide-y divide-brand-maroon/[0.08] border-y border-brand-maroon/[0.08] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
                          {event.activities.slice(0, 4).map((activity, i) => {
                            const Icon = getDisplayActivityIcon(event.title, activity.name);
                            return (
                              <div
                                key={i}
                                className="group/activity flex min-w-0 items-center gap-3 px-1 py-3.5 sm:px-4 sm:first:pl-1 lg:px-5 lg:first:pl-1"
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-maroon/10 bg-brand-cream/40 text-brand-maroon transition-transform duration-200 group-hover/activity:scale-105">
                                  <Icon size={15} strokeWidth={1.8} />
                                </span>
                                <span className="min-w-0 text-[0.82rem] font-medium leading-5 text-stone-700 sm:text-sm">
                                  {activity.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {event.acknowledgments && (
                      <div className="relative mt-6 flex gap-3 rounded-2xl border border-brand-maroon/[0.08] bg-brand-cream/45 px-4 py-3.5 sm:mt-7 sm:px-5 sm:py-4">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-maroon text-white">
                          <Heart size={13} fill="currentColor" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-maroon/60">With gratitude</p>
                          <p className="mt-1.5 text-sm font-normal leading-6 text-stone-700 sm:text-[0.95rem]">{event.acknowledgments}</p>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="relative mt-5 flex flex-wrap gap-2 border-t border-brand-maroon/[0.08] pt-4 sm:mt-5 sm:pt-4">
                        <button
                          type="button"
                          onClick={() => openEditEvent(event)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-maroon transition-all hover:border-brand-maroon hover:bg-brand-maroon hover:text-white"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(event)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-600 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        </div>
      </motion.div>
    </section>
  );
}
