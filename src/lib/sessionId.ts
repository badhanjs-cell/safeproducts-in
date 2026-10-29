// Anonymous visitor tracking helpers.
// Session ID lives in sessionStorage (one per browser session/tab lifetime).
// Falls back to localStorage-style persistence within the session only.

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem("sp_session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("sp_session", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w <= 1024) return "tablet";
  return "desktop";
}

export function logPageView(payload: {
  page?: string;
  search_term?: string;
  category_clicked?: string;
  profile_used?: string;
  category?: string;
}) {
  if (typeof window === "undefined") return;
  // Public writes go through the narrow RPC only — never a direct table insert.
  import("@/integrations/supabase/client").then(({ supabase }) => {
    supabase
      .rpc("sp_web_log_page_view_v1", {
        p_page: payload.page,
        p_search_term: payload.search_term,
        p_category_clicked: payload.category_clicked,
        p_profile_used: payload.profile_used,
        p_session_id: getSessionId(),
        p_device_type: getDeviceType(),
        p_category: payload.category,
      })
      .then(() => {});
  });
}
