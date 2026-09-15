import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  HeartHandshake,
  ImageIcon,
  Images,
  Maximize2,
  Megaphone,
  MoveLeft,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
import { useAuth } from "../context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Data model                                                         */
/* ------------------------------------------------------------------ */
/*
 * The photos table stays "one row = one photo" (no big relational rebuild
 * needed) but two columns let a set of rows represent one memory:
 *   - group_id:    shared by every photo that belongs to the same memory
 *   - photo_order: this photo's position within its group
 * Title / date / sub_category are written identically onto every row in a
 * group. The frontend re-groups the flat row list back into "memories"
 * before rendering, so one event with 5 photos is one card, not five
 * duplicated ones.
 *
 * IMPORTANT — this only works if the backend round-trips group_id and
 * photo_order. If GET /api/photos does not return those two fields for a
 * row (e.g. the columns exist but the SELECT doesn't include them, or the
 * POST/PATCH handlers silently drop them), every photo falls back to being
 * its own single-photo group below — which is exactly the symptom of one
 * memory rendering as several duplicate cards. See groupRowsIntoMemories.
 */

type ArchiveType = "fundraising" | "donation" | "awareness";

interface PhotoRow {
  id: string | number;
  url: string;
  title: string;
  date: string;
  sub_category?: string;
  group_id?: string;
  photo_order?: number;
  display_order?: number | null;
}

interface MemoryPhoto {
  id: string;
  url: string;
}

interface Memory {
  groupId: string;
  title: string;
  date: string;
  type: ArchiveType;
  displayOrder: number;
  photos: MemoryPhoto[];
}

// Grouping key: prefer the real group_id. If a row has none (older data, or
// a backend that isn't persisting it yet), fall back to a heuristic key
// built from title + date + category instead of the row's own id — this
// keeps photos that were clearly uploaded together as one card instead of
// splintering into one card per photo. It's a safety net, not a fix: the
// backend should still be storing/returning group_id (see note above).
const fallbackGroupKey = (row: PhotoRow) => `fallback::${row.title}::${row.date}::${row.sub_category || ""}`;

const groupRowsIntoMemories = (rows: PhotoRow[]): Memory[] => {
  const groups = new Map<string, PhotoRow[]>();
  rows.forEach((row) => {
    const key = row.group_id || fallbackGroupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  });

  const memories: Memory[] = Array.from(groups.entries()).map(([groupId, groupRows]) => {
    // .id may come back as a number from Postgres (serial/int8 primary key)
    // rather than a string — coerce both sides before comparing so this
    // never throws regardless of the column type.
    const sortedPhotos = [...groupRows].sort(
      (a, b) => (a.photo_order ?? 0) - (b.photo_order ?? 0) || String(a.id).localeCompare(String(b.id)),
    );
    const first = sortedPhotos[0];
    return {
      groupId,
      title: first.title,
      date: first.date,
      type: (first.sub_category as ArchiveType) || "fundraising",
      displayOrder: Number.isFinite(Number(first.display_order)) ? Number(first.display_order) : Number.MAX_SAFE_INTEGER,
      photos: sortedPhotos.map((p) => ({ id: String(p.id), url: p.url })),
    };
  });

  return memories.sort((a, b) => a.displayOrder - b.displayOrder);
};

// A Team Archive is more than a photo dump — tagging each memory by the kind
// of work it represents lets the page read as a structured record of what
// Ikshana actually does, and each category gets its own color identity (a
// top accent stripe, badge, and hover glow) so the three read as distinct at
// a glance rather than just differently-labeled versions of the same card.
const ARCHIVE_TYPES: {
  key: ArchiveType;
  label: string;
  shortLabel: string;
  plural: string;
  icon: typeof Camera;
  chipClass: string;
  activeTabClass: string;
  accentClass: string;
  glowClass: string;
}[] = [
  {
    key: "fundraising",
    label: "Fundraising Event",
    shortLabel: "Fundraising",
    plural: "Fundraising Events",
    icon: Megaphone,
    chipClass: "bg-amber-100 text-amber-700",
    activeTabClass: "border-amber-500 bg-amber-500 text-white",
    accentClass: "bg-gradient-to-r from-amber-400 to-amber-300",
    glowClass: "group-hover:shadow-[0_24px_50px_-18px_rgba(217,119,6,0.4)]",
  },
  {
    key: "donation",
    label: "Donation Drive",
    shortLabel: "Donation",
    plural: "Donation Drives",
    icon: HeartHandshake,
    chipClass: "bg-rose-100 text-rose-700",
    activeTabClass: "border-rose-500 bg-rose-500 text-white",
    accentClass: "bg-gradient-to-r from-rose-400 to-rose-300",
    glowClass: "group-hover:shadow-[0_24px_50px_-18px_rgba(225,29,72,0.4)]",
  },
  {
    key: "awareness",
    label: "Awareness & Outreach",
    shortLabel: "Awareness",
    plural: "Awareness & Outreach",
    icon: BookOpen,
    chipClass: "bg-teal-100 text-teal-700",
    activeTabClass: "border-teal-500 bg-teal-500 text-white",
    accentClass: "bg-gradient-to-r from-teal-400 to-teal-300",
    glowClass: "group-hover:shadow-[0_24px_50px_-18px_rgba(13,148,136,0.4)]",
  },
];

const getArchiveTypeMeta = (type?: string) =>
  ARCHIVE_TYPES.find((t) => t.key === type) ?? ARCHIVE_TYPES[0];

// Keep date-only values in local time. Using `toISOString().slice(0, 10)` for
// the current date can produce yesterday/tomorrow for users outside UTC.
const getLocalDateInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Supabase/Postgres may return a DATE as `yyyy-mm-dd`, a timestamp, or an
// ISO string. A date-only value must be used as-is; converting it through a
// Date object can shift the calendar day because of the browser timezone.
const toDateInputValue = (value?: string) => {
  if (!value) return getLocalDateInputValue();

  const trimmed = String(value).trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return getLocalDateInputValue();
};

const formatDisplayDate = (value?: string) => {
  if (!value) return "";
  const inputValue = toDateInputValue(value);
  const [year, month, day] = inputValue.split("-").map(Number);
  if (!year || !month || !day) return String(value);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
};

const EMPTY_FORM = {
  title: "",
  date: getLocalDateInputValue(),
  type: "fundraising" as ArchiveType,
};

// Keep the archive cards subtly staggered like scattered printed photos.
// This is deterministic so the cards do not jump between renders.
const CARD_TILTS = [-1.1, 0.8, -0.5, 1.2, -0.9, 0.5];
const getCardTilt = (index: number) => CARD_TILTS[index % CARD_TILTS.length];

const OUTPUT_LONG_SIDE = 1600;
const DEFAULT_RATIO = 4 / 5;

/* ------------------------------------------------------------------ */
/*  Crop & zoom modal                                                  */
/* ------------------------------------------------------------------ */

type CropPoint = { x: number; y: number };

