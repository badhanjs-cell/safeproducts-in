import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Images,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ProfilePills, type Profile } from "@/components/HeroSearch";
import { CameraCapture } from "@/components/CameraCapture";
import { LabelPendingResult } from "@/components/LabelPendingResult";
import { LabelQualifiedResult } from "@/components/LabelQualifiedResult";
import { analyzeLabel, type PendingLabelResult, type QualifiedLabelResult } from "@/lib/labels.functions";
import { validateLabelPair, type LabelPairValidationResult } from "@/lib/labelPair.functions";
import { useServerFn } from "@tanstack/react-start";
import { getSessionId, logPageView } from "@/lib/sessionId";
import { takePendingLabelCapture } from "@/lib/pendingLabelCapture";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/check-my-label")({
  head: () => ({
    meta: [
      { title: "Check My Label — SafeProducts" },
      {
        name: "description",
        content:
          "Upload a front product label and a separate ingredient-panel image. SafeProducts validates both before safety analysis.",
      },
    ],
  }),
  component: CheckMyLabelPage,
});

type Result = Awaited<ReturnType<typeof analyzeLabel>>;
type ImageRole = "front" | "ingredients";
type SelectedImage = {
  dataUrl: string;
  filename: string;
  sha256: string;
  width: number;
  height: number;
};

type Phase = "idle" | "eligibility" | "analysis";

const TECHNICAL_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function isPendingLabelResult(result: Result): result is PendingLabelResult {
  return result.status === "DEEPER_VERIFICATION_IN_PROGRESS"
    || result.status === "INSUFFICIENT_EVIDENCE"
    || result.status === "CONFLICT_REQUIRES_REVIEW";
}

