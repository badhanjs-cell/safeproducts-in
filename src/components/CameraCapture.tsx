import { useEffect, useRef, useState } from "react";
import { Camera, CameraIcon, Images, RefreshCw, X } from "lucide-react";

type FacingMode = "environment" | "user";

type CameraCaptureProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onFallbackUpload: () => void;
  title?: string;
  instructions?: string;
  captureFilenamePrefix?: string;
};

export function CameraCapture({
  open,
  onClose,
  onCapture,
  onFallbackUpload,
  title = "Take a Label Photo",
  instructions = "Keep the requested label area inside the frame and in focus.",
  captureFilenamePrefix = "safeproducts-label",
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);
    stopStream();

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("CAMERA_API_UNAVAILABLE");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (cameraError: any) {
        if (cancelled) return;
        const name = cameraError?.name ?? "";
        if (cameraError?.message === "CAMERA_API_UNAVAILABLE") {
          setError("This browser does not expose direct camera access. You can still choose an existing image.");
        } else if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Camera permission was blocked. Allow camera access for SafeProducts in your browser settings, then try again.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("No usable camera was found on this device. You can choose an image instead.");
        } else {
          setError("The camera could not be opened. Please retry or choose an image instead.");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facing]);

  if (!open) return null;

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("The camera is still starting. Please wait a moment and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("The photo could not be captured. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("The photo could not be captured. Please try again.");
          return;
        }
        const file = new File([blob], `${captureFilenamePrefix}-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        stopStream();
        onCapture(file);
      },
      "image/jpeg",
      0.94,
    );
  };

  const fallback = () => {
    stopStream();
    onFallbackUpload();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-white">{title}</p>
            <p className="text-xs text-slate-300">{instructions}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white hover:bg-white/10"
            aria-label="Close camera"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-video">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75 text-white">
              <CameraIcon className="h-10 w-10 animate-pulse text-brand-blue" />
              <p className="text-sm font-semibold">Opening camera…</p>
            </div>
          )}
          {error && !starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 px-6 text-center">
              <Camera className="h-10 w-10 text-orange-400" />
              <p className="max-w-lg text-sm leading-relaxed text-slate-200">{error}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" /> Retry Camera
                </button>
                <button
                  type="button"
                  onClick={fallback}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-slate-950"
                >
                  <Images className="h-4 w-4" /> Choose Image
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" /> Switch Camera
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={starting || !!error}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-3 text-sm font-extrabold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Camera className="h-4 w-4" /> Capture Photo
          </button>
          <button
            type="button"
            onClick={fallback}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            <Images className="h-4 w-4" /> Choose Image Instead
          </button>
        </div>
      </div>
    </div>
  );
}
