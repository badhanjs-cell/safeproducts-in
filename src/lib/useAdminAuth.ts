import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminAuthState = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
};

export function useAdminAuth(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    userId: null,
    email: null,
    isAdmin: false,
  });

  useEffect(() => {
    let active = true;

    async function check(userId: string | null, email: string | null) {
      if (!userId) {
        if (active) setState({ loading: false, userId: null, email: null, isAdmin: false });
        return;
      }
      const { data, error } = await supabase
        .from("sp_web_user_roles_v1")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!active) return;
      setState({
        loading: false,
        userId,
        email,
        isAdmin: !error && !!data,
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      check(session?.user?.id ?? null, session?.user?.email ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      check(data.session?.user?.id ?? null, data.session?.user?.email ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