async function prepareImage(file: File): Promise<SelectedImage> {
  if (!TECHNICAL_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Please use a JPG, PNG or WebP image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File too large. Maximum 10MB per image.");
  }

  const [dataUrl, buffer] = await Promise.all([
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("The image could not be opened. Please choose another image."));
      reader.readAsDataURL(file);
    }),
    file.arrayBuffer(),
  ]);

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The image could not be read. Please choose another photo."));
    image.src = dataUrl;
  });

  // Do not reject an image merely because of pixel dimensions. Normal phone photos,
  // resized gallery images, messaging-app copies and narrow label crops can still be
  // perfectly readable. Actual readability is determined by the eligibility engine.
  if (!dimensions.width || !dimensions.height) {
    throw new Error("The image could not be read. Please choose another photo.");
  }

  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    dataUrl,
    filename: file.name || "label-photo.jpg",
    sha256,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function CheckMyLabelPage() {
  const frontInputRef = useRef<HTMLInputElement>(null);
  const ingredientInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraRole, setCameraRole] = useState<ImageRole>("ingredients");
  const [frontImage, setFrontImage] = useState<SelectedImage | null>(null);
  const [ingredientImage, setIngredientImage] = useState<SelectedImage | null>(null);
  const [profile, setProfile] = useState<Profile>("ALL");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [pairValidation, setPairValidation] = useState<LabelPairValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSaveStatus, setImageSaveStatus] = useState<string | null>(null);
  const analyse = useServerFn(analyzeLabel);
  const validatePair = useServerFn(validateLabelPair);

  useEffect(() => {
    logPageView({ page: "check-my-label" });
  }, []);

  useEffect(() => {
    const pending = takePendingLabelCapture();
    if (pending) {
      void acceptFile(pending, "ingredients");
    }

    try {
      if (sessionStorage.getItem("safeproducts:open-label-camera") === "1") {
        sessionStorage.removeItem("safeproducts:open-label-camera");
        setCameraRole("ingredients");
        setCameraOpen(true);
      }
    } catch {
      // Visible camera buttons remain available.
    }
  }, []);

  const resetAnalysisState = () => {
    setResult(null);
    setPairValidation(null);
    setError(null);
    setImageSaveStatus(null);
  };

  const acceptFile = async (file: File, role: ImageRole) => {
    resetAnalysisState();
    try {
      const prepared = await prepareImage(file);
      const other = role === "front" ? ingredientImage : frontImage;
      if (other?.sha256 === prepared.sha256) {
        throw new Error("The same image cannot be used twice. Please provide a separate front photo and ingredient-panel photo.");
      }
      if (role === "front") setFrontImage(prepared);
      else setIngredientImage(prepared);
    } catch (fileError: any) {
      setError(fileError?.message || "This image cannot be used. Please choose another photo.");
    }
  };

  const clearRole = (role: ImageRole) => {
    resetAnalysisState();
    if (role === "front") {
      setFrontImage(null);
      if (frontInputRef.current) frontInputRef.current.value = "";
    } else {
      setIngredientImage(null);
      if (ingredientInputRef.current) ingredientInputRef.current.value = "";
    }
  };

  const resetAll = () => {
    setFrontImage(null);
    setIngredientImage(null);
    setProfile("ALL");
    setPhase("idle");
    resetAnalysisState();
    if (frontInputRef.current) frontInputRef.current.value = "";
    if (ingredientInputRef.current) ingredientInputRef.current.value = "";
  };

  const openCamera = (role: ImageRole) => {
    setCameraRole(role);
    setCameraOpen(true);
  };

  const chooseFile = (role: ImageRole) => {
    if (role === "front") frontInputRef.current?.click();
    else ingredientInputRef.current?.click();
  };

  const getAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error("TEMP_SESSION_UNAVAILABLE");

    let session = sessionData.session;
    if (!session) {
      const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously();
      if (anonymousError || !anonymousData.session) throw new Error("TEMP_SESSION_UNAVAILABLE");
      session = anonymousData.session;
    }

    if (!session.access_token) throw new Error("TEMP_SESSION_UNAVAILABLE");
    return session.access_token;
  };

  const submit = async () => {
    if (!frontImage || !ingredientImage) {
      setError("Both required images must be added before analysis.");
      return;
    }
    if (frontImage.sha256 === ingredientImage.sha256) {
      setError("The same image cannot be used twice. Please provide two different photos.");
      return;
    }

    setError(null);
    setResult(null);
    setPairValidation(null);

    try {
      const accessToken = await getAccessToken();
      const sessionId = getSessionId();

      setPhase("eligibility");
      const validated = await validatePair({
        data: {
          frontImageDataUrl: frontImage.dataUrl,
          ingredientImageDataUrl: ingredientImage.dataUrl,
          sessionId,
          accessToken,
        },
      });
      setPairValidation(validated);

      // Safety analysis is deliberately downstream of the eligibility gate.
      // The validated identity and both original-image hashes then travel with the
      // successful analysis into the catalog registry; catalog persistence is non-fatal.
      setPhase("analysis");
      const out = await analyse({
        data: {
          imageDataUrl: ingredientImage.dataUrl,
          profile,
          sessionId,
          accessToken,
          brandName: validated.eligibility.brand_name,
          productName: validated.eligibility.product_name,
          variant: validated.eligibility.variant,
          packSizeText: validated.eligibility.pack_size_text,
          frontImageSha256: frontImage.sha256,
          ingredientImageSha256: ingredientImage.sha256,
          frontWidth: frontImage.width,
          frontHeight: frontImage.height,
          ingredientWidth: ingredientImage.width,
          ingredientHeight: ingredientImage.height,
        },
      });
      setResult(out);
      if (out.scan_id && /^[0-9a-f-]{36}$/i.test(out.scan_id)) {
        setImageSaveStatus("Saving the product front photo for exact-pack cache…");
        try {
          const { data: saved, error: storageError } = await supabase.functions.invoke("sp-label-front-cache-v2", {
            headers: {Authorization: `Bearer ${accessToken}`},
            body: {
              scanId: out.scan_id,
              role: "front",
              imageDataUrl: frontImage.dataUrl,
              imageSha256: frontImage.sha256,
            },
          });
          if (storageError || saved?.stored !== true) {
            const code = typeof saved?.code === "string" ? saved.code : "FRONT_CACHE_UNAVAILABLE";
            console.warn("SafeProducts front cache failed", code, storageError?.name ?? "EDGE_REJECTION");
            throw new Error(code);
          }
          setImageSaveStatus("Product front photo and evidence report saved for exact-product lookup.");
        } catch {
          setImageSaveStatus("Analysis completed, but the front photo was not saved. Please retry the same two images; no ingredient photo is retained.");
        }
      }
    } catch (submitError: any) {
      if (submitError?.message === "TEMP_SESSION_UNAVAILABLE") {
        setError("Label analysis is temporarily unavailable. Please try again later.");
      } else {
        setError(submitError?.message || "Analysis failed.");
      }
    } finally {
      setPhase("idle");
    }
  };

  const bothReady = Boolean(frontImage && ingredientImage);
  const busy = phase !== "idle";
  const step = result ? 4 : pairValidation ? 3 : bothReady ? 2 : 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-brand-blue sm:text-3xl">Check My Label</h1>
        <p className="mt-2 text-sm text-body">
          Add two different photos of the same product. SafeProducts first checks that the product identity and ingredient text are readable, then determines the safety result.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {["Two photos", "Eligibility", "Profile", "Report"].map((label, i) => {
          const n = i + 1;
          const active = step >= n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-brand-blue text-primary-foreground" : "border border-divider bg-card text-body"}`}>
                {n}
              </span>
              <span className={active ? "text-heading" : "text-body"}>{label}</span>
              {n < 4 && <span className="mx-1 text-divider">→</span>}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ImageSlot
          role="front"
          title="1. Front / Product Label"
          help="Show the product front so the brand and product can be identified. Pack size is captured too when clearly visible; it is not required for image acceptance."
          image={frontImage}
          disabled={busy}
          onCamera={() => openCamera("front")}
          onChoose={() => chooseFile("front")}
          onDelete={() => clearRole("front")}
          onDrop={(file) => void acceptFile(file, "front")}
        />
        <ImageSlot
          role="ingredients"
          title="2. Ingredient Panel"
          help="Show the ingredients / composition / INCI panel. If the ingredient text can be read, the image can be accepted."
          image={ingredientImage}
          disabled={busy}
          onCamera={() => openCamera("ingredients")}
          onChoose={() => chooseFile("ingredients")}
          onDelete={() => clearRole("ingredients")}
          onDrop={(file) => void acceptFile(file, "ingredients")}
        />
      </div>

      <input
        ref={frontInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file, "front");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={ingredientInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void acceptFile(file, "ingredients");
          event.currentTarget.value = "";
        }}
      />

      {bothReady && !result && (
        <div className="space-y-4 rounded-lg border border-divider bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
            <div>
              <p className="text-sm font-bold text-heading">Readability check before safety analysis</p>
              <p className="mt-1 text-xs leading-relaxed text-body">
                Normal readable phone photos are accepted. SafeProducts rejects only unreadable images, duplicates, wrong image roles, or clearly mismatched products before ingredient analysis starts.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-heading">Who is this product for?</p>
            <ProfilePills value={profile} onChange={setProfile} />
          </div>

          <p className="rounded-md border border-divider bg-background px-3 py-2 text-xs text-body">
            Product front photo, identity, pack size and analysis result are saved to the private SafeProducts backend for exact-product reuse.
            The ingredient photo is analysed but its image bytes are not stored. A preliminary screening score is not presented as a verified Safety Score.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full rounded-md bg-brand-blue px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "eligibility"
              ? "Checking readability…"
              : phase === "analysis"
                ? "Images accepted — analysing ingredients…"
                : "Check Images & Analyse"}
          </button>
        </div>
      )}

      {pairValidation && (
        <div className="rounded-lg border border-safe/40 bg-safe/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-safe" />
            <div>
              <p className="text-sm font-bold text-heading">Images accepted</p>
              <p className="mt-1 text-xs text-body">
                {pairValidation.eligibility.brand_name || "Product"}
                {pairValidation.eligibility.product_name ? ` — ${pairValidation.eligibility.product_name}` : ""}
                {pairValidation.eligibility.variant ? ` (${pairValidation.eligibility.variant})` : ""}
                {pairValidation.eligibility.pack_size_text ? ` · ${pairValidation.eligibility.pack_size_text}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-center text-sm font-medium text-danger">
          {error}
        </div>
      )}

      {imageSaveStatus && (
        <p role="status" className="rounded-md border border-divider bg-card p-3 text-sm text-body">
          {imageSaveStatus}
        </p>
      )}

      {result && (
        isPendingLabelResult(result)
          ? <LabelPendingResult r={result} onReset={resetAll} />
          : <LabelQualifiedResult r={result as QualifiedLabelResult} onReset={resetAll} />
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title={cameraRole === "front" ? "Take Front / Product Label Photo" : "Take Ingredient Panel Photo"}
        instructions={
          cameraRole === "front"
            ? "Keep the brand/product identity reasonably readable. A normal phone photo is enough."
            : "Keep the ingredient/composition text readable. Perfect framing or studio quality is not required."
        }
        captureFilenamePrefix={cameraRole === "front" ? "safeproducts-front-label" : "safeproducts-ingredients"}
        onCapture={(file) => {
          void acceptFile(file, cameraRole);
          setCameraOpen(false);
        }}
        onFallbackUpload={() => {
          const role = cameraRole;
          setCameraOpen(false);
          window.setTimeout(() => chooseFile(role), 0);
        }}
      />
    </div>
  );
}

function ImageSlot({
  role,
  title,
  help,
  image,
  disabled,
  onCamera,
  onChoose,
  onDelete,
  onDrop,
}: {
  role: ImageRole;
  title: string;
  help: string;
  image: SelectedImage | null;
  disabled: boolean;
  onCamera: () => void;
  onChoose: () => void;
  onDelete: () => void;
  onDrop: (file: File) => void;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file && !disabled) onDrop(file);
      }}
      className="rounded-lg border-2 border-dashed border-divider bg-card p-5 transition hover:border-brand-blue"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-brand-blue/10 p-2 text-brand-blue">
          {role === "front" ? <Camera className="h-5 w-5" /> : <Images className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-heading">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-body">{help}</p>
        </div>
      </div>

      {image ? (
        <div className="mt-4 space-y-3">
          <img src={image.dataUrl} alt={title} className="h-44 w-full rounded-lg object-contain bg-background" />
          <div>
            <p className="truncate text-xs font-bold text-heading">{image.filename}</p>
            <p className="mt-1 text-[11px] text-safe">✓ Image opened successfully · {image.width} × {image.height} · readability checked next</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCamera}
              disabled={disabled}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-brand-blue px-3 py-2 text-xs font-bold text-brand-blue disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-danger/50 px-3 py-2 text-xs font-bold text-danger disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <button
            type="button"
            onClick={onCamera}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-blue px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            <Camera className="h-4 w-4" /> Take Photo
          </button>
          <button
            type="button"
            onClick={onChoose}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-brand-blue px-4 py-2.5 text-xs font-bold text-brand-blue disabled:opacity-50"
          >
            <Images className="h-4 w-4" /> Choose Image
          </button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-body/80">JPG, PNG or WebP · max 10MB · no fixed pixel minimum; readable images are accepted.</p>
    </div>
  );
}