const RATIO_PRESETS = [
  { key: "square", label: "Square", ratio: 1 },
  { key: "portrait", label: "Portrait", ratio: 4 / 5 },
  { key: "classic", label: "Classic", ratio: 4 / 3 },
  { key: "wide", label: "Wide", ratio: 16 / 9 },
  { key: "story", label: "Story", ratio: 9 / 16 },
] as const;

const MAX_ZOOM = 3;

// Fits a rectangle of the given ratio (width / height) inside a maxW x maxH
// box, keeping it as large as possible without exceeding either bound.
const computeViewportSize = (ratio: number, maxW: number, maxH: number) => {
  if (!maxW || !maxH || !ratio) return { width: 0, height: 0 };
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { width, height };
};

const createCroppedImageFile = async (
  imageSrc: string,
  crop: CropPoint,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): Promise<Blob> => {
  const image = new Image();

  try {
    const imageUrl = new URL(imageSrc, window.location.href);
    if (imageUrl.origin !== window.location.origin) {
      image.crossOrigin = "anonymous";
    }
  } catch {
    // Relative or already-safe URL — nothing to adjust.
  }

  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the selected image."));
  });

  const baseScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  const scale = baseScale * zoom;
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const left = (viewportWidth - displayedWidth) / 2 + crop.x;
  const top = (viewportHeight - displayedHeight) / 2 + crop.y;

  const rawSourceWidth = viewportWidth / scale;
  const rawSourceHeight = viewportHeight / scale;

  const sourceX = Math.max(0, Math.min(naturalWidth - rawSourceWidth, -left / scale));
  const sourceY = Math.max(0, Math.min(naturalHeight - rawSourceHeight, -top / scale));
  const sourceWidth = Math.min(rawSourceWidth, naturalWidth - sourceX);
  const sourceHeight = Math.min(rawSourceHeight, naturalHeight - sourceY);

  const ratio = viewportWidth / viewportHeight;
  const outWidth = ratio >= 1 ? OUTPUT_LONG_SIDE : Math.round(OUTPUT_LONG_SIDE * ratio);
  const outHeight = ratio >= 1 ? Math.round(OUTPUT_LONG_SIDE / ratio) : OUTPUT_LONG_SIDE;

  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create image canvas.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outWidth, outHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the cropped image."))),
      "image/jpeg",
      0.92,
    );
  });
};

