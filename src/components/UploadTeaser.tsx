import { useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";

export function UploadTeaser() {
  const navigate = useNavigate();

  const openCameraFlow = () => {
    try {
      sessionStorage.setItem("safeproducts:open-label-camera", "1");
    } catch {
      // Navigation still works when storage is unavailable.
    }
    navigate({ to: "/check-my-label" });
  };

  return (
    <section className="mx-auto max-w-5xl rounded-xl border border-brand-blue/35 border-l-4 border-l-brand-blue bg-[#182630] px-5 py-4 shadow-[0_12px_30px_rgba(2,6,23,0.28)] sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
        <Camera className="h-9 w-9 shrink-0 text-brand-blue" />
        <div className="min-w-0 sm:max-w-2xl">
          <h3 className="text-[17px] font-extrabold text-brand-blue">Already Have a Product?</h3>
          <p className="mt-1 text-[14px] leading-[1.65] text-slate-200 sm:text-[15px]">
            Open your device camera and photograph the ingredient label directly, or choose an existing image if camera permission is unavailable.
          </p>
        </div>
        <button
          type="button"
          onClick={openCameraFlow}
          className="shrink-0 rounded-lg border border-brand-blue bg-brand-blue/10 px-4 py-2.5 text-[14px] font-extrabold text-brand-blue transition hover:bg-brand-blue hover:text-primary-foreground"
        >
          Check My Label →
        </button>
      </div>
    </section>
  );
}
