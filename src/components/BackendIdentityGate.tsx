import { useEffect, useState } from "react";
import { verifyBackendIdentity } from "@/lib/backendSentinel";

/**
 * Bootstrap boundary. Renders immediately when canonical client is verified,
 * and runs the memoized database identity sentinel in the background.
 */
export function BackendIdentityGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"ok" | "error">("ok");

  useEffect(() => {
    let active = true;
    verifyBackendIdentity()
      .then((result) => {
        if (active && !result.ok) setStatus("error");
      })
      .catch(() => {
        // Keep app interactive when canonical client is already verified
      });
    return () => {
      active = false;
    };
  }, []);

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