// A sane default framing (center-cover crop, no interaction needed) applied
// the moment a photo is added, so uploading many photos at once doesn't
// force the admin through the interactive cropper for every single one.
// "Adjust crop" on any thumbnail re-opens the interactive tool afterward.
const autoCropFile = async (file: File, ratio = DEFAULT_RATIO): Promise<{ file: File; previewUrl: string }> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read the selected image."));
    });

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const naturalRatio = naturalWidth / naturalHeight;

    let sourceWidth = naturalWidth;
    let sourceHeight = naturalHeight;
    if (naturalRatio > ratio) {
      sourceWidth = naturalHeight * ratio;
    } else {
      sourceHeight = naturalWidth / ratio;
    }
    const sourceX = (naturalWidth - sourceWidth) / 2;
    const sourceY = (naturalHeight - sourceHeight) / 2;

    const outWidth = ratio >= 1 ? OUTPUT_LONG_SIDE : Math.round(OUTPUT_LONG_SIDE * ratio);
    const outHeight = ratio >= 1 ? Math.round(OUTPUT_LONG_SIDE / ratio) : OUTPUT_LONG_SIDE;

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create image canvas.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outWidth, outHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image."))), "image/jpeg", 0.92);
    });

    const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", { type: "image/jpeg" });
    const previewUrl = URL.createObjectURL(blob);
    return { file: croppedFile, previewUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

type CropModalProps = {
  image: string;
  initialRatioKey?: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

function CropModal({ image, initialRatioKey = "portrait", onCancel, onConfirm }: CropModalProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<CropPoint>({ x: 0, y: 0 });

  const [stageSize, setStageSize] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [ratioKey, setRatioKey] = useState(initialRatioKey);
  const [customW, setCustomW] = useState(4);
  const [customH, setCustomH] = useState(5);
  const [crop, setCrop] = useState<CropPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeRatio =
    ratioKey === "custom"
      ? customW > 0 && customH > 0
        ? customW / customH
        : 1
      : RATIO_PRESETS.find((preset) => preset.key === ratioKey)?.ratio ?? 1;

  const viewport = computeViewportSize(activeRatio, stageSize, stageSize);

  const getBaseScale = useCallback(() => {
    if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return 1;
    return Math.max(viewport.width / naturalSize.width, viewport.height / naturalSize.height);
  }, [viewport.width, viewport.height, naturalSize.width, naturalSize.height]);

  const clampCrop = useCallback(
    (point: CropPoint, nextZoom = zoom): CropPoint => {
      if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height) return point;
      const scale = getBaseScale() * nextZoom;
      const displayedWidth = naturalSize.width * scale;
      const displayedHeight = naturalSize.height * scale;
      const maxX = Math.max(0, (displayedWidth - viewport.width) / 2);
      const maxY = Math.max(0, (displayedHeight - viewport.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, point.x)),
        y: Math.min(maxY, Math.max(-maxY, point.y)),
      };
    },
    [getBaseScale, naturalSize.height, naturalSize.width, viewport.width, viewport.height, zoom],
  );

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const update = () => setStageSize(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratioKey, customW, customH]);

  useEffect(() => {
    setCrop((current) => clampCrop(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageSize]);

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isProcessing || !naturalSize.width) return;
    pointerIdRef.current = event.pointerId;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || isProcessing) return;
    const last = lastPointerRef.current;
    const delta = { x: event.clientX - last.x, y: event.clientY - last.y };
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setCrop((current) => clampCrop({ x: current.x + delta.x, y: current.y + delta.y }));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === event.pointerId) {
      pointerIdRef.current = null;
      setIsDragging(false);
    }
  };

  const handleZoomChange = (value: number) => {
    setZoom(value);
    setCrop((current) => clampCrop(current, value));
  };

  const handleConfirm = async () => {
    if (!viewport.width || !viewport.height || !naturalSize.width || !naturalSize.height || isProcessing) return;
    setIsProcessing(true);
    try {
      const blob = await createCroppedImageFile(
        image,
        crop,
        zoom,
        viewport.width,
        viewport.height,
        naturalSize.width,
        naturalSize.height,
      );
      const file = new File([blob], "gallery-photo.jpg", { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(file, previewUrl);
    } catch (error) {
      console.error("Failed to crop image:", error);
      window.alert("Unable to crop this image. Please try another photo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const baseScale = getBaseScale();
  const displayedWidth = naturalSize.width * baseScale * zoom;
  const displayedHeight = naturalSize.height * baseScale * zoom;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-950/85 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-photo-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-brand-maroon/10 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/45">Photo</p>
            <h3 id="crop-photo-title" className="mt-1 font-serif text-2xl text-brand-maroon sm:text-3xl">
              Crop &amp; frame
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-3 py-2 text-sm font-semibold text-brand-maroon transition hover:bg-brand-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close crop tool"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {RATIO_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setRatioKey(preset.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                  ratioKey === preset.key
                    ? "border-brand-maroon bg-brand-maroon text-white shadow-sm"
                    : "border-brand-maroon/15 bg-white text-brand-maroon/70 hover:border-brand-maroon/30 hover:text-brand-maroon"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`block w-3 rounded-[2px] border ${
                    ratioKey === preset.key ? "border-white/70" : "border-brand-maroon/50"
                  }`}
                  style={{ aspectRatio: preset.ratio }}
                />
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRatioKey("custom")}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                ratioKey === "custom"
                  ? "border-brand-maroon bg-brand-maroon text-white shadow-sm"
                  : "border-brand-maroon/15 bg-white text-brand-maroon/70 hover:border-brand-maroon/30 hover:text-brand-maroon"
              }`}
            >
              Custom
            </button>
          </div>

          {ratioKey === "custom" && (
            <div className="mb-5 flex items-center gap-2 text-sm text-brand-maroon/70">
              <input
                type="number"
                min={1}
                value={customW}
                onChange={(event) => setCustomW(Number(event.target.value) || 1)}
                className="w-16 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center"
                aria-label="Custom ratio width"
              />
              <span className="font-semibold text-brand-maroon/40">:</span>
              <input
                type="number"
                min={1}
                value={customH}
                onChange={(event) => setCustomH(Number(event.target.value) || 1)}
                className="w-16 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center"
                aria-label="Custom ratio height"
              />
              <span className="text-xs text-brand-maroon/40">width : height — type any ratio you like</span>
            </div>
          )}

          <div
            ref={stageRef}
            className="mx-auto flex w-full items-center justify-center overflow-hidden rounded-[1.5rem] bg-stone-950"
            style={{ height: stageSize || undefined, aspectRatio: "1 / 1", maxWidth: 440 }}
          >
            {stageSize > 0 && (
              <div
                ref={viewportRef}
                className={`relative overflow-hidden bg-stone-900 select-none touch-none ${
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{ width: viewport.width, height: viewport.height }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={(event) => {
                  if (pointerIdRef.current === event.pointerId) handlePointerUp(event);
                }}
              >
                {naturalSize.width > 0 && (
                  <img
                    src={image}
                    alt="Crop preview"
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                      width: displayedWidth,
                      height: displayedHeight,
                      left: "50%",
                      top: "50%",
                      transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
                    }}
                  />
                )}

                <img
                  src={image}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0"
                />

                <div className="pointer-events-none absolute inset-0 opacity-40">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                  <div className="absolute top-1/3 left-0 w-full h-px bg-white/40" />
                  <div className="absolute top-2/3 left-0 w-full h-px bg-white/40" />
                </div>
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />

                {!naturalSize.width && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                    Loading image…
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto mt-5 flex w-full max-w-[420px] items-center gap-3">
            <span className="text-lg text-stone-500">−</span>
            <input
              type="range"
              min="1"
              max={MAX_ZOOM}
              step="0.05"
              value={zoom}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[#8b1d3b]"
              aria-label="Image zoom"
            />
            <span className="text-lg font-semibold text-stone-500">+</span>
          </div>
          <p className="mx-auto mt-3 max-w-[420px] text-center text-xs text-stone-500">
            Drag the photo to reposition it, and use the slider to zoom.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-brand-maroon/10 bg-stone-50/70 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-2xl border border-brand-maroon/15 bg-white px-5 py-3 font-semibold text-brand-maroon transition hover:bg-brand-maroon/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing || !naturalSize.width}
            className="rounded-2xl bg-brand-maroon px-5 py-3 font-semibold text-white transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Crop & Use"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Memory cover collage                                               */
/* ------------------------------------------------------------------ */
/*
 * Renders the cover of a memory card. A single photo fills the whole box.
 * Two or more photos render as a real collage instead of hiding everyone
 * but the first photo — the exact layout (split halves / one big + two
 * small / 2x2 grid with a "+N" tile) depends on how many photos are in the
 * memory, mirroring the classic Facebook/Google-Photos album-cover pattern.
 * The tile order always follows the admin's own ordering from the edit
 * form (drag/move-left/move-right, with the first photo marked "Cover"),
 * so whatever they picked as the lead photo is always the largest/first
 * tile here too.
 */
// A tiny wrapper that fades an image in once it's actually loaded instead
// of letting it pop in abruptly, with a soft pulsing placeholder underneath
// so the tile never reads as a flat empty gray box while waiting.
function FadeImage({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden bg-stone-100">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-stone-200/70" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </div>
  );
}

function MemoryCoverCollage({ photos, title }: { photos: MemoryPhoto[]; title: string }) {
  const count = photos.length;
  const cover = photos[0];

  if (count <= 1) {
    return (
      <FadeImage
        src={cover.url}
        alt={title}
        eager
        className="transition-transform duration-700 group-hover:scale-105"
      />
    );
  }

  // A stack of photos instead of a tiled collage: only the single cover
  // photo (whatever the admin ordered first) is ever shown at full size —
  // the exact same well-behaved crop as a single-photo memory — with the
  // next one or two photos peeking out from behind it, offset and tilted
  // like a stack of physical prints. Because those peeking photos are
  // mostly hidden, their own crop quality never matters, which sidesteps
  // the whole "we can't know if a photo is portrait or landscape" problem
  // a tiled grid kept running into. It also echoes the slight tilt these
  // cards already have (see CARD_TILTS) instead of fighting it.
  const behind = photos.slice(1, 3);

  return (
    <div className="relative h-full w-full">
      {behind[1] && (
        <div className="absolute inset-0 origin-bottom-right rotate-[7deg] scale-[0.93] overflow-hidden rounded-[10px] border-[3px] border-white bg-stone-100 shadow-sm">
          <img src={behind[1].url} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      {behind[0] && (
        <div className="absolute inset-0 origin-bottom-left -rotate-[5deg] scale-[0.96] overflow-hidden rounded-[10px] border-[3px] border-white bg-stone-100 shadow-sm">
          <img src={behind[0].url} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="absolute inset-0 overflow-hidden rounded-[10px] border-[3px] border-white shadow-md">
        <FadeImage
          src={cover.url}
          alt={title}
          eager
          className="transition-transform duration-700 group-hover:scale-105"
        />
      </div>
    </div>
  );
}

/**
 * Warm an image into the browser cache without blocking UI.
 * Important: this is intentionally fire-and-forget. The Team Archive opens
 * the lightbox immediately, so event links must behave the same way.
 */
const warmImage = (src: string) => {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
};
/* ------------------------------------------------------------------ */
/*  Gallery page                                                       */
/* ------------------------------------------------------------------ */

type PhotoDraft = {
  key: string;
  existingId?: string; // present for a photo that already exists in the DB
  previewUrl: string;
  rawSourceUrl: string; // full-quality source used when (re-)cropping
  croppedFile?: File; // set whenever this draft needs to be uploaded
  markedForDeletion?: boolean;
};

let draftCounter = 0;
const nextDraftKey = () => `draft-${Date.now()}-${draftCounter++}`;

export default function Gallery() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeType, setActiveType] = useState<"all" | ArchiveType>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const [cropTargetKey, setCropTargetKey] = useState<string | null>(null);
  const [cropTargetSrc, setCropTargetSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [linkedEventNotFound, setLinkedEventNotFound] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const isObjectUrl = (value?: string | null): boolean => Boolean(value?.startsWith("blob:"));
  const revokeObjectUrl = (value?: string | null) => {
    if (isObjectUrl(value)) URL.revokeObjectURL(value as string);
  };

  const prepareImageForCropping = async (source: string): Promise<string> => {
    if (source.startsWith("blob:") || source.startsWith("data:")) return source;
    try {
      const sourceUrl = new URL(source, window.location.href);
      const isCrossOrigin = sourceUrl.origin !== window.location.origin;
      const response = isCrossOrigin
        ? await fetch(source, { mode: "cors", credentials: "omit" })
        : await fetch(source, buildAuthRequestInit({ method: "GET" }));
      if (!response.ok) throw new Error(`Image request failed with status ${response.status}.`);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("The server did not return a valid image.");
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Could not prepare existing image for cropping:", error);
      return source;
    }
  };

  const refreshMemories = async () => {
    try {
      const response = await fetch("/api/photos?category=gallery");
      if (response.ok) {
        const data: PhotoRow[] = await response.json();
        setMemories(groupRowsIntoMemories(data));
      }
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    refreshMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- link-in from the Events page --------------------- */
  // The Events page links here as `${TEAM_ARCHIVE_PATH}?event=<title>`. On
  // arrival we match that title against a memory (case-insensitive), force
  // the category filter to "all" so the match can't be hidden by whatever
  // filter happens to be selected, and open its lightbox immediately.
  //
  // This used to also scrollIntoView() the card first and open the lightbox
  // after a fixed setTimeout — that was the source of the "navigates to the
  // wrong part of the page" / "doesn't work" bug: client-side route changes
  // don't reset scroll position on their own, so the page could still be
  // sitting wherever the *previous* page had scrolled to when this effect
  // ran, and scrollIntoView on a card that hadn't fully laid out yet (or a
  // title that didn't match) could leave the user stranded. Since the
  // lightbox is a `position: fixed` overlay covering the whole viewport,
  // background scroll position doesn't actually matter to what's on
  // screen — resetting scroll to the top and opening the lightbox
  // synchronously is simpler and can't get stuck mid-animation.
  useEffect(() => {
    const eventParam = searchParams.get("event");
    if (!eventParam || memories.length === 0) return;

    if (activeType !== "all") {
      setActiveType("all");
      return; // effect re-runs once activeType updates, see deps below
    }

    const needle = eventParam.trim().toLowerCase();
    const target = memories.find((m) => m.title.trim().toLowerCase() === needle);

    if (!target) {
      setLinkedEventNotFound(true);
      return;
    }

    const index = memories
      .flatMap((m) => m.photos.map((p) => ({ memory: m, photo: p })))
      .findIndex((entry) => entry.memory.groupId === target.groupId);

    if (index !== -1) {
      const firstPhoto = memories
        .flatMap((m) => m.photos.map((p) => ({ memory: m, photo: p })))
        [index]?.photo;

      if (!firstPhoto) return;

      // Match the Team Archive interaction: open the lightbox immediately.
      // Never wait for a network request or image decode before showing it.
      window.scrollTo({ top: 0, behavior: "auto" });
      setLightboxIndex(index);
      warmImage(firstPhoto.url);

      // The event query is only a deep-link instruction. Once it has been
      // consumed, remove it from the address bar so closing/back navigation
      // can never leave ?event=... behind.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("event");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, memories, activeType]);

  /* ---------------------------- form lifecycle --------------------------- */

  const clearDrafts = () => {
    photoDrafts.forEach((draft) => {
      revokeObjectUrl(draft.previewUrl);
      if (draft.rawSourceUrl !== draft.previewUrl) revokeObjectUrl(draft.rawSourceUrl);
    });
    setPhotoDrafts([]);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingGroupId(null);
    setForm(EMPTY_FORM);
    clearDrafts();
    setShowCropper(false);
    setCropTargetKey(null);
    setCropTargetSrc(null);
    setDragActive(false);
  };

  const openAddForm = () => {
    setEditingGroupId(null);
    setForm({ ...EMPTY_FORM, type: activeType === "all" ? "fundraising" : activeType });
    clearDrafts();
    setIsFormOpen(true);
  };

  const openEditForm = (memory: Memory) => {
    setEditingGroupId(memory.groupId);
    setForm({
      title: memory.title,
      date: toDateInputValue(memory.date),
      type: memory.type,
    });
    clearDrafts();
    setPhotoDrafts(
      memory.photos.map((photo) => ({
        key: nextDraftKey(),
        existingId: photo.id,
        previewUrl: photo.url,
        rawSourceUrl: photo.url,
      })),
    );
    setIsFormOpen(true);
  };

  /* ------------------------------ photo drafts ---------------------------- */

  const addFilesAsDrafts = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      window.alert("Please choose valid image files.");
      return;
    }
    for (const file of list) {
      const rawSourceUrl = URL.createObjectURL(file);
      try {
        const { file: croppedFile, previewUrl } = await autoCropFile(file);
        setPhotoDrafts((prev) => [...prev, { key: nextDraftKey(), previewUrl, rawSourceUrl, croppedFile }]);
      } catch (error) {
        console.error("Failed to auto-crop photo", error);
        window.alert(`Couldn't process "${file.name}". Please try a different photo.`);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) await addFilesAsDrafts(files);
    e.target.value = "";
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) await addFilesAsDrafts(e.dataTransfer.files);
  };

  const removeDraft = (key: string) => {
    setPhotoDrafts((prev) => {
      const draft = prev.find((d) => d.key === key);
      if (!draft) return prev;
      // Existing (already-saved) photos are just marked, so a cancel
      // doesn't destroy anything until Save is actually pressed.
      if (draft.existingId) {
        return prev.map((d) => (d.key === key ? { ...d, markedForDeletion: true } : d));
      }
      revokeObjectUrl(draft.previewUrl);
      revokeObjectUrl(draft.rawSourceUrl);
      return prev.filter((d) => d.key !== key);
    });
  };

  const undoRemoveDraft = (key: string) => {
    setPhotoDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, markedForDeletion: false } : d)));
  };

  const moveDraft = (key: string, direction: -1 | 1) => {
    setPhotoDrafts((prev) => {
      const index = prev.findIndex((d) => d.key === key);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const openCropForDraft = async (key: string) => {
    const draft = photoDrafts.find((d) => d.key === key);
    if (!draft || isPreparingCrop) return;
    setIsPreparingCrop(true);
    try {
      const prepared = await prepareImageForCropping(draft.rawSourceUrl);
      setCropTargetKey(key);
      setCropTargetSrc(prepared);
      setShowCropper(true);
    } finally {
      setIsPreparingCrop(false);
    }
  };

  const handleCropConfirm = (file: File, previewUrl: string) => {
    setPhotoDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== cropTargetKey) return d;
        revokeObjectUrl(d.previewUrl);
        return { ...d, croppedFile: file, previewUrl };
      }),
    );
    setShowCropper(false);
    setCropTargetKey(null);
    setCropTargetSrc(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropTargetKey(null);
    setCropTargetSrc(null);
  };

  /* --------------------------------- submit -------------------------------- */

  const visibleDrafts = photoDrafts.filter((d) => !d.markedForDeletion);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (visibleDrafts.length === 0) {
      window.alert("Add at least one photo before saving.");
      return;
    }

    setLoading(true);
    try {
      const groupId = editingGroupId || `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const editingMemory = editingGroupId ? memories.find((m) => m.groupId === editingGroupId) : null;
      const displayOrder = editingMemory
        ? editingMemory.displayOrder
        : Math.max(0, ...memories.map((m) => m.displayOrder).filter((n) => Number.isFinite(n))) + 1;

      const toDelete = photoDrafts.filter((d) => d.existingId && d.markedForDeletion);
      for (const draft of toDelete) {
        await fetch(`/api/photos/${draft.existingId}`, buildAuthRequestInit({ method: "DELETE" }));
      }

      let photoOrder = 0;
      for (const draft of visibleDrafts) {
        const sharedFields = {
          title: form.title.trim() || "Untitled Moment",
          category: "gallery",
          sub_category: form.type,
          date: form.date,
          group_id: groupId,
          photo_order: String(photoOrder),
          display_order: String(displayOrder),
        };

        const isUnchangedExisting = draft.existingId && !draft.croppedFile;
        const formData = new FormData();
        Object.entries(sharedFields).forEach(([k, v]) => formData.append(k, v));
        if (draft.croppedFile) formData.append("file", draft.croppedFile);

        const url = draft.existingId ? `/api/photos/${draft.existingId}` : "/api/photos";
        const method = draft.existingId ? "PATCH" : "POST";

        // Skip re-sending an unchanged existing photo's own file, but still
        // sync shared fields (title/date/etc. may have changed) and order.
        void isUnchangedExisting;
        const response = await fetch(url, buildAuthRequestInit({ method, body: formData }));
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `${method} /api/photos failed (${response.status})`);
        }
        photoOrder += 1;
      }

      await refreshMemories();
      closeForm();
    } catch (error) {
      console.error(`Failed to ${editingGroupId ? "update" : "create"} memory`, error);
      alert(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const removeMemory = async (memory: Memory) => {
    if (!window.confirm(`Delete "${memory.title}" and all ${memory.photos.length} photo(s) in it?`)) return;
    try {
      for (const photo of memory.photos) {
        await fetch(`/api/photos/${photo.id}`, buildAuthRequestInit({ method: "DELETE" }));
      }
      setMemories((prev) => prev.filter((m) => m.groupId !== memory.groupId));
    } catch (e) {
      console.error("Failed to delete memory", e);
      alert("Something went wrong while deleting. Please try again.");
    }
  };

  /* ------------------------------- reordering ------------------------------ */

  // Shared by both desktop drag-and-drop and the mobile move-up/move-down
  // buttons below: applies a new order optimistically, then persists it,
  // rolling back if the request fails.
  const persistReorder = async (reordered: Memory[]) => {
    const previous = memories;
    setMemories(reordered);

    // display_order is duplicated onto every photo row in a group, so the
    // bulk reorder map needs one entry per photo, not per memory.
    const order: Record<string, number> = {};
    reordered.forEach((memory, index) => {
      memory.photos.forEach((photo) => {
        order[photo.id] = index + 1;
      });
    });

    try {
      const response = await fetch("/api/photos/reorder", buildAuthRequestInit({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      }));
      if (!response.ok) throw new Error(`Reorder API failed (${response.status})`);
    } catch (error) {
      console.error("Failed to persist memory order", error);
      setMemories(previous);
      alert("The cards were moved temporarily, but the new order could not be saved. Please try again.");
    }
  };

  // Mobile fallback for reordering: native HTML5 drag-and-drop (used by the
  // desktop cards below) never fires on a touchscreen, so admins on a phone
  // had no way to reorder memories at all. These move the card one position
  // within the *currently filtered* list, which matches what's visibly
  // adjacent on screen regardless of which category tab is active.
  const moveMemoryWithinFiltered = (groupId: string, direction: -1 | 1, filtered: Memory[]) => {
    const filteredIndex = filtered.findIndex((m) => m.groupId === groupId);
    const targetFilteredIndex = filteredIndex + direction;
    if (filteredIndex === -1 || targetFilteredIndex < 0 || targetFilteredIndex >= filtered.length) return;

    const targetGroupId = filtered[targetFilteredIndex].groupId;
    const fullIndex = memories.findIndex((m) => m.groupId === groupId);
    const fullTargetIndex = memories.findIndex((m) => m.groupId === targetGroupId);
    if (fullIndex === -1 || fullTargetIndex === -1) return;

    const next = [...memories];
    [next[fullIndex], next[fullTargetIndex]] = [next[fullTargetIndex], next[fullIndex]];
    const reordered = next.map((m, i) => ({ ...m, displayOrder: i + 1 }));
    persistReorder(reordered);
  };

  const handleCardDragStart = (e: React.DragEvent, groupId: string) => {
    if (!isAdmin) return;
    setDraggedGroupId(groupId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", groupId);
    }
  };

  const handleCardDragOver = (e: React.DragEvent, groupId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    setDragOverGroupId(groupId);
  };

  const handleCardDrop = async (e: React.DragEvent, targetGroupId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);

    const draggedId = draggedGroupId || e.dataTransfer?.getData("text/plain") || null;
    if (!draggedId || draggedId === targetGroupId) {
      setDraggedGroupId(null);
      return;
    }

    const draggedIndex = memories.findIndex((m) => m.groupId === draggedId);
    const targetIndex = memories.findIndex((m) => m.groupId === targetGroupId);
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedGroupId(null);
      return;
    }

    const next = [...memories];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    const reordered = next.map((m, i) => ({ ...m, displayOrder: i + 1 }));

    setDraggedGroupId(null);
    await persistReorder(reordered);
  };

  const handleCardDragEnd = () => {
    setDraggedGroupId(null);
    setDragOverGroupId(null);
  };

  /* -------------------------------- lightbox -------------------------------- */

  const filteredMemories =
    activeType === "all" ? memories : memories.filter((m) => m.type === activeType);

  // Flatten to a single sequence of {memory, photo} so prev/next can swipe
  // continuously through a multi-photo memory's own photos, then roll into
  // the next memory — while dots/position are still computed relative to
  // just the current memory.
  const lightboxSequence = filteredMemories.flatMap((memory) =>
    memory.photos.map((photo) => ({ memory, photo })),
  );

  const closeLightbox = () => {
    setLightboxIndex(null);
    if (searchParams.has("event")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("event");
      setSearchParams(nextParams, { replace: true });
    }
  };
  const showPrev = useCallback(
    () => setLightboxIndex((i) => (i === null ? null : (i - 1 + lightboxSequence.length) % lightboxSequence.length)),
    [lightboxSequence.length],
  );
  const showNext = useCallback(
    () => setLightboxIndex((i) => (i === null ? null : (i + 1) % lightboxSequence.length)),
    [lightboxSequence.length],
  );

  const openLightboxForMemory = (memory: Memory) => {
    const index = lightboxSequence.findIndex((entry) => entry.photo.id === memory.photos[0].id);
    if (index === -1) {
      setLightboxIndex(0);
      return;
    }

    // Open first, then warm the image in the background. Do not await anything.
    setLightboxIndex(index);
    warmImage(memory.photos[0].url);
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, showPrev, showNext]);

  useEffect(() => {
    setLightboxIndex(null);
  }, [activeType]);

  // The grid only ever fetches the 1–4 photos actually shown in a card's
  // collage tile, so any photo beyond that — or simply the next/previous
  // one in the lightbox — has never been requested by the browser yet.
  // Warm the current photo and its neighbors in the background. This never
  // blocks opening or navigation; it only improves subsequent next/prev taps.
  useEffect(() => {
    if (lightboxIndex === null || lightboxSequence.length === 0) return;

    const preloadAt = (offset: number) => {
      const target =
        lightboxSequence[
          (lightboxIndex + offset + lightboxSequence.length) % lightboxSequence.length
        ];
      if (!target) return;
      warmImage(target.photo.url);
    };

    // Warm the current image as well as both neighbours. The current image is
    // especially important when the lightbox was opened directly from Events.
    preloadAt(0);
    if (lightboxSequence.length > 1) {
      preloadAt(1);
      preloadAt(-1);
    }
  }, [lightboxIndex, lightboxSequence]);

  // Track the photo that has actually finished loading. Using the photo id
  // instead of resetting a boolean in an effect avoids a race where a cached
  // first image fires onLoad before the reset effect runs.
  const [loadedLightboxPhotoId, setLoadedLightboxPhotoId] = useState<string | null>(null);

  const lightboxEntry = lightboxIndex !== null ? lightboxSequence[lightboxIndex] : null;
  const lightboxImageLoaded =
    lightboxEntry !== null && loadedLightboxPhotoId === lightboxEntry.photo.id;
  const lightboxTypeMeta = lightboxEntry ? getArchiveTypeMeta(lightboxEntry.memory.type) : null;
  const lightboxPhotoPosition = lightboxEntry
    ? lightboxEntry.memory.photos.findIndex((p) => p.id === lightboxEntry.photo.id)
    : -1;

  return (
    <section id="gallery" className="py-24 px-4 sm:py-32 sm:px-6 bg-[#fffcfc] overflow-hidden relative">
      <div className="absolute top-0 right-0 w-full h-full opacity-[0.02] pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[800px] h-[800px] bg-brand-maroon rounded-full blur-[160px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="rounded-[1.75rem] border border-brand-maroon/10 bg-white px-3 py-4 shadow-[0_30px_90px_-30px_rgba(91,63,212,0.22)] sm:px-5 sm:py-6 lg:px-10 lg:py-10 xl:px-14 xl:py-12"
        >
          {linkedEventNotFound && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              We followed a link from an event, but couldn't find a matching memory here yet — it may not have
              photos in the archive with the exact same title.
            </div>
          )}

          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="text-center">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-brand-maroon/45 sm:text-sm"
              >
                Our Memories
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-brand-maroon"
              >
                Team{" "}
                <span className="relative inline-block italic">
                  Archive
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full bg-brand-maroon/25"
                  />
                </span>
              </motion.h2>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="mt-5 flex flex-col items-center gap-4 sm:mt-6 sm:gap-5"
            >
              <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand-maroon/10 bg-[#fff8f5] px-5 py-2.5 shadow-[0_14px_34px_-24px_rgba(139,29,59,0.45)] sm:gap-3 sm:px-6 sm:py-3 lg:gap-4 lg:px-8 lg:py-3.5">
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-maroon/35" />
                <p className="text-center text-xs font-medium leading-5 tracking-wide text-brand-maroon/75 sm:text-sm lg:text-base lg:leading-6">
                  Our team members, our milestones, the moments that shaped who we are.
                </p>
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-maroon/35" />
              </div>

              <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:max-w-full sm:flex-wrap sm:justify-center sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveType("all")}
                  className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold leading-tight transition-all sm:w-auto sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm lg:px-5 lg:py-2.5 lg:text-base ${
                    activeType === "all"
                      ? "border-brand-maroon bg-brand-maroon text-white shadow-sm"
                      : "border-brand-maroon/15 bg-white text-brand-maroon/70 hover:border-brand-maroon/30 hover:text-brand-maroon"
                  }`}
                >
                  All
                </button>
                {ARCHIVE_TYPES.map((type) => {
                  const Icon = type.icon;
                  const active = activeType === type.key;
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setActiveType(type.key)}
                      className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[8px] font-semibold leading-[1.15] transition-all sm:w-auto sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm lg:px-5 lg:py-2.5 lg:text-base ${
                        active
                          ? type.activeTabClass
                          : "border-brand-maroon/15 bg-white text-brand-maroon/70 hover:border-brand-maroon/30 hover:text-brand-maroon"
                      }`}
                    >
                      <Icon size={13} className="shrink-0" />
                      <span className="leading-[1.15]">{type.plural}</span>
                    </button>
                  );
                })}
              </div>

              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={openAddForm}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-maroon px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand-maroon/20 transition hover:bg-stone-900 sm:w-auto sm:px-7 sm:py-4 lg:px-9 lg:py-4.5 lg:text-base"
                >
                  <Camera size={18} />
                  Add a Memory
                </motion.button>
              )}
            </motion.div>
          </div>

          {isInitialLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-[1.5rem] border border-brand-maroon/10 bg-white p-3 pt-0 sm:rounded-[1.75rem] sm:p-4 sm:pt-0"
                >
                  <div className="-mx-3 mb-3 h-1.5 bg-stone-100 sm:-mx-4 sm:mb-4" />
                  <div className="aspect-[3/2] w-full rounded-[1.1rem] bg-stone-100 sm:rounded-[1.35rem]" />
                  <div className="px-1 pb-1 pt-3.5 sm:px-1.5 sm:pb-1.5 sm:pt-4">
                    <div className="h-5 w-28 rounded-full bg-stone-100" />
                    <div className="mt-3 h-5 w-4/5 rounded bg-stone-100" />
                    <div className="mt-2 h-5 w-2/3 rounded bg-stone-100" />
                    <div className="mt-3 h-3 w-24 rounded bg-stone-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMemories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="flex min-h-[340px] flex-col items-center justify-center rounded-[2rem] border border-brand-maroon/10 bg-[#fffcfc] px-6 py-10 relative overflow-hidden sm:aspect-[21/9] sm:min-h-0 sm:rounded-[2.5rem] sm:px-0 sm:py-0"
            >
              <div className="relative z-10 text-center px-2 sm:px-6">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff8f5] text-brand-maroon/30 shadow-sm sm:mb-8 sm:h-20 sm:w-20">
                  <ImageIcon size={28} className="sm:hidden" />
                  <ImageIcon size={36} className="hidden sm:block" />
                </div>
                <h3 className="mb-2.5 font-serif text-xl text-brand-maroon sm:mb-3 sm:text-2xl">
                  {activeType === "all" ? "No memories yet" : `No ${getArchiveTypeMeta(activeType).plural.toLowerCase()} yet`}
                </h3>
                <p className="mx-auto mb-6 max-w-xs text-xs leading-relaxed text-brand-maroon/50 sm:mb-8 sm:max-w-sm sm:text-sm">
                  Be the first to add a photo and start building the archive.
                </p>
                {isAdmin && (
                  <button
                    onClick={openAddForm}
                    className="text-brand-maroon font-bold tracking-widest uppercase text-xs hover:tracking-[0.2em] transition-all"
                  >
                    Add a Memory +
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
              <AnimatePresence>
                {filteredMemories.map((memory, index) => {
                  const isDragged = draggedGroupId === memory.groupId;
                  const isDropTarget = dragOverGroupId === memory.groupId;
                  const typeMeta = getArchiveTypeMeta(memory.type);
                  const TypeIcon = typeMeta.icon;
                  const photoCount = memory.photos.length;

                  return (
                    <motion.div
                      key={memory.groupId}
                      id={`memory-${memory.groupId}`}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0, rotate: getCardTilt(index) }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35 }}
                      whileHover={{ y: -6, rotate: 0, scale: 1.015 }}
                      draggable={isAdmin}
                      onDragStart={(e) => handleCardDragStart(e as any, memory.groupId)}
                      onDragOver={(e) => handleCardDragOver(e as any, memory.groupId)}
                      onDrop={(e) => handleCardDrop(e as any, memory.groupId)}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDragEnd={handleCardDragEnd}
                      className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] border bg-white p-3 pt-0 select-none shadow-[0_14px_34px_-16px_rgba(91,63,212,0.28)] transition-shadow duration-300 sm:rounded-[1.75rem] sm:p-4 sm:pt-0 ${typeMeta.glowClass} ${
                        isDragged
                          ? "opacity-50 border-brand-maroon"
                          : isDropTarget
                            ? "border-[#5B3FD4] ring-2 ring-[#5B3FD4]/20"
                            : "border-brand-maroon/10"
                      } ${isAdmin ? "sm:cursor-grab sm:active:cursor-grabbing" : ""}`}
                    >
                      <span aria-hidden="true" className={`-mx-3 mb-3 block h-1.5 sm:-mx-4 sm:mb-4 ${typeMeta.accentClass}`} />

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => openLightboxForMemory(memory)}
                          className="relative block aspect-[3/2] w-full overflow-hidden rounded-[1.1rem] bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-maroon focus-visible:ring-offset-2 sm:rounded-[1.35rem]"
                          aria-label={`View ${memory.title} full size`}
                        >
                          <MemoryCoverCollage photos={memory.photos} title={memory.title} />

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-maroon/0 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:from-brand-maroon/50 group-hover:opacity-100" />

                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-maroon shadow-md">
                              <Maximize2 size={17} />
                            </span>
                          </div>

                          {photoCount > 1 && (
                            <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-stone-950/60 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                              <Images size={12} />
                              {photoCount}
                            </span>
                          )}

                          {isAdmin && (
                            <div className="pointer-events-none absolute bottom-2.5 left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-dashed border-white/40 bg-stone-950/60 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 sm:flex">
                              <GripVertical size={11} />
                              Drag to reorder
                            </div>
                          )}
                        </button>

                        {isAdmin && (
                          <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-100 transition-opacity">
                            {/* Move up/down — the only way to reorder on a touchscreen,
                                since native HTML5 drag-and-drop (used on sm+ below)
                                never fires on touch devices at all. Reorders within
                                whatever category tab is currently active, matching
                                what's visibly adjacent on screen. */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveMemoryWithinFiltered(memory.groupId, -1, filteredMemories);
                              }}
                              disabled={index === 0}
                              className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
                              title="Move up"
                              aria-label="Move this memory earlier"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveMemoryWithinFiltered(memory.groupId, 1, filteredMemories);
                              }}
                              disabled={index === filteredMemories.length - 1}
                              className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:hidden"
                              title="Move down"
                              aria-label="Move this memory later"
                            >
                              <ChevronDown size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditForm(memory);
                              }}
                              className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMemory(memory);
                              }}
                              className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col px-1 pb-1 pt-3.5 sm:px-1.5 sm:pb-1.5 sm:pt-4">
                        <span
                          className={`inline-flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-[0.14em] ${typeMeta.chipClass}`}
                        >
                          <TypeIcon size={11} className="shrink-0" />
                          {typeMeta.label}
                        </span>

                        <h3 className="mt-2.5 line-clamp-2 break-words font-serif text-lg font-bold leading-snug text-brand-maroon sm:mt-3 sm:text-xl">
                          {memory.title}
                        </h3>

                        <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-brand-maroon/45 sm:pt-3 sm:text-xs sm:tracking-[0.18em]">
                          <CalendarDays size={12} className="shrink-0 text-brand-maroon/40" aria-hidden="true" />
                          <span>{formatDisplayDate(memory.date)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add / edit memory modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
              className="absolute inset-0 bg-stone-900/70 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-brand-maroon/10 px-8 py-6 sm:px-10">
                <h3 className="font-serif text-3xl text-brand-maroon sm:text-4xl">
                  {editingGroupId ? "Edit a Memory" : "Add a Memory"}
                </h3>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-3 py-2 text-sm font-semibold text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-8 sm:px-10">
                <form onSubmit={handleSubmit} className="space-y-7">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-brand-maroon/50">
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ARCHIVE_TYPES.map((type) => {
                        const Icon = type.icon;
                        const active = form.type === type.key;
                        return (
                          <button
                            key={type.key}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, type: type.key }))}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                              active
                                ? type.activeTabClass
                                : "border-stone-200 bg-stone-50 text-stone-500 hover:border-brand-maroon/30 hover:text-brand-maroon"
                            }`}
                          >
                            <Icon size={14} />
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-brand-maroon/50">
                        Story title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="What's this event or moment?"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-lg font-serif placeholder:text-stone-400 focus:border-brand-maroon focus:outline-none"
                        value={form.title}
                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      />
                      <p className="mt-1.5 text-[10px] text-brand-maroon/35">
                        If this belongs to an event, use the exact same title as on the Events page — that's how the
                        two pages link up.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-maroon/50">
                        <CalendarDays size={14} />
                        Date
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-base text-brand-maroon focus:border-brand-maroon focus:outline-none"
                        value={form.date}
                        onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-[0.2em] text-brand-maroon/50">
                        Photos {visibleDrafts.length > 0 && `(${visibleDrafts.length})`}
                      </label>
                      <span className="text-[10px] text-brand-maroon/35">One title & date, as many photos as you like</span>
                    </div>

                    {photoDrafts.length === 0 ? (
                      <div
                        className={`relative flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-8 text-center transition-all sm:p-10 ${
                          dragActive
                            ? "border-brand-maroon bg-brand-maroon/5"
                            : "border-stone-200 bg-stone-50 hover:bg-stone-100/60"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center">
                          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-maroon/40 shadow-sm">
                            <Upload size={22} />
                          </div>
                          <p className="mb-1 font-serif text-sm text-stone-600">Drop your photos here</p>
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">
                            or <span className="font-bold text-brand-maroon">browse files</span> — select as many as you need
                          </p>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleFileInputChange}
                        />
                      </div>
                    ) : (
                      <div
                        className={`rounded-[2rem] border-2 border-dashed p-4 transition-all sm:p-5 ${
                          dragActive ? "border-brand-maroon bg-brand-maroon/5" : "border-stone-200 bg-stone-50"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <div className="flex flex-wrap gap-3">
                          {photoDrafts.map((draft, i) =>
                            draft.markedForDeletion ? (
                              <div
                                key={draft.key}
                                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stone-300 bg-stone-100 text-center"
                              >
                                <span className="text-[9px] font-semibold uppercase tracking-widest text-stone-400">Removed</span>
                                <button
                                  type="button"
                                  onClick={() => undoRemoveDraft(draft.key)}
                                  className="text-[10px] font-bold text-brand-maroon hover:underline"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <div key={draft.key} className="group/thumb relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white shadow-md">
                                <img src={draft.previewUrl} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />

                                {i === 0 && (
                                  <span className="absolute left-1 top-1 rounded-full bg-brand-maroon px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                                    Cover
                                  </span>
                                )}

                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-stone-950/55 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/thumb:opacity-100">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveDraft(draft.key, -1)}
                                      disabled={i === 0}
                                      className="rounded-full bg-white/90 p-1 text-brand-maroon disabled:opacity-30"
                                      title="Move left"
                                    >
                                      <MoveLeft size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openCropForDraft(draft.key)}
                                      disabled={isPreparingCrop}
                                      className="rounded-full bg-white/90 p-1 text-brand-maroon disabled:opacity-30"
                                      title="Adjust crop"
                                    >
                                      <Maximize2 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveDraft(draft.key, 1)}
                                      disabled={i === visibleDrafts.length - 1 && !photoDrafts.slice(i + 1).some((d) => !d.markedForDeletion)}
                                      className="rounded-full bg-white/90 p-1 text-brand-maroon disabled:opacity-30"
                                      title="Move right"
                                    >
                                      <MoveRight size={11} />
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDraft(draft.key)}
                                    className="rounded-full bg-white/90 p-1 text-brand-maroon"
                                    title="Remove"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            ),
                          )}

                          <button
                            type="button"
                            onClick={() => addMoreInputRef.current?.click()}
                            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-stone-300 text-stone-400 transition hover:border-brand-maroon/40 hover:text-brand-maroon"
                          >
                            <Plus size={18} />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Add</span>
                          </button>
                          <input
                            ref={addMoreInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleFileInputChange}
                          />
                        </div>
                        <p className="mt-3 text-[10px] text-brand-maroon/40">
                          The first photo is used as the cover. On mobile, the photo controls stay visible; on desktop, hover a photo to reorder, re-crop, or remove it.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={visibleDrafts.length === 0 || loading}
                    className="w-full rounded-2xl bg-brand-maroon py-4 text-xs font-bold uppercase tracking-[0.3em] text-white shadow-lg shadow-brand-maroon/20 transition hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading
                      ? editingGroupId
                        ? "Updating..."
                        : "Saving..."
                      : editingGroupId
                        ? "Update Memory"
                        : `Save Memory${visibleDrafts.length > 1 ? ` (${visibleDrafts.length} photos)` : ""}`}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showCropper && cropTargetSrc && (
        <CropModal image={cropTargetSrc} onCancel={handleCropCancel} onConfirm={handleCropConfirm} />
      )}

      {/* Lightbox viewer — one scrollable card per photo; a multi-photo memory
          swipes through its own photos with dots, while title/date are shared
          and shown once. */}
      <AnimatePresence>
        {lightboxEntry && lightboxTypeMeta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-stone-950/95 p-3 sm:p-6"
            onClick={closeLightbox}
            onTouchStart={(e) => {
              touchStartXRef.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null) return;
              const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
              touchStartXRef.current = null;
              if (Math.abs(deltaX) < 50) return;
              if (deltaX > 0) showPrev();
              else showNext();
            }}
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="fixed right-4 top-4 z-[160] rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:right-6 sm:top-6"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {lightboxSequence.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrev();
                  }}
                  className="fixed left-2 top-1/2 z-[160] -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:left-4"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNext();
                  }}
                  className="fixed right-2 top-1/2 z-[160] -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 sm:right-4"
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            <motion.div
              key={lightboxEntry.photo.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#171315] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.75)] sm:rounded-[2rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 overflow-y-auto">
                <div className="relative flex min-h-[46vh] items-center justify-center bg-black/80 sm:min-h-[58vh]">
                  {!lightboxImageLoaded && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
                    </div>
                  )}
                  <img
                    key={lightboxEntry.photo.id}
                    src={lightboxEntry.photo.url}
                    alt={lightboxEntry.memory.title}
                    loading="eager"
                    fetchPriority="high"
                    onLoad={(event) => {
                      setLoadedLightboxPhotoId(lightboxEntry.photo.id);
                    }}
                    onError={() => {
                      // Do not leave the lightbox stuck behind the spinner if
                      // the image request fails. The browser will still show
                      // its normal broken-image state.
                      setLoadedLightboxPhotoId(lightboxEntry.photo.id);
                    }}
                    className="max-h-[60vh] w-full object-contain sm:max-h-[70vh]"
                  />
                </div>

                {lightboxEntry.memory.photos.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-4">
                    {lightboxEntry.memory.photos.map((photo, i) => (
                      <span
                        key={photo.id}
                        aria-hidden="true"
                        className={`h-1.5 rounded-full transition-all ${
                          i === lightboxPhotoPosition ? "w-4 bg-rose-300" : "w-1.5 bg-white/25"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="border-t border-white/10 bg-[#1c1719] px-6 py-5 text-center sm:px-10 sm:py-7">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${lightboxTypeMeta.chipClass}`}
                  >
                    <lightboxTypeMeta.icon size={12} />
                    {lightboxTypeMeta.label}
                  </span>

                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    <CalendarDays size={13} />
                    <span>{formatDisplayDate(lightboxEntry.memory.date)}</span>
                    {lightboxEntry.memory.photos.length > 1 && (
                      <span className="text-white/30">
                        &middot; {lightboxPhotoPosition + 1} / {lightboxEntry.memory.photos.length}
                      </span>
                    )}
                  </div>

                  <h3 className="mx-auto mt-2 max-w-3xl font-serif text-2xl leading-tight text-white sm:text-3xl">{lightboxEntry.memory.title}</h3>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
