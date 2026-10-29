// SafeProducts website runtime schema (canonical production project wmxbdirvlwuagouraobr).
// Hand-maintained: covers ONLY the versioned sp_web_*_v1 tables and narrow RPCs used by
// the website. Qualified SP-PROD safety/search tables are NOT part of this surface.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at?: string };

type GuidelineRow = {
  id: string;
  profile: string;
  title: string;
  body: string;
  content: string | null;
  age_specifics: string | null;
  source_note: string | null;
  status: string;
  display_order: number | null;
} & Timestamps;

type ContactRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  user_type: string;
  purpose: string;
  subject: string;
  message: string;
  attachment_url: string | null;
  status: string;
  created_at: string;
};

type LabelAnalysisRow = {
  id: string;
  uploaded_image_url: string | null;
  detected_ingredients: Json;
  ingredient_breakdown: Json;
  warnings: Json;
  safety_score: number | null;
  profile_used: string | null;
  summary: string | null;
  session_id: string | null;
  analysed_at: string;
};

type PageViewRow = {
  id: number;
  page: string | null;
  search_term: string | null;
  category_clicked: string | null;
  category: string | null;
  profile_used: string | null;
  session_id: string | null;
  device_type: string | null;
  visited_at: string | null;
};

type AnnouncementRow = {
  id: string;
  message: string;
  type: string;
  active: boolean | null;
  status: string;
  display_from: string | null;
  display_until: string | null;
  created_at: string;
};

type UserRoleRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type AdminAuditRow = {
  id: string;
  actor_id: string | null;
  action: string | null;
  entity: string | null;
  entity_id: string | null;
  detail: Json | null;
  created_at: string;
};

type Writable<T> = { [K in keyof T]?: T[K] };

type TableDef<Row> = {
  Row: Row;
  Insert: Writable<Row>;
  Update: Writable<Row>;
  Relationships: [];
};

export type SafeProductsWebDatabase = {
  public: {
    Tables: {
      sp_web_guidelines_v1: TableDef<GuidelineRow>;
      sp_web_contact_submissions_v1: TableDef<ContactRow>;
      sp_web_label_analyses_v1: TableDef<LabelAnalysisRow>;
      sp_web_page_views_v1: TableDef<PageViewRow>;
      sp_web_site_announcements_v1: TableDef<AnnouncementRow>;
      sp_web_user_roles_v1: TableDef<UserRoleRow>;
      sp_web_admin_audit_v1: TableDef<AdminAuditRow>;
    };
    Views: Record<never, never>;
    Functions: {
      sp_web_runtime_identity_check_v1: {
        Args: Record<string, never>;
        Returns: Json;
      };
      sp_web_submit_contact_v1: {
        Args: {
          p_full_name: string;
          p_email: string;
          p_phone?: string | null;
          p_user_type: string;
          p_purpose: string;
          p_subject: string;
          p_message: string;
          p_attachment_url?: string | null;
        };
        Returns: Json;
      };
      sp_web_log_page_view_v1: {
        Args: {
          p_page?: string | null;
          p_search_term?: string | null;
          p_category_clicked?: string | null;
          p_profile_used?: string | null;
          p_session_id?: string | null;
          p_device_type?: string | null;
          p_category?: string | null;
        };
        Returns: Json;
      };
      sp_web_record_label_analysis_v1: {
        Args: {
          p_detected_ingredients: Json;
          p_safety_score: number | null;
          p_profile_used: string | null;
          p_warnings: Json;
          p_ingredient_breakdown: Json;
          p_summary: string | null;
          p_session_id: string | null;
          p_uploaded_image_url?: string | null;
        };
        Returns: Json;
      };
      sp_web_label_regulatory_reference_v1: {
        Args: { p_limit: number };
        Returns: Json;
      };
      sp_web_admin_search_runs_v1: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      sp_web_admin_search_trace_v1: {
        Args: { p_search_id: string };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
