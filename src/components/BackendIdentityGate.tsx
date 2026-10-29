import { useEffect, useState } from "react";
import { verifyBackendIdentity } from "@/lib/backendSentinel";

/**
 * Fail-closed bootstrap boundary. Runs the memoized database identity sentinel once
 * and, on any mismatch, renders a visible configuration error instead of the app.
 */
export function BackendIdentityGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    let active = true;
    verifyBackendIdentity()
      .then((result) => {
        if (active) setStatus(result.ok ? "ok" : "error");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-body">Verifying secure connection…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-lg rounded-lg border border-divider bg-card p-6 text-center">
          <h1 className="text-lg font-bold text-danger">Configuration error</h1>
          <p className="mt-3 text-sm text-body">
            This site could not confirm its authorised backend and has stopped for safety. No safety
            information is shown until the configuration is corrected.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
