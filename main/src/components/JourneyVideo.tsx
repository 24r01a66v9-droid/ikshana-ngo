import { useState } from "react";
import { AlertTriangle, Pencil, Play, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "./ui/feedback";
import { extractYouTubeId, useSiteSettings } from "../hooks/useSiteSettings";

/**
 * "The Ikshana Journey" video.
 *
 * Admin pastes any YouTube URL form — watch link, youtu.be, /embed/, /live/,
 * /shorts/, or a bare 11-character id — and the id is extracted server-side of
 * the UI in `extractYouTubeId`. A paste that yields no id is rejected in the
 * form rather than rendering an iframe that silently shows nothing.
 *
 * The embed is responsive via `aspect-video` on the wrapper with the iframe
 * absolutely filling it. That was the specific ask: not "a broken iframe at
 * odd widths". A fixed width/height iframe letterboxes or overflows at every
 * size that isn't the one it was written for; this one is correct at all of
 * them because the aspect ratio is the constraint, not the pixels.
 *
 * Facade pattern: a poster image plus a play button, and the iframe is only
 * mounted on click. Embedding YouTube eagerly pulls ~1MB of their player
 * JavaScript into every page load, and sets cookies before the visitor has
 * asked for anything — youtube-nocookie plus click-to-load avoids both.
 */

export default function JourneyVideo() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const isAdmin = user?.role === "admin";
  const { settings, available, loading, hint, save } = useSiteSettings();

  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);

  const videoId = extractYouTubeId(settings.journey_video_url || "");
  const title = "How Ikshana Began";

  const openEditor = () => {
    setDraftUrl(settings.journey_video_url || "");
    setEditing(true);
  };

  const submit = async () => {
    const trimmed = draftUrl.trim();
    if (trimmed && !extractYouTubeId(trimmed)) {
      toast("That doesn't look like a YouTube link. Paste the watch URL or the video ID.", {
        tone: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await save({ journey_video_url: trimmed, journey_video_title: title });
      toast(trimmed ? "Video updated." : "Video removed.");
      setEditing(false);
      setPlaying(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the video.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  // Nothing configured and no admin present: render nothing, rather than an
  // empty section with a heading over a grey box.
  if (!videoId && !isAdmin) return null;

  if (!available && !isAdmin) return null;

  return (
    <section className="mb-6 sm:mb-8">
      <div className="mx-auto max-w-6xl">
        {videoId && (
          <div className="group relative overflow-hidden rounded-[1.5rem] border border-brand-maroon/15 bg-stone-950 shadow-[0_28px_70px_-34px_rgba(28,25,23,0.48)] sm:rounded-[2.25rem]">
            {isAdmin && (
              <button
                type="button"
                onClick={openEditor}
                aria-label="Edit journey video"
                title="Edit journey video"
                className="absolute right-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-stone-950/65 text-white shadow-lg backdrop-blur-md transition hover:bg-brand-maroon sm:right-5 sm:top-5"
              >
                <Pencil size={16} />
              </button>
            )}

            <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-video">
              {playing ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 h-full w-full border-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label={`Play ${title}`}
                  className="absolute inset-0 h-full w-full cursor-pointer text-left"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                  />

                  <div className="absolute inset-0 bg-gradient-to-r from-stone-950/[0.94] via-stone-950/60 to-stone-950/20" />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/15 to-transparent" />

                  {/* Responsive thumbnail copy: compact on phones, spacious on larger screens. */}
                  <div className="absolute inset-0 flex items-end">
                    <div className="w-full px-5 pb-5 pt-12 sm:px-10 sm:pb-10 sm:pt-16 lg:px-14 lg:pb-12">
                      <div className="max-w-2xl">
                        <div className="mb-2.5 flex items-center gap-2.5 text-white/75 sm:mb-4 sm:gap-3">
                          <span className="h-px w-7 bg-white/60 sm:w-9" />
                          <span className="text-[8px] font-bold uppercase tracking-[0.22em] sm:text-xs sm:tracking-[0.25em]">
                            Our Story · 2021
                          </span>
                        </div>

                        <h3 className="font-serif text-[2rem] italic leading-[1.02] tracking-[-0.025em] text-white sm:text-5xl lg:text-6xl">
                          How Ikshana Began
                        </h3>

                        <p className="mt-2.5 max-w-xl text-[13px] leading-5 text-white/80 sm:mt-4 sm:text-base sm:leading-7">
                          A glimpse into the people, idea, and first steps that brought Ikshana to life.
                        </p>

                        <span className="mt-4 inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/20 bg-stone-950/35 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.13em] text-white backdrop-blur-md sm:mt-7 sm:gap-3 sm:px-5 sm:py-3 sm:text-xs sm:tracking-[0.16em]">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-brand-maroon shadow-lg sm:h-10 sm:w-10">
                            <Play size={14} fill="currentColor" className="ml-0.5 sm:h-4 sm:w-4" />
                          </span>
                          <span className="truncate">Watch our beginning</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {!available && isAdmin && (
          <div className="mt-6 flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[14px] leading-relaxed text-amber-900">
              Only you can see this. {hint || "The site_settings table hasn't been created yet."}
            </p>
          </div>
        )}

        {available && !videoId && isAdmin && (
          <div className="mt-6 flex flex-col gap-4 rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] leading-relaxed text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Only you can see this section. Add a YouTube link and it becomes visible to everyone.</span>
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-maroon px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-stone-900"
            >
              <Pencil size={14} />
              Add video
            </button>
          </div>
        )}
      </div>


      {editing && isAdmin && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-6">
          <div
            className="absolute inset-0 bg-stone-950/55 backdrop-blur-[3px]"
            onClick={() => setEditing(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-editor-title"
            className="relative w-full max-w-lg rounded-t-feature bg-white p-6 shadow-lift sm:rounded-feature sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="video-editor-title" className="font-serif text-2xl text-brand-maroon">
                How Ikshana Began
              </h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close"
                className="focus-ring -mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-brand-maroon/70 hover:bg-brand-maroon/8"
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="block">
                <span className="text-label block text-brand-maroon/70">YouTube link</span>
                <input
                  type="text"
                  value={draftUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="mt-1.5 w-full rounded-field border border-brand-maroon/15 bg-white px-3.5 py-2.5 text-[15px] text-brand-maroon placeholder:text-brand-maroon/70 focus:border-brand-maroon focus:outline-none"
                />
                <span className="mt-1 block text-[12.5px] leading-relaxed text-brand-maroon/70">
                  Any form works — watch link, youtu.be, /shorts/, or just the video ID. Clear the
                  field to remove the video.
                </span>
              </label>

              {draftUrl.trim() && (
                <p className="text-[13px] text-brand-maroon/70">
                  {extractYouTubeId(draftUrl)
                    ? `Detected video ID: ${extractYouTubeId(draftUrl)}`
                    : "No video ID found in that link yet."}
                </p>
              )}

              <div className="mt-2 flex flex-col-reverse gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
