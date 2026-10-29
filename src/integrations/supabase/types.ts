export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_merchant_config: {
        Row: {
          admitad_tracking_url: string
          affiliate_network: string
          created_at: string | null
          id: number
          is_active: boolean | null
          merchant_home_url: string
          merchant_key: string
          merchant_name: string
        }
        Insert: {
          admitad_tracking_url: string
          affiliate_network?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          merchant_home_url: string
          merchant_key: string
          merchant_name: string
        }
        Update: {
          admitad_tracking_url?: string
          affiliate_network?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          merchant_home_url?: string
          merchant_key?: string
          merchant_name?: string
        }
        Relationships: []
      }
      compliance_logic_map: {
        Row: {
          condition: string
          id: number
          make_usage: string | null
          rule_name: string
          score_action: string | null
          warning_action: string | null
        }
        Insert: {
          condition: string
          id?: number
          make_usage?: string | null
          rule_name: string
          score_action?: string | null
          warning_action?: string | null
        }
        Update: {
          condition?: string
          id?: number
          make_usage?: string | null
          rule_name?: string
          score_action?: string | null
          warning_action?: string | null
        }
        Relationships: []
      }
      diaper_material_safety_layer: {
        Row: {
          child_risk: boolean
          created_at: string | null
          frontend_profiles: Json
          id: number
          infant_risk: boolean
          material_or_hazard: string
          normalized_key: string
          product_types: Json
          risk_level: string
          risk_reason: string | null
          risk_score: number
          safer_alternative: string | null
          source_reference: string | null
          status: string
          warning_text: string | null
        }
        Insert: {
          child_risk?: boolean
          created_at?: string | null
          frontend_profiles?: Json
          id?: number
          infant_risk?: boolean
          material_or_hazard: string
          normalized_key: string
          product_types?: Json
          risk_level: string
          risk_reason?: string | null
          risk_score: number
          safer_alternative?: string | null
          source_reference?: string | null
          status: string
          warning_text?: string | null
        }
        Update: {
          child_risk?: boolean
          created_at?: string | null
          frontend_profiles?: Json
          id?: number
          infant_risk?: boolean
          material_or_hazard?: string
          normalized_key?: string
          product_types?: Json
          risk_level?: string
          risk_reason?: string | null
          risk_score?: number
          safer_alternative?: string | null
          source_reference?: string | null
          status?: string
          warning_text?: string | null
        }
        Relationships: []
      }
      household_child_hazard_guidelines: {
        Row: {
          created_at: string | null
          frontend_profiles: Json
          hazard_category: string
          hazard_item: string
          id: number
          normalized_key: string
          risk_level: string
          risk_score: number
          safer_practice: string | null
          warning_text: string | null
        }
        Insert: {
          created_at?: string | null
          frontend_profiles?: Json
          hazard_category: string
          hazard_item: string
          id?: number
          normalized_key: string
          risk_level: string
          risk_score: number
          safer_practice?: string | null
          warning_text?: string | null
        }
        Update: {
          created_at?: string | null
          frontend_profiles?: Json
          hazard_category?: string
          hazard_item?: string
          id?: number
          normalized_key?: string
          risk_level?: string
          risk_score?: number
          safer_practice?: string | null
          warning_text?: string | null
        }
        Relationships: []
      }
      ingredient_aliases: {
        Row: {
          alias_name: string
          alias_normalized: string
          alias_type: string | null
          canonical_name: string
          confidence: number | null
          created_at: string | null
          id: number
          source: string | null
        }
        Insert: {
          alias_name: string
          alias_normalized: string
          alias_type?: string | null
          canonical_name: string
          confidence?: number | null
          created_at?: string | null
          id?: never
          source?: string | null
        }
        Update: {
          alias_name?: string
          alias_normalized?: string
          alias_type?: string | null
          canonical_name?: string
          confidence?: number | null
          created_at?: string | null
          id?: never
          source?: string | null
        }
        Relationships: []
      }
      ingredient_evidence_module_links: {
        Row: {
          evidence_id: number
          id: number
          linked_at: string
          linked_by: string
          module_instance_id: number
          relevance_role: string
        }
        Insert: {
          evidence_id: number
          id?: never
          linked_at?: string
          linked_by?: string
          module_instance_id: number
          relevance_role?: string
        }
        Update: {
          evidence_id?: number
          id?: never
          linked_at?: string
          linked_by?: string
          module_instance_id?: number
          relevance_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_evidence_module_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_module_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_module_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_lineage_summary"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_module_links_module_instance_id_fkey"
            columns: ["module_instance_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_module_links_module_instance_id_fkey"
            columns: ["module_instance_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["module_instance_id"]
          },
        ]
      }
      ingredient_evidence_review_queue: {
        Row: {
          attempt_count: number
          canonical_name: string
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          dossier_id: number
          evidence_id: number
          id: number
          last_error_code: string | null
          last_error_message: string | null
          lease_expires_at: string | null
          priority: string
          queue_status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          canonical_name: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dossier_id: number
          evidence_id: number
          id?: never
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          priority?: string
          queue_status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          canonical_name?: string
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dossier_id?: number
          evidence_id?: number
          id?: never
          last_error_code?: string | null
          last_error_message?: string | null
          lease_expires_at?: string | null
          priority?: string
          queue_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "ingredient_scientific_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_lineage_summary"
            referencedColumns: ["evidence_id"]
          },
        ]
      }
      ingredient_evidence_verification_audit: {
        Row: {
          canonical_name: string
          claim_supported: boolean
          created_at: string
          document_checked: boolean
          dossier_id: number
          evidence_id: number
          evidence_snapshot: Json
          exposure_route_confirmed: boolean
          id: number
          ingredient_identity_confirmed: boolean
          product_scope_confirmed: boolean
          review_decision: string
          reviewed_at: string
          reviewer_name: string
          source_version_confirmed: boolean
          verification_notes: string
          verified_document_url: string | null
          verified_source_reference: string | null
          verified_source_version: string | null
        }
        Insert: {
          canonical_name: string
          claim_supported?: boolean
          created_at?: string
          document_checked?: boolean
          dossier_id: number
          evidence_id: number
          evidence_snapshot?: Json
          exposure_route_confirmed?: boolean
          id?: never
          ingredient_identity_confirmed?: boolean
          product_scope_confirmed?: boolean
          review_decision: string
          reviewed_at?: string
          reviewer_name: string
          source_version_confirmed?: boolean
          verification_notes: string
          verified_document_url?: string | null
          verified_source_reference?: string | null
          verified_source_version?: string | null
        }
        Update: {
          canonical_name?: string
          claim_supported?: boolean
          created_at?: string
          document_checked?: boolean
          dossier_id?: number
          evidence_id?: number
          evidence_snapshot?: Json
          exposure_route_confirmed?: boolean
          id?: never
          ingredient_identity_confirmed?: boolean
          product_scope_confirmed?: boolean
          review_decision?: string
          reviewed_at?: string
          reviewer_name?: string
          source_version_confirmed?: boolean
          verification_notes?: string
          verified_document_url?: string | null
          verified_source_reference?: string | null
          verified_source_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_verification_audit_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_lineage_summary"
            referencedColumns: ["evidence_id"]
          },
        ]
      }
      ingredient_extraction_logs: {
        Row: {
          created_at: string | null
          extraction_confidence: number | null
          id: number
          ingredient_confidence: number | null
          ingredients_found: boolean | null
          merchant_name: string | null
          parsed_ingredients: Json | null
          product_fingerprint: string | null
          product_name: string | null
          product_url: string | null
          railway_response: Json | null
          raw_ingredient_text: string | null
          response_status: string | null
          search_id: string | null
          source_confidence: number | null
          source_type: string | null
        }
        Insert: {
          created_at?: string | null
          extraction_confidence?: number | null
          id?: never
          ingredient_confidence?: number | null
          ingredients_found?: boolean | null
          merchant_name?: string | null
          parsed_ingredients?: Json | null
          product_fingerprint?: string | null
          product_name?: string | null
          product_url?: string | null
          railway_response?: Json | null
          raw_ingredient_text?: string | null
          response_status?: string | null
          search_id?: string | null
          source_confidence?: number | null
          source_type?: string | null
        }
        Update: {
          created_at?: string | null
          extraction_confidence?: number | null
          id?: never
          ingredient_confidence?: number | null
          ingredients_found?: boolean | null
          merchant_name?: string | null
          parsed_ingredients?: Json | null
          product_fingerprint?: string | null
          product_name?: string | null
          product_url?: string | null
          railway_response?: Json | null
          raw_ingredient_text?: string | null
          response_status?: string | null
          search_id?: string | null
          source_confidence?: number | null
          source_type?: string | null
        }
        Relationships: []
      }
      ingredient_profile_rules: {
        Row: {
          canonical_name: string
          created_at: string | null
          id: number
          penalty: number | null
          profile: string
          rule_type: string
          severity: string | null
          use_instruction: string | null
          warning_text: string | null
        }
        Insert: {
          canonical_name: string
          created_at?: string | null
          id?: never
          penalty?: number | null
          profile: string
          rule_type: string
          severity?: string | null
          use_instruction?: string | null
          warning_text?: string | null
        }
        Update: {
          canonical_name?: string
          created_at?: string | null
          id?: never
          penalty?: number | null
          profile?: string
          rule_type?: string
          severity?: string | null
          use_instruction?: string | null
          warning_text?: string | null
        }
        Relationships: []
      }
      ingredient_scientific_dossiers: {
        Row: {
          applicable_exposure_routes: Json
          applicable_product_types: Json
          approved_at: string | null
          canonical_name: string
          cas_number: string | null
          chemical_class: string | null
          child_risk: boolean | null
          common_names: Json
          concentration_context: string | null
          concentration_limit: number | null
          concentration_unit: string | null
          created_at: string
          dossier_status: string
          ec_number: string | null
          general_safe_use_warning: string | null
          hazard_categories: Json
          id: number
          identity_confidence: number | null
          inci_name: string | null
          ingredient_functions: Json
          inhalation_adjustment: number
          leave_on_adjustment: number
          normalized_canonical_name: string
          oral_adjustment: number
          pregnancy_risk: boolean | null
          proposed_base_risk_score: number | null
          proposed_recommendation: string | null
          proposed_warning: string | null
          pubchem_cid: string | null
          queue_id: number
          regulatory_classification: string | null
          regulatory_confidence: number | null
          reviewed_at: string | null
          reviewer_name: string | null
          rinse_off_adjustment: number
          safety_classification: string | null
          scientific_confidence: number | null
          senior_risk: boolean | null
          sensitive_skin_risk: boolean | null
          synonyms: Json
          updated_at: string
          version: number
        }
        Insert: {
          applicable_exposure_routes?: Json
          applicable_product_types?: Json
          approved_at?: string | null
          canonical_name: string
          cas_number?: string | null
          chemical_class?: string | null
          child_risk?: boolean | null
          common_names?: Json
          concentration_context?: string | null
          concentration_limit?: number | null
          concentration_unit?: string | null
          created_at?: string
          dossier_status?: string
          ec_number?: string | null
          general_safe_use_warning?: string | null
          hazard_categories?: Json
          id?: never
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_functions?: Json
          inhalation_adjustment?: number
          leave_on_adjustment?: number
          normalized_canonical_name: string
          oral_adjustment?: number
          pregnancy_risk?: boolean | null
          proposed_base_risk_score?: number | null
          proposed_recommendation?: string | null
          proposed_warning?: string | null
          pubchem_cid?: string | null
          queue_id: number
          regulatory_classification?: string | null
          regulatory_confidence?: number | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          rinse_off_adjustment?: number
          safety_classification?: string | null
          scientific_confidence?: number | null
          senior_risk?: boolean | null
          sensitive_skin_risk?: boolean | null
          synonyms?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          applicable_exposure_routes?: Json
          applicable_product_types?: Json
          approved_at?: string | null
          canonical_name?: string
          cas_number?: string | null
          chemical_class?: string | null
          child_risk?: boolean | null
          common_names?: Json
          concentration_context?: string | null
          concentration_limit?: number | null
          concentration_unit?: string | null
          created_at?: string
          dossier_status?: string
          ec_number?: string | null
          general_safe_use_warning?: string | null
          hazard_categories?: Json
          id?: never
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_functions?: Json
          inhalation_adjustment?: number
          leave_on_adjustment?: number
          normalized_canonical_name?: string
          oral_adjustment?: number
          pregnancy_risk?: boolean | null
          proposed_base_risk_score?: number | null
          proposed_recommendation?: string | null
          proposed_warning?: string | null
          pubchem_cid?: string | null
          queue_id?: number
          regulatory_classification?: string | null
          regulatory_confidence?: number | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          rinse_off_adjustment?: number
          safety_classification?: string | null
          scientific_confidence?: number | null
          senior_risk?: boolean | null
          sensitive_skin_risk?: boolean | null
          synonyms?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      ingredient_scientific_evidence: {
        Row: {
          contradicts_classification: string | null
          created_at: string
          dossier_id: number
          effective_date: string | null
          evidence_confidence: number
          evidence_strength: string
          evidence_summary: string
          evidence_title: string
          evidence_type: string
          extracted_requirement: string | null
          id: number
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          raw_evidence_id: number | null
          source_date: string | null
          source_document: string | null
          source_reference: string | null
          source_registry_id: number
          source_url: string | null
          source_version: string | null
          supports_classification: string | null
          updated_at: string
          verification_notes: string | null
          verification_status: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          verified_document_url: string | null
          verified_source_version: string | null
        }
        Insert: {
          contradicts_classification?: string | null
          created_at?: string
          dossier_id: number
          effective_date?: string | null
          evidence_confidence: number
          evidence_strength: string
          evidence_summary: string
          evidence_title: string
          evidence_type: string
          extracted_requirement?: string | null
          id?: never
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          raw_evidence_id?: number | null
          source_date?: string | null
          source_document?: string | null
          source_reference?: string | null
          source_registry_id: number
          source_url?: string | null
          source_version?: string | null
          supports_classification?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          verified_document_url?: string | null
          verified_source_version?: string | null
        }
        Update: {
          contradicts_classification?: string | null
          created_at?: string
          dossier_id?: number
          effective_date?: string | null
          evidence_confidence?: number
          evidence_strength?: string
          evidence_summary?: string
          evidence_title?: string
          evidence_type?: string
          extracted_requirement?: string | null
          id?: never
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          raw_evidence_id?: number | null
          source_date?: string | null
          source_document?: string | null
          source_reference?: string | null
          source_registry_id?: number
          source_url?: string | null
          source_version?: string | null
          supports_classification?: string | null
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          verified_document_url?: string | null
          verified_source_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_raw_evidence_fk"
            columns: ["raw_evidence_id"]
            isOneToOne: false
            referencedRelation: "scientific_evidence_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_evidence_source_registry_id_fkey"
            columns: ["source_registry_id"]
            isOneToOne: false
            referencedRelation: "regulatory_source_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_scientific_modules: {
        Row: {
          activated_at: string | null
          activation_reason: string | null
          created_at: string
          dossier_id: number
          id: number
          last_reviewed_at: string | null
          limitations: Json
          module_code: string
          module_confidence: number | null
          module_status: string
          module_summary: string | null
          next_review_due_at: string | null
          pending_evidence_count: number
          priority: string
          rejected_evidence_count: number
          research_started_at: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_evidence_count: number
        }
        Insert: {
          activated_at?: string | null
          activation_reason?: string | null
          created_at?: string
          dossier_id: number
          id?: never
          last_reviewed_at?: string | null
          limitations?: Json
          module_code: string
          module_confidence?: number | null
          module_status?: string
          module_summary?: string | null
          next_review_due_at?: string | null
          pending_evidence_count?: number
          priority?: string
          rejected_evidence_count?: number
          research_started_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_evidence_count?: number
        }
        Update: {
          activated_at?: string | null
          activation_reason?: string | null
          created_at?: string
          dossier_id?: number
          id?: never
          last_reviewed_at?: string | null
          limitations?: Json
          module_code?: string
          module_confidence?: number | null
          module_status?: string
          module_summary?: string | null
          next_review_due_at?: string | null
          pending_evidence_count?: number
          priority?: string
          rejected_evidence_count?: number
          research_started_at?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_evidence_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_scientific_modules_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "scientific_module_catalog"
            referencedColumns: ["module_code"]
          },
        ]
      }
      ingredient_source_items: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: number
          ingredient_name: string
          ingredient_sequence: number | null
          ingredient_source_id: number
          normalized_ingredient: string
          product_fingerprint: string
          search_id: string | null
          source_name: string | null
          source_priority: number | null
          source_type: string
          verified: boolean | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          ingredient_name: string
          ingredient_sequence?: number | null
          ingredient_source_id: number
          normalized_ingredient: string
          product_fingerprint: string
          search_id?: string | null
          source_name?: string | null
          source_priority?: number | null
          source_type: string
          verified?: boolean | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: number
          ingredient_name?: string
          ingredient_sequence?: number | null
          ingredient_source_id?: number
          normalized_ingredient?: string
          product_fingerprint?: string
          search_id?: string | null
          source_name?: string | null
          source_priority?: number | null
          source_type?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_source_items_ingredient_source_id_fkey"
            columns: ["ingredient_source_id"]
            isOneToOne: false
            referencedRelation: "ingredient_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_sources: {
        Row: {
          barcode: string | null
          brand_name: string | null
          category: string | null
          confidence_score: number | null
          created_at: string | null
          extracted_at: string | null
          extraction_method: string | null
          id: number
          image_url: string | null
          ingredient_hash: string | null
          ingredient_text: string | null
          language_code: string | null
          merchant_name: string | null
          parsed_ingredients: Json
          product_fingerprint: string
          product_name: string | null
          search_id: string | null
          source_name: string | null
          source_priority: number | null
          source_type: string
          source_url: string | null
          verification_notes: string | null
          verified: boolean | null
        }
        Insert: {
          barcode?: string | null
          brand_name?: string | null
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          id?: number
          image_url?: string | null
          ingredient_hash?: string | null
          ingredient_text?: string | null
          language_code?: string | null
          merchant_name?: string | null
          parsed_ingredients?: Json
          product_fingerprint: string
          product_name?: string | null
          search_id?: string | null
          source_name?: string | null
          source_priority?: number | null
          source_type: string
          source_url?: string | null
          verification_notes?: string | null
          verified?: boolean | null
        }
        Update: {
          barcode?: string | null
          brand_name?: string | null
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extracted_at?: string | null
          extraction_method?: string | null
          id?: number
          image_url?: string | null
          ingredient_hash?: string | null
          ingredient_text?: string | null
          language_code?: string | null
          merchant_name?: string | null
          parsed_ingredients?: Json
          product_fingerprint?: string
          product_name?: string | null
          search_id?: string | null
          source_name?: string | null
          source_priority?: number | null
          source_type?: string
          source_url?: string | null
          verification_notes?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      merchant_master: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean | null
          merchant_class: string
          merchant_name: string
          merchant_name_normalized: string
          merchant_score: number
          normalized_keyword: string | null
          notes: string | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          merchant_class: string
          merchant_name: string
          merchant_name_normalized: string
          merchant_score: number
          normalized_keyword?: string | null
          notes?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          is_active?: boolean | null
          merchant_class?: string
          merchant_name?: string
          merchant_name_normalized?: string
          merchant_score?: number
          normalized_keyword?: string | null
          notes?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      modern_ingredient_watchlist: {
        Row: {
          allergenicity: boolean | null
          canonical_name: string
          category: string | null
          child_risk: boolean | null
          common_use: string | null
          created_at: string | null
          endocrine_disruptor: boolean | null
          id: number
          notes: string | null
          photosensitivity: boolean | null
          pregnancy_risk: boolean | null
          recommended_risk_score: number | null
          senior_risk: boolean | null
        }
        Insert: {
          allergenicity?: boolean | null
          canonical_name: string
          category?: string | null
          child_risk?: boolean | null
          common_use?: string | null
          created_at?: string | null
          endocrine_disruptor?: boolean | null
          id?: never
          notes?: string | null
          photosensitivity?: boolean | null
          pregnancy_risk?: boolean | null
          recommended_risk_score?: number | null
          senior_risk?: boolean | null
        }
        Update: {
          allergenicity?: boolean | null
          canonical_name?: string
          category?: string | null
          child_risk?: boolean | null
          common_use?: string | null
          created_at?: string | null
          endocrine_disruptor?: boolean | null
          id?: never
          notes?: string | null
          photosensitivity?: boolean | null
          pregnancy_risk?: boolean | null
          recommended_risk_score?: number | null
          senior_risk?: boolean | null
        }
        Relationships: []
      }
      nutrient_rda_limits: {
        Row: {
          id: number
          labeling_warning: string | null
          normalized_nutrient_name: string
          nutrient_name: string
          rda_general: number | null
          rda_pregnant: number | null
          rda_seniors: number | null
          source_reference: string | null
          status: string | null
          synonyms: string | null
          tolerable_upper_limit: string | null
          unit: string | null
        }
        Insert: {
          id?: number
          labeling_warning?: string | null
          normalized_nutrient_name: string
          nutrient_name: string
          rda_general?: number | null
          rda_pregnant?: number | null
          rda_seniors?: number | null
          source_reference?: string | null
          status?: string | null
          synonyms?: string | null
          tolerable_upper_limit?: string | null
          unit?: string | null
        }
        Update: {
          id?: number
          labeling_warning?: string | null
          normalized_nutrient_name?: string
          nutrient_name?: string
          rda_general?: number | null
          rda_pregnant?: number | null
          rda_seniors?: number | null
          source_reference?: string | null
          status?: string | null
          synonyms?: string | null
          tolerable_upper_limit?: string | null
          unit?: string | null
        }
        Relationships: []
      }
      product_category_master: {
        Row: {
          category: string
          created_at: string | null
          id: number
          is_active: boolean
          keyword: string
          priority: number
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: number
          is_active?: boolean
          keyword: string
          priority?: number
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: number
          is_active?: boolean
          keyword?: string
          priority?: number
        }
        Relationships: []
      }
      product_profile_master: {
        Row: {
          created_at: string | null
          id: number
          is_active: boolean
          keyword: string
          priority: number
          profile: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          is_active?: boolean
          keyword: string
          priority?: number
          profile: string
        }
        Update: {
          created_at?: string | null
          id?: number
          is_active?: boolean
          keyword?: string
          priority?: number
          profile?: string
        }
        Relationships: []
      }
      product_sources: {
        Row: {
          affiliate_url: string | null
          average_confidence: number
          brand_name: string | null
          category: string | null
          first_seen: string
          id: number
          image_url: string | null
          ingredient_failure_count: number
          ingredient_success_count: number
          last_failure_at: string | null
          last_success_at: string | null
          last_verified_at: string | null
          merchant_class: string | null
          merchant_name: string | null
          normalized_product_name: string | null
          product_fingerprint: string
          product_name: string
          resolved_product_url: string | null
          source_domain: string | null
          source_priority: number
          source_status: string
          source_type: string
          source_url: string
          success_rate: number
          supports_json: boolean
          supports_ocr: boolean
          supports_shopify: boolean
          updated_at: string
          verified: boolean
          verified_by: string | null
        }
        Insert: {
          affiliate_url?: string | null
          average_confidence?: number
          brand_name?: string | null
          category?: string | null
          first_seen?: string
          id?: number
          image_url?: string | null
          ingredient_failure_count?: number
          ingredient_success_count?: number
          last_failure_at?: string | null
          last_success_at?: string | null
          last_verified_at?: string | null
          merchant_class?: string | null
          merchant_name?: string | null
          normalized_product_name?: string | null
          product_fingerprint: string
          product_name: string
          resolved_product_url?: string | null
          source_domain?: string | null
          source_priority?: number
          source_status?: string
          source_type: string
          source_url: string
          success_rate?: number
          supports_json?: boolean
          supports_ocr?: boolean
          supports_shopify?: boolean
          updated_at?: string
          verified?: boolean
          verified_by?: string | null
        }
        Update: {
          affiliate_url?: string | null
          average_confidence?: number
          brand_name?: string | null
          category?: string | null
          first_seen?: string
          id?: number
          image_url?: string | null
          ingredient_failure_count?: number
          ingredient_success_count?: number
          last_failure_at?: string | null
          last_success_at?: string | null
          last_verified_at?: string | null
          merchant_class?: string | null
          merchant_name?: string | null
          normalized_product_name?: string | null
          product_fingerprint?: string
          product_name?: string
          resolved_product_url?: string | null
          source_domain?: string | null
          source_priority?: number
          source_status?: string
          source_type?: string
          source_url?: string
          success_rate?: number
          supports_json?: boolean
          supports_ocr?: boolean
          supports_shopify?: boolean
          updated_at?: string
          verified?: boolean
          verified_by?: string | null
        }
        Relationships: []
      }
      product_type_safety_rules: {
        Row: {
          action: string
          id: number
          notes: string | null
          product_type: string
          profile_key: string
          severity: string
          source_reference: string | null
          trigger_condition: string
          warning_text: string | null
        }
        Insert: {
          action: string
          id?: number
          notes?: string | null
          product_type: string
          profile_key: string
          severity: string
          source_reference?: string | null
          trigger_condition: string
          warning_text?: string | null
        }
        Update: {
          action?: string
          id?: number
          notes?: string | null
          product_type?: string
          profile_key?: string
          severity?: string
          source_reference?: string | null
          trigger_condition?: string
          warning_text?: string | null
        }
        Relationships: []
      }
      profile_group_map: {
        Row: {
          description: string | null
          frontend_label: string
          frontend_profile: string | null
          id: number
          include_common_all_rules: boolean
          mapped_group: string | null
          matches_target_groups: Json
          profile_key: string
          risk_weight: number | null
        }
        Insert: {
          description?: string | null
          frontend_label: string
          frontend_profile?: string | null
          id?: number
          include_common_all_rules?: boolean
          mapped_group?: string | null
          matches_target_groups?: Json
          profile_key: string
          risk_weight?: number | null
        }
        Update: {
          description?: string | null
          frontend_label?: string
          frontend_profile?: string | null
          id?: number
          include_common_all_rules?: boolean
          mapped_group?: string | null
          matches_target_groups?: Json
          profile_key?: string
          risk_weight?: number | null
        }
        Relationships: []
      }
      regulatory_knowledge_queue: {
        Row: {
          approved_at: string | null
          canonical_name: string
          cas_number: string | null
          created_at: string
          current_status: string
          ec_number: string | null
          evidence_confidence: number | null
          first_seen_at: string
          id: number
          identity_confidence: number | null
          inci_name: string | null
          ingredient_function: string | null
          last_seen_at: string
          normalized_canonical_name: string
          occurrence_count: number
          priority: string
          proposed_recommendation: string | null
          proposed_risk_level: string | null
          proposed_risk_score: number | null
          proposed_warning: string | null
          research_payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source_authorities: Json
          source_references: Json
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          canonical_name: string
          cas_number?: string | null
          created_at?: string
          current_status?: string
          ec_number?: string | null
          evidence_confidence?: number | null
          first_seen_at?: string
          id?: never
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_function?: string | null
          last_seen_at?: string
          normalized_canonical_name: string
          occurrence_count?: number
          priority?: string
          proposed_recommendation?: string | null
          proposed_risk_level?: string | null
          proposed_risk_score?: number | null
          proposed_warning?: string | null
          research_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_authorities?: Json
          source_references?: Json
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          canonical_name?: string
          cas_number?: string | null
          created_at?: string
          current_status?: string
          ec_number?: string | null
          evidence_confidence?: number | null
          first_seen_at?: string
          id?: never
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_function?: string | null
          last_seen_at?: string
          normalized_canonical_name?: string
          occurrence_count?: number
          priority?: string
          proposed_recommendation?: string | null
          proposed_risk_level?: string | null
          proposed_risk_score?: number | null
          proposed_warning?: string | null
          research_payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_authorities?: Json
          source_references?: Json
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_source_registry: {
        Row: {
          authority_name: string
          authority_tier: number
          base_url: string | null
          created_at: string
          id: number
          identity_reference_source: boolean
          is_active: boolean
          jurisdiction: string
          legally_binding: boolean
          notes: string | null
          scientific_review_source: boolean
          source_code: string
          source_type: string
          updated_at: string
        }
        Insert: {
          authority_name: string
          authority_tier: number
          base_url?: string | null
          created_at?: string
          id?: never
          identity_reference_source?: boolean
          is_active?: boolean
          jurisdiction: string
          legally_binding?: boolean
          notes?: string | null
          scientific_review_source?: boolean
          source_code: string
          source_type: string
          updated_at?: string
        }
        Update: {
          authority_name?: string
          authority_tier?: number
          base_url?: string | null
          created_at?: string
          id?: never
          identity_reference_source?: boolean
          is_active?: boolean
          jurisdiction?: string
          legally_binding?: boolean
          notes?: string | null
          scientific_review_source?: boolean
          source_code?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_standards: {
        Row: {
          agency: string | null
          automation_notes: string | null
          cas_no: string | null
          category: string | null
          child_penalty: number
          child_risk: boolean
          created_at: string | null
          id: number
          ingredient_canonical_name: string
          labeling_warnings: string | null
          limits: Json
          normalized_canonical_name: string
          pregnancy_penalty: number
          pregnancy_risk: boolean
          product_type_conditions: Json
          regulatory_subgroups: Json
          restriction_status: string
          risk_level: string | null
          risk_score: number
          senior_penalty: number
          senior_risk: boolean
          standard_id: string | null
          synonym_name: string | null
          synonym_normalized: string | null
          target_groups: Json
        }
        Insert: {
          agency?: string | null
          automation_notes?: string | null
          cas_no?: string | null
          category?: string | null
          child_penalty?: number
          child_risk?: boolean
          created_at?: string | null
          id?: number
          ingredient_canonical_name: string
          labeling_warnings?: string | null
          limits?: Json
          normalized_canonical_name: string
          pregnancy_penalty?: number
          pregnancy_risk?: boolean
          product_type_conditions?: Json
          regulatory_subgroups?: Json
          restriction_status: string
          risk_level?: string | null
          risk_score?: number
          senior_penalty?: number
          senior_risk?: boolean
          standard_id?: string | null
          synonym_name?: string | null
          synonym_normalized?: string | null
          target_groups?: Json
        }
        Update: {
          agency?: string | null
          automation_notes?: string | null
          cas_no?: string | null
          category?: string | null
          child_penalty?: number
          child_risk?: boolean
          created_at?: string | null
          id?: number
          ingredient_canonical_name?: string
          labeling_warnings?: string | null
          limits?: Json
          normalized_canonical_name?: string
          pregnancy_penalty?: number
          pregnancy_risk?: boolean
          product_type_conditions?: Json
          regulatory_subgroups?: Json
          restriction_status?: string
          risk_level?: string | null
          risk_score?: number
          senior_penalty?: number
          senior_risk?: boolean
          standard_id?: string | null
          synonym_name?: string | null
          synonym_normalized?: string | null
          target_groups?: Json
        }
        Relationships: []
      }
      scientific_authority_domain_allowlist: {
        Row: {
          allowed_domain: string
          can_support_approval: boolean
          created_at: string
          evidence_use: string
          id: number
          is_active: boolean
          notes: string | null
          source_code: string
        }
        Insert: {
          allowed_domain: string
          can_support_approval?: boolean
          created_at?: string
          evidence_use: string
          id?: never
          is_active?: boolean
          notes?: string | null
          source_code: string
        }
        Update: {
          allowed_domain?: string
          can_support_approval?: boolean
          created_at?: string
          evidence_use?: string
          id?: never
          is_active?: boolean
          notes?: string | null
          source_code?: string
        }
        Relationships: []
      }
      scientific_authority_registry: {
        Row: {
          authority_category: string
          authority_code: string
          authority_name: string
          created_at: string
          default_strength: string
          id: number
          is_active: boolean
          priority: number
        }
        Insert: {
          authority_category: string
          authority_code: string
          authority_name: string
          created_at?: string
          default_strength: string
          id?: number
          is_active?: boolean
          priority?: number
        }
        Update: {
          authority_category?: string
          authority_code?: string
          authority_name?: string
          created_at?: string
          default_strength?: string
          id?: number
          is_active?: boolean
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "scientific_authority_registry_default_strength_fkey"
            columns: ["default_strength"]
            isOneToOne: false
            referencedRelation: "scientific_evidence_vocabulary"
            referencedColumns: ["canonical_strength"]
          },
        ]
      }
      scientific_document_registry: {
        Row: {
          canonical_strength: string
          created_at: string
          document_category: string
          document_pattern: string
          id: number
          is_active: boolean
          notes: string | null
          priority: number
        }
        Insert: {
          canonical_strength: string
          created_at?: string
          document_category: string
          document_pattern: string
          id?: number
          is_active?: boolean
          notes?: string | null
          priority: number
        }
        Update: {
          canonical_strength?: string
          created_at?: string
          document_category?: string
          document_pattern?: string
          id?: number
          is_active?: boolean
          notes?: string | null
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "scientific_document_registry_canonical_strength_fkey"
            columns: ["canonical_strength"]
            isOneToOne: false
            referencedRelation: "scientific_evidence_vocabulary"
            referencedColumns: ["canonical_strength"]
          },
        ]
      }
      scientific_evidence_consistency_rules: {
        Row: {
          allowed_strengths: string[]
          created_at: string
          description: string | null
          evidence_type: string
          id: number
          is_active: boolean
          require_identity_reference: boolean
          require_legally_binding: boolean
          require_scientific_review: boolean
          updated_at: string
        }
        Insert: {
          allowed_strengths: string[]
          created_at?: string
          description?: string | null
          evidence_type: string
          id?: number
          is_active?: boolean
          require_identity_reference?: boolean
          require_legally_binding?: boolean
          require_scientific_review?: boolean
          updated_at?: string
        }
        Update: {
          allowed_strengths?: string[]
          created_at?: string
          description?: string | null
          evidence_type?: string
          id?: number
          is_active?: boolean
          require_identity_reference?: boolean
          require_legally_binding?: boolean
          require_scientific_review?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scientific_evidence_raw: {
        Row: {
          ai_confidence: number | null
          ai_evidence_strength: string | null
          ai_evidence_type: string | null
          ai_excerpt: string | null
          ai_model: string
          ai_provider: string
          ai_reasoning: string | null
          ai_recommendation: string | null
          ai_summary: string | null
          authority_name: string | null
          canonical_name: string | null
          completion_tokens: number | null
          created_at: string
          dossier_id: number | null
          estimated_cost: number | null
          extraction_timestamp: string
          id: number
          ingestion_uuid: string
          ingredient_name: string | null
          last_error_code: string | null
          last_error_message: string | null
          model_version: string | null
          parsed_response: Json | null
          pipeline_version: string
          processed_evidence_id: number | null
          processing_attempts: number
          processing_status: string
          processing_time_ms: number | null
          processing_updated_at: string
          prompt_tokens: number | null
          prompt_version: string | null
          raw_request: Json | null
          raw_response: Json
          replay_reason: string | null
          replay_required: boolean
          search_term: string | null
          source_code: string | null
          source_document: string | null
          source_reference: string | null
          source_url: string | null
          total_tokens: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_evidence_strength?: string | null
          ai_evidence_type?: string | null
          ai_excerpt?: string | null
          ai_model: string
          ai_provider: string
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_summary?: string | null
          authority_name?: string | null
          canonical_name?: string | null
          completion_tokens?: number | null
          created_at?: string
          dossier_id?: number | null
          estimated_cost?: number | null
          extraction_timestamp?: string
          id?: never
          ingestion_uuid?: string
          ingredient_name?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          model_version?: string | null
          parsed_response?: Json | null
          pipeline_version?: string
          processed_evidence_id?: number | null
          processing_attempts?: number
          processing_status?: string
          processing_time_ms?: number | null
          processing_updated_at?: string
          prompt_tokens?: number | null
          prompt_version?: string | null
          raw_request?: Json | null
          raw_response: Json
          replay_reason?: string | null
          replay_required?: boolean
          search_term?: string | null
          source_code?: string | null
          source_document?: string | null
          source_reference?: string | null
          source_url?: string | null
          total_tokens?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_evidence_strength?: string | null
          ai_evidence_type?: string | null
          ai_excerpt?: string | null
          ai_model?: string
          ai_provider?: string
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_summary?: string | null
          authority_name?: string | null
          canonical_name?: string | null
          completion_tokens?: number | null
          created_at?: string
          dossier_id?: number | null
          estimated_cost?: number | null
          extraction_timestamp?: string
          id?: never
          ingestion_uuid?: string
          ingredient_name?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          model_version?: string | null
          parsed_response?: Json | null
          pipeline_version?: string
          processed_evidence_id?: number | null
          processing_attempts?: number
          processing_status?: string
          processing_time_ms?: number | null
          processing_updated_at?: string
          prompt_tokens?: number | null
          prompt_version?: string | null
          raw_request?: Json | null
          raw_response?: Json
          replay_reason?: string | null
          replay_required?: boolean
          search_term?: string | null
          source_code?: string | null
          source_document?: string | null
          source_reference?: string | null
          source_url?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_processed_evidence_fk"
            columns: ["processed_evidence_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_processed_evidence_fk"
            columns: ["processed_evidence_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "scientific_evidence_raw_processed_evidence_fk"
            columns: ["processed_evidence_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_lineage_summary"
            referencedColumns: ["evidence_id"]
          },
        ]
      }
      scientific_evidence_type_registry: {
        Row: {
          canonical_strength: string
          created_at: string
          description: string | null
          evidence_type: string
          id: number
          is_active: boolean
          priority: number
        }
        Insert: {
          canonical_strength: string
          created_at?: string
          description?: string | null
          evidence_type: string
          id?: number
          is_active?: boolean
          priority: number
        }
        Update: {
          canonical_strength?: string
          created_at?: string
          description?: string | null
          evidence_type?: string
          id?: number
          is_active?: boolean
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "scientific_evidence_type_registry_canonical_strength_fkey"
            columns: ["canonical_strength"]
            isOneToOne: false
            referencedRelation: "scientific_evidence_vocabulary"
            referencedColumns: ["canonical_strength"]
          },
        ]
      }
      scientific_evidence_vocabulary: {
        Row: {
          canonical_strength: string
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          id: number
          is_active: boolean
        }
        Insert: {
          canonical_strength: string
          created_at?: string
          description?: string | null
          display_name: string
          display_order: number
          id?: number
          is_active?: boolean
        }
        Update: {
          canonical_strength?: string
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          id?: number
          is_active?: boolean
        }
        Relationships: []
      }
      scientific_factory_drafts: {
        Row: {
          canonical_name: string
          classification_payload: Json
          created_at: string
          dossier_id: number
          draft_quality_score: number | null
          draft_status: string
          evidence_payload: Json
          exposure_payload: Json
          id: number
          identity_payload: Json
          profile_payload: Json
          run_id: string
          schema_version: string
          updated_at: string
          warning_payload: Json
        }
        Insert: {
          canonical_name: string
          classification_payload?: Json
          created_at?: string
          dossier_id: number
          draft_quality_score?: number | null
          draft_status?: string
          evidence_payload?: Json
          exposure_payload?: Json
          id?: never
          identity_payload?: Json
          profile_payload?: Json
          run_id: string
          schema_version?: string
          updated_at?: string
          warning_payload?: Json
        }
        Update: {
          canonical_name?: string
          classification_payload?: Json
          created_at?: string
          dossier_id?: number
          draft_quality_score?: number | null
          draft_status?: string
          evidence_payload?: Json
          exposure_payload?: Json
          id?: never
          identity_payload?: Json
          profile_payload?: Json
          run_id?: string
          schema_version?: string
          updated_at?: string
          warning_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "scientific_factory_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_drafts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_factory_monitor_v1"
            referencedColumns: ["run_id"]
          },
        ]
      }
      scientific_factory_runs: {
        Row: {
          attempt_number: number
          canonical_name: string
          claimed_at: string
          claimed_by: string
          completed_at: string | null
          created_at: string
          dossier_id: number
          error_code: string | null
          error_message: string | null
          id: string
          ingestion_status: string | null
          input_payload: Json
          lease_expires_at: string
          model_name: string | null
          model_payload: Json
          model_response_id: string | null
          normalized_canonical_name: string
          output_payload: Json
          priority: string
          pubchem_status: string | null
          queue_id: number
          research_status: string | null
          run_status: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          canonical_name: string
          claimed_at?: string
          claimed_by: string
          completed_at?: string | null
          created_at?: string
          dossier_id: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          ingestion_status?: string | null
          input_payload?: Json
          lease_expires_at?: string
          model_name?: string | null
          model_payload?: Json
          model_response_id?: string | null
          normalized_canonical_name: string
          output_payload?: Json
          priority: string
          pubchem_status?: string | null
          queue_id: number
          research_status?: string | null
          run_status?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          canonical_name?: string
          claimed_at?: string
          claimed_by?: string
          completed_at?: string | null
          created_at?: string
          dossier_id?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          ingestion_status?: string | null
          input_payload?: Json
          lease_expires_at?: string
          model_name?: string | null
          model_payload?: Json
          model_response_id?: string | null
          normalized_canonical_name?: string
          output_payload?: Json
          priority?: string
          pubchem_status?: string | null
          queue_id?: number
          research_status?: string | null
          run_status?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      scientific_factory_settings: {
        Row: {
          authority_map: string
          created_at: string
          dossier_max_output_tokens: number
          dossier_model: string
          dossier_system_prompt: string
          is_active: boolean
          research_max_output_tokens: number
          research_model: string
          research_system_prompt: string
          setting_key: string
          setting_version: string
          updated_at: string
        }
        Insert: {
          authority_map: string
          created_at?: string
          dossier_max_output_tokens?: number
          dossier_model?: string
          dossier_system_prompt: string
          is_active?: boolean
          research_max_output_tokens?: number
          research_model?: string
          research_system_prompt: string
          setting_key: string
          setting_version: string
          updated_at?: string
        }
        Update: {
          authority_map?: string
          created_at?: string
          dossier_max_output_tokens?: number
          dossier_model?: string
          dossier_system_prompt?: string
          is_active?: boolean
          research_max_output_tokens?: number
          research_model?: string
          research_system_prompt?: string
          setting_key?: string
          setting_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      scientific_factory_source_hits: {
        Row: {
          ai_relevance_confidence: number | null
          authority_name: string | null
          authority_registered: boolean
          claim_summary: string | null
          created_at: string
          document_date: string | null
          document_title: string | null
          document_version: string | null
          domain_allowed: boolean
          dossier_id: number
          evidence_strength: string | null
          evidence_type: string | null
          extracted_requirement: string | null
          id: number
          ingestion_status: string
          raw_source_payload: Json
          rejection_reason: string | null
          run_id: string
          source_code: string | null
          source_domain: string
          source_reference: string | null
          source_url: string
          updated_at: string
        }
        Insert: {
          ai_relevance_confidence?: number | null
          authority_name?: string | null
          authority_registered?: boolean
          claim_summary?: string | null
          created_at?: string
          document_date?: string | null
          document_title?: string | null
          document_version?: string | null
          domain_allowed?: boolean
          dossier_id: number
          evidence_strength?: string | null
          evidence_type?: string | null
          extracted_requirement?: string | null
          id?: never
          ingestion_status?: string
          raw_source_payload?: Json
          rejection_reason?: string | null
          run_id: string
          source_code?: string | null
          source_domain: string
          source_reference?: string | null
          source_url: string
          updated_at?: string
        }
        Update: {
          ai_relevance_confidence?: number | null
          authority_name?: string | null
          authority_registered?: boolean
          claim_summary?: string | null
          created_at?: string
          document_date?: string | null
          document_title?: string | null
          document_version?: string | null
          domain_allowed?: boolean
          dossier_id?: number
          evidence_strength?: string | null
          evidence_type?: string | null
          extracted_requirement?: string | null
          id?: never
          ingestion_status?: string
          raw_source_payload?: Json
          rejection_reason?: string | null
          run_id?: string
          source_code?: string | null
          source_domain?: string
          source_reference?: string | null
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scientific_factory_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_source_hits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_factory_monitor_v1"
            referencedColumns: ["run_id"]
          },
        ]
      }
      scientific_module_catalog: {
        Row: {
          allowed_evidence_types: Json
          applicable_product_domains: Json
          created_at: string
          default_active: boolean
          display_order: number
          is_active: boolean
          minimum_verified_evidence: number
          module_code: string
          module_description: string
          module_name: string
          preferred_source_codes: Json
          requires_identity_module: boolean
          system_instruction: string
          updated_at: string
        }
        Insert: {
          allowed_evidence_types?: Json
          applicable_product_domains?: Json
          created_at?: string
          default_active?: boolean
          display_order: number
          is_active?: boolean
          minimum_verified_evidence?: number
          module_code: string
          module_description: string
          module_name: string
          preferred_source_codes?: Json
          requires_identity_module?: boolean
          system_instruction: string
          updated_at?: string
        }
        Update: {
          allowed_evidence_types?: Json
          applicable_product_domains?: Json
          created_at?: string
          default_active?: boolean
          display_order?: number
          is_active?: boolean
          minimum_verified_evidence?: number
          module_code?: string
          module_description?: string
          module_name?: string
          preferred_source_codes?: Json
          requires_identity_module?: boolean
          system_instruction?: string
          updated_at?: string
        }
        Relationships: []
      }
      scientific_module_jobs: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string
          dossier_id: number
          error_code: string | null
          error_message: string | null
          id: string
          job_status: string
          lease_expires_at: string | null
          model_name: string | null
          model_response_id: string | null
          module_code: string
          module_instance_id: number
          priority: string
          research_completed_at: string | null
          research_payload: Json | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dossier_id: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_status?: string
          lease_expires_at?: string | null
          model_name?: string | null
          model_response_id?: string | null
          module_code: string
          module_instance_id: number
          priority?: string
          research_completed_at?: string | null
          research_payload?: Json | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string
          dossier_id?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          job_status?: string
          lease_expires_at?: string | null
          model_name?: string | null
          model_response_id?: string | null
          module_code?: string
          module_instance_id?: number
          priority?: string
          research_completed_at?: string | null
          research_payload?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "scientific_module_catalog"
            referencedColumns: ["module_code"]
          },
          {
            foreignKeyName: "scientific_module_jobs_module_instance_id_fkey"
            columns: ["module_instance_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_module_jobs_module_instance_id_fkey"
            columns: ["module_instance_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["module_instance_id"]
          },
        ]
      }
      sp_catalog_admin_audit_v1: {
        Row: {
          action: string
          actor_user_id: string | null
          audit_id: number
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          product_id: string | null
          reason: string | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          audit_id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          product_id?: string | null
          reason?: string | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          audit_id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          product_id?: string | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      sp_catalog_brand_domain_v1: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          domain_host: string
          domain_type: string
          id: string
          market_country_code: string | null
          official_base_url: string
          status: string
          supports_shopify: boolean
          supports_structured_product_data: boolean
          updated_at: string
          updated_by: string | null
          verification_notes: string | null
          verification_source_url: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          domain_host: string
          domain_type?: string
          id?: string
          market_country_code?: string | null
          official_base_url: string
          status?: string
          supports_shopify?: boolean
          supports_structured_product_data?: boolean
          updated_at?: string
          updated_by?: string | null
          verification_notes?: string | null
          verification_source_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          domain_host?: string
          domain_type?: string
          id?: string
          market_country_code?: string | null
          official_base_url?: string
          status?: string
          supports_shopify?: boolean
          supports_structured_product_data?: boolean
          updated_at?: string
          updated_by?: string | null
          verification_notes?: string | null
          verification_source_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_brand_domain_v1_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_brand_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_brand_v1: {
        Row: {
          brand_name: string
          company_name: string | null
          created_at: string
          created_by: string | null
          home_country_code: string | null
          id: string
          normalized_brand_name: string
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_name: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          home_country_code?: string | null
          id?: string
          normalized_brand_name: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_name?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          home_country_code?: string | null
          id?: string
          normalized_brand_name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sp_catalog_commerce_offer_v1: {
        Row: {
          affiliate_url: string | null
          availability_status: string
          created_at: string
          created_by: string | null
          currency: string
          exact_pack_match: boolean
          id: string
          image_url: string | null
          list_price: number | null
          market_country_code: string
          merchant_name: string | null
          notes: string | null
          offer_confidence: number | null
          pack_match_confidence: number | null
          pack_normalized_key: string | null
          pack_normalized_unit: string | null
          pack_normalized_value: number | null
          pack_size_text: string | null
          platform_name: string
          price: number | null
          product_id: string
          retrieved_at: string
          source_domain: string | null
          source_url: string
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          verified: boolean
        }
        Insert: {
          affiliate_url?: string | null
          availability_status?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exact_pack_match?: boolean
          id?: string
          image_url?: string | null
          list_price?: number | null
          market_country_code?: string
          merchant_name?: string | null
          notes?: string | null
          offer_confidence?: number | null
          pack_match_confidence?: number | null
          pack_normalized_key?: string | null
          pack_normalized_unit?: string | null
          pack_normalized_value?: number | null
          pack_size_text?: string | null
          platform_name: string
          price?: number | null
          product_id: string
          retrieved_at?: string
          source_domain?: string | null
          source_url: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          verified?: boolean
        }
        Update: {
          affiliate_url?: string | null
          availability_status?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          exact_pack_match?: boolean
          id?: string
          image_url?: string | null
          list_price?: number | null
          market_country_code?: string
          merchant_name?: string | null
          notes?: string | null
          offer_confidence?: number | null
          pack_match_confidence?: number | null
          pack_normalized_key?: string | null
          pack_normalized_unit?: string | null
          pack_normalized_value?: number | null
          pack_size_text?: string | null
          platform_name?: string
          price?: number | null
          product_id?: string
          retrieved_at?: string
          source_domain?: string | null
          source_url?: string
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_commerce_offer_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_commerce_offer_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_enrichment_queue_v1: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error_code: string | null
          last_error_detail: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          priority: string
          product_id: string
          result: Json
          status: string
          task_type: string
          updated_at: string
          worker_code: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          priority?: string
          product_id: string
          result?: Json
          status?: string
          task_type: string
          updated_at?: string
          worker_code?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          priority?: string
          product_id?: string
          result?: Json
          status?: string
          task_type?: string
          updated_at?: string
          worker_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_enrichment_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_enrichment_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_ingredient_evidence_v1: {
        Row: {
          created_at: string
          created_by: string | null
          engine_version: string | null
          evidence_kind: string
          evidence_sha256: string | null
          extraction_confidence: number | null
          extraction_method: string | null
          id: string
          image_id: string | null
          independent_group_key: string | null
          ingredient_confidence: number | null
          ingredient_span: string | null
          is_primary_evidence: boolean
          parsed_ingredients: Json
          product_id: string
          raw_text: string | null
          retrieval_metadata: Json
          retrieved_at: string | null
          source_confidence: number | null
          source_domain: string | null
          source_name: string | null
          source_url: string | null
          updated_at: string
          updated_by: string | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engine_version?: string | null
          evidence_kind: string
          evidence_sha256?: string | null
          extraction_confidence?: number | null
          extraction_method?: string | null
          id?: string
          image_id?: string | null
          independent_group_key?: string | null
          ingredient_confidence?: number | null
          ingredient_span?: string | null
          is_primary_evidence?: boolean
          parsed_ingredients?: Json
          product_id: string
          raw_text?: string | null
          retrieval_metadata?: Json
          retrieved_at?: string | null
          source_confidence?: number | null
          source_domain?: string | null
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engine_version?: string | null
          evidence_kind?: string
          evidence_sha256?: string | null
          extraction_confidence?: number | null
          extraction_method?: string | null
          id?: string
          image_id?: string | null
          independent_group_key?: string | null
          ingredient_confidence?: number | null
          ingredient_span?: string | null
          is_primary_evidence?: boolean
          parsed_ingredients?: Json
          product_id?: string
          raw_text?: string | null
          retrieval_metadata?: Json
          retrieved_at?: string | null
          source_confidence?: number | null
          source_domain?: string | null
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          updated_by?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_ingredient_evidence_v1_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_image_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_catalog_ingredient_evidence_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_ingredient_evidence_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_ingredient_item_v1: {
        Row: {
          canonical_ingredient_id: number | null
          confidence: number | null
          created_at: string
          created_by: string | null
          evidence_id: string
          id: string
          ingredient_sequence: number | null
          normalized_name: string
          raw_name: string
          resolution_status: string
        }
        Insert: {
          canonical_ingredient_id?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          evidence_id: string
          id?: string
          ingredient_sequence?: number | null
          normalized_name: string
          raw_name: string
          resolution_status?: string
        }
        Update: {
          canonical_ingredient_id?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          evidence_id?: string
          id?: string
          ingredient_sequence?: number | null
          normalized_name?: string
          raw_name?: string
          resolution_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_ingredient_item_v1_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_ingredient_evidence_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_pipeline_state_v1: {
        Row: {
          admin_review_required: boolean
          commerce_stage: string
          domain_stage: string
          identity_stage: string
          image_stage: string
          ingredient_stage: string
          last_error_code: string | null
          last_error_detail: string | null
          product_id: string
          safety_stage: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_review_required?: boolean
          commerce_stage?: string
          domain_stage?: string
          identity_stage?: string
          image_stage?: string
          ingredient_stage?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          product_id: string
          safety_stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_review_required?: boolean
          commerce_stage?: string
          domain_stage?: string
          identity_stage?: string
          image_stage?: string
          ingredient_stage?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          product_id?: string
          safety_stage?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_pipeline_state_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_pipeline_state_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_product_image_v1: {
        Row: {
          created_at: string
          created_by: string | null
          exact_product_match: boolean
          height_px: number | null
          id: string
          identity_evidence: boolean
          image_role: string
          image_sha256: string | null
          image_url: string | null
          ingredient_evidence: boolean
          is_primary_display: boolean
          market_country_code: string | null
          mime_type: string | null
          notes: string | null
          product_id: string
          retrieved_at: string | null
          source_kind: string
          source_url: string | null
          storage_bucket: string | null
          storage_object_path: string | null
          updated_at: string
          updated_by: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          width_px: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exact_product_match?: boolean
          height_px?: number | null
          id?: string
          identity_evidence?: boolean
          image_role: string
          image_sha256?: string | null
          image_url?: string | null
          ingredient_evidence?: boolean
          is_primary_display?: boolean
          market_country_code?: string | null
          mime_type?: string | null
          notes?: string | null
          product_id: string
          retrieved_at?: string | null
          source_kind: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_object_path?: string | null
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          width_px?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exact_product_match?: boolean
          height_px?: number | null
          id?: string
          identity_evidence?: boolean
          image_role?: string
          image_sha256?: string | null
          image_url?: string | null
          ingredient_evidence?: boolean
          is_primary_display?: boolean
          market_country_code?: string | null
          mime_type?: string | null
          notes?: string | null
          product_id?: string
          retrieved_at?: string | null
          source_kind?: string
          source_url?: string | null
          storage_bucket?: string | null
          storage_object_path?: string | null
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_product_image_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_product_image_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_product_ingredient_v1: {
        Row: {
          admin_override: boolean
          canonical_ingredient_id: number | null
          confidence: number | null
          created_at: string
          created_by: string | null
          display_name: string
          evidence_ids: string[]
          id: string
          independent_source_count: number
          ingredient_sequence: number | null
          normalized_name: string
          override_reason: string | null
          product_id: string
          qualification_status: string
          qualified_at: string | null
          source_count: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_override?: boolean
          canonical_ingredient_id?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          display_name: string
          evidence_ids?: string[]
          id?: string
          independent_source_count?: number
          ingredient_sequence?: number | null
          normalized_name: string
          override_reason?: string | null
          product_id: string
          qualification_status?: string
          qualified_at?: string | null
          source_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_override?: boolean
          canonical_ingredient_id?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          evidence_ids?: string[]
          id?: string
          independent_source_count?: number
          ingredient_sequence?: number | null
          normalized_name?: string
          override_reason?: string | null
          product_id?: string
          qualification_status?: string
          qualified_at?: string | null
          source_count?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_product_ingredient_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_product_ingredient_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_product_v1: {
        Row: {
          barcode: string | null
          brand_id: string | null
          brand_name: string
          category: string | null
          created_at: string
          created_by: string | null
          gtin: string | null
          id: string
          identity_confidence: number | null
          identity_status: string
          is_active: boolean
          market_country_code: string
          normalized_product_name: string
          notes: string | null
          pack_is_official_default: boolean
          pack_normalized_key: string | null
          pack_normalized_unit: string | null
          pack_normalized_value: number | null
          pack_size_text: string | null
          pack_source_kind: string | null
          product_fingerprint: string
          product_name: string
          source_origin: string
          subcategory: string | null
          updated_at: string
          updated_by: string | null
          variant_name: string | null
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          brand_name: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          gtin?: string | null
          id?: string
          identity_confidence?: number | null
          identity_status?: string
          is_active?: boolean
          market_country_code?: string
          normalized_product_name: string
          notes?: string | null
          pack_is_official_default?: boolean
          pack_normalized_key?: string | null
          pack_normalized_unit?: string | null
          pack_normalized_value?: number | null
          pack_size_text?: string | null
          pack_source_kind?: string | null
          product_fingerprint: string
          product_name: string
          source_origin?: string
          subcategory?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_name?: string | null
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          brand_name?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          gtin?: string | null
          id?: string
          identity_confidence?: number | null
          identity_status?: string
          is_active?: boolean
          market_country_code?: string
          normalized_product_name?: string
          notes?: string | null
          pack_is_official_default?: boolean
          pack_normalized_key?: string | null
          pack_normalized_unit?: string | null
          pack_normalized_value?: number | null
          pack_size_text?: string | null
          pack_source_kind?: string | null
          product_fingerprint?: string
          product_name?: string
          source_origin?: string
          subcategory?: string | null
          updated_at?: string
          updated_by?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_product_v1_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_brand_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_review_queue_v1: {
        Row: {
          assigned_to: string | null
          created_by: string | null
          detail: string | null
          id: string
          opened_at: string
          product_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          review_type: string
          severity: string
          source_context: Json
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_by?: string | null
          detail?: string | null
          id?: string
          opened_at?: string
          product_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          review_type: string
          severity?: string
          source_context?: Json
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_by?: string | null
          detail?: string | null
          id?: string
          opened_at?: string
          product_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          review_type?: string
          severity?: string
          source_context?: Json
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_review_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_review_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_catalog_safety_assessment_v1: {
        Row: {
          assessment_status: string
          assessment_version: string
          child_score: number | null
          created_at: string
          created_by: string | null
          determination_confidence: number | null
          determination_source: string
          determined_at: string
          expires_at: string | null
          id: string
          ingredient_snapshot_sha256: string | null
          is_current: boolean
          overall_score: number | null
          override_reason: string | null
          pregnancy_score: number | null
          product_id: string
          regulatory_snapshot_ref: string | null
          senior_score: number | null
          summary: string | null
          warnings: Json
        }
        Insert: {
          assessment_status: string
          assessment_version: string
          child_score?: number | null
          created_at?: string
          created_by?: string | null
          determination_confidence?: number | null
          determination_source?: string
          determined_at?: string
          expires_at?: string | null
          id?: string
          ingredient_snapshot_sha256?: string | null
          is_current?: boolean
          overall_score?: number | null
          override_reason?: string | null
          pregnancy_score?: number | null
          product_id: string
          regulatory_snapshot_ref?: string | null
          senior_score?: number | null
          summary?: string | null
          warnings?: Json
        }
        Update: {
          assessment_status?: string
          assessment_version?: string
          child_score?: number | null
          created_at?: string
          created_by?: string | null
          determination_confidence?: number | null
          determination_source?: string
          determined_at?: string
          expires_at?: string | null
          id?: string
          ingredient_snapshot_sha256?: string | null
          is_current?: boolean
          overall_score?: number | null
          override_reason?: string | null
          pregnancy_score?: number | null
          product_id?: string
          regulatory_snapshot_ref?: string | null
          senior_score?: number | null
          summary?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sp_catalog_safety_assessment_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_catalog_safety_assessment_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_m1b_engine_attempt_v1: {
        Row: {
          cost_usd: number | null
          created_at: string
          detail: Json
          engine: string
          failure_code: string | null
          id: string
          latency_ms: number | null
          metrics: Json
          ocr_calls: number
          run_id: string
          search_calls: number
          stage: string
          status: string
          vlm_calls: number
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          detail?: Json
          engine: string
          failure_code?: string | null
          id?: string
          latency_ms?: number | null
          metrics?: Json
          ocr_calls?: number
          run_id: string
          search_calls?: number
          stage: string
          status: string
          vlm_calls?: number
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          detail?: Json
          engine?: string
          failure_code?: string | null
          id?: string
          latency_ms?: number | null
          metrics?: Json
          ocr_calls?: number
          run_id?: string
          search_calls?: number
          stage?: string
          status?: string
          vlm_calls?: number
        }
        Relationships: [
          {
            foreignKeyName: "sp_m1b_engine_attempt_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_m1b_run_v1: {
        Row: {
          benchmark_sealed_at: string | null
          benchmark_slot_id: string | null
          context: string
          created_at: string
          displayed_at: string | null
          final_ingredient_status: string | null
          id: string
          m1b_failure_code: string | null
          m1b_status: string
          m1br_status: string
          metrics_recorded_at: string | null
          product_fingerprint: string
          product_id: string | null
          promoted_at: string | null
          promotion_status: string
          session_key_hash: string | null
          updated_at: string
        }
        Insert: {
          benchmark_sealed_at?: string | null
          benchmark_slot_id?: string | null
          context: string
          created_at?: string
          displayed_at?: string | null
          final_ingredient_status?: string | null
          id?: string
          m1b_failure_code?: string | null
          m1b_status?: string
          m1br_status?: string
          metrics_recorded_at?: string | null
          product_fingerprint: string
          product_id?: string | null
          promoted_at?: string | null
          promotion_status?: string
          session_key_hash?: string | null
          updated_at?: string
        }
        Update: {
          benchmark_sealed_at?: string | null
          benchmark_slot_id?: string | null
          context?: string
          created_at?: string
          displayed_at?: string | null
          final_ingredient_status?: string | null
          id?: string
          m1b_failure_code?: string | null
          m1b_status?: string
          m1br_status?: string
          metrics_recorded_at?: string | null
          product_fingerprint?: string
          product_id?: string | null
          promoted_at?: string | null
          promotion_status?: string
          session_key_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_m1b_run_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_m1b_run_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_m1br_recovery_queue_v1: {
        Row: {
          attempt_count: number
          created_at: string
          failure_code: string | null
          id: string
          last_error_code: string | null
          last_error_detail: string | null
          locked_at: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          priority: string
          product_id: string | null
          result: Json
          run_id: string
          status: string
          updated_at: string
          worker_code: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          failure_code?: string | null
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          priority?: string
          product_id?: string | null
          result?: Json
          run_id: string
          status?: string
          updated_at?: string
          worker_code?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          failure_code?: string | null
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          locked_at?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          priority?: string
          product_id?: string | null
          result?: Json
          run_id?: string
          status?: string
          updated_at?: string
          worker_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_m1br_recovery_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_m1br_recovery_queue_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_m1br_recovery_queue_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_prod1_canonical_resolution_evidence_v1: {
        Row: {
          alias_name: string
          canonical_name: string
          created_at: string
          evidence_kind: string
          evidence_note: string | null
          evidence_url: string
          status: string
        }
        Insert: {
          alias_name: string
          canonical_name: string
          created_at?: string
          evidence_kind: string
          evidence_note?: string | null
          evidence_url: string
          status?: string
        }
        Update: {
          alias_name?: string
          canonical_name?: string
          created_at?: string
          evidence_kind?: string
          evidence_note?: string | null
          evidence_url?: string
          status?: string
        }
        Relationships: []
      }
      sp_prod1_h46_compliance_rule_v1: {
        Row: {
          active: boolean
          authority: string
          compliance_penalty: number
          created_at: string
          dimension: string
          domain: string
          effective_from: string | null
          effective_to: string | null
          hard_zero_on_violation: boolean
          legal_status: string
          machine_evaluable: boolean
          product_category: string
          required_evidence_fields: Json
          rule_code: string
          rule_json: Json
          safety_penalty: number
          severity: string
          source_code: string
          source_reference: string | null
          source_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          authority: string
          compliance_penalty?: number
          created_at?: string
          dimension: string
          domain: string
          effective_from?: string | null
          effective_to?: string | null
          hard_zero_on_violation?: boolean
          legal_status: string
          machine_evaluable?: boolean
          product_category?: string
          required_evidence_fields?: Json
          rule_code: string
          rule_json?: Json
          safety_penalty?: number
          severity: string
          source_code: string
          source_reference?: string | null
          source_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          authority?: string
          compliance_penalty?: number
          created_at?: string
          dimension?: string
          domain?: string
          effective_from?: string | null
          effective_to?: string | null
          hard_zero_on_violation?: boolean
          legal_status?: string
          machine_evaluable?: boolean
          product_category?: string
          required_evidence_fields?: Json
          rule_code?: string
          rule_json?: Json
          safety_penalty?: number
          severity?: string
          source_code?: string
          source_reference?: string | null
          source_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_prod1_h46b_coverage_observation_v1: {
        Row: {
          canonical_name: string
          declared_amount: number | null
          declared_unit: string | null
          id: number
          input_name: string
          match_method: string
          normalized_input: string
          observed_at: string
          product_fingerprint: string
          product_title: string | null
          regulatory_limits: Json
          search_id: string
          standard_id: string | null
          standard_row_id: number | null
        }
        Insert: {
          canonical_name: string
          declared_amount?: number | null
          declared_unit?: string | null
          id?: number
          input_name: string
          match_method: string
          normalized_input: string
          observed_at?: string
          product_fingerprint: string
          product_title?: string | null
          regulatory_limits?: Json
          search_id: string
          standard_id?: string | null
          standard_row_id?: number | null
        }
        Update: {
          canonical_name?: string
          declared_amount?: number | null
          declared_unit?: string | null
          id?: number
          input_name?: string
          match_method?: string
          normalized_input?: string
          observed_at?: string
          product_fingerprint?: string
          product_title?: string | null
          regulatory_limits?: Json
          search_id?: string
          standard_id?: string | null
          standard_row_id?: number | null
        }
        Relationships: []
      }
      sp_prod1_h46b_healthcare_alias_v1: {
        Row: {
          alias_name: string
          alias_normalized: string
          canonical_name: string
          created_at: string
          source_basis: string
        }
        Insert: {
          alias_name: string
          alias_normalized: string
          canonical_name: string
          created_at?: string
          source_basis?: string
        }
        Update: {
          alias_name?: string
          alias_normalized?: string
          canonical_name?: string
          created_at?: string
          source_basis?: string
        }
        Relationships: []
      }
      sp_prod1_ingredient_alias_integrity_audit_v1: {
        Row: {
          ambiguous_alias_keys: number
          assertion_status: string
          audit_version: string
          created_at: string
          distinct_alias_keys: number
          exact_canonical_disambiguated_keys: number
          fail_closed_ambiguous_keys: number
          findings: Json
          id: number
          malformed_normalized_keys: number
          total_alias_rows: number
          unique_alias_keys: number
        }
        Insert: {
          ambiguous_alias_keys: number
          assertion_status: string
          audit_version?: string
          created_at?: string
          distinct_alias_keys: number
          exact_canonical_disambiguated_keys: number
          fail_closed_ambiguous_keys: number
          findings?: Json
          id?: never
          malformed_normalized_keys: number
          total_alias_rows: number
          unique_alias_keys: number
        }
        Update: {
          ambiguous_alias_keys?: number
          assertion_status?: string
          audit_version?: string
          created_at?: string
          distinct_alias_keys?: number
          exact_canonical_disambiguated_keys?: number
          fail_closed_ambiguous_keys?: number
          findings?: Json
          id?: never
          malformed_normalized_keys?: number
          total_alias_rows?: number
          unique_alias_keys?: number
        }
        Relationships: []
      }
      sp_prod1_ingredient_alias_integrity_change_v1: {
        Row: {
          after_key: string | null
          alias_name: string | null
          before_key: string | null
          canonical_name: string | null
          change_control: string
          change_type: string
          changed_at: string
          id: number
          ingredient_alias_id: number | null
          rationale: string
        }
        Insert: {
          after_key?: string | null
          alias_name?: string | null
          before_key?: string | null
          canonical_name?: string | null
          change_control?: string
          change_type: string
          changed_at?: string
          id?: never
          ingredient_alias_id?: number | null
          rationale: string
        }
        Update: {
          after_key?: string | null
          alias_name?: string | null
          before_key?: string | null
          canonical_name?: string | null
          change_control?: string
          change_type?: string
          changed_at?: string
          id?: never
          ingredient_alias_id?: number | null
          rationale?: string
        }
        Relationships: []
      }
      sp_prod1_ingredient_alias_integrity_exception_v1: {
        Row: {
          active: boolean
          approved_at: string
          contract: string
          exception_type: string
          id: number
          ingredient_alias_id: number
          rationale: string
          source_basis: string | null
        }
        Insert: {
          active?: boolean
          approved_at?: string
          contract?: string
          exception_type: string
          id?: never
          ingredient_alias_id: number
          rationale: string
          source_basis?: string | null
        }
        Update: {
          active?: boolean
          approved_at?: string
          contract?: string
          exception_type?: string
          id?: never
          ingredient_alias_id?: number
          rationale?: string
          source_basis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_prod1_ingredient_alias_integrity_ex_ingredient_alias_id_fkey"
            columns: ["ingredient_alias_id"]
            isOneToOne: true
            referencedRelation: "ingredient_aliases"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_prod1_ingredient_evidence_quality_audit_v1: {
        Row: {
          action: string
          created_at: string
          evidence_contract: string
          id: number
          ingredient_source_id: number | null
          product_fingerprint: string | null
          quality_result: Json
          search_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          evidence_contract?: string
          id?: never
          ingredient_source_id?: number | null
          product_fingerprint?: string | null
          quality_result: Json
          search_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          evidence_contract?: string
          id?: never
          ingredient_source_id?: number | null
          product_fingerprint?: string | null
          quality_result?: Json
          search_id?: string | null
        }
        Relationships: []
      }
      sp_prod1_ingredient_qualification_v1: {
        Row: {
          cache_eligible: boolean
          created_at: string
          currency: string | null
          decision: string
          discovery_rank: number | null
          extraction_confidence: number
          id: number
          immersive_api: string | null
          ingredient_confidence: number
          ingredient_count: number
          merchant_class: string | null
          merchant_name: string
          merchant_score: number | null
          monetization_considered: boolean
          normalized_title: string | null
          overall_confidence: number
          pool_count: number
          price: number | null
          price_text: string | null
          priority: number | null
          product_fingerprint: string
          product_link: string | null
          qualification_order: number
          railway_response: Json
          reject_reason: string | null
          resolved_offer: Json
          response_status: string | null
          search_id: string
          selected_for_safety: boolean
          source_confidence: number
          thumbnail: string | null
          title: string
          trusted_source: boolean
          updated_at: string
        }
        Insert: {
          cache_eligible?: boolean
          created_at?: string
          currency?: string | null
          decision: string
          discovery_rank?: number | null
          extraction_confidence?: number
          id?: never
          immersive_api?: string | null
          ingredient_confidence?: number
          ingredient_count?: number
          merchant_class?: string | null
          merchant_name: string
          merchant_score?: number | null
          monetization_considered?: boolean
          normalized_title?: string | null
          overall_confidence?: number
          pool_count: number
          price?: number | null
          price_text?: string | null
          priority?: number | null
          product_fingerprint: string
          product_link?: string | null
          qualification_order: number
          railway_response?: Json
          reject_reason?: string | null
          resolved_offer?: Json
          response_status?: string | null
          search_id: string
          selected_for_safety?: boolean
          source_confidence?: number
          thumbnail?: string | null
          title: string
          trusted_source?: boolean
          updated_at?: string
        }
        Update: {
          cache_eligible?: boolean
          created_at?: string
          currency?: string | null
          decision?: string
          discovery_rank?: number | null
          extraction_confidence?: number
          id?: never
          immersive_api?: string | null
          ingredient_confidence?: number
          ingredient_count?: number
          merchant_class?: string | null
          merchant_name?: string
          merchant_score?: number | null
          monetization_considered?: boolean
          normalized_title?: string | null
          overall_confidence?: number
          pool_count?: number
          price?: number | null
          price_text?: string | null
          priority?: number | null
          product_fingerprint?: string
          product_link?: string | null
          qualification_order?: number
          railway_response?: Json
          reject_reason?: string | null
          resolved_offer?: Json
          response_status?: string | null
          search_id?: string
          selected_for_safety?: boolean
          source_confidence?: number
          thumbnail?: string | null
          title?: string
          trusted_source?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      sp_prod1_merchant_alias: {
        Row: {
          alias_normalized: string
          created_at: string
          is_active: boolean
          merchant_id: number
          notes: string | null
        }
        Insert: {
          alias_normalized: string
          created_at?: string
          is_active?: boolean
          merchant_id: number
          notes?: string | null
        }
        Update: {
          alias_normalized?: string
          created_at?: string
          is_active?: boolean
          merchant_id?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_prod1_merchant_alias_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_master"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_prod1_regulatory_research_observation_v1: {
        Row: {
          canonical_name: string
          id: number
          input_name: string
          normalized_canonical_name: string
          normalized_input: string
          observed_at: string
          product_fingerprint: string
          product_title: string | null
          queue_id: number
          search_id: string
        }
        Insert: {
          canonical_name: string
          id?: never
          input_name: string
          normalized_canonical_name: string
          normalized_input: string
          observed_at?: string
          product_fingerprint: string
          product_title?: string | null
          queue_id: number
          search_id: string
        }
        Update: {
          canonical_name?: string
          id?: never
          input_name?: string
          normalized_canonical_name?: string
          normalized_input?: string
          observed_at?: string
          product_fingerprint?: string
          product_title?: string | null
          queue_id?: number
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_prod1_regulatory_research_observation_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_prod1_regulatory_research_observation_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_prod1_regulatory_research_observation_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      sp_prod1_verified_ingredient_source_alias_v1: {
        Row: {
          alias_key: string
          alias_kind: string
          created_at: string
          source_code: string
        }
        Insert: {
          alias_key: string
          alias_kind?: string
          created_at?: string
          source_code: string
        }
        Update: {
          alias_key?: string
          alias_kind?: string
          created_at?: string
          source_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_prod1_verified_ingredient_source_alias_v1_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "sp_prod1_verified_ingredient_source_v1"
            referencedColumns: ["source_code"]
          },
        ]
      }
      sp_prod1_verified_ingredient_source_v1: {
        Row: {
          active: boolean
          brand_key: string
          canonical_product_name: string
          created_at: string
          evidence_basis: string
          source_code: string
          source_confidence: number
          source_domain: string
          source_type: string
          source_url: string
          updated_at: string
          verification_status: string
          verified_at: string
        }
        Insert: {
          active?: boolean
          brand_key: string
          canonical_product_name: string
          created_at?: string
          evidence_basis: string
          source_code: string
          source_confidence: number
          source_domain: string
          source_type: string
          source_url: string
          updated_at?: string
          verification_status?: string
          verified_at?: string
        }
        Update: {
          active?: boolean
          brand_key?: string
          canonical_product_name?: string
          created_at?: string
          evidence_basis?: string
          source_code?: string
          source_confidence?: number
          source_domain?: string
          source_type?: string
          source_url?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string
        }
        Relationships: []
      }
      sp_regulatory_research_evidence_v1: {
        Row: {
          authority: string | null
          created_at: string
          evidence_status: string
          evidence_summary: string | null
          id: string
          jurisdiction: string | null
          legal_force: string | null
          machine_confidence: number | null
          normalized_canonical_name: string
          publication_date: string | null
          queue_id: number
          raw_payload: Json
          retrieved_at: string
          source_sha256: string
          source_title: string | null
          source_url: string
          worker_version: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          evidence_status?: string
          evidence_summary?: string | null
          id?: string
          jurisdiction?: string | null
          legal_force?: string | null
          machine_confidence?: number | null
          normalized_canonical_name: string
          publication_date?: string | null
          queue_id: number
          raw_payload?: Json
          retrieved_at?: string
          source_sha256: string
          source_title?: string | null
          source_url: string
          worker_version: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          evidence_status?: string
          evidence_summary?: string | null
          id?: string
          jurisdiction?: string | null
          legal_force?: string | null
          machine_confidence?: number | null
          normalized_canonical_name?: string
          publication_date?: string | null
          queue_id?: number
          raw_payload?: Json
          retrieved_at?: string
          source_sha256?: string
          source_title?: string | null
          source_url?: string
          worker_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_regulatory_research_evidence_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_regulatory_research_evidence_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_regulatory_research_evidence_v1_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      sp_safety_calibration_certificate_v1: {
        Row: {
          bias_and_subgroup_report_url: string
          calibration_signed_at: string
          calibrator_id: string
          clinical_endpoint_description: string
          independent_numeric_reference: boolean
          number_semantics: string
          numeric_holdout_count: number
          policy_sha256: string
          rubric_sha256: string
          study_id: string
          validation_report_url: string
        }
        Insert: {
          bias_and_subgroup_report_url: string
          calibration_signed_at?: string
          calibrator_id: string
          clinical_endpoint_description: string
          independent_numeric_reference: boolean
          number_semantics: string
          numeric_holdout_count: number
          policy_sha256: string
          rubric_sha256: string
          study_id: string
          validation_report_url: string
        }
        Update: {
          bias_and_subgroup_report_url?: string
          calibration_signed_at?: string
          calibrator_id?: string
          clinical_endpoint_description?: string
          independent_numeric_reference?: boolean
          number_semantics?: string
          numeric_holdout_count?: number
          policy_sha256?: string
          rubric_sha256?: string
          study_id?: string
          validation_report_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_calibration_certificate_v1_calibrator_id_fkey"
            columns: ["calibrator_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_reviewer_v1"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "sp_safety_calibration_certificate_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: true
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_score_canary_observation_v1: {
        Row: {
          candidate_numeric_score_exposed: boolean
          collected_at: string
          evidence_policy_version: string
          id: string
          main_safety_score_written: boolean
          observations: Json
          product_scope: string | null
          profile: string | null
          result: string
          stage: string
          study_id: string | null
        }
        Insert: {
          candidate_numeric_score_exposed?: boolean
          collected_at?: string
          evidence_policy_version: string
          id?: string
          main_safety_score_written?: boolean
          observations: Json
          product_scope?: string | null
          profile?: string | null
          result: string
          stage: string
          study_id?: string | null
        }
        Update: {
          candidate_numeric_score_exposed?: boolean
          collected_at?: string
          evidence_policy_version?: string
          id?: string
          main_safety_score_written?: boolean
          observations?: Json
          product_scope?: string | null
          profile?: string | null
          result?: string
          stage?: string
          study_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_score_canary_observation_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_attestation_v1: {
        Row: {
          decision: string
          evidence_url: string
          rationale: string
          reviewer_id: string
          role: string
          signed_at: string
          study_id: string
        }
        Insert: {
          decision: string
          evidence_url: string
          rationale: string
          reviewer_id: string
          role: string
          signed_at?: string
          study_id: string
        }
        Update: {
          decision?: string
          evidence_url?: string
          rationale?: string
          reviewer_id?: string
          role?: string
          signed_at?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_attestation_v1_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_reviewer_v1"
            referencedColumns: ["reviewer_id"]
          },
          {
            foreignKeyName: "sp_safety_validation_attestation_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_case_v1: {
        Row: {
          applicable_law_url: string
          case_group: string
          case_key: string
          country_code: string
          created_at: string
          external_evidence_url: string
          id: string
          is_external_holdout: boolean
          label_facts: Json
          profile: string
          scope: string
          study_id: string
        }
        Insert: {
          applicable_law_url: string
          case_group: string
          case_key: string
          country_code?: string
          created_at?: string
          external_evidence_url: string
          id?: string
          is_external_holdout?: boolean
          label_facts: Json
          profile: string
          scope: string
          study_id: string
        }
        Update: {
          applicable_law_url?: string
          case_group?: string
          case_key?: string
          country_code?: string
          created_at?: string
          external_evidence_url?: string
          id?: string
          is_external_holdout?: boolean
          label_facts?: Json
          profile?: string
          scope?: string
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_case_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_judgement_v1: {
        Row: {
          case_id: string
          dimension: string
          evidence_url: string
          label: string
          rationale: string
          reviewed_at: string
          reviewer_id: string
        }
        Insert: {
          case_id: string
          dimension: string
          evidence_url: string
          label: string
          rationale: string
          reviewed_at?: string
          reviewer_id: string
        }
        Update: {
          case_id?: string
          dimension?: string
          evidence_url?: string
          label?: string
          rationale?: string
          reviewed_at?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_judgement_v1_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_case_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_safety_validation_judgement_v1_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_reviewer_v1"
            referencedColumns: ["reviewer_id"]
          },
        ]
      }
      sp_safety_validation_metric_v1: {
        Row: {
          assessed_at: string
          benchmark_status: string
          false_regulatory_permission_count: number
          false_safe_count: number
          gold_agreement_cases: number
          high_concern_cases: number
          high_concern_recall: number
          prediction_coverage: number
          study_id: string
          total: number
        }
        Insert: {
          assessed_at?: string
          benchmark_status: string
          false_regulatory_permission_count: number
          false_safe_count: number
          gold_agreement_cases: number
          high_concern_cases: number
          high_concern_recall: number
          prediction_coverage: number
          study_id: string
          total: number
        }
        Update: {
          assessed_at?: string
          benchmark_status?: string
          false_regulatory_permission_count?: number
          false_safe_count?: number
          gold_agreement_cases?: number
          high_concern_cases?: number
          high_concern_recall?: number
          prediction_coverage?: number
          study_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_metric_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: true
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_prediction_v1: {
        Row: {
          case_id: string
          clinical_label: string
          model_policy_sha256: string
          predicted_at: string
          proposed_score: number | null
          regulatory_label: string
        }
        Insert: {
          case_id: string
          clinical_label: string
          model_policy_sha256: string
          predicted_at?: string
          proposed_score?: number | null
          regulatory_label: string
        }
        Update: {
          case_id?: string
          clinical_label?: string
          model_policy_sha256?: string
          predicted_at?: string
          proposed_score?: number | null
          regulatory_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_prediction_v1_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "sp_safety_validation_case_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_release_event_v1: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string
          event: string
          id: number
          study_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail: string
          event: string
          id?: never
          study_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string
          event?: string
          id?: never
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_safety_validation_release_event_v1_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "sp_safety_validation_study_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_safety_validation_reviewer_v1: {
        Row: {
          active: boolean
          credential_reference: string
          enrolled_at: string
          independently_verified_at: string
          is_product_builder: boolean
          organization: string
          reviewer_id: string
          role: string
        }
        Insert: {
          active?: boolean
          credential_reference: string
          enrolled_at?: string
          independently_verified_at: string
          is_product_builder?: boolean
          organization: string
          reviewer_id: string
          role: string
        }
        Update: {
          active?: boolean
          credential_reference?: string
          enrolled_at?: string
          independently_verified_at?: string
          is_product_builder?: boolean
          organization?: string
          reviewer_id?: string
          role?: string
        }
        Relationships: []
      }
      sp_safety_validation_study_v1: {
        Row: {
          active_at: string | null
          code: string
          code_commit_sha: string
          created_at: string
          dataset_sha256: string
          expiry_at: string | null
          frozen_at: string | null
          id: string
          policy_sha256: string
          revoked_at: string | null
          scope: string
          shadow_passed_at: string | null
          status: string
        }
        Insert: {
          active_at?: string | null
          code: string
          code_commit_sha: string
          created_at?: string
          dataset_sha256: string
          expiry_at?: string | null
          frozen_at?: string | null
          id?: string
          policy_sha256: string
          revoked_at?: string | null
          scope: string
          shadow_passed_at?: string | null
          status?: string
        }
        Update: {
          active_at?: string | null
          code?: string
          code_commit_sha?: string
          created_at?: string
          dataset_sha256?: string
          expiry_at?: string | null
          frozen_at?: string | null
          id?: string
          policy_sha256?: string
          revoked_at?: string | null
          scope?: string
          shadow_passed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sp_us2_acquisition_request_v1: {
        Row: {
          anchor_product_id: string | null
          attempt_count: number
          category: string | null
          comparison_pack_key: string | null
          completed_at: string | null
          contract_version: string
          created_at: string
          dedupe_key: string
          dispatched_at: string | null
          id: string
          last_error_code: string | null
          max_attempts: number
          next_attempt_at: string
          normalized_query: string
          payload: Json
          requested_pack_key: string | null
          result_summary: Json | null
          search_mode: string
          status: string
          target_alternatives: number
          target_category_products: number
          target_exact_offers: number
          updated_at: string
        }
        Insert: {
          anchor_product_id?: string | null
          attempt_count?: number
          category?: string | null
          comparison_pack_key?: string | null
          completed_at?: string | null
          contract_version?: string
          created_at?: string
          dedupe_key: string
          dispatched_at?: string | null
          id?: string
          last_error_code?: string | null
          max_attempts?: number
          next_attempt_at?: string
          normalized_query: string
          payload?: Json
          requested_pack_key?: string | null
          result_summary?: Json | null
          search_mode: string
          status?: string
          target_alternatives?: number
          target_category_products?: number
          target_exact_offers?: number
          updated_at?: string
        }
        Update: {
          anchor_product_id?: string | null
          attempt_count?: number
          category?: string | null
          comparison_pack_key?: string | null
          completed_at?: string | null
          contract_version?: string
          created_at?: string
          dedupe_key?: string
          dispatched_at?: string | null
          id?: string
          last_error_code?: string | null
          max_attempts?: number
          next_attempt_at?: string
          normalized_query?: string
          payload?: Json
          requested_pack_key?: string | null
          result_summary?: Json | null
          search_mode?: string
          status?: string
          target_alternatives?: number
          target_category_products?: number
          target_exact_offers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_us2_acquisition_request_v1_anchor_product_id_fkey"
            columns: ["anchor_product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_us2_acquisition_request_v1_anchor_product_id_fkey"
            columns: ["anchor_product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_us2_live_safety_enrichment_claim_v1: {
        Row: {
          claim_count: number
          last_claimed_at: string
          last_status: string
          product_id: string
          updated_at: string
        }
        Insert: {
          claim_count?: number
          last_claimed_at?: string
          last_status?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          claim_count?: number
          last_claimed_at?: string
          last_status?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_us2_live_safety_enrichment_claim_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_us2_live_safety_enrichment_claim_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_us2_paid_discovery_budget_v1: {
        Row: {
          claim_count: number
          scope_key: string
          updated_at: string
          window_kind: string
          window_start: string
        }
        Insert: {
          claim_count?: number
          scope_key: string
          updated_at?: string
          window_kind: string
          window_start: string
        }
        Update: {
          claim_count?: number
          scope_key?: string
          updated_at?: string
          window_kind?: string
          window_start?: string
        }
        Relationships: []
      }
      sp_us2_safety_provider_lease_v1: {
        Row: {
          holder_id: string | null
          lease_key: string
          lease_until: string | null
          updated_at: string
        }
        Insert: {
          holder_id?: string | null
          lease_key: string
          lease_until?: string | null
          updated_at?: string
        }
        Update: {
          holder_id?: string | null
          lease_key?: string
          lease_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sp_us2_spend_cap_v1: {
        Row: {
          daily_cap: number
          enabled: boolean
          notes: string | null
          per_client_hourly_cap: number | null
          provider: string
          updated_at: string
        }
        Insert: {
          daily_cap: number
          enabled?: boolean
          notes?: string | null
          per_client_hourly_cap?: number | null
          provider: string
          updated_at?: string
        }
        Update: {
          daily_cap?: number
          enabled?: boolean
          notes?: string | null
          per_client_hourly_cap?: number | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_us2_spend_client_window_v1: {
        Row: {
          client_key: string
          provider: string
          units_used: number
          window_start: string
        }
        Insert: {
          client_key: string
          provider: string
          units_used?: number
          window_start: string
        }
        Update: {
          client_key?: string
          provider?: string
          units_used?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_us2_spend_client_window_v1_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "sp_us2_spend_cap_v1"
            referencedColumns: ["provider"]
          },
        ]
      }
      sp_us2_spend_ledger_v1: {
        Row: {
          day: string
          provider: string
          units_used: number
          updated_at: string
        }
        Insert: {
          day: string
          provider: string
          units_used?: number
          updated_at?: string
        }
        Update: {
          day?: string
          provider?: string
          units_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_us2_spend_ledger_v1_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "sp_us2_spend_cap_v1"
            referencedColumns: ["provider"]
          },
        ]
      }
      sp_voice_transcribe_rate_v1: {
        Row: {
          bucket: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      sp_web_admin_audit_v1: {
        Row: {
          action: string
          actor_user_id: string | null
          audit_id: number
          new_row: Json | null
          occurred_at: string
          old_row: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          audit_id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          audit_id?: never
          new_row?: Json | null
          occurred_at?: string
          old_row?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      sp_web_browse_seed_catalog_v1: {
        Row: {
          active: boolean
          brand_name: string | null
          browse_bucket: string
          category_label: string
          created_at: string
          evidence_note: string
          id: string
          image_url: string | null
          product_name: string
          source_url: string
          verified_at: string
        }
        Insert: {
          active?: boolean
          brand_name?: string | null
          browse_bucket: string
          category_label: string
          created_at?: string
          evidence_note: string
          id?: string
          image_url?: string | null
          product_name: string
          source_url: string
          verified_at?: string
        }
        Update: {
          active?: boolean
          brand_name?: string | null
          browse_bucket?: string
          category_label?: string
          created_at?: string
          evidence_note?: string
          id?: string
          image_url?: string | null
          product_name?: string
          source_url?: string
          verified_at?: string
        }
        Relationships: []
      }
      sp_web_contact_submissions_v1: {
        Row: {
          attachment_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
          purpose: string
          source_system: string
          status: string
          subject: string
          user_type: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
          purpose: string
          source_system?: string
          status?: string
          subject: string
          user_type: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
          purpose?: string
          source_system?: string
          status?: string
          subject?: string
          user_type?: string
        }
        Relationships: []
      }
      sp_web_guidelines_v1: {
        Row: {
          age_specifics: string | null
          body: string
          content: string | null
          created_at: string
          display_order: number
          id: string
          profile: string
          source_note: string | null
          source_system: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          age_specifics?: string | null
          body?: string
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          profile: string
          source_note?: string | null
          source_system?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          age_specifics?: string | null
          body?: string
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          profile?: string
          source_note?: string | null
          source_system?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sp_web_label_ai_rate_limit_v1: {
        Row: {
          last_request_at: string
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          last_request_at?: string
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          last_request_at?: string
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      sp_web_label_analyses_v1: {
        Row: {
          analysed_at: string
          confidence_adjustment: number | null
          detected_ingredients: Json
          engine_version: string | null
          evidence_coverage: number | null
          id: string
          image_sha256: string | null
          ingredient_breakdown: Json
          product_scope: string | null
          profile_used: string | null
          regulatory_screen_score: number | null
          research_pending_count: number | null
          resolution_snapshot: Json | null
          safety_score: number | null
          safety_score_raw: number | null
          score_policy_version: string | null
          session_id: string | null
          source_system: string
          summary: string | null
          uploaded_image_url: string | null
          warnings: Json
        }
        Insert: {
          analysed_at?: string
          confidence_adjustment?: number | null
          detected_ingredients?: Json
          engine_version?: string | null
          evidence_coverage?: number | null
          id?: string
          image_sha256?: string | null
          ingredient_breakdown?: Json
          product_scope?: string | null
          profile_used?: string | null
          regulatory_screen_score?: number | null
          research_pending_count?: number | null
          resolution_snapshot?: Json | null
          safety_score?: number | null
          safety_score_raw?: number | null
          score_policy_version?: string | null
          session_id?: string | null
          source_system?: string
          summary?: string | null
          uploaded_image_url?: string | null
          warnings?: Json
        }
        Update: {
          analysed_at?: string
          confidence_adjustment?: number | null
          detected_ingredients?: Json
          engine_version?: string | null
          evidence_coverage?: number | null
          id?: string
          image_sha256?: string | null
          ingredient_breakdown?: Json
          product_scope?: string | null
          profile_used?: string | null
          regulatory_screen_score?: number | null
          research_pending_count?: number | null
          resolution_snapshot?: Json | null
          safety_score?: number | null
          safety_score_raw?: number | null
          score_policy_version?: string | null
          session_id?: string | null
          source_system?: string
          summary?: string | null
          uploaded_image_url?: string | null
          warnings?: Json
        }
        Relationships: []
      }
      sp_web_label_clinical_screen_v1: {
        Row: {
          created_at: string
          details: Json
          owner_id: string
          run_id: string
          scan_id: string
          score: number | null
          status: string
          version: string
        }
        Insert: {
          created_at?: string
          details: Json
          owner_id: string
          run_id: string
          scan_id: string
          score?: number | null
          status: string
          version: string
        }
        Update: {
          created_at?: string
          details?: Json
          owner_id?: string
          run_id?: string
          scan_id?: string
          score?: number | null
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_label_clinical_screen_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_web_label_clinical_screen_v1_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "sp_web_label_pack_scan_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_label_front_asset_v1: {
        Row: {
          byte_count: number
          created_at: string
          front_sha256: string
          mime_type: string
          owner_id: string
          scan_id: string
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          byte_count: number
          created_at?: string
          front_sha256: string
          mime_type: string
          owner_id: string
          scan_id: string
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          byte_count?: number
          created_at?: string
          front_sha256?: string
          mime_type?: string
          owner_id?: string
          scan_id?: string
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_label_front_asset_v1_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "sp_web_label_pack_scan_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_label_identity_research_v1: {
        Row: {
          display_name: string
          first_seen_at: string
          gril_canonical_name: string | null
          gril_identity_id: number | null
          identity_resolution_status: string
          last_evidence: Json
          last_product_scope: string | null
          last_seen_at: string
          normalized_input: string
          occurrence_count: number
          pubchem_cid: number | null
          pubchem_inchi_key: string | null
          pubchem_is_discrete: boolean | null
          pubchem_iupac_name: string | null
          pubchem_status: string
          pubchem_title: string | null
          regulatory_resolution_status: string
          research_status: string
        }
        Insert: {
          display_name: string
          first_seen_at?: string
          gril_canonical_name?: string | null
          gril_identity_id?: number | null
          identity_resolution_status?: string
          last_evidence?: Json
          last_product_scope?: string | null
          last_seen_at?: string
          normalized_input: string
          occurrence_count?: number
          pubchem_cid?: number | null
          pubchem_inchi_key?: string | null
          pubchem_is_discrete?: boolean | null
          pubchem_iupac_name?: string | null
          pubchem_status?: string
          pubchem_title?: string | null
          regulatory_resolution_status?: string
          research_status?: string
        }
        Update: {
          display_name?: string
          first_seen_at?: string
          gril_canonical_name?: string | null
          gril_identity_id?: number | null
          identity_resolution_status?: string
          last_evidence?: Json
          last_product_scope?: string | null
          last_seen_at?: string
          normalized_input?: string
          occurrence_count?: number
          pubchem_cid?: number | null
          pubchem_inchi_key?: string | null
          pubchem_is_discrete?: boolean | null
          pubchem_iupac_name?: string | null
          pubchem_status?: string
          pubchem_title?: string | null
          regulatory_resolution_status?: string
          research_status?: string
        }
        Relationships: []
      }
      sp_web_label_multi_source_evidence_v1: {
        Row: {
          created_at: string
          evidence_version: string
          owner_id: string
          qualification: string
          report: Json
          run_id: string
          scan_id: string
        }
        Insert: {
          created_at?: string
          evidence_version: string
          owner_id: string
          qualification: string
          report: Json
          run_id: string
          scan_id: string
        }
        Update: {
          created_at?: string
          evidence_version?: string
          owner_id?: string
          qualification?: string
          report?: Json
          run_id?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_label_multi_source_evidence_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_web_label_multi_source_evidence_v1_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: true
            referencedRelation: "sp_web_label_pack_scan_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_label_pack_scan_v1: {
        Row: {
          created_at: string
          detected_ingredients: Json
          engine_version: string
          evidence_coverage: number | null
          front_sha256: string
          id: string
          ingredient_breakdown: Json
          ingredient_sha256: string
          owner_id: string
          product_id: string
          profile_used: string
          run_id: string
          score_policy_version: string | null
          score_status: string
          screening_score: number | null
          warnings: Json
        }
        Insert: {
          created_at?: string
          detected_ingredients?: Json
          engine_version?: string
          evidence_coverage?: number | null
          front_sha256: string
          id?: string
          ingredient_breakdown?: Json
          ingredient_sha256: string
          owner_id: string
          product_id: string
          profile_used: string
          run_id: string
          score_policy_version?: string | null
          score_status: string
          screening_score?: number | null
          warnings?: Json
        }
        Update: {
          created_at?: string
          detected_ingredients?: Json
          engine_version?: string
          evidence_coverage?: number | null
          front_sha256?: string
          id?: string
          ingredient_breakdown?: Json
          ingredient_sha256?: string
          owner_id?: string
          product_id?: string
          profile_used?: string
          run_id?: string
          score_policy_version?: string | null
          score_status?: string
          screening_score?: number | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_label_pack_scan_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_unified_v1"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sp_web_label_pack_scan_v1_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sp_catalog_product_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sp_web_label_pack_scan_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_label_pair_rate_limit_v1: {
        Row: {
          last_request_at: string | null
          request_count: number
          user_id: string
          window_started_at: string
        }
        Insert: {
          last_request_at?: string | null
          request_count?: number
          user_id: string
          window_started_at?: string
        }
        Update: {
          last_request_at?: string | null
          request_count?: number
          user_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      sp_web_label_private_images_v1: {
        Row: {
          analysis_id: string
          byte_count: number
          consented_at: string
          created_at: string
          id: string
          image_role: string
          image_sha256: string
          mime_type: string
          owner_id: string
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          analysis_id: string
          byte_count: number
          consented_at?: string
          created_at?: string
          id?: string
          image_role: string
          image_sha256: string
          mime_type: string
          owner_id: string
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          analysis_id?: string
          byte_count?: number
          consented_at?: string
          created_at?: string
          id?: string
          image_role?: string
          image_sha256?: string
          mime_type?: string
          owner_id?: string
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_label_private_images_v1_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "sp_web_label_analyses_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_page_views_v1: {
        Row: {
          category: string | null
          category_clicked: string | null
          device_type: string | null
          id: number
          page: string | null
          profile_used: string
          search_term: string | null
          session_id: string | null
          source_system: string
          visited_at: string
        }
        Insert: {
          category?: string | null
          category_clicked?: string | null
          device_type?: string | null
          id?: never
          page?: string | null
          profile_used?: string
          search_term?: string | null
          session_id?: string | null
          source_system?: string
          visited_at?: string
        }
        Update: {
          category?: string | null
          category_clicked?: string | null
          device_type?: string | null
          id?: never
          page?: string | null
          profile_used?: string
          search_term?: string | null
          session_id?: string | null
          source_system?: string
          visited_at?: string
        }
        Relationships: []
      }
      sp_web_profile_seed_catalog_v1: {
        Row: {
          active: boolean
          brand_name: string | null
          category_label: string
          display_order: number
          id: number
          image_url: string | null
          product_name: string
          profile_code: string
          source_url: string
          verified_at: string
        }
        Insert: {
          active?: boolean
          brand_name?: string | null
          category_label: string
          display_order?: number
          id?: number
          image_url?: string | null
          product_name: string
          profile_code: string
          source_url: string
          verified_at?: string
        }
        Update: {
          active?: boolean
          brand_name?: string | null
          category_label?: string
          display_order?: number
          id?: number
          image_url?: string | null
          product_name?: string
          profile_code?: string
          source_url?: string
          verified_at?: string
        }
        Relationships: []
      }
      sp_web_runtime_identity_v1: {
        Row: {
          canonical_project_ref: string
          change_control: string
          created_at: string
          environment: string
          frozen: boolean
          singleton: boolean
          system_code: string
        }
        Insert: {
          canonical_project_ref: string
          change_control: string
          created_at?: string
          environment: string
          frozen?: boolean
          singleton?: boolean
          system_code: string
        }
        Update: {
          canonical_project_ref?: string
          change_control?: string
          created_at?: string
          environment?: string
          frozen?: boolean
          singleton?: boolean
          system_code?: string
        }
        Relationships: []
      }
      sp_web_site_announcements_v1: {
        Row: {
          active: boolean
          created_at: string
          display_from: string | null
          display_until: string | null
          id: string
          message: string
          source_system: string
          status: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_from?: string | null
          display_until?: string | null
          id?: string
          message: string
          source_system?: string
          status?: string
          type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_from?: string | null
          display_until?: string | null
          id?: string
          message?: string
          source_system?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      sp_web_supplement_regulatory_review_v1: {
        Row: {
          created_at: string
          owner_id: string
          report: Json
          review_version: string
          run_id: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          report: Json
          review_version: string
          run_id: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          report?: Json
          review_version?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sp_web_supplement_regulatory_review_v1_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "sp_m1b_run_v1"
            referencedColumns: ["id"]
          },
        ]
      }
      sp_web_user_roles_v1: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["sp_web_app_role_v1"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["sp_web_app_role_v1"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["sp_web_app_role_v1"]
          user_id?: string
        }
        Relationships: []
      }
      toys_material_hazard_layer: {
        Row: {
          applies_to_age: string | null
          created_at: string | null
          frontend_profiles: Json
          hazard: string
          id: number
          normalized_key: string
          product_types: Json
          risk_level: string
          risk_score: number
          safer_alternative: string | null
          source_reference: string | null
          status: string
          warning_text: string | null
        }
        Insert: {
          applies_to_age?: string | null
          created_at?: string | null
          frontend_profiles?: Json
          hazard: string
          id?: number
          normalized_key: string
          product_types?: Json
          risk_level: string
          risk_score: number
          safer_alternative?: string | null
          source_reference?: string | null
          status: string
          warning_text?: string | null
        }
        Update: {
          applies_to_age?: string | null
          created_at?: string | null
          frontend_profiles?: Json
          hazard?: string
          id?: number
          normalized_key?: string
          product_types?: Json
          risk_level?: string
          risk_score?: number
          safer_alternative?: string | null
          source_reference?: string | null
          status?: string
          warning_text?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sp_catalog_product_unified_v1: {
        Row: {
          admin_review_required: boolean | null
          assessment_status: string | null
          barcode: string | null
          brand_name: string | null
          category: string | null
          child_score: number | null
          commerce_stage: string | null
          current_currency: string | null
          current_price: number | null
          current_price_platform: string | null
          current_price_source_url: string | null
          domain_stage: string | null
          identity_confidence: number | null
          identity_stage: string | null
          identity_status: string | null
          image_stage: string | null
          ingredient_stage: string | null
          ingredients: Json | null
          market_country_code: string | null
          official_base_url: string | null
          overall_score: number | null
          pack_size_text: string | null
          pregnancy_score: number | null
          primary_image_source: string | null
          primary_image_url: string | null
          product_fingerprint: string | null
          product_id: string | null
          product_name: string | null
          safety_confidence: number | null
          safety_stage: string | null
          senior_score: number | null
          subcategory: string | null
          supports_shopify: boolean | null
          updated_at: string | null
          variant_name: string | null
        }
        Relationships: []
      }
      sp_prod1_cosmetic_regulatory_standards_v1: {
        Row: {
          agency: string | null
          automation_notes: string | null
          cas_no: string | null
          category: string | null
          child_penalty: number | null
          child_risk: boolean | null
          created_at: string | null
          id: number | null
          ingredient_canonical_name: string | null
          labeling_warnings: string | null
          limits: Json | null
          normalized_canonical_name: string | null
          pregnancy_penalty: number | null
          pregnancy_risk: boolean | null
          product_type_conditions: Json | null
          regulatory_subgroups: Json | null
          restriction_status: string | null
          risk_level: string | null
          risk_score: number | null
          senior_penalty: number | null
          senior_risk: boolean | null
          standard_id: string | null
          synonym_name: string | null
          synonym_normalized: string | null
          target_groups: Json | null
        }
        Insert: {
          agency?: string | null
          automation_notes?: string | null
          cas_no?: string | null
          category?: string | null
          child_penalty?: number | null
          child_risk?: boolean | null
          created_at?: string | null
          id?: number | null
          ingredient_canonical_name?: string | null
          labeling_warnings?: string | null
          limits?: Json | null
          normalized_canonical_name?: string | null
          pregnancy_penalty?: number | null
          pregnancy_risk?: boolean | null
          product_type_conditions?: Json | null
          regulatory_subgroups?: Json | null
          restriction_status?: string | null
          risk_level?: string | null
          risk_score?: number | null
          senior_penalty?: number | null
          senior_risk?: boolean | null
          standard_id?: string | null
          synonym_name?: string | null
          synonym_normalized?: string | null
          target_groups?: Json | null
        }
        Update: {
          agency?: string | null
          automation_notes?: string | null
          cas_no?: string | null
          category?: string | null
          child_penalty?: number | null
          child_risk?: boolean | null
          created_at?: string | null
          id?: number | null
          ingredient_canonical_name?: string | null
          labeling_warnings?: string | null
          limits?: Json | null
          normalized_canonical_name?: string | null
          pregnancy_penalty?: number | null
          pregnancy_risk?: boolean | null
          product_type_conditions?: Json | null
          regulatory_subgroups?: Json | null
          restriction_status?: string | null
          risk_level?: string | null
          risk_score?: number | null
          senior_penalty?: number | null
          senior_risk?: boolean | null
          standard_id?: string | null
          synonym_name?: string | null
          synonym_normalized?: string | null
          target_groups?: Json | null
        }
        Relationships: []
      }
      v_canonical_ingredient_universe_v2: {
        Row: {
          alias_keys: string[] | null
          alias_row_count: number | null
          canonical_key: string | null
          canonical_name: string | null
        }
        Relationships: []
      }
      v_dossier_evidence_gate_v1: {
        Row: {
          canonical_name: string | null
          dossier_id: number | null
          dossier_status: string | null
          evidence_gate_block_reason: string | null
          evidence_gate_passed: boolean | null
          has_verified_exposure_evidence: boolean | null
          has_verified_hazard_evidence: boolean | null
          has_verified_identity_evidence: boolean | null
          has_verified_profile_evidence: boolean | null
          has_verified_regulatory_evidence: boolean | null
          has_verified_safety_assessment: boolean | null
          primary_verified_evidence_count: number | null
          queue_id: number | null
          total_evidence_count: number | null
          verified_evidence_count: number | null
          verified_source_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      v_evidence_review_operations_v1: {
        Row: {
          attempt_count: number | null
          authority_name: string | null
          authority_tier: number | null
          canonical_name: string | null
          claim_expired: boolean | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string | null
          dossier_id: number | null
          dossier_status: string | null
          evidence_confidence: number | null
          evidence_id: number | null
          evidence_strength: string | null
          evidence_title: string | null
          evidence_type: string | null
          jurisdiction: string | null
          lease_expires_at: string | null
          priority: string | null
          queue_id: number | null
          queue_status: string | null
          source_code: string | null
          source_reference: string | null
          source_url: string | null
          updated_at: string | null
          verification_status: string | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "ingredient_scientific_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["evidence_id"]
          },
          {
            foreignKeyName: "ingredient_evidence_review_queue_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_lineage_summary"
            referencedColumns: ["evidence_id"]
          },
        ]
      }
      v_ingredient_dossier_completeness_v1: {
        Row: {
          canonical_name: string | null
          completeness_percent: number | null
          dossier_id: number | null
          dossier_status: string | null
          evidence_count: number | null
          has_verified_exposure_evidence: boolean | null
          has_verified_hazard_evidence: boolean | null
          has_verified_identity_evidence: boolean | null
          has_verified_profile_evidence: boolean | null
          has_verified_regulatory_evidence: boolean | null
          has_verified_safety_assessment: boolean | null
          normalized_canonical_name: string | null
          primary_verified_evidence_count: number | null
          promotion_block_reason: string | null
          promotion_ready: boolean | null
          queue_id: number | null
          verified_evidence_count: number | null
          verified_source_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_scientific_dossiers_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: true
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      v_ingredient_evidence_review_dashboard_v1: {
        Row: {
          authority_name: string | null
          authority_tier: number | null
          canonical_name: string | null
          dossier_id: number | null
          dossier_status: string | null
          evidence_confidence: number | null
          evidence_id: number | null
          evidence_strength: string | null
          evidence_title: string | null
          evidence_type: string | null
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          source_code: string | null
          source_document: string | null
          source_reference: string | null
          source_url: string | null
          source_version: string | null
          verification_notes: string | null
          verification_order: number | null
          verification_status: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Relationships: []
      }
      v_ingredient_identity_keys_v2: {
        Row: {
          canonical_name: string | null
          ingredient_key: string | null
          key_source: string | null
        }
        Relationships: []
      }
      v_ingredient_knowledge_coverage_v2: {
        Row: {
          alias_row_count: number | null
          canonical_key: string | null
          canonical_name: string | null
          canonical_regulatory_match: boolean | null
          coverage_status: string | null
          has_any_safety_intelligence: boolean | null
          has_specific_regulatory_evidence: boolean | null
          profile_rule_match_count: number | null
          provisional_scoring_ready: boolean | null
          regulatory_match_count: number | null
          scientific_review_required: boolean | null
          synonym_regulatory_match: boolean | null
          watchlist_match_count: number | null
        }
        Relationships: []
      }
      v_ingredient_scientific_modules_v1: {
        Row: {
          activated_at: string | null
          activation_reason: string | null
          canonical_name: string | null
          created_at: string | null
          display_order: number | null
          dossier_id: number | null
          dossier_status: string | null
          last_reviewed_at: string | null
          limitations: Json | null
          minimum_verified_evidence: number | null
          module_code: string | null
          module_confidence: number | null
          module_description: string | null
          module_gate_passed: boolean | null
          module_instance_id: number | null
          module_name: string | null
          module_status: string | null
          module_summary: string | null
          next_review_due_at: string | null
          pending_evidence_count: number | null
          priority: string | null
          rejected_evidence_count: number | null
          research_started_at: string | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          verified_evidence_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_modules_module_code_fkey"
            columns: ["module_code"]
            isOneToOne: false
            referencedRelation: "scientific_module_catalog"
            referencedColumns: ["module_code"]
          },
        ]
      }
      v_profile_rule_identity_keys_v2: {
        Row: {
          canonical_name: string | null
          ingredient_key: string | null
        }
        Relationships: []
      }
      v_regulatory_identity_keys_v2: {
        Row: {
          key_source: string | null
          regulatory_id: number | null
          regulatory_key: string | null
        }
        Relationships: []
      }
      v_regulatory_queue_promotion_readiness_v1: {
        Row: {
          authority_count: number | null
          canonical_name: string | null
          cas_number: string | null
          current_status: string | null
          ec_number: string | null
          evidence_confidence: number | null
          id: number | null
          identity_confidence: number | null
          inci_name: string | null
          ingredient_function: string | null
          normalized_canonical_name: string | null
          priority: string | null
          promotion_block_reason: string | null
          promotion_ready: boolean | null
          proposed_recommendation: string | null
          proposed_risk_level: string | null
          proposed_risk_score: number | null
          proposed_warning: string | null
          reference_count: number | null
          source_authorities: Json | null
          source_references: Json | null
        }
        Insert: {
          authority_count?: never
          canonical_name?: string | null
          cas_number?: string | null
          current_status?: string | null
          ec_number?: string | null
          evidence_confidence?: number | null
          id?: number | null
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_function?: string | null
          normalized_canonical_name?: string | null
          priority?: string | null
          promotion_block_reason?: never
          promotion_ready?: never
          proposed_recommendation?: string | null
          proposed_risk_level?: string | null
          proposed_risk_score?: number | null
          proposed_warning?: string | null
          reference_count?: never
          source_authorities?: Json | null
          source_references?: Json | null
        }
        Update: {
          authority_count?: never
          canonical_name?: string | null
          cas_number?: string | null
          current_status?: string | null
          ec_number?: string | null
          evidence_confidence?: number | null
          id?: number | null
          identity_confidence?: number | null
          inci_name?: string | null
          ingredient_function?: string | null
          normalized_canonical_name?: string | null
          priority?: string | null
          promotion_block_reason?: never
          promotion_ready?: never
          proposed_recommendation?: string | null
          proposed_risk_level?: string | null
          proposed_risk_score?: number | null
          proposed_warning?: string | null
          reference_count?: never
          source_authorities?: Json | null
          source_references?: Json | null
        }
        Relationships: []
      }
      v_scientific_dossier_domain_coverage_v1: {
        Row: {
          all_launch_modules_verified: boolean | null
          canonical_name: string | null
          dossier_id: number | null
          evidence_pending_modules: number | null
          insufficient_evidence_modules: number | null
          launch_module_processing_complete: boolean | null
          on_demand_modules: number | null
          pending_modules: number | null
          researching_modules: number | null
          total_modules: number | null
          verified_modules: number | null
        }
        Relationships: []
      }
      v_scientific_factory_monitor_v1: {
        Row: {
          accepted_source_count: number | null
          attempt_number: number | null
          canonical_name: string | null
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          dossier_id: number | null
          dossier_status: string | null
          error_code: string | null
          error_message: string | null
          lease_expires_at: string | null
          model_name: string | null
          model_response_id: string | null
          priority: string | null
          queue_id: number | null
          rejected_source_count: number | null
          run_id: string | null
          run_status: string | null
          source_hit_count: number | null
          started_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "ingredient_scientific_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_dossier_evidence_gate_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_dossier_completeness_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_evidence_review_dashboard_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_ingredient_scientific_modules_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_dossier_domain_coverage_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["dossier_id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "regulatory_knowledge_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_regulatory_queue_promotion_readiness_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scientific_factory_runs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "v_scientific_review_work_queue_v1"
            referencedColumns: ["queue_id"]
          },
        ]
      }
      v_scientific_lineage_summary: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          evidence_created_at: string | null
          evidence_id: number | null
          evidence_strength: string | null
          evidence_type: string | null
          evidence_updated_at: string | null
          extraction_timestamp: string | null
          ingestion_uuid: string | null
          pipeline_version: string | null
          processing_status: string | null
          raw_evidence_id: number | null
          raw_record_created_at: string | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_scientific_evidence_raw_evidence_fk"
            columns: ["raw_evidence_id"]
            isOneToOne: false
            referencedRelation: "scientific_evidence_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      v_scientific_review_work_queue_v1: {
        Row: {
          canonical_name: string | null
          completeness_percent: number | null
          current_status: string | null
          dossier_id: number | null
          dossier_status: string | null
          evidence_count: number | null
          has_verified_exposure_evidence: boolean | null
          has_verified_hazard_evidence: boolean | null
          has_verified_identity_evidence: boolean | null
          has_verified_profile_evidence: boolean | null
          has_verified_regulatory_evidence: boolean | null
          has_verified_safety_assessment: boolean | null
          normalized_canonical_name: string | null
          occurrence_count: number | null
          primary_verified_evidence_count: number | null
          priority: string | null
          priority_order: number | null
          promotion_block_reason: string | null
          promotion_ready: boolean | null
          queue_id: number | null
          verified_evidence_count: number | null
          verified_source_count: number | null
        }
        Relationships: []
      }
      v_watchlist_identity_keys_v2: {
        Row: {
          canonical_name: string | null
          ingredient_key: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _p8_2b_3b1_fixture_fingerprint_v1: {
        Args: {
          p_expected_outcome: Json
          p_fixture_code: string
          p_input_payload: Json
          p_revision_metadata: Json
          p_revision_number: number
        }
        Returns: string
      }
      _p8_2b_3b2_execute_workspace_v1: {
        Args: { p_pipeline_version: string; p_workspace_id: number }
        Returns: Json
      }
      _p8_2b_3b2_json_contract_matches_v1: {
        Args: { p_actual: Json; p_expected: Json }
        Returns: boolean
      }
      _p8_2b_3b2_materialize_json_v1: {
        Args: { p_tokens: Json; p_value: Json }
        Returns: Json
      }
      _p8_2b_3b3_delete_owned_artifacts_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      _p8_2b_3c_child_metrics_v1: { Args: { p_run_id: number }; Returns: Json }
      _p8_2b_3c_child_snapshot_v1: { Args: { p_run_id: number }; Returns: Json }
      _p8_2b_3c_normalize_json_v1: { Args: { p_value: Json }; Returns: Json }
      _p8_2b_3c_record_result_v1: {
        Args: {
          p_check_code: string
          p_check_name: string
          p_check_order: number
          p_check_status: string
          p_details: Json
          p_repeatability_run_id: number
        }
        Returns: undefined
      }
      _p8_2b_3d_cleanup_owned_artifacts_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      _p8_2b_3d_record_result_v1: {
        Args: {
          p_check_code: string
          p_check_name: string
          p_check_order: number
          p_check_status: string
          p_details: Json
          p_duration_ms?: number
          p_run_id: number
        }
        Returns: undefined
      }
      _p8_2b_clean_text_v1: {
        Args: { p_single_line?: boolean; p_value: string }
        Returns: string
      }
      _p8_2b_part_5_step_1_probe_v11: {
        Args: { p_part: string }
        Returns: Json
      }
      _p8_2b_try_bigint_v1: { Args: { p_value: string }; Returns: number }
      _p8_2b_try_boolean_v1: { Args: { p_value: string }; Returns: boolean }
      _p8_2b_try_date_v1: { Args: { p_value: string }; Returns: string }
      _p8_2b_try_numeric_v1: { Args: { p_value: string }; Returns: number }
      _sp_web_featured_products_core_v1_2: {
        Args: { p_category?: string; p_limit?: number; p_profile?: string }
        Returns: Json
      }
      abort_p8_2b_part_5_step_3d_edge_run_v1: {
        Args: { p_details?: Json; p_reason: string; p_run_id: number }
        Returns: Json
      }
      activate_scientific_module_v1: {
        Args: {
          p_activation_reason: string
          p_dossier_id: number
          p_module_code: string
          p_priority?: string
        }
        Returns: Json
      }
      apply_p8_2b_part_5_step_2b_hardening_v1: {
        Args: never
        Returns: {
          access_class: string
          action_status: string
          actions_applied: Json
          function_signature: string
          policy_order: number
        }[]
      }
      approve_ingredient_scientific_dossier_v1: {
        Args: { p_dossier_id: number; p_reviewer_name: string }
        Returns: Json
      }
      assert_p8_2b_foundation_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_1b_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_2_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_3_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_4_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_1_v11: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_2b_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3a_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3b_1_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3b_2_run_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      assert_p8_2b_part_5_step_3b_2_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3b_3_pre_cleanup_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      assert_p8_2b_part_5_step_3b_3_run_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      assert_p8_2b_part_5_step_3b_3_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3c_run_v1: {
        Args: { p_repeatability_run_id: number }
        Returns: Json
      }
      assert_p8_2b_part_5_step_3c_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3d_edge_bridge_v1: { Args: never; Returns: Json }
      assert_p8_2b_part_5_step_3d_edge_hotfix_1_v1: {
        Args: never
        Returns: Json
      }
      assert_p8_2b_part_5_step_3d_run_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      assert_p8_2b_part_5_step_3d_v1: { Args: never; Returns: Json }
      attach_evidence_to_scientific_module_v1: {
        Args: {
          p_evidence_id: number
          p_linked_by?: string
          p_module_instance_id: number
          p_relevance_role?: string
        }
        Returns: Json
      }
      begin_raw_evidence_processing_v1: {
        Args: { p_pipeline_version?: string; p_raw_evidence_id: number }
        Returns: Json
      }
      calculate_layered_product_safety: {
        Args: {
          category: string
          product_name: string
          raw_ingredient_text: string
        }
        Returns: Json
      }
      calculate_layered_product_safety_cosmetic_v1: {
        Args: {
          category: string
          product_name: string
          raw_ingredient_text: string
        }
        Returns: Json
      }
      calculate_layered_product_safety_v21_core: {
        Args: {
          category: string
          product_name: string
          raw_ingredient_text: string
        }
        Returns: Json
      }
      calculate_layered_product_safety_v21_cosmetic_core_v1: {
        Args: {
          category: string
          product_name: string
          raw_ingredient_text: string
        }
        Returns: Json
      }
      calculate_layered_product_safety_v22_confidence: {
        Args: {
          p_category: string
          p_extraction_confidence?: number
          p_ingredient_confidence?: number
          p_product_name: string
          p_raw_ingredient_text: string
          p_source_confidence?: number
        }
        Returns: Json
      }
      calculate_product_safety_unified: {
        Args: {
          product_category?: string
          product_name?: string
          raw_ingredient_text: string
          user_profile?: string
        }
        Returns: Json
      }
      calculate_safety_score: {
        Args: { p_category: string; p_ingredients: Json; p_profile?: string }
        Returns: Json
      }
      claim_document_review_by_id_v1: {
        Args: {
          p_lease_seconds?: number
          p_review_id: string
          p_reviewer: string
        }
        Returns: Json
      }
      claim_document_review_by_snapshot_v1: {
        Args: {
          p_lease_seconds?: number
          p_reviewer: string
          p_snapshot_id: number
        }
        Returns: Json
      }
      claim_document_review_v1: {
        Args: { p_lease_seconds?: number; p_reviewer: string }
        Returns: Json
      }
      claim_ingredient_clause_job_v1: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_layout_aware_ingredient_clause_job_v2: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_layout_aware_ingredient_clause_job_v3: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_layout_remediation_job_v1: {
        Args: {
          p_lease_seconds?: number
          p_source_artifact_id: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_layout_remediation_job_v1_1: {
        Args: {
          p_lease_seconds?: number
          p_source_artifact_id: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_layout_remediation_job_v1_2: {
        Args: {
          p_lease_seconds?: number
          p_source_artifact_id: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_layout_remediation_job_v1_3: {
        Args: {
          p_lease_seconds?: number
          p_source_artifact_id: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_layout_remediation_review_v1: {
        Args: {
          p_layout_artifact_id: number
          p_lease_seconds?: number
          p_reviewer: string
        }
        Returns: Json
      }
      claim_next_acquisition_job_v1: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_next_evidence_review_v1: {
        Args: { p_priority_limit?: string; p_reviewer_name: string }
        Returns: Json
      }
      claim_next_scientific_factory_job_v1: {
        Args: { p_priority_limit?: string; p_worker_name: string }
        Returns: Json
      }
      claim_next_scientific_factory_job_v2: {
        Args: { p_priority_limit: string; p_worker_name: string }
        Returns: Json
      }
      claim_next_scientific_module_job_v1: {
        Args: {
          p_module_code?: string
          p_priority_limit?: string
          p_worker_name: string
        }
        Returns: Json
      }
      claim_next_scientific_module_job_v2: {
        Args: {
          p_module_code?: string
          p_priority_limit?: string
          p_worker_name: string
        }
        Returns: Json
      }
      claim_or_resume_ingredient_clause_atomic_page_v5: {
        Args: {
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_or_resume_ingredient_clause_autonomous_page_v6: {
        Args: {
          p_forward_lookahead_pages?: number
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_or_resume_ingredient_clause_autonomous_page_v7: {
        Args: {
          p_forward_lookahead_pages?: number
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_or_resume_ingredient_clause_autonomous_page_v8: {
        Args: {
          p_forward_lookahead_pages?: number
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_or_resume_ingredient_clause_batch_v3: {
        Args: {
          p_job_id: string
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_reference_discovery_job_v1: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_referenced_document_review_v1: {
        Args: { p_lease_seconds?: number; p_reviewer: string }
        Returns: Json
      }
      claim_text_extraction_job_by_snapshot_v1: {
        Args: {
          p_lease_seconds?: number
          p_snapshot_id: number
          p_worker_id: string
        }
        Returns: Json
      }
      claim_text_extraction_job_v1: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: Json
      }
      claim_text_extraction_review_v1: {
        Args: { p_lease_seconds?: number; p_reviewer: string }
        Returns: Json
      }
      clamp_numeric: {
        Args: { p_max: number; p_min: number; p_value: number }
        Returns: number
      }
      clean_discovery_title: { Args: { p_title: string }; Returns: string }
      clean_ranked_response_warnings_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      clean_warning_array: { Args: { p_warnings: Json }; Returns: Json }
      cleanup_p8_2b_part_5_step_3b_3_invalidated_run_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      cleanup_p8_2b_part_5_step_3d_failed_run_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      clear_search_candidate_buffer: {
        Args: { p_search_id: string }
        Returns: undefined
      }
      complete_not_modified_acquisition_v1: {
        Args: {
          p_actor?: string
          p_content_length: number
          p_http_status: number
          p_job_id: string
          p_lease_token: string
          p_resolved_url: string
          p_response_content_type: string
          p_response_etag: string
          p_response_headers?: Json
          p_response_last_modified: string
        }
        Returns: Json
      }
      complete_search_candidate_v4: {
        Args: {
          p_completion_route?: string
          p_completion_status?: string
          p_product_fingerprint?: string
          p_profile?: string
          p_search_id: string
        }
        Returns: Json
      }
      confirm_snapshot_storage_v1: {
        Args: {
          p_actor?: string
          p_job_id: string
          p_lease_token: string
          p_snapshot_id: number
        }
        Returns: Json
      }
      correct_product_card_display_v1: { Args: { p_card: Json }; Returns: Json }
      correct_ranked_response_display_v1: {
        Args: { p_response: Json }
        Returns: Json
      }
      correct_ranked_response_display_v1_core_c32: {
        Args: { p_response: Json }
        Returns: Json
      }
      create_search_session: { Args: never; Returns: string }
      decide_document_snapshot_v1: {
        Args: {
          p_claim_token: string
          p_decision: string
          p_document_status: string
          p_document_title: string
          p_document_version: string
          p_effective_from: string
          p_effective_to: string
          p_external_document_key: string
          p_original_language: string
          p_publication_date: string
          p_review_id: string
          p_review_notes: string
          p_reviewer: string
        }
        Returns: Json
      }
      decide_layout_remediation_review_v1: {
        Args: {
          p_claim_token: string
          p_comparison_method: string
          p_decision: string
          p_identifiers_preserved: boolean
          p_review_id: string
          p_review_notes: string
          p_reviewer: string
          p_row_column_associations_preserved: boolean
          p_sampled_pages: Json
          p_structure_preserved: boolean
          p_text_complete: boolean
        }
        Returns: Json
      }
      decide_referenced_document_review_v1: {
        Args: {
          p_candidate_id: string
          p_claim_token: string
          p_decision: string
          p_document_title: string
          p_original_language: string
          p_publication_date: string
          p_review_notes: string
          p_reviewer: string
        }
        Returns: Json
      }
      decide_text_extraction_review_v1: {
        Args: {
          p_claim_token: string
          p_comparison_method: string
          p_decision: string
          p_review_id: string
          p_review_notes: string
          p_reviewer: string
          p_sampled_pages: Json
          p_structure_preserved: boolean
          p_text_accurate: boolean
          p_text_complete: boolean
        }
        Returns: Json
      }
      deduplicate_warning_array_v1: {
        Args: { p_warnings: Json }
        Returns: Json
      }
      derive_evidence_strength_v2: {
        Args: {
          p_evidence_type?: string
          p_source_document?: string
          p_source_registry_id?: number
          p_supplied_strength?: string
        }
        Returns: string
      }
      digest: { Args: { p_algorithm: string; p_data: string }; Returns: string }
      enqueue_due_source_checks_v1: {
        Args: { p_actor?: string; p_limit?: number }
        Returns: Json
      }
      enqueue_ingredient_evidence_review_v1: {
        Args: { p_evidence_id: number }
        Returns: Json
      }
      enqueue_layout_aware_ingredient_clause_job_v2: {
        Args: {
          p_actor?: string
          p_layout_artifact_id: number
          p_regulatory_document_id: number
        }
        Returns: Json
      }
      enqueue_layout_remediation_job_v1: {
        Args: { p_actor?: string; p_source_artifact_id: number }
        Returns: Json
      }
      enqueue_layout_remediation_job_v1_1: {
        Args: { p_actor?: string; p_source_artifact_id: number }
        Returns: Json
      }
      enqueue_layout_remediation_job_v1_2: {
        Args: { p_actor?: string; p_source_artifact_id: number }
        Returns: Json
      }
      enqueue_layout_remediation_job_v1_3: {
        Args: { p_actor?: string; p_source_artifact_id: number }
        Returns: Json
      }
      enqueue_verified_ingredient_clause_jobs_v1: {
        Args: { p_actor?: string; p_limit?: number }
        Returns: Json
      }
      enqueue_verified_reference_discovery_jobs_v1: {
        Args: { p_actor?: string; p_limit?: number }
        Returns: Json
      }
      enqueue_verified_text_extractions_v1: {
        Args: { p_actor?: string; p_limit?: number }
        Returns: Json
      }
      ensure_scientific_modules_for_dossier_v1: {
        Args: { p_dossier_id: number }
        Returns: Json
      }
      execute_p8_2b_part_5_step_3b_2_v1: {
        Args: { p_suite_version?: string }
        Returns: Json
      }
      execute_p8_2b_part_5_step_3b_3_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      execute_p8_2b_part_5_step_3c_v1: {
        Args: { p_version: string }
        Returns: Json
      }
      execute_p8_2b_part_5_step_3d_contender_v1: {
        Args: {
          p_contender_code: string
          p_execution_token: string
          p_run_id: number
        }
        Returns: Json
      }
      explain_canonical_evidence_type_v1: {
        Args: {
          p_proposed_evidence_type: string
          p_source_document?: string
          p_source_registry_id: number
        }
        Returns: Json
      }
      extract_hostname_v1: { Args: { p_url: string }; Returns: string }
      extract_warning_text_v1: { Args: { p_warning: Json }; Returns: string }
      fail_raw_evidence_processing_v1: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_pipeline_version?: string
          p_raw_evidence_id: number
        }
        Returns: Json
      }
      fail_scientific_factory_run_v1: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_run_id: string
        }
        Returns: Json
      }
      finalize_ingredient_clause_extraction_v3: {
        Args: {
          p_actor?: string
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
          p_run_metadata?: Json
        }
        Returns: Json
      }
      finalize_layout_remediation_v1: {
        Args: {
          p_actor: string
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
        }
        Returns: Json
      }
      finalize_p8_2b_part_5_step_3d_edge_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      finalize_p8_2b_part_5_step_3d_v1: {
        Args: { p_run_id: number }
        Returns: Json
      }
      finalize_raw_evidence_processing_v1: {
        Args: {
          p_canonical_evidence_id: number
          p_pipeline_version?: string
          p_raw_evidence_id: number
        }
        Returns: Json
      }
      finalize_scientific_module_v1: {
        Args: {
          p_decision: string
          p_limitations?: Json
          p_module_confidence: number
          p_module_instance_id: number
          p_module_summary: string
          p_reviewer_name: string
        }
        Returns: Json
      }
      generate_ingredient_hash: { Args: { p_text: string }; Returns: string }
      generate_product_fingerprint: {
        Args: { input_title: string }
        Returns: string
      }
      get_g2_monitoring_dashboard_v1: { Args: never; Returns: Json }
      get_g3a_monitoring_dashboard_v1: { Args: never; Returns: Json }
      get_g3b_monitoring_dashboard_v1: { Args: never; Returns: Json }
      get_g3c_monitoring_dashboard_v1: { Args: never; Returns: Json }
      get_ingredient_coverage_summary_v2: { Args: never; Returns: Json }
      get_layout_remediation_page_v1: {
        Args: { p_layout_artifact_id: number; p_page_no: number }
        Returns: Json
      }
      get_layout_section_profiles_v1: {
        Args: { p_regulatory_document_id: number }
        Returns: Json
      }
      get_layout_section_profiles_v1_1: {
        Args: { p_regulatory_document_id: number }
        Returns: Json
      }
      get_ranked_product_sources: {
        Args: { p_limit?: number; p_product_fingerprint: string }
        Returns: {
          average_confidence: number
          image_url: string
          merchant_name: string
          source_priority: number
          source_type: string
          source_url: string
          success_rate: number
          verified: boolean
        }[]
      }
      get_raw_evidence_processing_state_v1: {
        Args: { p_raw_evidence_id: number }
        Returns: Json
      }
      get_scientific_classifier_version: { Args: never; Returns: Json }
      get_scientific_evidence_vocabulary: {
        Args: never
        Returns: {
          canonical_strength: string
          description: string
          display_name: string
          display_order: number
        }[]
      }
      get_scientific_evidence_vocabulary_v1: { Args: never; Returns: Json }
      get_search_pipeline_status_v1: {
        Args: { p_search_id: string }
        Returns: Json
      }
      get_search_pipeline_status_v2: {
        Args: { p_search_id: string }
        Returns: Json
      }
      get_source_confidence: { Args: { p_source: string }; Returns: number }
      get_source_priority: { Args: { p_source: string }; Returns: number }
      get_verified_layout_page_batch_v3: {
        Args: {
          p_end_page: number
          p_layout_artifact_id: number
          p_start_page: number
        }
        Returns: Json
      }
      ingest_scientific_evidence_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      ingest_scientific_factory_draft_v1: {
        Args: { p_payload: Json; p_run_id: string }
        Returns: Json
      }
      ingest_scientific_factory_draft_v2: {
        Args: { p_payload: Json; p_run_id: string }
        Returns: Json
      }
      ingest_scientific_factory_draft_v3: {
        Args: { p_payload: Json; p_run_id: string }
        Returns: Json
      }
      ingest_scientific_module_draft_v1: {
        Args: {
          p_job_id: string
          p_model_name?: string
          p_model_response_id?: string
          p_payload: Json
        }
        Returns: Json
      }
      initialize_search_pipeline_v1: {
        Args: {
          p_expected_count?: number
          p_profile?: string
          p_search_id: string
        }
        Returns: Json
      }
      insert_search_candidate: {
        Args: {
          p_extracted_price: number
          p_immersive_api: string
          p_immersive_token: string
          p_merchant_class: string
          p_merchant_name: string
          p_merchant_score: number
          p_priority: number
          p_product_link: string
          p_search_id: string
          p_source: string
          p_thumbnail: string
          p_title: string
        }
        Returns: undefined
      }
      is_warning_array_key_v1: { Args: { p_key: string }; Returns: boolean }
      log_ingredient_extraction_v17: {
        Args: {
          p_merchant_name: string
          p_product_fingerprint: string
          p_product_name: string
          p_product_url: string
          p_railway_response: Json
          p_search_id: string
        }
        Returns: Json
      }
      lookup_merchant: {
        Args: { merchant_input: string }
        Returns: {
          merchant_class: string
          merchant_name: string
          merchant_score: number
          priority: number
        }[]
      }
      lookup_offer_merchant: {
        Args: { merchant_input: string }
        Returns: {
          merchant_class: string
          merchant_name: string
          merchant_score: number
          priority: number
        }[]
      }
      lookup_offer_merchant_v2: {
        Args: { merchant_input: string }
        Returns: {
          is_qualified: boolean
          merchant_class: string
          merchant_name: string
          merchant_score: number
          priority: number
        }[]
      }
      lookup_regulatory_source_strength_v2: {
        Args: { p_source_registry_id: number }
        Returns: string
      }
      lookup_scientific_authority: {
        Args: { p_authority_code: string }
        Returns: string
      }
      lookup_scientific_document: {
        Args: { p_document_title: string }
        Returns: string
      }
      lookup_scientific_evidence_type: {
        Args: { p_evidence_type: string }
        Returns: string
      }
      match_ingredient: {
        Args: { input_text: string }
        Returns: {
          canonical_name: string
          child_risk: boolean
          label_warnings: string
          limits: string
          match_source: string
          pregnancy_risk: boolean
          risk_score: number
          senior_risk: boolean
        }[]
      }
      match_ingredients_v2: {
        Args: { search_terms: string[] }
        Returns: {
          canonical_name: string
          match_id: number
          matched_synonym: string
          regulation_limit: Json
          risk: string
          warning_text: string
        }[]
      }
      normalize_evidence_strength_v1: {
        Args: {
          p_evidence_strength: string
          p_evidence_summary?: string
          p_evidence_title?: string
          p_evidence_type?: string
          p_source_document?: string
          p_source_reference?: string
          p_source_url?: string
        }
        Returns: string
      }
      normalize_ingredient_key_v2: {
        Args: { p_value: string }
        Returns: string
      }
      normalize_ingredient_label: {
        Args: { input_text: string }
        Returns: string
      }
      normalize_ingredient_text: { Args: { p_text: string }; Returns: string }
      normalize_product_title: {
        Args: { input_title: string }
        Returns: string
      }
      normalize_scientific_ingestion_payload_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      normalize_search_intent: {
        Args: { p_raw_query: string; p_search_id: string }
        Returns: Json
      }
      normalize_warning_display_text_v1: {
        Args: { p_warning: string }
        Returns: string
      }
      normalize_warning_json_v1: { Args: { p_warning: Json }; Returns: Json }
      p8_2b_dependency_inventory_v1: {
        Args: never
        Returns: {
          dependency_order: number
          function_name: string
          identity_arguments: string
          installed: boolean
          package_name: string
          result_type: string
          security_definer: boolean
          volatility: string
        }[]
      }
      p8_2b_derive_strength_adapter_v1: {
        Args: {
          p_evidence_type: string
          p_source_document: string
          p_source_registry_id: number
          p_supplied_strength: string
        }
        Returns: Json
      }
      p8_2b_foundation_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_1b_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_2_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_3_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_4_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_1_report_v11: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_2a_function_inventory_v1: {
        Args: never
        Returns: {
          access_class: string
          anon_execute: boolean
          authenticated_execute: boolean
          configured_search_path: string
          findings: Json
          function_exists: boolean
          function_name: string
          function_oid: unknown
          function_signature: string
          hardened_search_path_enabled: boolean
          hardened_search_path_required: boolean
          identity_arguments: string
          inventory_order: number
          owner_is_anchor_owner: boolean
          owner_name: string
          owner_oid: unknown
          package_component: string
          public_execute: boolean
          schema_name: string
          security_definer_enabled: boolean
          security_definer_required: boolean
          security_status: string
          service_role_allowed: boolean
          service_role_execute: boolean
        }[]
      }
      p8_2b_part_5_step_2a_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_2b_policy_report_v1: {
        Args: never
        Returns: {
          access_class: string
          anon_execute: boolean
          authenticated_execute: boolean
          configured_search_path: string
          findings: Json
          function_exists: boolean
          function_signature: string
          hardened_search_path_enabled: boolean
          owner_matches_anchor: boolean
          owner_name: string
          package_component: string
          policy_order: number
          policy_status: string
          public_execute: boolean
          schema_name: string
          security_definer_enabled: boolean
          service_role_execute: boolean
        }[]
      }
      p8_2b_part_5_step_2b_security_policy_v1: {
        Args: never
        Returns: {
          access_class: string
          function_signature: string
          hardened_search_path_required: boolean
          package_component: string
          policy_order: number
          security_definer_required: boolean
          service_role_allowed: boolean
        }[]
      }
      p8_2b_part_5_step_3a_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_3b_1_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_3b_2_report_v1: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          details: Json
          status: string
        }[]
      }
      p8_2b_part_5_step_3b_2_run_report_v1: {
        Args: { p_run_id: number }
        Returns: {
          canonical_evidence_id: number
          check_order: number
          details: Json
          duration_ms: number
          fixture_code: string
          fixture_name: string
          qualification_status: string
          raw_evidence_id: number
          response_action: string
          response_status: string
          workspace_status: string
        }[]
      }
      p8_2b_part_5_step_3b_3_pre_cleanup_report_v1: {
        Args: { p_run_id: number }
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3b_3_report_v1: {
        Args: never
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3b_3_run_report_v1: {
        Args: { p_run_id: number }
        Returns: {
          cleaned_workspace_count: number
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
          remaining_canonical_count: number
          remaining_raw_count: number
          run_status: string
          workspace_count: number
        }[]
      }
      p8_2b_part_5_step_3c_report_v1: {
        Args: never
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3c_run_report_v1: {
        Args: { p_repeatability_run_id: number }
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          check_status: string
          details: Json
          first_child_run_id: number
          first_child_status: string
          parent_run_status: string
          second_child_run_id: number
          second_child_status: string
        }[]
      }
      p8_2b_part_5_step_3d_contender_status_v1: {
        Args: { p_run_id: number }
        Returns: {
          backend_pid: number
          canonical_evidence_id: number
          contender_code: string
          contender_status: string
          duration_ms: number
          error_code: string
          error_message: string
          invoked_at: string
          process_finished_at: string
          process_started_at: string
          raw_evidence_id: number
          response_action: string
          response_status: string
          transaction_id: number
        }[]
      }
      p8_2b_part_5_step_3d_edge_bridge_report_v1: {
        Args: never
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3d_edge_hotfix_1_report_v1: {
        Args: never
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3d_report_v1: {
        Args: never
        Returns: {
          qualification_code: string
          qualification_details: Json
          qualification_name: string
          qualification_order: number
          qualification_status: string
        }[]
      }
      p8_2b_part_5_step_3d_run_report_v1: {
        Args: { p_run_id: number }
        Returns: {
          check_code: string
          check_name: string
          check_order: number
          check_status: string
          cleaned_contender_count: number
          contender_count: number
          details: Json
          remaining_canonical_count: number
          remaining_raw_count: number
          run_status: string
        }[]
      }
      p8_2b_raw_status_contract_v1: { Args: never; Returns: Json }
      p8_2b_resolve_type_adapter_v1: {
        Args: {
          p_proposed_evidence_type: string
          p_source_document: string
          p_source_registry_id: number
        }
        Returns: Json
      }
      p8_2b_validate_consistency_adapter_v1: {
        Args: {
          p_evidence_strength: string
          p_evidence_type: string
          p_source_document: string
          p_source_registry_id: number
        }
        Returns: Json
      }
      prepare_p8_2b_part_5_step_3d_v1: {
        Args: { p_start_delay_seconds?: number; p_version: string }
        Returns: Json
      }
      prepare_scientific_ingestion_payload_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      process_discovery_batch: {
        Args: { p_candidates: Json; p_search_id: string }
        Returns: Json
      }
      process_scientific_evidence_v1: {
        Args: {
          p_payload: Json
          p_pipeline_version?: string
          p_raw_evidence_id: number
        }
        Returns: Json
      }
      promote_ingredient_clause_staging_v1: {
        Args: { p_actor?: string; p_batch_id: string; p_staging_id: number }
        Returns: Json
      }
      rank_discovery_candidates: { Args: { p_candidates: Json }; Returns: Json }
      rank_offer_candidates: { Args: { p_candidates: Json }; Returns: Json }
      rank_search_results_v1: {
        Args: {
          p_payload?: Json
          p_profile?: string
          p_query?: string
          p_search_id?: string
        }
        Returns: Json
      }
      rank_search_results_v2: {
        Args: { p_profile?: string; p_search_id: string }
        Returns: Json
      }
      rank_search_results_v4: {
        Args: { p_profile?: string; p_search_id: string }
        Returns: Json
      }
      record_acquisition_failure_v1: {
        Args: {
          p_actor?: string
          p_error_code: string
          p_error_message: string
          p_http_status: number
          p_job_id: string
          p_lease_token: string
          p_resolved_url: string
          p_response_headers?: Json
        }
        Returns: Json
      }
      record_ingredient_clause_failure_v1: {
        Args: {
          p_actor?: string
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_lease_token: string
        }
        Returns: Json
      }
      record_layout_remediation_failure_v1: {
        Args: {
          p_actor: string
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_lease_token: string
        }
        Returns: Json
      }
      record_reference_discovery_failure_v1: {
        Args: {
          p_actor?: string
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_lease_token: string
        }
        Returns: Json
      }
      record_storage_failure_v1: {
        Args: {
          p_actor?: string
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_lease_token: string
          p_snapshot_id: number
        }
        Returns: Json
      }
      record_text_extraction_failure_v1: {
        Args: {
          p_actor?: string
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_lease_token: string
        }
        Returns: Json
      }
      recover_stalled_acquisitions_v1: {
        Args: { p_actor?: string }
        Returns: Json
      }
      recover_stalled_ingredient_clause_jobs_v1: {
        Args: { p_actor?: string }
        Returns: Json
      }
      recover_stalled_layout_remediation_v1: {
        Args: { p_actor?: string }
        Returns: Json
      }
      recover_stalled_reference_discovery_v1: {
        Args: { p_actor?: string }
        Returns: Json
      }
      recover_stalled_text_extractions_v1: {
        Args: { p_actor?: string }
        Returns: Json
      }
      refresh_ingredient_dossier_review_state_v1: {
        Args: { p_dossier_id: number }
        Returns: Json
      }
      refresh_scientific_module_counts_v1: {
        Args: { p_module_instance_id: number }
        Returns: Json
      }
      register_downloaded_content_v1: {
        Args: {
          p_actor?: string
          p_content_length: number
          p_content_sha256: string
          p_http_status: number
          p_job_id: string
          p_lease_token: string
          p_resolved_url: string
          p_response_cache_control: string
          p_response_content_type: string
          p_response_etag: string
          p_response_headers?: Json
          p_response_last_modified: string
        }
        Returns: Json
      }
      register_extracted_text_v1: {
        Args: {
          p_actor?: string
          p_character_count: number
          p_extracted_text: string
          p_extracted_text_sha256: string
          p_extraction_confidence: number
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_extraction_metadata?: Json
          p_extraction_method: string
          p_job_id: string
          p_language_code: string
          p_lease_token: string
          p_page_count: number
        }
        Returns: Json
      }
      register_ingredient_clause_candidate_batch_v3: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_candidates: Json
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
          p_run_metadata?: Json
        }
        Returns: Json
      }
      register_ingredient_clause_candidates_v1: {
        Args: {
          p_actor?: string
          p_candidates: Json
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
          p_run_metadata?: Json
        }
        Returns: Json
      }
      register_ingredient_clause_candidates_v2: {
        Args: {
          p_actor?: string
          p_candidates: Json
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
          p_run_metadata?: Json
        }
        Returns: Json
      }
      register_layout_remediation_page_batch_v1: {
        Args: {
          p_actor: string
          p_job_id: string
          p_lease_token: string
          p_pages: Json
        }
        Returns: Json
      }
      register_openai_ingredient_clause_atomic_progress_v5: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v10: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v11: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v12: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v13: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v14: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v15: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v16: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v17: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v18: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v19: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v20: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v6: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v7: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v8: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_progress_v9: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_context_page_end: number
          p_context_page_start: number
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v1: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v2: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v3: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v4: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v5: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v6: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v7: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v8: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_autonomous_transport_v9: {
        Args: {
          p_actor?: string
          p_extraction_model?: string
          p_openai_finish_reason: string
          p_response_text: string
        }
        Returns: Json
      }
      register_openai_ingredient_clause_batch_progress_v3: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_candidates_text: string
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
        }
        Returns: Json
      }
      register_openai_ingredient_clause_structured_progress_v4: {
        Args: {
          p_actor?: string
          p_batch_key: string
          p_extraction_model?: string
          p_job_id: string
          p_lease_token: string
          p_openai_finish_reason: string
          p_page_end: number
          p_page_start: number
          p_response_text: string
        }
        Returns: Json
      }
      register_referenced_document_candidates_v1: {
        Args: {
          p_actor?: string
          p_candidates: Json
          p_extraction_engine: string
          p_extraction_engine_version: string
          p_job_id: string
          p_lease_token: string
          p_run_metadata?: Json
        }
        Returns: Json
      }
      release_evidence_review_claim_v1: {
        Args: {
          p_queue_id: number
          p_release_reason: string
          p_reviewer_name: string
        }
        Returns: Json
      }
      release_expired_evidence_review_claims_v1: { Args: never; Returns: Json }
      release_expired_scientific_module_jobs_v1: { Args: never; Returns: Json }
      resolve_canonical_evidence_type_v1: {
        Args: {
          p_proposed_evidence_type: string
          p_source_document?: string
          p_source_registry_id: number
        }
        Returns: string
      }
      resolve_evidence_review_priority_v1: {
        Args: { p_dossier_id: number }
        Returns: string
      }
      resolve_product_category: {
        Args: { p_search_query: string }
        Returns: string
      }
      resolve_product_profile: {
        Args: { p_search_query: string }
        Returns: string
      }
      resume_ingredient_clause_autonomous_exception_v1: {
        Args: {
          p_actor?: string
          p_expected_target_page: number
          p_job_id: string
          p_resolution_action?: string
        }
        Returns: Json
      }
      run_scientific_consistency_tests_v1: {
        Args: never
        Returns: {
          actual_valid: boolean
          derived_strength: string
          expected_valid: boolean
          test_name: string
          test_number: number
          test_result: string
          validation_details: Json
          validation_status: string
        }[]
      }
      safe_norm: { Args: { input_text: string }; Returns: string }
      safe_numeric_from_jsonb: { Args: { p_value: Json }; Returns: number }
      safe_profile_groups: { Args: { user_profile: string }; Returns: string[] }
      safe_resolve_canonical: {
        Args: { raw_ingredient: string }
        Returns: string
      }
      safe_table_exists: { Args: { table_name: string }; Returns: boolean }
      safe_text_from_jsonb: { Args: { p_value: Json }; Returns: string }
      safe_text_has_any: {
        Args: { source_text: string; terms: string[] }
        Returns: boolean
      }
      score_product_ingredients: { Args: { ingredients: Json }; Returns: Json }
      search_safe_products_response: {
        Args: {
          result_limit?: number
          search_query: string
          user_profile?: string
        }
        Returns: Json
      }
      select_best_offers: { Args: { p_offers: Json }; Returns: Json }
      sp_catalog_admin_audit_overview_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      sp_catalog_admin_product_bundle_v1: {
        Args: { p_product_id: string }
        Returns: Json
      }
      sp_catalog_apply_web_enrichment_v1: {
        Args: { p_result: Json; p_task_id: string }
        Returns: Json
      }
      sp_catalog_claim_enrichment_tasks_v1: {
        Args: {
          p_limit?: number
          p_task_types?: string[]
          p_worker_code: string
        }
        Returns: Json
      }
      sp_catalog_complete_enrichment_task_v1: {
        Args: {
          p_error_code?: string
          p_error_detail?: string
          p_result?: Json
          p_retry_minutes?: number
          p_success: boolean
          p_task_id: string
        }
        Returns: Json
      }
      sp_catalog_enqueue_default_enrichment_v1: {
        Args: { p_product_id: string }
        Returns: Json
      }
      sp_catalog_get_pipeline_worker_v1: {
        Args: { p_product_id: string }
        Returns: Json
      }
      sp_catalog_ingest_label_analysis_by_id_v1: {
        Args: {
          p_analysis_id: string
          p_identity: Json
          p_image_meta?: Json
          p_ingredient_image_sha256: string
        }
        Returns: Json
      }
      sp_catalog_ingest_label_analysis_by_id_v2: {
        Args: {
          p_analysis_id: string
          p_analysis_image_sha256: string
          p_identity: Json
          p_image_meta?: Json
        }
        Returns: Json
      }
      sp_catalog_ingest_label_result_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      sp_catalog_reconcile_label_safety_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      sp_catalog_refresh_due_web_enrichment_v1: {
        Args: { p_stale_hours?: number }
        Returns: Json
      }
      sp_catalog_stage_search_discovery_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      sp_claim_regulatory_web_research_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      sp_complete_regulatory_web_research_v1: {
        Args: {
          p_evidence: Json
          p_queue_id: number
          p_worker_version?: string
        }
        Returns: Json
      }
      sp_get_regulatory_official_domains_v1: { Args: never; Returns: Json }
      sp_internal_voice_rate_consume_v1: {
        Args: { p_bucket: string; p_limit?: number }
        Returns: boolean
      }
      sp_internal_voice_transcribe_webhook_v1: { Args: never; Returns: string }
      sp_internal_worker_token_valid_v1: {
        Args: { p_token: string; p_worker_code: string }
        Returns: boolean
      }
      sp_m1b_apply_path_a_result_v1: {
        Args: { p_product_id: string; p_result: Json; p_run_id: string }
        Returns: Json
      }
      sp_m1b_begin_run_v1: {
        Args: {
          p_benchmark_slot_id?: string
          p_context: string
          p_product_fingerprint: string
          p_product_id: string
          p_session_key?: string
        }
        Returns: Json
      }
      sp_m1b_enqueue_recovery_v1: {
        Args: {
          p_failure_code: string
          p_payload?: Json
          p_product_id: string
          p_run_id: string
        }
        Returns: Json
      }
      sp_m1b_get_current_safety_v2: {
        Args: { p_product_ids: string[] }
        Returns: Json
      }
      sp_m1b_get_report_v1: {
        Args: { p_context?: string; p_from: string; p_to: string }
        Returns: Json
      }
      sp_m1b_label_apply_ingredient_evidence_v1: {
        Args: { p_payload: Json; p_product_id: string; p_run_id: string }
        Returns: Json
      }
      sp_m1b_label_register_evidence_v1: {
        Args: { p_identity: Json; p_image_meta: Json }
        Returns: Json
      }
      sp_m1b_promote_after_display_v1: {
        Args: { p_run_id: string }
        Returns: Json
      }
      sp_m1b_record_attempt_v1: {
        Args: {
          p_detail?: Json
          p_engine: string
          p_failure_code?: string
          p_metrics?: Json
          p_run_id: string
          p_stage: string
          p_status: string
        }
        Returns: Json
      }
      sp_m1b_score_catalog_reuse_v2: {
        Args: { p_product_id: string; p_profile?: string }
        Returns: Json
      }
      sp_m1b_score_product_ingredients_v2: {
        Args: {
          p_product_id: string
          p_profile?: string
          p_require_verified?: boolean
        }
        Returns: Json
      }
      sp_m1b_score_qualified_product_v1: {
        Args: { p_product_id: string; p_profile?: string; p_run_id: string }
        Returns: Json
      }
      sp_m1b_score_qualified_product_v2: {
        Args: { p_product_id: string; p_profile?: string; p_run_id: string }
        Returns: Json
      }
      sp_m1b_search_catalog_candidates_v1: {
        Args: { p_category?: string; p_limit?: number; p_query: string }
        Returns: Json
      }
      sp_m1b_submit_human_recovery_v2: {
        Args: {
          p_identity_confirmed: boolean
          p_ingredient_declaration: string
          p_parsed_ingredients: Json
          p_review_id: string
          p_reviewer_note?: string
          p_source_kind: string
          p_source_url: string
        }
        Returns: Json
      }
      sp_m1br_apply_ingredient_result_v1: {
        Args: { p_product_id: string; p_result: Json; p_run_id: string }
        Returns: Json
      }
      sp_m1br_claim_targeted_v1: {
        Args: {
          p_product_id: string
          p_run_id: string
          p_task_id: string
          p_worker_code: string
        }
        Returns: Json
      }
      sp_m1br_claim_tasks_v1: {
        Args: { p_limit?: number; p_worker_code: string }
        Returns: Json
      }
      sp_m1br_complete_task_v1: {
        Args: {
          p_error_detail?: string
          p_failure_code?: string
          p_result?: Json
          p_retry_minutes?: number
          p_status: string
          p_success: boolean
          p_task_id: string
        }
        Returns: Json
      }
      sp_m1br_create_review_v1: {
        Args: {
          p_packet: Json
          p_product_id: string
          p_run_id: string
          p_terminal_status: string
        }
        Returns: Json
      }
      sp_m1br_targeted_status_v1: {
        Args: { p_product_id: string; p_run_id: string; p_task_id: string }
        Returns: Json
      }
      sp_prod1_alias_key_v1: { Args: { p_input: string }; Returns: string }
      sp_prod1_build_ingredient_consensus_v1: {
        Args: { p_product_fingerprint: string; p_search_id: string }
        Returns: Json
      }
      sp_prod1_build_ingredient_consensus_v2: {
        Args: { p_product_fingerprint: string; p_search_id: string }
        Returns: Json
      }
      sp_prod1_cache_key_v1: {
        Args: {
          p_category?: string
          p_contract_version?: string
          p_location?: string
          p_search_query: string
          p_user_profile?: string
        }
        Returns: string
      }
      sp_prod1_calculate_healthcare_safety_v1: {
        Args: {
          p_category: string
          p_ingredient_confidence: number
          p_parsed_ingredients: Json
          p_product_name: string
          p_profile?: string
        }
        Returns: Json
      }
      sp_prod1_calculate_safety_only_v1: {
        Args: {
          p_category: string
          p_product_name: string
          p_raw_ingredient_text: string
        }
        Returns: Json
      }
      sp_prod1_calculate_safety_only_v2: {
        Args: {
          p_category: string
          p_engine_ingredient_text: string
          p_product_name: string
        }
        Returns: Json
      }
      sp_prod1_calculate_safety_only_v3: {
        Args: {
          p_category: string
          p_engine_ingredient_text: string
          p_product_name: string
        }
        Returns: Json
      }
      sp_prod1_calculate_safety_only_v4: {
        Args: {
          p_category: string
          p_engine_ingredient_text: string
          p_ingredient_confidence: number
          p_product_name: string
        }
        Returns: Json
      }
      sp_prod1_calculate_safety_only_v5: {
        Args: {
          p_category: string
          p_engine_ingredient_text: string
          p_ingredient_confidence: number
          p_product_name: string
        }
        Returns: Json
      }
      sp_prod1_clean_parsed_ingredient_v1: {
        Args: { p_ingredient: string }
        Returns: string
      }
      sp_prod1_completion_gate_v1: {
        Args: { p_completions: Json; p_shortlist: Json }
        Returns: Json
      }
      sp_prod1_evaluate_h46_health_compliance_impl_v1: {
        Args: {
          p_claim_facts?: Json
          p_declared_ingredients?: Json
          p_label_facts?: Json
          p_packaging_facts?: Json
          p_product_category: string
          p_profile?: string
        }
        Returns: Json
      }
      sp_prod1_evaluate_h46_health_compliance_v1: {
        Args: {
          p_claim_facts?: Json
          p_declared_ingredients?: Json
          p_label_facts?: Json
          p_packaging_facts?: Json
          p_product_category: string
          p_profile?: string
        }
        Returns: Json
      }
      sp_prod1_finalize_ingredient_qualification_v1: {
        Args: { p_search_id: string }
        Returns: Json
      }
      sp_prod1_finalize_ingredient_qualification_v2: {
        Args: { p_search_id: string }
        Returns: Json
      }
      sp_prod1_h46_build_finding_v1: {
        Args: {
          p_detail: string
          p_evidence?: Json
          p_rule_code: string
          p_status: string
        }
        Returns: Json
      }
      sp_prod1_h46_is_healthcare_food_category_v1: {
        Args: { p_category: string }
        Returns: boolean
      }
      sp_prod1_h46_to_mg_v1: {
        Args: { p_unit: string; p_value: number }
        Returns: number
      }
      sp_prod1_h46b_backfill_search_v1: {
        Args: { p_search_id: string }
        Returns: Json
      }
      sp_prod1_h46b_parse_ingredient_v1: {
        Args: { p_input: string }
        Returns: Json
      }
      sp_prod1_h46b_resolve_regulatory_v1: {
        Args: { p_category?: string; p_input: string; p_profile?: string }
        Returns: Json
      }
      sp_prod1_ingredient_observation_quality_v1: {
        Args: { p_items: Json }
        Returns: Json
      }
      sp_prod1_ingredient_source_priority_v1: {
        Args: { p_source_type: string; p_verified?: boolean }
        Returns: number
      }
      sp_prod1_lookup_merchant_v1: {
        Args: { p_merchant_input: string }
        Returns: {
          merchant_class: string
          merchant_name: string
          merchant_score: number
          priority: number
        }[]
      }
      sp_prod1_lookup_merchant_v1_1: {
        Args: { p_merchant_input: string }
        Returns: {
          merchant_class: string
          merchant_name: string
          merchant_score: number
          priority: number
        }[]
      }
      sp_prod1_normalize_merchant_name_v1: {
        Args: { p_value: string }
        Returns: string
      }
      sp_prod1_normalize_product_source_key_v1: {
        Args: { p_value: string }
        Returns: string
      }
      sp_prod1_parsed_ingredients_to_engine_text_v1: {
        Args: { p_parsed: Json }
        Returns: string
      }
      sp_prod1_qualification_state_v3: {
        Args: { p_search_id: string }
        Returns: Json
      }
      sp_prod1_reconcile_consumer_display_v2: {
        Args: { p_search_id: string }
        Returns: Json
      }
      sp_prod1_record_ingredient_qualification_v1: {
        Args: {
          p_candidate: Json
          p_pool_count: number
          p_railway_response: Json
          p_resolved_offer: Json
          p_search_id: string
        }
        Returns: Json
      }
      sp_prod1_record_ingredient_qualification_v2: {
        Args: {
          p_candidate: Json
          p_pool_count: number
          p_railway_response: Json
          p_resolved_offer: Json
          p_search_id: string
        }
        Returns: Json
      }
      sp_prod1_record_ingredient_qualification_wave_v1: {
        Args: { p_items: Json; p_pool_count: number; p_search_id: string }
        Returns: Json
      }
      sp_prod1_record_ingredient_qualification_wave_v2: {
        Args: { p_items: Json; p_pool_count: number; p_search_id: string }
        Returns: Json
      }
      sp_prod1_record_ingredient_qualification_wave_v3: {
        Args: { p_items: Json; p_pool_count: number; p_search_id: string }
        Returns: Json
      }
      sp_prod1_record_ingredient_sources_batch_v1: {
        Args: {
          p_product_fingerprint: string
          p_search_id: string
          p_sources: Json
        }
        Returns: Json
      }
      sp_prod1_resolve_immersive_offer_v1: {
        Args: {
          p_discovery_merchant: string
          p_discovery_price: number
          p_discovery_title: string
          p_product_title: string
          p_stores: Json
        }
        Returns: Json
      }
      sp_prod1_resolve_ingredient_alias_strict_v1: {
        Args: { p_input: string }
        Returns: Json
      }
      sp_prod1_resolve_verified_ingredient_source_v1: {
        Args: { p_brand_name?: string; p_product_name: string }
        Returns: Json
      }
      sp_prod1_route_regulatory_gap_v1: {
        Args: {
          p_input_name: string
          p_product_fingerprint: string
          p_product_title: string
          p_search_id: string
        }
        Returns: Json
      }
      sp_prod1_route_regulatory_gap_v2: {
        Args: {
          p_category: string
          p_input_name: string
          p_product_fingerprint: string
          p_product_title: string
          p_search_id: string
        }
        Returns: Json
      }
      sp_prod1_run_ingredient_alias_integrity_audit_v1: {
        Args: never
        Returns: Json
      }
      sp_prod1_safety_engine_unavailable_reason_v1: {
        Args: { p_safety_result: Json }
        Returns: string
      }
      sp_prod1_safety_unavailable_reason_v1: {
        Args: {
          p_ingredient_confidence: number
          p_ingredient_count: number
          p_overall_confidence: number
          p_reject_reason: string
          p_response_status: string
          p_trusted_source: boolean
        }
        Returns: string
      }
      sp_prod1_select_discovery_v1: {
        Args: { p_candidates: Json; p_limit?: number }
        Returns: Json
      }
      sp_prod1_select_discovery_v1_1: {
        Args: {
          p_candidates: Json
          p_max_per_merchant?: number
          p_minimum?: number
          p_target?: number
        }
        Returns: Json
      }
      sp_prod1_start_search_v2: { Args: { p_search_id: string }; Returns: Json }
      sp_prod1_verify_qualification_token_v1: {
        Args: { p_search_id: string; p_token: string }
        Returns: boolean
      }
      sp_safety_multisource_numeric_score_v1: {
        Args: { p_product_id: string; p_profile: string }
        Returns: number
      }
      sp_safety_score_canary_diagnostic_v1: { Args: never; Returns: Json }
      sp_safety_score_canary_readiness_v1: {
        Args: { p_study?: string }
        Returns: Json
      }
      sp_safety_score_canary_record_shadow_v1: {
        Args: {
          p_evidence_version: string
          p_profile: string
          p_result: string
          p_scope: string
          p_source_count: number
          p_study: string
          p_unresolved_count: number
        }
        Returns: string
      }
      sp_safety_validation_attest_v1: {
        Args: {
          p_decision: string
          p_evidence_url: string
          p_rationale: string
          p_study: string
        }
        Returns: boolean
      }
      sp_safety_validation_blinded_case_v1: {
        Args: { p_case: string }
        Returns: Json
      }
      sp_safety_validation_calibrate_v1: {
        Args: {
          p_bias_report_url: string
          p_count: number
          p_endpoint: string
          p_report_url: string
          p_rubric_sha256: string
          p_study: string
        }
        Returns: boolean
      }
      sp_safety_validation_evaluate_v1: {
        Args: { p_study: string }
        Returns: Json
      }
      sp_safety_validation_freeze_v1: {
        Args: { p_study: string }
        Returns: Json
      }
      sp_safety_validation_promote_v1: {
        Args: { p_study: string }
        Returns: Json
      }
      sp_safety_validation_release_readiness_v1: {
        Args: { p_study: string }
        Returns: Json
      }
      sp_safety_validation_review_queue_v1: { Args: never; Returns: Json }
      sp_safety_validation_rollback_v1: {
        Args: { p_reason: string; p_study: string }
        Returns: boolean
      }
      sp_safety_validation_submit_review_v1: {
        Args: {
          p_case: string
          p_evidence_url: string
          p_label: string
          p_rationale: string
        }
        Returns: boolean
      }
      sp_us2_catalog_candidate_reuse_v1: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      sp_us2_catalog_candidate_reuse_v2: {
        Args: { p_limit?: number; p_query: string }
        Returns: Json
      }
      sp_us2_category_candidates_v1: {
        Args: {
          p_category: string
          p_exclude_product_id: string
          p_limit?: number
          p_pack_normalized_key: string
        }
        Returns: {
          barcode: string
          brand_name: string
          category: string
          gtin: string
          id: string
          identity_confidence: number
          identity_status: string
          market_country_code: string
          pack_normalized_key: string
          pack_normalized_unit: string
          pack_normalized_value: number
          pack_size_text: string
          product_fingerprint: string
          product_name: string
          subcategory: string
          variant_name: string
        }[]
      }
      sp_us2_category_cards_v1: {
        Args: {
          p_category: string
          p_exclude_product_id: string
          p_limit?: number
          p_pack_normalized_key: string
        }
        Returns: Json
      }
      sp_us2_claim_acquisition_v1: { Args: never; Returns: Json }
      sp_us2_claim_acquisition_v1_1: { Args: never; Returns: Json }
      sp_us2_claim_live_safety_enrichment_v1: {
        Args: { p_cooldown_minutes?: number; p_product_id: string }
        Returns: Json
      }
      sp_us2_claim_live_safety_enrichment_v2: {
        Args: { p_cooldown_minutes?: number; p_product_id: string }
        Returns: Json
      }
      sp_us2_claim_paid_discovery_v1: {
        Args: { p_query: string }
        Returns: Json
      }
      sp_us2_claim_paid_discovery_v2: {
        Args: {
          p_current_count: number
          p_query: string
          p_target_count: number
        }
        Returns: Json
      }
      sp_us2_claim_safety_provider_lease_v1: {
        Args: { p_holder_id: string; p_lease_seconds?: number }
        Returns: Json
      }
      sp_us2_enqueue_acquisition_v1: {
        Args: {
          p_anchor_product_id?: string
          p_category?: string
          p_payload?: Json
          p_query: string
          p_requested_pack_key?: string
          p_search_mode: string
          p_target_alternatives?: number
          p_target_exact_offers?: number
        }
        Returns: Json
      }
      sp_us2_enqueue_acquisition_v1_1: {
        Args: {
          p_anchor_product_id?: string
          p_category?: string
          p_comparison_pack_key?: string
          p_payload?: Json
          p_query: string
          p_requested_pack_key?: string
          p_search_mode: string
          p_target_alternatives?: number
          p_target_category_products?: number
          p_target_exact_offers?: number
        }
        Returns: Json
      }
      sp_us2_exact_offers_v1: {
        Args: {
          p_limit?: number
          p_pack_normalized_key: string
          p_product_id: string
        }
        Returns: {
          affiliate_url: string
          availability_status: string
          currency: string
          exact_pack_match: boolean
          id: string
          image_url: string
          list_price: number
          market_country_code: string
          merchant_name: string
          offer_confidence: number
          pack_match_confidence: number
          pack_normalized_key: string
          pack_normalized_unit: string
          pack_normalized_value: number
          pack_size_text: string
          platform_name: string
          price: number
          product_id: string
          retrieved_at: string
          source_domain: string
          source_url: string
          valid_until: string
          verified: boolean
        }[]
      }
      sp_us2_finish_acquisition_v1: {
        Args: {
          p_error_code?: string
          p_request_id: string
          p_result_summary?: Json
          p_retry_after_seconds?: number
          p_status: string
        }
        Returns: Json
      }
      sp_us2_finish_live_safety_enrichment_v1: {
        Args: { p_product_id: string; p_status: string }
        Returns: Json
      }
      sp_us2_pack_key_from_url_v1: { Args: { p_url: string }; Returns: string }
      sp_us2_recent_acquisition_results_v1: {
        Args: {
          p_limit?: number
          p_query: string
          p_requested_pack_key?: string
        }
        Returns: Json
      }
      sp_us2_release_safety_provider_lease_v1: {
        Args: { p_holder_id: string }
        Returns: Json
      }
      sp_us2_spend_gate_gc_v1: {
        Args: { p_keep_days?: number }
        Returns: number
      }
      sp_us2_spend_gate_v1: {
        Args: { p_client_key?: string; p_provider: string; p_units?: number }
        Returns: Json
      }
      sp_us2_stage_commerce_offer_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      sp_us2_upsert_commerce_offer_v1: {
        Args: { p_offer: Json; p_product_id: string }
        Returns: Json
      }
      sp_us2_upsert_display_image_v1: {
        Args: { p_image: Json; p_product_id: string }
        Returns: Json
      }
      sp_web_browse_bucket_v1: {
        Args: { p_category: string; p_name: string }
        Returns: string
      }
      sp_web_claim_label_ai_slot_v1: {
        Args: { p_limit?: number; p_user_id: string; p_window_seconds?: number }
        Returns: Json
      }
      sp_web_claim_label_pair_slot_v1: {
        Args: { p_limit?: number; p_user_id: string; p_window_seconds?: number }
        Returns: Json
      }
      sp_web_featured_products_v1: {
        Args: { p_category?: string; p_limit?: number; p_profile?: string }
        Returns: Json
      }
      sp_web_featured_products_v1_1: {
        Args: { p_category?: string; p_limit?: number; p_profile?: string }
        Returns: Json
      }
      sp_web_featured_products_v1_2: {
        Args: { p_category?: string; p_limit?: number; p_profile?: string }
        Returns: Json
      }
      sp_web_find_cached_label_analysis_v2: {
        Args: {
          p_engine_version: string
          p_image_sha256: string
          p_profile: string
        }
        Returns: Json
      }
      sp_web_fssai_supplement_schedule_v1: {
        Args: { p_ingredient: string; p_scope: string }
        Returns: Json
      }
      sp_web_get_label_identity_research_v1: {
        Args: { p_normalized_input: string }
        Returns: Json
      }
      sp_web_has_role_v1: {
        Args: {
          _role: Database["public"]["Enums"]["sp_web_app_role_v1"]
          _user_id: string
        }
        Returns: boolean
      }
      sp_web_is_probiotic_v1: {
        Args: { p_category: string; p_name: string }
        Returns: boolean
      }
      sp_web_label_cached_extraction_v1: {
        Args: { p_engine_version: string; p_image_sha256: string }
        Returns: Json
      }
      sp_web_label_exact_pack_clinical_screen_v1: {
        Args: { p_profile?: string; p_query: string }
        Returns: Json
      }
      sp_web_label_exact_pack_multi_source_v1: {
        Args: { p_profile?: string; p_query: string }
        Returns: Json
      }
      sp_web_label_exact_pack_search_v1: {
        Args: { p_profile?: string; p_query: string }
        Returns: Json
      }
      sp_web_label_exact_pair_transcription_v1: {
        Args: {
          p_front_sha256: string
          p_ingredient_sha256: string
          p_owner_id: string
          p_profile: string
        }
        Returns: Json
      }
      sp_web_label_record_pack_scan_v1: {
        Args: {
          p_breakdown: Json
          p_coverage: number
          p_front_sha256: string
          p_ingredient_sha256: string
          p_ingredients: Json
          p_owner_id: string
          p_policy: string
          p_profile: string
          p_run_id: string
          p_score: number
          p_status: string
          p_warnings: Json
        }
        Returns: string
      }
      sp_web_label_record_supplement_review_v1: {
        Args: { p_owner_id: string; p_report: Json; p_run_id: string }
        Returns: boolean
      }
      sp_web_label_regulatory_reference_v1: {
        Args: { p_limit?: number }
        Returns: {
          ingredient_name: string
          max_limit: string
          notes: string
          status: string
        }[]
      }
      sp_web_label_save_clinical_screen_v1: {
        Args: { p_owner_id: string; p_run_id: string; p_screen: Json }
        Returns: boolean
      }
      sp_web_label_save_multi_source_v1: {
        Args: { p_owner_id: string; p_report: Json; p_run_id: string }
        Returns: boolean
      }
      sp_web_log_page_view_v1: {
        Args: {
          p_category?: string
          p_category_clicked?: string
          p_device_type?: string
          p_page?: string
          p_profile_used?: string
          p_search_term?: string
          p_session_id?: string
        }
        Returns: number
      }
      sp_web_normalize_label_ingredients_v1: {
        Args: { p_ingredients: Json }
        Returns: Json
      }
      sp_web_popular_searches_v1: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      sp_web_progress_label_research_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      sp_web_record_label_analysis_v1: {
        Args: {
          p_detected_ingredients: Json
          p_ingredient_breakdown: Json
          p_profile_used: string
          p_safety_score: number
          p_session_id: string
          p_summary: string
          p_uploaded_image_url?: string
          p_warnings: Json
        }
        Returns: string
      }
      sp_web_record_label_analysis_v2: {
        Args: {
          p_detected_ingredients: Json
          p_engine_version: string
          p_evidence_coverage: number
          p_image_sha256: string
          p_ingredient_breakdown: Json
          p_product_scope: string
          p_profile_used: string
          p_research_pending_count: number
          p_resolution_snapshot: Json
          p_safety_score: number
          p_score_policy_version: string
          p_session_id: string
          p_summary: string
          p_warnings: Json
        }
        Returns: string
      }
      sp_web_record_label_analysis_v3: {
        Args: {
          p_confidence_adjustment: number
          p_detected_ingredients: Json
          p_engine_version: string
          p_evidence_coverage: number
          p_image_sha256: string
          p_ingredient_breakdown: Json
          p_product_scope: string
          p_profile_used: string
          p_regulatory_screen_score: number
          p_research_pending_count: number
          p_resolution_snapshot: Json
          p_safety_score: number
          p_safety_score_raw: number
          p_score_policy_version: string
          p_session_id: string
          p_summary: string
          p_warnings: Json
        }
        Returns: string
      }
      sp_web_resolve_label_ingredient_v2: {
        Args: { p_name: string; p_product_scope?: string }
        Returns: Json
      }
      sp_web_runtime_identity_check_v1: { Args: never; Returns: Json }
      sp_web_score_label_safety_v1: {
        Args: {
          p_breakdown: Json
          p_product_scope?: string
          p_profile?: string
        }
        Returns: Json
      }
      sp_web_score_label_v1: { Args: { p_breakdown: Json }; Returns: Json }
      sp_web_submit_contact_v1: {
        Args: {
          p_attachment_url?: string
          p_email: string
          p_full_name: string
          p_message: string
          p_phone: string
          p_purpose: string
          p_subject: string
          p_user_type: string
        }
        Returns: string
      }
      sp_web_upsert_label_identity_research_v1: {
        Args: { p_payload: Json }
        Returns: undefined
      }
      submit_evidence_review_decision_v1: {
        Args: {
          p_claim_supported: boolean
          p_document_checked: boolean
          p_exposure_route_confirmed: boolean
          p_ingredient_identity_confirmed: boolean
          p_product_scope_confirmed: boolean
          p_queue_id: number
          p_review_decision: string
          p_reviewer_name: string
          p_source_version_confirmed: boolean
          p_verification_notes: string
          p_verified_document_url: string
          p_verified_source_reference: string
          p_verified_source_version: string
        }
        Returns: Json
      }
      test_warning_cleanup_patch_d_v1: { Args: never; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      update_scientific_factory_run_v1: {
        Args: {
          p_model_name?: string
          p_model_response_id?: string
          p_payload?: Json
          p_run_id: string
          p_run_status: string
        }
        Returns: Json
      }
      upsert_ingredient_evidence_v1: {
        Args: {
          p_canonical_name: string
          p_contradicts_classification: string
          p_evidence_confidence: number
          p_evidence_strength: string
          p_evidence_summary: string
          p_evidence_title: string
          p_evidence_type: string
          p_extracted_requirement: string
          p_source_code: string
          p_source_date: string
          p_source_document: string
          p_source_reference: string
          p_source_url: string
          p_source_version: string
          p_supports_classification: string
          p_verified_by: string
        }
        Returns: Json
      }
      upsert_product_cache: {
        Args: {
          p_affiliate_url: string
          p_brand_name: string
          p_category: string
          p_currency: string
          p_current_price: number
          p_image_url: string
          p_merchant_name: string
          p_normalized_name: string
          p_product_fingerprint: string
          p_product_name: string
          p_product_url: string
          p_raw_ingredient_text: string
        }
        Returns: Json
      }
      upsert_product_cache_auto: {
        Args: {
          p_affiliate_url: string
          p_brand_name: string
          p_category: string
          p_currency: string
          p_current_price: number
          p_image_url: string
          p_merchant_name: string
          p_normalized_name: string
          p_product_fingerprint: string
          p_product_name: string
          p_product_url: string
          p_raw_ingredient_text: string
        }
        Returns: Json
      }
      upsert_product_source: {
        Args: {
          p_affiliate_url: string
          p_brand_name: string
          p_category: string
          p_confidence?: number
          p_image_url: string
          p_merchant_class: string
          p_merchant_name: string
          p_normalized_product_name: string
          p_product_fingerprint: string
          p_product_name: string
          p_resolved_product_url: string
          p_source_domain: string
          p_source_priority: number
          p_source_type: string
          p_source_url: string
          p_success?: boolean
          p_supports_json?: boolean
          p_supports_ocr?: boolean
          p_supports_shopify?: boolean
          p_verified?: boolean
          p_verified_by?: string
        }
        Returns: Json
      }
      upsert_scientific_evidence_v1: {
        Args: { p_prepared_payload: Json; p_raw_evidence_id?: number }
        Returns: Json
      }
      validate_scientific_evidence_v1: {
        Args: {
          p_evidence_strength: string
          p_evidence_type: string
          p_source_document?: string
          p_source_registry_id: number
        }
        Returns: Json
      }
      validate_scientific_ingestion_payload_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      verify_ingredient_evidence_claim_v1: {
        Args: {
          p_claim_supported: boolean
          p_document_checked: boolean
          p_evidence_id: number
          p_exposure_route_confirmed: boolean
          p_ingredient_identity_confirmed: boolean
          p_product_scope_confirmed: boolean
          p_review_decision: string
          p_reviewer_name: string
          p_source_version_confirmed: boolean
          p_verification_notes: string
          p_verified_document_url: string
          p_verified_source_reference: string
          p_verified_source_version: string
        }
        Returns: Json
      }
      warning_deduplication_key_v1: {
        Args: { p_warning: string }
        Returns: string
      }
    }
    Enums: {
      agency_enum: "FDA" | "EU" | "WHO" | "CDSCO" | "EPA" | "OTHER"
      category_enum:
        | "COSMETIC"
        | "SUPPLEMENT"
        | "FOOD"
        | "PHARMA"
        | "CHEMICAL"
        | "OTHER"
      sp_web_app_role_v1: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      search_engine_response: {
        search_id: string | null
        search_query: string | null
        category: string | null
        resolved_category: string | null
        user_profile: string | null
        resolved_profile: string | null
        resolved_location: string | null
        enable_local_commerce: boolean | null
        cache_hit: boolean | null
        product_count: number | null
        products: Json | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agency_enum: ["FDA", "EU", "WHO", "CDSCO", "EPA", "OTHER"],
      category_enum: [
        "COSMETIC",
        "SUPPLEMENT",
        "FOOD",
        "PHARMA",
        "CHEMICAL",
        "OTHER",
      ],
      sp_web_app_role_v1: ["admin", "moderator", "user"],
    },
  },
} as const
