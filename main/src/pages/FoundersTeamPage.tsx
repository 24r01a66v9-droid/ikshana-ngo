import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { CalendarDays, GripVertical, Instagram, Linkedin, Pencil, Plus, Trash2, X } from "lucide-react";
import { buildAuthRequestInit } from "../auth/fetchWithAuth";
import { useAuth } from "../context/AuthContext";
import { reorderMembersById } from "../components/teamUtils";

const STORAGE_KEY = "ikshana-leadership-members";
const LEADERSHIP_RESET_KEY = "ikshana-leadership-reset-complete";

type LeadershipCategory = "founders" | "currentBoard" | "previousBoard" | "volunteers";

interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  tenure: string;
  bio: string;
  image: string;
  category: LeadershipCategory;
  displayOrder: number;
  linkedinUrl?: string;
  instagramUrl?: string;
}

const createAvatar = (name: string, accent: string) => {
  const label = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="40" fill="${accent}"/><circle cx="120" cy="96" r="46" fill="#fff7f2"/><path d="M56 196c12-34 42-52 64-52s52 18 64 52" fill="#fff7f2"/><text x="120" y="214" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#7a1f2d">${label}</text></svg>`)}`;
};

type CropPoint = {
  x: number;
  y: number;
};

type ImageCropperModalProps = {
  image: string;
  onCancel: () => void;
  onConfirm: (file: File, previewUrl: string) => void;
};

const OUTPUT_IMAGE_SIZE = 800;
const MAX_ZOOM = 3;

const createCroppedImageFile = async (
  imageSrc: string,
  crop: CropPoint,
  zoom: number,
  cropDiameter: number,
  viewportSize: number,
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
  }

  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not load the selected image."));
  });

  const baseScale = Math.max(
    cropDiameter / naturalWidth,
    cropDiameter / naturalHeight,
  );
  const scale = baseScale * zoom;
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  const left = (viewportSize - displayedWidth) / 2 + crop.x;
  const top = (viewportSize - displayedHeight) / 2 + crop.y;

  const sourceCropSize = viewportSize * 0.78;
  const cropLeft = (viewportSize - sourceCropSize) / 2;
  const cropTop = (viewportSize - sourceCropSize) / 2;

  const sourceX = Math.max(
    0,
    Math.min(naturalWidth - sourceCropSize / scale, (cropLeft - left) / scale),
  );
  const sourceY = Math.max(
    0,
    Math.min(naturalHeight - sourceCropSize / scale, (cropTop - top) / scale),
  );
  const sourceSize = Math.min(
    sourceCropSize / scale,
    naturalWidth - sourceX,
    naturalHeight - sourceY,
  );

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_IMAGE_SIZE;
  canvas.height = OUTPUT_IMAGE_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create image canvas.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    OUTPUT_IMAGE_SIZE,
    OUTPUT_IMAGE_SIZE,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not create the cropped image."));
        }
      },
      "image/jpeg",
      0.92,
    );
  });
};

function ImageCropperModal({ image, onCancel, onConfirm }: ImageCropperModalProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointerPositionRef = useRef<CropPoint>({ x: 0, y: 0 });

  const [viewportSize, setViewportSize] = useState(0);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const cropDiameter = viewportSize * 0.78;

  const getBaseScale = useCallback(() => {
    if (!cropDiameter || !naturalSize.width || !naturalSize.height) {
      return 1;
    }

    return Math.max(
      cropDiameter / naturalSize.width,
      cropDiameter / naturalSize.height,
    );
  }, [cropDiameter, naturalSize.height, naturalSize.width]);

  const clampCrop = useCallback(
    (point: CropPoint, nextZoom = zoom): CropPoint => {
      if (!viewportSize || !naturalSize.width || !naturalSize.height) {
        return point;
      }

      const scale = getBaseScale() * nextZoom;
      const displayedWidth = naturalSize.width * scale;
      const displayedHeight = naturalSize.height * scale;

      const maxX = Math.max(0, (displayedWidth - cropDiameter) / 2);
      const maxY = Math.max(0, (displayedHeight - cropDiameter) / 2);

      return {
        x: Math.min(maxX, Math.max(-maxX, point.x)),
        y: Math.min(maxY, Math.max(-maxY, point.y)),
      };
    },
    [cropDiameter, getBaseScale, naturalSize.height, naturalSize.width, viewportSize, zoom],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateSize = () => {
      setViewportSize(element.getBoundingClientRect().width);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCrop((current) => clampCrop(current));
  }, [clampCrop, viewportSize]);

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    setNaturalSize({ width: target.naturalWidth, height: target.naturalHeight });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isProcessing || !naturalSize.width) return;

    pointerIdRef.current = event.pointerId;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId || isProcessing) return;

    const last = lastPointerPositionRef.current;
    const delta = {
      x: event.clientX - last.x,
      y: event.clientY - last.y,
    };

    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
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
    if (!viewportSize || !naturalSize.width || !naturalSize.height || isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      const blob = await createCroppedImageFile(
        image,
        crop,
        zoom,
        cropDiameter,
        viewportSize,
        naturalSize.width,
        naturalSize.height,
      );

      const file = new File([blob], "profile-image.jpg", { type: "image/jpeg" });
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(file, previewUrl);
    } catch (error) {
      console.error("Failed to crop image:", error);
      window.alert("Unable to crop this image. Please try another image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const baseScale = getBaseScale();
  const displayedWidth = naturalSize.width * baseScale * zoom;
  const displayedHeight = naturalSize.height * baseScale * zoom;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-950/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-image-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-brand-maroon/10 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/45">
              Profile picture
            </p>
            <h3 id="crop-image-title" className="mt-1 font-serif text-2xl text-brand-maroon sm:text-3xl">
              Adjust image
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-stone-500 sm:text-sm">
              Drag the image and use the zoom slider until the face and head fit comfortably inside the circle.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-3 py-2 text-sm font-semibold text-brand-maroon transition hover:bg-brand-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close image cropper"
          >
            <X size={16} />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <div
            ref={viewportRef}
            className={`relative mx-auto aspect-square w-full max-w-[430px] overflow-hidden rounded-[1.5rem] bg-stone-950 select-none touch-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={(event) => {
              if (pointerIdRef.current === event.pointerId) {
                handlePointerUp(event);
              }
            }}
          >
            {naturalSize.width > 0 && viewportSize > 0 && (
              <img
                src={image}
                alt="Crop preview"
                draggable={false}
                onLoad={handleImageLoad}
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

            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              <div className="absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 -translate-y-1/2 bg-white/20" />
              <div className="absolute left-1/2 top-1/2 h-[78%] w-px -translate-x-1/2 -translate-y-1/2 bg-white/20" />
            </div>

            {!naturalSize.width && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                Loading image…
              </div>
            )}
          </div>

          <p className="mx-auto mt-3 max-w-[430px] text-center text-xs text-stone-500">
            Everything inside the circle will be saved as the profile picture.
          </p>

          <div className="mx-auto mt-5 flex w-full max-w-[430px] items-center gap-3">
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

          <div className="mx-auto mt-2 flex w-full max-w-[430px] justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            <span>Zoom out</span>
            <span>Zoom in</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-brand-maroon/10 bg-stone-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
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

export default function FoundersTeamPage() {
  const { user } = useAuth();
  const normalizedRole = user?.role?.toLowerCase();
  const isAdmin = Boolean(
    normalizedRole === "admin" || (user?.email && user.email === "24r01a66v9@cmrithyderabad.edu.in")
  );

  const [leadershipMembers, setLeadershipMembers] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<LeadershipCategory>("founders");
  const [selectedPreviousBatch, setSelectedPreviousBatch] = useState("");
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isPreparingCropSource, setIsPreparingCropSource] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    role: "",
    tenure: "",
    bio: "",
    linkedinUrl: "",
    instagramUrl: "",
    category: "founders" as LeadershipCategory,
  });

  const fetchLeadershipMembers = async () => {
    try {
      const response = await fetch("/api/leadership-members");
      if (response.ok) {
        const data: any[] = await response.json();
        if (Array.isArray(data)) {
          const mapped: LeadershipMember[] = data.map((item, index) => {
            const category: LeadershipCategory =
              item.category === "founders" ||
              item.category === "currentBoard" ||
              item.category === "previousBoard" ||
              item.category === "volunteers"
                ? item.category
                : "founders";

            const rawBio = typeof item.bio === "string" ? item.bio.trim() : "";
            return {
              id: String(item.id),
              name: item.name || "Leadership Member",
              role:
                item.role ||
                (category === "founders"
                  ? "Founder"
                  : category === "previousBoard"
                    ? "Former Board Member"
                    : category === "volunteers"
                      ? "Volunteer"
                      : "Executive Board Member"),
              tenure: item.tenure || "2026",
              bio: rawBio,
              image: item.image || createAvatar(item.name || "Member", "#8b1d3b"),
              category,
              displayOrder: Number(item.display_order ?? index + 1),
              linkedinUrl: item.linkedin_url || item.linkedinUrl || undefined,
              instagramUrl: item.instagram_url || item.instagramUrl || undefined,
            };
          });

          setLeadershipMembers(mapped);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch leadership members from DB:", err);
    } finally {
      setLoading(false);
    }

    const storedMembers = window.localStorage.getItem(STORAGE_KEY);
    if (storedMembers) {
      try {
        const parsed = JSON.parse(storedMembers) as LeadershipMember[];
        if (parsed.length > 0) {
          setLeadershipMembers(parsed);
          return;
        }
      } catch {}
    }
  };

  useEffect(() => {
    if (!showAddMemberForm || !isAdmin) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAddMemberForm(false);
        setShowCropper(false);
        setCropImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddMemberForm, isAdmin]);

  useEffect(() => {
    fetchLeadershipMembers();
  }, []);

  const isObjectUrl = (value: string | null): boolean => Boolean(value?.startsWith("blob:"));

  const revokeObjectUrl = (value: string | null) => {
    if (isObjectUrl(value)) {
      URL.revokeObjectURL(value as string);
    }
  };

  const prepareImageForCropping = async (source: string): Promise<string> => {
    if (source.startsWith("blob:") || source.startsWith("data:")) {
      return source;
    }

    try {
      const sourceUrl = new URL(source, window.location.href);
      const isCrossOrigin = sourceUrl.origin !== window.location.origin;

      const response = isCrossOrigin
        ? await fetch(source, { mode: "cors", credentials: "omit" })
        : await fetch(source, buildAuthRequestInit({ method: "GET" }));

      if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("The server did not return a valid image.");
      }

      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Could not prepare existing image for cropping:", error);
      return source;
    }
  };

  const openCropper = async (source: string, sourceIsOriginal = true) => {
    const cropSource = await prepareImageForCropping(source);

    if (sourceIsOriginal) {
      if (cropSourceImage && cropSourceImage !== cropSource && isObjectUrl(cropSourceImage)) {
        revokeObjectUrl(cropSourceImage);
      }
      setCropSourceImage(cropSource);
    }

    setCropImage(cropSource);
    setShowCropper(true);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    revokeObjectUrl(cropSourceImage);
    revokeObjectUrl(previewImage);

    setUploadedFile(null);
    setPreviewImage(null);
    setIsPreparingCropSource(false);
    setCropSourceImage(imageUrl);
    setCropImage(imageUrl);
    setShowCropper(true);
    event.target.value = "";
  };

  const handleCropConfirm = (file: File, previewUrl: string) => {
    setUploadedFile(file);
    setPreviewImage(previewUrl);
    setShowCropper(false);
    setCropImage(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropImage(null);
  };

  const handleAdjustCrop = async () => {
    if (!cropSourceImage || isPreparingCropSource) return;
    await openCropper(cropSourceImage, false);
  };

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !newMember.name.trim() || !newMember.role.trim()) return;

    setIsSubmitting(true);

    try {
      const targetDisplayOrder = editingMemberId
        ? leadershipMembers.find((item) => item.id === editingMemberId)?.displayOrder ?? 1
        : Math.max(0, ...leadershipMembers.map((item) => item.displayOrder)) + 1;

      const formData = new FormData();
      formData.append("name", newMember.name.trim());
      formData.append("role", newMember.role.trim());
      formData.append("tenure", newMember.tenure.trim() || "2026");
      formData.append("bio", newMember.bio.trim());
      formData.append("category", newMember.category);
      formData.append("display_order", String(targetDisplayOrder));
      formData.append("linkedin_url", newMember.linkedinUrl.trim());
      formData.append("instagram_url", newMember.instagramUrl.trim());

      if (!newMember.bio.trim()) {
        formData.set("bio", "");
      }

      if (uploadedFile) {
        formData.append("file", uploadedFile);
      } else if (previewImage) {
        formData.append("image", previewImage);
      }

      let dbIdToUpdate = editingMemberId;

      if (editingMemberId && !/^\d+$/.test(editingMemberId)) {
        try {
          const resp = await fetch("/api/leadership-members");
          if (resp.ok) {
            const list: any[] = await resp.json();
            const match = list.find((m) => m.name === newMember.name.trim() && m.category === newMember.category && /^\d+$/.test(String(m.id)));
            if (match && match.id) dbIdToUpdate = String(match.id);
          }
        } catch (err) {
          console.error("Failed to resolve DB id before submit:", err);
        }
      }

      const isRealDbMember = Boolean(dbIdToUpdate && /^\d+$/.test(dbIdToUpdate));
      const url = isRealDbMember ? `/api/leadership-members/${dbIdToUpdate}` : "/api/leadership-members";
      const method = isRealDbMember ? "PATCH" : "POST";

      console.log("Submitting leadership member", { method, url, editingMemberId, dbIdToUpdate });
      const response = await fetch(url, buildAuthRequestInit({ method, body: formData }));

      if (!response.ok) {
        const bodyText = await response.text().catch(() => null);
        console.error("Leadership member save failed", { status: response.status, body: bodyText });
        const errorData = bodyText ? (() => { try { return JSON.parse(bodyText); } catch { return { error: bodyText }; } })() : {};
        alert(errorData.error || `Failed to save (${response.status})`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API request failed:", errorData);
      }

      setShowAddMemberForm(false);
      setEditingMemberId(null);
      setUploadedFile(null);
      revokeObjectUrl(previewImage);
      revokeObjectUrl(cropSourceImage);
      setPreviewImage(null);
      setCropSourceImage(null);
      setCropImage(null);
      setIsPreparingCropSource(false);
      setShowCropper(false);
      setNewMember({ name: "", role: "", tenure: "", bio: "", linkedinUrl: "", instagramUrl: "", category: "founders" });

      await fetchLeadershipMembers();
    } catch (error) {
      console.error("Failed to save leadership member to DB", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMember = async (member: LeadershipMember) => {
    let dbId = member.id;
    if (!/^\d+$/.test(member.id)) {
      try {
        const resp = await fetch("/api/leadership-members");
        if (resp.ok) {
          const list: any[] = await resp.json();
          const match = list.find((m) => m.name === member.name && m.category === member.category && /^\d+$/.test(String(m.id)));
          if (match && match.id) dbId = String(match.id);
        }
      } catch (err) {
        console.error("Failed to resolve DB id for member edit:", err);
      }
    }

    setEditingMemberId(dbId);
    setNewMember({
      name: member.name,
      role: member.role,
      tenure: member.tenure,
      bio: member.bio,
      linkedinUrl: member.linkedinUrl ?? "",
      instagramUrl: member.instagramUrl ?? "",
      category: member.category,
    });
    setUploadedFile(null);
    setPreviewImage(member.image);
    setCropImage(null);
    setShowAddMemberForm(true);

    setIsPreparingCropSource(true);
    try {
      const preparedSource = await prepareImageForCropping(member.image);
      setCropSourceImage(preparedSource);
    } finally {
      setIsPreparingCropSource(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    const targetMember = leadershipMembers.find((item) => item.id === memberId);

    const updated = leadershipMembers.filter((item) => item.id !== memberId);
    const sorted = updated.slice().sort((a, b) => a.displayOrder - b.displayOrder);
    setLeadershipMembers(sorted);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));

    if (/^\d+$/.test(memberId)) {
      try {
        await fetch(`/api/leadership-members/${memberId}`, buildAuthRequestInit({ method: "DELETE" }));
      } catch (err) {
        console.error("Failed to delete leadership member from DB", err);
      }
    } else if (targetMember) {
      try {
        const resp = await fetch("/api/leadership-members");
        if (resp.ok) {
          const list: any[] = await resp.json();
          const match = list.find((item) => item.name === targetMember.name && item.category === targetMember.category);
          if (match && match.id) {
            await fetch(`/api/leadership-members/${match.id}`, buildAuthRequestInit({ method: "DELETE" }));
          }
        }
      } catch (err) {
        console.error("Failed to delete matching leadership member from DB", err);
      }
    }
  };

  const handleReorderMembers = async (draggedId: string, targetId: string) => {
    const draggedMember = leadershipMembers.find((member) => member.id === draggedId);
    const targetMember = leadershipMembers.find((member) => member.id === targetId);

    if (!draggedMember || !targetMember || draggedMember.category !== targetMember.category) {
      setDraggedMemberId(null);
      setDropTargetId(null);
      return;
    }

    const sameCategoryMembers = leadershipMembers.filter((member) => member.category === draggedMember.category);
    const reordered = reorderMembersById(sameCategoryMembers, draggedId, targetId);
    const reorderedById = new Map(reordered.map((member, index) => [member.id, { ...member, displayOrder: index + 1 }]));

    const updatedMembers = leadershipMembers.map((member) => reorderedById.get(member.id) ?? member);
    const sorted = updatedMembers.slice().sort((a, b) => a.displayOrder - b.displayOrder);

    setLeadershipMembers(sorted);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    setDraggedMemberId(null);
    setDropTargetId(null);

    for (const member of reordered) {
      if (/^\d+$/.test(member.id)) {
        try {
          const newOrder = reorderedById.get(member.id)?.displayOrder;
          if (newOrder !== undefined) {
            await fetch(`/api/leadership-members/${member.id}`, buildAuthRequestInit({
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ display_order: newOrder }),
            }));
          }
        } catch (err) {
          console.error("Failed to sync reorder with DB:", err);
        }
      }
    }
  };

  const normalizeSocialUrl = (value: string) => {
    if (!value) return "";
    return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
  };

  const founders = leadershipMembers
    .filter((member) => member.category === "founders")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const currentBoard = leadershipMembers
    .filter((member) => member.category === "currentBoard")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const previousBoard = leadershipMembers
    .filter((member) => member.category === "previousBoard")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const volunteers = leadershipMembers
    .filter((member) => member.category === "volunteers")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const normalizeTenure = (value: string) => {
    const cleaned = value.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
    const years = cleaned.match(/(20\d{2})\s*-\s*(20\d{2})/);
    return years ? `${years[1]}-${years[2]}` : cleaned || "Unspecified";
  };

  const groupByTenure = (members: LeadershipMember[]) => {
    const groups = new Map<string, LeadershipMember[]>();

    members.forEach((member) => {
      const tenure = normalizeTenure(member.tenure);
      const existing = groups.get(tenure) ?? [];
      existing.push(member);
      groups.set(tenure, existing);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => {
      const aStart = Number(a.match(/20\d{2}/)?.[0] ?? 0);
      const bStart = Number(b.match(/20\d{2}/)?.[0] ?? 0);
      return bStart - aStart || b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
    });
  };

  const previousBoardBatches = groupByTenure(previousBoard);
  const latestPreviousBatch = previousBoardBatches[0]?.[0] ?? "";
  const activePreviousBatch = selectedPreviousBatch && previousBoardBatches.some(([tenure]) => tenure === selectedPreviousBatch)
    ? selectedPreviousBatch
    : latestPreviousBatch;
  const selectedPreviousMembers = previousBoardBatches.find(([tenure]) => tenure === activePreviousBatch)?.[1] ?? [];

  useEffect(() => {
    const hasSelectedBatch = previousBoardBatches.some(([tenure]) => tenure === selectedPreviousBatch);
    if (latestPreviousBatch && !hasSelectedBatch) {
      setSelectedPreviousBatch(latestPreviousBatch);
    }
  }, [latestPreviousBatch, previousBoardBatches, selectedPreviousBatch]);

  // Responsive card grid: `repeat(auto-fit, minmax(...))` sizes columns based on
  // the available container width instead of jumping between fixed breakpoint
  // column counts. This keeps cards comfortably large on every screen size, and
  // because it's `auto-fit` (not `auto-fill`), a lone card left in the final row
  // stretches to fill the row instead of leaving an empty gap next to it.
  const renderMemberGrid = (members: LeadershipMember[], compact = false) => (
    <div
      className={`grid items-start gap-2.5 sm:gap-5 ${
        compact
          ? "grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
          : "grid-cols-[repeat(auto-fill,minmax(145px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]"
      }`}
    >
      {members.map((person) => {
        const isDragged = draggedMemberId === person.id;
        const isDropTarget = dropTargetId === person.id;

        return (
          <motion.article
            key={person.id}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileHover={{
              y: -3,
              boxShadow: "0 18px 40px -25px rgba(91,63,212,0.28)",
            }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            draggable={isAdmin}
            onDragStart={(event) => {
              const dragEvent = event as unknown as { dataTransfer?: DataTransfer | null };
              setDraggedMemberId(person.id);
              setDropTargetId(person.id);
              if (dragEvent.dataTransfer) {
                dragEvent.dataTransfer.effectAllowed = "move";
                dragEvent.dataTransfer.setData("application/ikshana-member-id", person.id);
                dragEvent.dataTransfer.setData("text/plain", person.id);
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDropTargetId(person.id);
            }}
            onDragOver={(event) => {
              const dragEvent = event as unknown as { dataTransfer?: DataTransfer | null };
              event.preventDefault();
              if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = "move";
              setDropTargetId(person.id);
            }}
            onDrop={(event) => {
              const dragEvent = event as unknown as { dataTransfer?: DataTransfer | null };
              event.preventDefault();
              event.stopPropagation();

              const draggedId = dragEvent.dataTransfer
                ? dragEvent.dataTransfer.getData("application/ikshana-member-id") ||
                  dragEvent.dataTransfer.getData("text/plain") ||
                  draggedMemberId
                : draggedMemberId;

              if (draggedId && draggedId !== person.id) {
                handleReorderMembers(draggedId, person.id);
              } else {
                setDraggedMemberId(null);
                setDropTargetId(null);
              }
            }}
            onDragEnd={() => {
              setDraggedMemberId(null);
              setDropTargetId(null);
            }}
            className={`group relative flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-brand-maroon/10 bg-white p-2.5 shadow-[0_10px_30px_-18px_rgba(91,63,212,0.24)] transition-all sm:rounded-[1.75rem] sm:p-4 ${
              isDragged ? "scale-[0.98] opacity-50" : ""
            } ${
              isDropTarget ? "border-[#5B3FD4] ring-2 ring-[#5B3FD4]/20" : ""
            } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {/* Large, near-full-bleed photo: scales with the card's own width via
                aspect-ratio, so it stays visually impactful at every screen size
                instead of a small fixed-size avatar. */}
            <div
              className={`relative w-full overflow-hidden rounded-[1.35rem] bg-stone-100 ${
                compact ? "aspect-[4/5]" : "aspect-square"
              }`}
            >
              <img
                src={person.image}
                alt={person.name}
                className="h-full w-full object-cover"
              />

              {isAdmin && (
                <>
                  <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-dashed border-[#5B3FD4]/30 bg-white/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#5B3FD4] backdrop-blur">
                    <GripVertical size={11} />
                    Drag
                  </div>

                  <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditMember(person)}
                      className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMember(person.id)}
                      className="rounded-full border border-brand-maroon/10 bg-white/90 p-1.5 text-brand-maroon backdrop-blur transition hover:bg-brand-maroon hover:text-white"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-1 flex-col px-0.5 pb-1 pt-3 text-left sm:px-1.5 sm:pt-4">
              <h3 className="break-words text-lg font-bold leading-snug text-brand-maroon sm:text-xl md:text-2xl">
                {person.name}
              </h3>

              <span
                aria-hidden="true"
                className="mt-2 h-[3px] w-8 shrink-0 rounded-full bg-rose-300 sm:mt-2.5 sm:w-10"
              />

              {!compact && (
                <p className="mt-2 break-words text-base font-bold leading-5 text-[#2d1620] sm:mt-2.5 sm:text-base md:text-lg">
                  {person.role}
                </p>
              )}

              <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-maroon/45 sm:mt-3 sm:gap-2 sm:text-xs sm:tracking-[0.18em]">
                <CalendarDays size={13} className="shrink-0 text-brand-maroon/40 sm:h-[14px] sm:w-[14px]" aria-hidden="true" />
                <span className="h-3 w-px shrink-0 bg-brand-maroon/15" aria-hidden="true" />
                <span>{person.tenure}</span>
              </div>

              {!compact && person.bio ? (
                <p className="mt-4 border-t border-brand-maroon/10 pt-3 text-sm leading-6 text-brand-maroon/70 [overflow-wrap:anywhere]">
                  {person.bio}
                </p>
              ) : null}

              {!compact && (person.linkedinUrl || person.instagramUrl) && (
                <div className="mt-3 flex items-center gap-1.5">
                  {person.linkedinUrl && (
                    <a
                      href={normalizeSocialUrl(person.linkedinUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-brand-maroon/10 p-1.5 text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
                      aria-label={`Visit ${person.name}'s LinkedIn`}
                    >
                      <Linkedin size={14} />
                    </a>
                  )}

                  {person.instagramUrl && (
                    <a
                      href={normalizeSocialUrl(person.instagramUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-brand-maroon/10 p-1.5 text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
                      aria-label={`Visit ${person.name}'s Instagram`}
                    >
                      <Instagram size={14} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.article>
        );
      })}
    </div>
  );


  const sectionData: Record<LeadershipCategory, { title: string; subtitle: string; members: LeadershipMember[]; emptyText: string }> = {
    founders: {
      title: "Founders",
      subtitle: "The visionaries who started this journey",
      members: founders,
      emptyText: "founders",
    },
    currentBoard: {
      title: "Executive Board",
      subtitle: "The leaders guiding our work today",
      members: currentBoard,
      emptyText: "executive board members",
    },
    previousBoard: {
      title: "Previous Board",
      subtitle: "Former leaders who helped shape our journey",
      members: selectedPreviousMembers,
      emptyText: "previous board members",
    },
    volunteers: {
      title: "Volunteers",
      subtitle: "The people who give their time and energy to Ikshana",
      members: volunteers,
      emptyText: "volunteers",
    },
  };

  const activeData = sectionData[activeSection];

  return (
    <section className="min-h-screen bg-[#fffcfc] px-3 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8 lg:pt-28 xl:px-10 2xl:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="rounded-[1.75rem] border border-brand-maroon/10 bg-white p-3 shadow-[0_30px_90px_-30px_rgba(91,63,212,0.22)] sm:p-6 lg:p-8 xl:p-10"
        >
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="font-serif text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-brand-maroon sm:text-4xl md:text-5xl lg:text-[3.5rem]">
              Our{" "}
              <span className="relative inline-block italic">
                Founders
                <span
                  aria-hidden="true"
                  className="absolute -bottom-[0.08em] left-0 h-[0.06em] w-full rounded-full bg-brand-maroon/20"
                />
              </span>{" "}
              &amp; Team
            </h1>
          </div>

          <div className="mx-auto mt-7 w-full max-w-4xl">
            <div className="grid w-full grid-cols-4 gap-1.5 rounded-2xl border border-brand-maroon/10 bg-[#fffafa] p-1.5 sm:gap-2 sm:p-2">
              {(
                [
                  { key: "founders", label: "Founders" },
                  { key: "currentBoard", label: "Executive Board" },
                  { key: "previousBoard", label: "Previous Board" },
                  { key: "volunteers", label: "Volunteers" },
                ] as const
              ).map((tab) => {
                const active = activeSection === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSection(tab.key)}
                    className={`flex min-h-12 w-full items-center justify-center rounded-xl px-1.5 py-2.5 text-[9px] font-semibold leading-tight tracking-wide transition-all min-[380px]:text-[10px] sm:min-h-[3.25rem] sm:px-3 sm:text-sm ${
                      active
                        ? "bg-brand-maroon text-white shadow-md"
                        : "text-brand-maroon/70 hover:bg-white hover:text-brand-maroon"
                    }`}
                  >
                    <span className="text-center">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-center px-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand-maroon/10 bg-[#fff8f5] px-5 py-2.5 shadow-[0_14px_34px_-24px_rgba(139,29,59,0.45)] sm:gap-3 sm:px-6 sm:py-3"
                >
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-maroon/35" />
                  <p className="text-center text-xs font-medium leading-5 tracking-wide text-brand-maroon/75 sm:text-sm">
                    {sectionData[activeSection].subtitle}
                  </p>
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-maroon/35" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-brand-maroon/10 bg-gradient-to-br from-[#fdfcff] via-white to-[#fff8f5] p-3 sm:p-5 lg:p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMemberId(null);
                    setUploadedFile(null);
                    revokeObjectUrl(previewImage);
                    revokeObjectUrl(cropSourceImage);
                    setPreviewImage(null);
                    setCropSourceImage(null);
                    setCropImage(null);
                    setIsPreparingCropSource(false);
                    setShowCropper(false);
                    setNewMember({
                      name: "",
                      role: "",
                      tenure: activeSection === "previousBoard" ? activePreviousBatch : "",
                      bio: "",
                      linkedinUrl: "",
                      instagramUrl: "",
                      category: activeSection,
                    });
                    setShowAddMemberForm(true);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-maroon px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-maroon/20 transition hover:bg-stone-900 sm:w-auto"
                >
                  <Plus size={16} />
                  Add Member
                </button>
              )}
            </div>

            {activeSection === "previousBoard" && previousBoard.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {previousBoardBatches.map(([tenure]) => {
                    const active = tenure === activePreviousBatch;

                    return (
                      <button
                        key={tenure}
                        type="button"
                        onClick={() => setSelectedPreviousBatch(tenure)}
                        className={`inline-flex min-h-9 items-center justify-center rounded-full border px-3.5 py-2 text-xs font-semibold transition-all sm:text-sm ${
                          active
                            ? "border-brand-maroon bg-brand-maroon text-white shadow-sm"
                            : "border-brand-maroon/15 bg-white text-brand-maroon/70 hover:border-brand-maroon/25 hover:text-brand-maroon"
                        }`}
                      >
                        {tenure === "Unspecified" ? "Batch" : tenure}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeData.members.length === 0 ? (
              <div className="rounded-[1rem] border border-dashed border-brand-maroon/20 bg-white/70 p-6 text-center text-sm text-brand-maroon/70">
                No {activeData.emptyText} added yet.
              </div>
            ) : activeSection === "volunteers" ? (
              renderMemberGrid(activeData.members, true)
            ) : (
              renderMemberGrid(activeData.members)
            )}
          </div>
        </motion.div>
      </div>

      {showAddMemberForm && isAdmin && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-900/70 p-3 sm:p-4"
          onClick={() => { setShowAddMemberForm(false); setShowCropper(false); setCropImage(null); }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 mb-6 flex items-center justify-between gap-4 rounded-2xl border border-brand-maroon/10 bg-white/90 px-2 py-2 backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-maroon/40">Admin</p>
                <h3 className="text-2xl font-serif text-brand-maroon">{editingMemberId ? "Update member" : "Add member"}</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddMemberForm(false); setShowCropper(false); setCropImage(null); }}
                className="inline-flex items-center gap-2 rounded-full border border-brand-maroon/15 bg-white px-3 py-2 text-sm font-semibold text-brand-maroon transition hover:bg-brand-maroon hover:text-white"
                aria-label="Close form"
              >
                <X size={16} />
                Close
              </button>
            </div>
            <form onSubmit={handleAddMember} className="grid gap-4">
              <select
                value={newMember.category}
                onChange={(event) => setNewMember({ ...newMember, category: event.target.value as LeadershipCategory })}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <option value="founders">Founders</option>
                <option value="currentBoard">Current Executive Board</option>
                <option value="previousBoard">Previous Board</option>
                <option value="volunteers">Volunteers</option>
              </select>
              <input value={newMember.name} onChange={(event) => setNewMember({ ...newMember, name: event.target.value })} placeholder="Name" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" required />
              <input value={newMember.role} onChange={(event) => setNewMember({ ...newMember, role: event.target.value })} placeholder={newMember.category === "volunteers" ? "Role (internal only)" : "Role"} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" required />
              {newMember.category === "volunteers" && (
                <p className="-mt-2 text-xs leading-5 text-brand-maroon/55">
                  The role is stored for admin use but is not shown on the Volunteers section.
                </p>
              )}
              <input value={newMember.tenure} onChange={(event) => setNewMember({ ...newMember, tenure: event.target.value })} placeholder="Tenure year" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" />
              <input value={newMember.linkedinUrl} onChange={(event) => setNewMember({ ...newMember, linkedinUrl: event.target.value })} placeholder="LinkedIn URL (optional)" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" />
              <input value={newMember.instagramUrl} onChange={(event) => setNewMember({ ...newMember, instagramUrl: event.target.value })} placeholder="Instagram URL (optional)" className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" />
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <label className="mb-2 block text-sm font-semibold text-brand-maroon">Profile image</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="w-full text-sm text-stone-500"
                />

                {previewImage && (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-stone-500">Profile preview</p>
                      <img
                        src={previewImage}
                        alt="Profile preview"
                        className="h-28 w-28 rounded-full border-4 border-brand-maroon/10 object-cover shadow-lg"
                      />
                    </div>

                    {cropSourceImage && (
                      <button
                        type="button"
                        onClick={handleAdjustCrop}
                        disabled={isPreparingCropSource}
                        className="rounded-full border border-brand-maroon/15 bg-white px-4 py-2 text-sm font-semibold text-brand-maroon transition hover:bg-brand-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPreparingCropSource ? "Preparing image..." : "Adjust Crop"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <textarea value={newMember.bio} onChange={(event) => setNewMember({ ...newMember, bio: event.target.value })} placeholder="Short bio" className="min-h-24 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" />
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberForm(false);
                    setShowCropper(false);
                    setCropImage(null);
                  }}
                  className="rounded-2xl border border-brand-maroon/15 px-4 py-3 font-semibold text-brand-maroon transition hover:bg-brand-maroon/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`rounded-2xl bg-brand-maroon px-4 py-3 font-semibold text-white transition ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-stone-900"}`}
                >
                  {isSubmitting ? "Saving..." : editingMemberId ? "Update Member" : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCropper && cropImage && isAdmin && (
        <ImageCropperModal
          image={cropImage}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </section>
  );
}
