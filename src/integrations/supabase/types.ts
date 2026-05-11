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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      absence_coverage: {
        Row: {
          created_at: string
          end_date: string
          id: string
          member_id: string
          reason: string
          sos_notes: string | null
          start_date: string
          status: string
          substitute_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          member_id: string
          reason?: string
          sos_notes?: string | null
          start_date: string
          status?: string
          substitute_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          member_id?: string
          reason?: string
          sos_notes?: string | null
          start_date?: string
          status?: string
          substitute_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_coverage_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_coverage_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_coverage_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_coverage_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      access_password_audit: {
        Row: {
          access_id: string | null
          action: string
          created_at: string
          id: string
          ip: string | null
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          access_id?: string | null
          action: string
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          access_id?: string | null
          action?: string
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_password_audit_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "platform_accesses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          automation_key: string
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          automation_key: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          automation_key?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      backups: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          started_at: string
          status: string
          tables_count: number | null
          trigger_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          started_at?: string
          status?: string
          tables_count?: number | null
          trigger_type?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          started_at?: string
          status?: string
          tables_count?: number | null
          trigger_type?: string
        }
        Relationships: []
      }
      brand_archetypes: {
        Row: {
          archetype: string | null
          id: string
          notes: string | null
          slot: string
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          id?: string
          notes?: string | null
          slot: string
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          id?: string
          notes?: string | null
          slot?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_competitors: {
        Row: {
          comunicacao: string | null
          created_at: string
          id: string
          instagram: string | null
          name: string
          plataformas: string | null
          posicionamento: string | null
          precos: string | null
          produtos: string | null
          sort_order: number
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          comunicacao?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name: string
          plataformas?: string | null
          posicionamento?: string | null
          precos?: string | null
          produtos?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          comunicacao?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          name?: string
          plataformas?: string | null
          posicionamento?: string | null
          precos?: string | null
          produtos?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      brand_content_pillars: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      brand_differentials: {
        Row: {
          content: string
          created_at: string
          id: string
          sort_order: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      brand_folder_links: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          sort_order: number
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      brand_kanban_items: {
        Row: {
          content: string | null
          created_at: string
          emoji: string
          group_key: string
          id: string
          is_system: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          emoji?: string
          group_key: string
          id?: string
          is_system?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          emoji?: string
          group_key?: string
          id?: string
          is_system?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_kanban_section_attachments: {
        Row: {
          created_at: string
          file_path: string | null
          file_type: string | null
          id: string
          kind: string
          label: string
          section_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          kind: string
          label: string
          section_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          kind?: string
          label?: string
          section_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kanban_section_attachments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "brand_kanban_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kanban_sections: {
        Row: {
          content: string | null
          created_at: string
          id: string
          item_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          item_id: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          item_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kanban_sections_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "brand_kanban_items"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_links: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      brand_personality_images: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string | null
          id: string
          image_url: string
          kind: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          image_url: string
          kind: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          image_url?: string
          kind?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      brand_swot_items: {
        Row: {
          content: string
          created_at: string
          id: string
          quadrant: string
          sort_order: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          quadrant: string
          sort_order?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          quadrant?: string
          sort_order?: number
        }
        Relationships: []
      }
      brand_universe_notes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_visual_cards: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_visual_files: {
        Row: {
          caption: string | null
          card_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          caption?: string | null
          card_id: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
        }
        Update: {
          caption?: string | null
          card_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_visual_files_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "brand_visual_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      business_legal_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          expires_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          expires_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_plan_cards: {
        Row: {
          column_key: string
          content: string
          created_at: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          column_key: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          column_key?: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      business_plan_custom_columns: {
        Row: {
          column_key: string
          created_at: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          column_key: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          column_key?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      business_plan_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          value_proposition: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          value_proposition?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          value_proposition?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          about_text: string | null
          accent_color: string
          accountant_member_id: string | null
          accountant_type: string
          activity_start_date: string | null
          auto_calendar_labels: Json
          background_color: string
          business_name: string
          business_sector: string
          business_type: string
          created_at: string
          disabled_modules: Json
          font_body: string
          font_display: string
          has_accountant: boolean
          id: string
          iva_exempt: boolean
          iva_exemption_end_date: string | null
          kanban_group_labels: Json
          kanban_group_order: Json
          login_bg_url: string | null
          logo_position_y: number
          logo_url: string | null
          mission: string | null
          primary_color: string
          proposta_unica_valor: string | null
          secondary_color: string
          ss_exempt: boolean
          ss_exemption_end_date: string | null
          ss_type: string
          support_hours: string | null
          tactical_areas: Json
          tax_irs_regime: string
          tax_iva_regime: string
          team_type: string
          text_color: string
          updated_at: string
          use_system_theme: boolean
          values_list: Json
          vision: string | null
          weekly_align_day: number
          welcome_client_email_settings: Json
          welcome_text: string | null
          whatsapp_team_url: string | null
        }
        Insert: {
          about_text?: string | null
          accent_color?: string
          accountant_member_id?: string | null
          accountant_type?: string
          activity_start_date?: string | null
          auto_calendar_labels?: Json
          background_color?: string
          business_name: string
          business_sector?: string
          business_type?: string
          created_at?: string
          disabled_modules?: Json
          font_body?: string
          font_display?: string
          has_accountant?: boolean
          id?: string
          iva_exempt?: boolean
          iva_exemption_end_date?: string | null
          kanban_group_labels?: Json
          kanban_group_order?: Json
          login_bg_url?: string | null
          logo_position_y?: number
          logo_url?: string | null
          mission?: string | null
          primary_color?: string
          proposta_unica_valor?: string | null
          secondary_color?: string
          ss_exempt?: boolean
          ss_exemption_end_date?: string | null
          ss_type?: string
          support_hours?: string | null
          tactical_areas?: Json
          tax_irs_regime?: string
          tax_iva_regime?: string
          team_type?: string
          text_color?: string
          updated_at?: string
          use_system_theme?: boolean
          values_list?: Json
          vision?: string | null
          weekly_align_day?: number
          welcome_client_email_settings?: Json
          welcome_text?: string | null
          whatsapp_team_url?: string | null
        }
        Update: {
          about_text?: string | null
          accent_color?: string
          accountant_member_id?: string | null
          accountant_type?: string
          activity_start_date?: string | null
          auto_calendar_labels?: Json
          background_color?: string
          business_name?: string
          business_sector?: string
          business_type?: string
          created_at?: string
          disabled_modules?: Json
          font_body?: string
          font_display?: string
          has_accountant?: boolean
          id?: string
          iva_exempt?: boolean
          iva_exemption_end_date?: string | null
          kanban_group_labels?: Json
          kanban_group_order?: Json
          login_bg_url?: string | null
          logo_position_y?: number
          logo_url?: string | null
          mission?: string | null
          primary_color?: string
          proposta_unica_valor?: string | null
          secondary_color?: string
          ss_exempt?: boolean
          ss_exemption_end_date?: string | null
          ss_type?: string
          support_hours?: string | null
          tactical_areas?: Json
          tax_irs_regime?: string
          tax_iva_regime?: string
          team_type?: string
          text_color?: string
          updated_at?: string
          use_system_theme?: boolean
          values_list?: Json
          vision?: string | null
          weekly_align_day?: number
          welcome_client_email_settings?: Json
          welcome_text?: string | null
          whatsapp_team_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_accountant_member_id_fkey"
            columns: ["accountant_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_settings_accountant_member_id_fkey"
            columns: ["accountant_member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      business_setup: {
        Row: {
          banco: string
          business_email: string | null
          business_legal_name: string
          business_phone: string | null
          business_website: string | null
          cae_principal: string
          cae_secundarios: string
          capital_social: string
          cirs_code: string | null
          contabilista: string
          contabilista_contacto: string
          created_at: string
          email_send_to_clients_enabled: boolean
          email_test_mode: boolean
          email_test_redirect: string
          iban: string
          id: string
          morada_fiscal: string
          nif: string
          niss: string | null
          notas: string
          payment_methods: Json | null
          regime_fiscal: string
          regime_iva: string
          updated_at: string
        }
        Insert: {
          banco?: string
          business_email?: string | null
          business_legal_name?: string
          business_phone?: string | null
          business_website?: string | null
          cae_principal?: string
          cae_secundarios?: string
          capital_social?: string
          cirs_code?: string | null
          contabilista?: string
          contabilista_contacto?: string
          created_at?: string
          email_send_to_clients_enabled?: boolean
          email_test_mode?: boolean
          email_test_redirect?: string
          iban?: string
          id?: string
          morada_fiscal?: string
          nif?: string
          niss?: string | null
          notas?: string
          payment_methods?: Json | null
          regime_fiscal?: string
          regime_iva?: string
          updated_at?: string
        }
        Update: {
          banco?: string
          business_email?: string | null
          business_legal_name?: string
          business_phone?: string | null
          business_website?: string | null
          cae_principal?: string
          cae_secundarios?: string
          capital_social?: string
          cirs_code?: string | null
          contabilista?: string
          contabilista_contacto?: string
          created_at?: string
          email_send_to_clients_enabled?: boolean
          email_test_mode?: boolean
          email_test_redirect?: string
          iban?: string
          id?: string
          morada_fiscal?: string
          nif?: string
          niss?: string | null
          notas?: string
          payment_methods?: Json | null
          regime_fiscal?: string
          regime_iva?: string
          updated_at?: string
        }
        Relationships: []
      }
      capacity_scenario_products: {
        Row: {
          created_at: string
          current_clients: number
          hours_per_client_month: number
          id: string
          price_per_client: number
          product_id: string | null
          product_name: string
          scenario_id: string
        }
        Insert: {
          created_at?: string
          current_clients?: number
          hours_per_client_month?: number
          id?: string
          price_per_client?: number
          product_id?: string | null
          product_name: string
          scenario_id: string
        }
        Update: {
          created_at?: string
          current_clients?: number
          hours_per_client_month?: number
          id?: string
          price_per_client?: number
          product_id?: string | null
          product_name?: string
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_scenario_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_scenario_products_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "capacity_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_scenarios: {
        Row: {
          admin_percent: number
          business_percent: number
          client_facing_count: number
          created_at: string
          id: string
          member_overheads: Json | null
          name: string
          notes: string | null
          team_size: number
          updated_at: string
          useful_hours_per_month: number
        }
        Insert: {
          admin_percent?: number
          business_percent?: number
          client_facing_count?: number
          created_at?: string
          id?: string
          member_overheads?: Json | null
          name?: string
          notes?: string | null
          team_size?: number
          updated_at?: string
          useful_hours_per_month?: number
        }
        Update: {
          admin_percent?: number
          business_percent?: number
          client_facing_count?: number
          created_at?: string
          id?: string
          member_overheads?: Json | null
          name?: string
          notes?: string | null
          team_size?: number
          updated_at?: string
          useful_hours_per_month?: number
        }
        Relationships: []
      }
      channel_monthly_metrics: {
        Row: {
          channel_id: string
          created_at: string
          em_avg_click_rate: number | null
          em_avg_open_rate: number | null
          em_list_growth: number | null
          em_list_total: number | null
          followers: number | null
          followers_growth: number | null
          id: string
          ig_accounts_reached: number | null
          ig_avg_comments: number | null
          ig_avg_likes: number | null
          ig_avg_saves: number | null
          ig_bio_link_clicks: number | null
          ig_engagement_rate: number | null
          ig_profile_visits: number | null
          ig_total_impressions: number | null
          li_page_visits: number | null
          li_total_impressions: number | null
          month: number
          notes: string | null
          pt_monthly_impressions: number | null
          pt_total_clicks: number | null
          tt_total_likes: number | null
          tt_total_shares: number | null
          tt_total_views: number | null
          year: number
          yt_new_subscribers: number | null
          yt_total_views: number | null
          yt_watch_hours: number | null
        }
        Insert: {
          channel_id: string
          created_at?: string
          em_avg_click_rate?: number | null
          em_avg_open_rate?: number | null
          em_list_growth?: number | null
          em_list_total?: number | null
          followers?: number | null
          followers_growth?: number | null
          id?: string
          ig_accounts_reached?: number | null
          ig_avg_comments?: number | null
          ig_avg_likes?: number | null
          ig_avg_saves?: number | null
          ig_bio_link_clicks?: number | null
          ig_engagement_rate?: number | null
          ig_profile_visits?: number | null
          ig_total_impressions?: number | null
          li_page_visits?: number | null
          li_total_impressions?: number | null
          month: number
          notes?: string | null
          pt_monthly_impressions?: number | null
          pt_total_clicks?: number | null
          tt_total_likes?: number | null
          tt_total_shares?: number | null
          tt_total_views?: number | null
          year: number
          yt_new_subscribers?: number | null
          yt_total_views?: number | null
          yt_watch_hours?: number | null
        }
        Update: {
          channel_id?: string
          created_at?: string
          em_avg_click_rate?: number | null
          em_avg_open_rate?: number | null
          em_list_growth?: number | null
          em_list_total?: number | null
          followers?: number | null
          followers_growth?: number | null
          id?: string
          ig_accounts_reached?: number | null
          ig_avg_comments?: number | null
          ig_avg_likes?: number | null
          ig_avg_saves?: number | null
          ig_bio_link_clicks?: number | null
          ig_engagement_rate?: number | null
          ig_profile_visits?: number | null
          ig_total_impressions?: number | null
          li_page_visits?: number | null
          li_total_impressions?: number | null
          month?: number
          notes?: string | null
          pt_monthly_impressions?: number | null
          pt_total_clicks?: number | null
          tt_total_likes?: number | null
          tt_total_shares?: number | null
          tt_total_views?: number | null
          year?: number
          yt_new_subscribers?: number | null
          yt_total_views?: number | null
          yt_watch_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_monthly_metrics_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_pages: {
        Row: {
          channel_id: string
          content: string | null
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_pages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_reports: {
        Row: {
          channel_id: string | null
          created_at: string
          data: Json | null
          id: string
          notes: string | null
          report_month: number | null
          report_year: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          report_month?: number | null
          report_year?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          report_month?: number | null
          report_year?: number | null
        }
        Relationships: []
      }
      client_activities: {
        Row: {
          activity: string
          client_id: string
          created_at: string
          id: string
          phase: string | null
          responsible: string | null
          rule: string | null
          sort_order: number
        }
        Insert: {
          activity?: string
          client_id: string
          created_at?: string
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          sort_order?: number
        }
        Update: {
          activity?: string
          client_id?: string
          created_at?: string
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assignment_type: string
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          profile_id: string
        }
        Insert: {
          assignment_type?: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          assignment_type?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback: {
        Row: {
          client_id: string | null
          created_at: string
          feedback_date: string | null
          feedback_text: string | null
          id: string
          rating: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          feedback_date?: string | null
          feedback_text?: string | null
          id?: string
          rating?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          feedback_date?: string | null
          feedback_text?: string | null
          id?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_history: {
        Row: {
          client_id: string
          created_at: string
          entry_date: string
          id: string
          lead_id: string | null
          milestone: string
          observations: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          entry_date?: string
          id?: string
          lead_id?: string | null
          milestone?: string
          observations?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          lead_id?: string | null
          milestone?: string
          observations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_milestones: {
        Row: {
          client_id: string
          created_at: string
          expected_date: string
          id: string
          milestone: string
          milestone_type: string
          notes: string | null
          product_id: string | null
          responsible_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expected_date: string
          id?: string
          milestone?: string
          milestone_type?: string
          notes?: string | null
          product_id?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expected_date?: string
          id?: string
          milestone?: string
          milestone_type?: string
          notes?: string | null
          product_id?: string | null
          responsible_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_milestones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_milestones_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_nps_records: {
        Row: {
          actual_date: string | null
          client_id: string
          created_at: string
          expected_date: string
          id: string
          is_manual: boolean
          notes: string | null
          nps_score: number | null
          product_id: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          client_id: string
          created_at?: string
          expected_date: string
          id?: string
          is_manual?: boolean
          notes?: string | null
          nps_score?: number | null
          product_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          client_id?: string
          created_at?: string
          expected_date?: string
          id?: string
          is_manual?: boolean
          notes?: string | null
          nps_score?: number | null
          product_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_nps_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_nps_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_nps_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_nps_records_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_offboarding: {
        Row: {
          activity: string
          client_id: string
          completed: boolean | null
          created_at: string | null
          documents_links: string | null
          due_date: string | null
          id: string
          phase: string | null
          responsible: string | null
          rule: string | null
          rule_days: number | null
          rule_trigger: string | null
          rule_unit: string | null
          sort_order: number | null
        }
        Insert: {
          activity?: string
          client_id: string
          completed?: boolean | null
          created_at?: string | null
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number | null
        }
        Update: {
          activity?: string
          client_id?: string
          completed?: boolean | null
          created_at?: string | null
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_offboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_offboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          activity: string
          client_id: string
          completed: boolean
          created_at: string
          documents_links: string | null
          due_date: string | null
          id: string
          phase: string | null
          responsible: string | null
          rule: string | null
          rule_days: number | null
          rule_trigger: string | null
          rule_unit: string | null
          sort_order: number
        }
        Insert: {
          activity?: string
          client_id: string
          completed?: boolean
          created_at?: string
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
        }
        Update: {
          activity?: string
          client_id?: string
          completed?: boolean
          created_at?: string
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portals: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          last_visit_at: string | null
          portal_type: Database["public"]["Enums"]["portal_type"]
          show_faqs: boolean
          show_meetings: boolean
          show_monthly_summary: boolean
          show_onboarding: boolean
          show_payments: boolean
          show_timeline: boolean
          show_workspace: boolean
          slug: string | null
          token: string
          welcome_email_sent_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_visit_at?: string | null
          portal_type: Database["public"]["Enums"]["portal_type"]
          show_faqs?: boolean
          show_meetings?: boolean
          show_monthly_summary?: boolean
          show_onboarding?: boolean
          show_payments?: boolean
          show_timeline?: boolean
          show_workspace?: boolean
          slug?: string | null
          token?: string
          welcome_email_sent_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_visit_at?: string | null
          portal_type?: Database["public"]["Enums"]["portal_type"]
          show_faqs?: boolean
          show_meetings?: boolean
          show_monthly_summary?: boolean
          show_onboarding?: boolean
          show_payments?: boolean
          show_timeline?: boolean
          show_workspace?: boolean
          slug?: string | null
          token?: string
          welcome_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_renewals: {
        Row: {
          activity: string
          client_id: string
          completed: boolean
          created_at: string
          cycle_number: number
          documents_links: string | null
          due_date: string | null
          id: string
          phase: string | null
          project_id: string | null
          responsible: string | null
          rule: string | null
          rule_days: number | null
          rule_trigger: string | null
          rule_unit: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          activity: string
          client_id: string
          completed?: boolean
          created_at?: string
          cycle_number?: number
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          project_id?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          activity?: string
          client_id?: string
          completed?: boolean
          created_at?: string
          cycle_number?: number
          documents_links?: string | null
          due_date?: string | null
          id?: string
          phase?: string | null
          project_id?: string | null
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_renewals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_renewals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birthday: string | null
          client_files: Json | null
          client_id: string
          client_since: string | null
          conversion_date: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          current_product: string | null
          current_product_id: string | null
          documents: string | null
          dp: string | null
          drive_folder_url: string | null
          email: string | null
          end_of_cycle: string | null
          final_settlement_amount: number | null
          final_settlement_notes: string | null
          final_settlement_status: string | null
          fiscal_address: string | null
          full_name: string
          icon: Json | null
          id: string
          is_legacy: boolean
          legacy_product_description: string | null
          nif: string | null
          observations: string | null
          payment_method: string | null
          pending_renewal_project_id: string | null
          portal_deactivation_date: string | null
          renewal_count: number
          start_date: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          whatsapp_group_url: string | null
        }
        Insert: {
          birthday?: string | null
          client_files?: Json | null
          client_id?: string
          client_since?: string | null
          conversion_date?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          current_product?: string | null
          current_product_id?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          final_settlement_amount?: number | null
          final_settlement_notes?: string | null
          final_settlement_status?: string | null
          fiscal_address?: string | null
          full_name: string
          icon?: Json | null
          id?: string
          is_legacy?: boolean
          legacy_product_description?: string | null
          nif?: string | null
          observations?: string | null
          payment_method?: string | null
          pending_renewal_project_id?: string | null
          portal_deactivation_date?: string | null
          renewal_count?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_group_url?: string | null
        }
        Update: {
          birthday?: string | null
          client_files?: Json | null
          client_id?: string
          client_since?: string | null
          conversion_date?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          current_product?: string | null
          current_product_id?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          final_settlement_amount?: number | null
          final_settlement_notes?: string | null
          final_settlement_status?: string | null
          fiscal_address?: string | null
          full_name?: string
          icon?: Json | null
          id?: string
          is_legacy?: boolean
          legacy_product_description?: string | null
          nif?: string | null
          observations?: string | null
          payment_method?: string | null
          pending_renewal_project_id?: string | null
          portal_deactivation_date?: string | null
          renewal_count?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          whatsapp_group_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_current_product_id_fkey"
            columns: ["current_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_pending_renewal_project_id_fkey"
            columns: ["pending_renewal_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_monthly_analysis: {
        Row: {
          created_at: string
          id: string
          month: number
          portfolio_notes: string | null
          what_went_well: string | null
          what_went_wrong: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          portfolio_notes?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          portfolio_notes?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
          year?: number
        }
        Relationships: []
      }
      commercial_annual_goals: {
        Row: {
          created_at: string
          goal_amount: number
          id: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          goal_amount?: number
          id?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          goal_amount?: number
          id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      commercial_library_entries: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          entry_type: string
          id: string
          learnings: string | null
          materials: Json | null
          notes: string | null
          product: string | null
          product_id: string | null
          project_id: string | null
          result: string
          results_numbers: string | null
          start_date: string | null
          summary: string | null
          title: string
          updated_at: string
          what_didnt_work: string | null
          what_worked: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          entry_type?: string
          id?: string
          learnings?: string | null
          materials?: Json | null
          notes?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          result?: string
          results_numbers?: string | null
          start_date?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          entry_type?: string
          id?: string
          learnings?: string | null
          materials?: Json | null
          notes?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          result?: string
          results_numbers?: string | null
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_library_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_library_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_monthly_analysis: {
        Row: {
          active_actions_results: string | null
          created_at: string
          id: string
          main_objections: string | null
          month: number
          what_went_well: string | null
          what_went_wrong: string | null
          year: number
        }
        Insert: {
          active_actions_results?: string | null
          created_at?: string
          id?: string
          main_objections?: string | null
          month: number
          what_went_well?: string | null
          what_went_wrong?: string | null
          year: number
        }
        Update: {
          active_actions_results?: string | null
          created_at?: string
          id?: string
          main_objections?: string | null
          month?: number
          what_went_well?: string | null
          what_went_wrong?: string | null
          year?: number
        }
        Relationships: []
      }
      commercial_monthly_goals: {
        Row: {
          created_at: string
          goal_amount: number
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          goal_amount?: number
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          goal_amount?: number
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      commercial_product_goals: {
        Row: {
          created_at: string
          goal_amount: number
          id: string
          intention: string | null
          product_id: string | null
          product_name: string
          sort_order: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          goal_amount?: number
          id?: string
          intention?: string | null
          product_id?: string | null
          product_name: string
          sort_order?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          goal_amount?: number
          id?: string
          intention?: string | null
          product_id?: string | null
          product_name?: string
          sort_order?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_product_goals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_quarterly_goals: {
        Row: {
          created_at: string
          goal_amount: number
          id: string
          quarter: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          goal_amount?: number
          id?: string
          quarter: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          goal_amount?: number
          id?: string
          quarter?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      commercial_sales: {
        Row: {
          assigned_to: string | null
          base_value: number
          client: string | null
          client_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          documents: Json | null
          icon: Json | null
          id: string
          invoice_total: number
          is_special_offer: boolean
          payment_date: string | null
          payment_method: string | null
          product: string | null
          product_id: string | null
          project_id: string | null
          sale_id: string
          sale_month: number | null
          sale_quarter: number | null
          sale_year: number | null
          source: string | null
          special_offer_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          base_value?: number
          client?: string | null
          client_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          icon?: Json | null
          id?: string
          invoice_total?: number
          is_special_offer?: boolean
          payment_date?: string | null
          payment_method?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          sale_id: string
          sale_month?: number | null
          sale_quarter?: number | null
          sale_year?: number | null
          source?: string | null
          special_offer_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          base_value?: number
          client?: string | null
          client_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          icon?: Json | null
          id?: string
          invoice_total?: number
          is_special_offer?: boolean
          payment_date?: string | null
          payment_method?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          sale_id?: string
          sale_month?: number | null
          sale_quarter?: number | null
          sale_year?: number | null
          source?: string | null
          special_offer_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_sales_actions: {
        Row: {
          action_name: string
          action_type: string
          created_at: string
          created_by: string | null
          end_date: string | null
          enrollment_open_date: string | null
          id: string
          notes: string | null
          objective: string | null
          product: string | null
          product_id: string | null
          project_id: string | null
          result: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_name: string
          action_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          result?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_name?: string
          action_type?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          enrollment_open_date?: string | null
          id?: string
          notes?: string | null
          objective?: string | null
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          result?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_sales_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_sales_actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_strategy: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          period: string
          sections: Json
          start_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          period?: string
          sections?: Json
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          period?: string
          sections?: Json
          start_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      commercial_strategy_projects: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          strategy_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          strategy_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          strategy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_strategy_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_strategy_projects_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "commercial_strategy"
            referencedColumns: ["id"]
          },
        ]
      }
      content_attachments: {
        Row: {
          content_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          sort_order: number
        }
        Insert: {
          content_id: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          sort_order?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_attachments_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_channels: {
        Row: {
          channel_id: string
          content_id: string
          created_at: string
          id: string
        }
        Insert: {
          channel_id: string
          content_id: string
          created_at?: string
          id?: string
        }
        Update: {
          channel_id?: string
          content_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_channels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_channels_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_comments: {
        Row: {
          author_id: string
          body: string
          content_item_id: string
          created_at: string
          id: string
          parent_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          content_item_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          content_item_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_comments_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_item_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_item_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          body_template: Json | null
          content_type: string | null
          copy_content: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          format: string | null
          funnel_stage: string | null
          icon: Json | null
          id: string
          launch_id: string | null
          objective: string | null
          product_id: string | null
          product_name: string | null
          project_id: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          body_template?: Json | null
          content_type?: string | null
          copy_content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          funnel_stage?: string | null
          icon?: Json | null
          id?: string
          launch_id?: string | null
          objective?: string | null
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          body_template?: Json | null
          content_type?: string | null
          copy_content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          funnel_stage?: string | null
          icon?: Json | null
          id?: string
          launch_id?: string | null
          objective?: string | null
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "commercial_library_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_metrics: {
        Row: {
          avg_watch_time: number | null
          channel_id: string
          comments: number | null
          content_id: string
          created_at: string
          ctr: number | null
          email_click_rate: number | null
          email_open_rate: number | null
          email_sent: number | null
          email_unsubscribes: number | null
          format: string | null
          id: string
          impressions: number | null
          likes: number | null
          month: number
          new_subscribers: number | null
          pin_link_clicks: number | null
          reach: number | null
          saves: number | null
          shares: number | null
          story_exits: number | null
          story_link_clicks: number | null
          story_replies: number | null
          views: number | null
          watch_hours: number | null
          year: number
        }
        Insert: {
          avg_watch_time?: number | null
          channel_id: string
          comments?: number | null
          content_id: string
          created_at?: string
          ctr?: number | null
          email_click_rate?: number | null
          email_open_rate?: number | null
          email_sent?: number | null
          email_unsubscribes?: number | null
          format?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          month: number
          new_subscribers?: number | null
          pin_link_clicks?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          story_exits?: number | null
          story_link_clicks?: number | null
          story_replies?: number | null
          views?: number | null
          watch_hours?: number | null
          year: number
        }
        Update: {
          avg_watch_time?: number | null
          channel_id?: string
          comments?: number | null
          content_id?: string
          created_at?: string
          ctr?: number | null
          email_click_rate?: number | null
          email_open_rate?: number | null
          email_sent?: number | null
          email_unsubscribes?: number | null
          format?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          month?: number
          new_subscribers?: number | null
          pin_link_clicks?: number | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
          story_exits?: number | null
          story_link_clicks?: number | null
          story_replies?: number | null
          views?: number | null
          watch_hours?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_metrics_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_metrics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_custom_stages: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          sort_order: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          sort_order?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      crm_interactions: {
        Row: {
          created_at: string
          files: string | null
          id: string
          interaction_date: string
          interaction_type: string
          lead_id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          files?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          lead_id: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          files?: string | null
          id?: string
          interaction_date?: string
          interaction_type?: string
          lead_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_labels_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_actions: {
        Row: {
          completed: boolean
          created_at: string
          deadline: string | null
          id: string
          lead_id: string
          task: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          id?: string
          lead_id: string
          task: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline?: string | null
          id?: string
          lead_id?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          lead_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "crm_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_labels_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          added_at: string
          closed_product: string | null
          context: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          documents: string | null
          email: string | null
          estimated_value: number | null
          followup_notes: string | null
          icon: Json | null
          id: string
          lost_reason: string | null
          name: string
          next_followup: string | null
          phone: string | null
          potential_product: string | null
          potential_product_id: string | null
          quote_id: string | null
          responsible_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          closed_product?: string | null
          context?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          documents?: string | null
          email?: string | null
          estimated_value?: number | null
          followup_notes?: string | null
          icon?: Json | null
          id?: string
          lost_reason?: string | null
          name: string
          next_followup?: string | null
          phone?: string | null
          potential_product?: string | null
          potential_product_id?: string | null
          quote_id?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          closed_product?: string | null
          context?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          documents?: string | null
          email?: string | null
          estimated_value?: number | null
          followup_notes?: string | null
          icon?: Json | null
          id?: string
          lost_reason?: string | null
          name?: string
          next_followup?: string | null
          phone?: string | null
          potential_product?: string | null
          potential_product_id?: string | null
          quote_id?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_potential_product_id_fkey"
            columns: ["potential_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "product_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_labels: {
        Row: {
          color: string | null
          id: string
          label_name: string
          pipeline_id: string | null
        }
        Insert: {
          color?: string | null
          id?: string
          label_name: string
          pipeline_id?: string | null
        }
        Update: {
          color?: string | null
          id?: string
          label_name?: string
          pipeline_id?: string | null
        }
        Relationships: []
      }
      crm_pipeline_leads: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          pipeline_id: string
          sort_order: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          pipeline_id: string
          sort_order?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          pipeline_id?: string
          sort_order?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pipeline_leads_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          end_date: string | null
          icon: Json | null
          id: string
          name: string
          product: string | null
          product_id: string | null
          project_id: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon?: Json | null
          id?: string
          name: string
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          icon?: Json | null
          id?: string
          name?: string
          product?: string | null
          product_id?: string | null
          project_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipelines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          created_at: string
          entity_id: string
          field_id: string | null
          id: string
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          field_id?: string | null
          id?: string
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          field_id?: string | null
          id?: string
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string
          entity_type: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean | null
          options: Json | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
        }
        Relationships: []
      }
      custom_fonts: {
        Row: {
          created_at: string
          font_name: string
          font_type: string
          font_url: string
          id: string
        }
        Insert: {
          created_at?: string
          font_name: string
          font_type?: string
          font_url: string
          id?: string
        }
        Update: {
          created_at?: string
          font_name?: string
          font_type?: string
          font_url?: string
          id?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_owner: boolean
          is_sales: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner?: boolean
          is_sales?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner?: boolean
          is_sales?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_views: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json | null
          id: string
          is_default: boolean | null
          name: string
          page_key: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          page_key: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          page_key?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      department_colors: {
        Row: {
          color_key: string
          created_at: string
          department_value: string
          id: string
          updated_at: string
        }
        Insert: {
          color_key?: string
          created_at?: string
          department_value: string
          id?: string
          updated_at?: string
        }
        Update: {
          color_key?: string
          created_at?: string
          department_value?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_covers: {
        Row: {
          created_at: string
          department_key: string
          id: string
          image_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          department_key: string
          id?: string
          image_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          department_key?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      department_links: {
        Row: {
          created_at: string
          created_by: string | null
          department: string
          id: string
          label: string | null
          link_type: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department: string
          id?: string
          label?: string | null
          link_type: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string
          id?: string
          label?: string | null
          link_type?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      department_whatsapp_links: {
        Row: {
          department: string
          id: string
          updated_at: string
          updated_by: string | null
          whatsapp_url: string
        }
        Insert: {
          department: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string
        }
        Update: {
          department?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_url?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          cover_url: string | null
          created_at: string
          gradient: string
          icon: string
          id: string
          label: string
          lucide_icon: string
          sort_order: number
          value: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          gradient?: string
          icon?: string
          id?: string
          label: string
          lucide_icon?: string
          sort_order?: number
          value: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          gradient?: string
          icon?: string
          id?: string
          label?: string
          lucide_icon?: string
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      digest_settings: {
        Row: {
          created_at: string
          digest_type: string
          enabled: boolean
          frequency: Database["public"]["Enums"]["digest_frequency"]
          id: string
          is_owner_digest: boolean
          sections: Json
          send_day_of_month: number | null
          send_day_of_week: number | null
          send_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_type?: string
          enabled?: boolean
          frequency?: Database["public"]["Enums"]["digest_frequency"]
          id?: string
          is_owner_digest?: boolean
          sections?: Json
          send_day_of_month?: number | null
          send_day_of_week?: number | null
          send_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_type?: string
          enabled?: boolean
          frequency?: Database["public"]["Enums"]["digest_frequency"]
          id?: string
          is_owner_digest?: boolean
          sections?: Json
          send_day_of_month?: number | null
          send_day_of_week?: number | null
          send_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_ceo_alerts: {
        Row: {
          alert_key: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_key: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      edge_function_runs: {
        Row: {
          attempts: number
          context: Json | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          function_name: string
          id: string
          started_at: string
          status: string
        }
        Insert: {
          attempts?: number
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          function_name: string
          id?: string
          started_at?: string
          status: string
        }
        Update: {
          attempts?: number
          context?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          function_name?: string
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_template_settings: {
        Row: {
          created_at: string
          cta_text: string | null
          emoji: string | null
          font_body: string | null
          font_display: string | null
          footer_text: string | null
          id: string
          muted_color: string | null
          primary_color: string | null
          primary_foreground: string | null
          subtitle_text: string | null
          template_key: string
          text_color: string | null
          title_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          emoji?: string | null
          font_body?: string | null
          font_display?: string | null
          footer_text?: string | null
          id?: string
          muted_color?: string | null
          primary_color?: string | null
          primary_foreground?: string | null
          subtitle_text?: string | null
          template_key: string
          text_color?: string | null
          title_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          emoji?: string | null
          font_body?: string | null
          font_display?: string | null
          footer_text?: string | null
          id?: string
          muted_color?: string | null
          primary_color?: string | null
          primary_foreground?: string | null
          subtitle_text?: string | null
          template_key?: string
          text_color?: string | null
          title_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_attachments: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          type: string
          url: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          client_name: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          department: string | null
          end_date: string | null
          event_type_id: string | null
          google_calendar_db_id: string | null
          icon: Json | null
          id: string
          meeting_url: string | null
          notes: string | null
          product_id: string | null
          product_name: string | null
          recurrence_end: string | null
          recurrence_type: string | null
          start_date: string
          title: string
          updated_at: string
          with_meet: boolean
        }
        Insert: {
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_date?: string | null
          event_type_id?: string | null
          google_calendar_db_id?: string | null
          icon?: Json | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          start_date: string
          title: string
          updated_at?: string
          with_meet?: boolean
        }
        Update: {
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_date?: string | null
          event_type_id?: string | null
          google_calendar_db_id?: string | null
          icon?: Json | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          start_date?: string
          title?: string
          updated_at?: string
          with_meet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_brain_dump: {
        Row: {
          category_id: string | null
          completed: boolean
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["brain_dump_status"]
          task: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["brain_dump_status"]
          task: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["brain_dump_status"]
          task?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_brain_dump_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "executive_brain_dump_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_brain_dump_categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      executive_monthly_checklists: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          month: number
          task: string
          year: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          month: number
          task: string
          year: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          month?: number
          task?: string
          year?: number
        }
        Relationships: []
      }
      executive_objectives: {
        Row: {
          area: string
          contribui_visao_5_anos: boolean
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          measurement_type: string
          objective_type: string
          owner_id: string | null
          primary_metric_id: string | null
          product_id: string | null
          progress: number
          source_filter: Json | null
          status: string
          target_unit: string | null
          target_value: number | null
          title: string
          updated_at: string
          value_source: string | null
          year: number
        }
        Insert: {
          area?: string
          contribui_visao_5_anos?: boolean
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          measurement_type?: string
          objective_type?: string
          owner_id?: string | null
          primary_metric_id?: string | null
          product_id?: string | null
          progress?: number
          source_filter?: Json | null
          status?: string
          target_unit?: string | null
          target_value?: number | null
          title: string
          updated_at?: string
          value_source?: string | null
          year?: number
        }
        Update: {
          area?: string
          contribui_visao_5_anos?: boolean
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          measurement_type?: string
          objective_type?: string
          owner_id?: string | null
          primary_metric_id?: string | null
          product_id?: string | null
          progress?: number
          source_filter?: Json | null
          status?: string
          target_unit?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string
          value_source?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_objectives_primary_metric_id_fkey"
            columns: ["primary_metric_id"]
            isOneToOne: false
            referencedRelation: "objective_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_objectives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_quarterly_analysis: {
        Row: {
          adjustments: string | null
          created_at: string
          id: string
          lessons: string | null
          quarter: number
          updated_at: string
          went_well: string | null
          went_wrong: string | null
          year: number
        }
        Insert: {
          adjustments?: string | null
          created_at?: string
          id?: string
          lessons?: string | null
          quarter: number
          updated_at?: string
          went_well?: string | null
          went_wrong?: string | null
          year: number
        }
        Update: {
          adjustments?: string | null
          created_at?: string
          id?: string
          lessons?: string | null
          quarter?: number
          updated_at?: string
          went_well?: string | null
          went_wrong?: string | null
          year?: number
        }
        Relationships: []
      }
      executive_weekly_routines: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          routine_key: string
          week_start: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          routine_key: string
          week_start: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          routine_key?: string
          week_start?: string
        }
        Relationships: []
      }
      feedback_sessions: {
        Row: {
          agreements: string | null
          created_at: string
          event_id: string | null
          feedback_type: string
          id: string
          member_id: string
          next_session: string | null
          session_date: string
          session_time: string | null
          summary: string | null
          to_improve: string | null
          transcript_url: string | null
          updated_at: string
          went_well: string | null
        }
        Insert: {
          agreements?: string | null
          created_at?: string
          event_id?: string | null
          feedback_type?: string
          id?: string
          member_id: string
          next_session?: string | null
          session_date: string
          session_time?: string | null
          summary?: string | null
          to_improve?: string | null
          transcript_url?: string | null
          updated_at?: string
          went_well?: string | null
        }
        Update: {
          agreements?: string | null
          created_at?: string
          event_id?: string | null
          feedback_type?: string
          id?: string
          member_id?: string
          next_session?: string | null
          session_date?: string
          session_time?: string | null
          summary?: string | null
          to_improve?: string | null
          transcript_url?: string | null
          updated_at?: string
          went_well?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          category_type: string
          created_at: string
          id: string
          label: string
          sort_order: number
          value: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          value: string
        }
        Update: {
          category_type?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      financial_contractors: {
        Row: {
          contractor_name: string
          created_at: string
          created_by: string | null
          documents: Json | null
          expense_id: string | null
          id: string
          location: string
          month: number
          service: string | null
          status: string
          updated_at: string
          value: number
          year: number
        }
        Insert: {
          contractor_name: string
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          expense_id?: string | null
          id?: string
          location?: string
          month: number
          service?: string | null
          status?: string
          updated_at?: string
          value?: number
          year: number
        }
        Update: {
          contractor_name?: string
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          expense_id?: string | null
          id?: string
          location?: string
          month?: number
          service?: string | null
          status?: string
          updated_at?: string
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_contractors_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_documents: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          document_name: string | null
          document_url: string | null
          due_date: string | null
          icon: Json | null
          id: string
          notes: string | null
          period_end: string | null
          period_month: number | null
          period_start: string | null
          period_year: number | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
          icon?: Json | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_month?: number | null
          period_start?: string | null
          period_year?: number | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
          icon?: Json | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_month?: number | null
          period_start?: string | null
          period_year?: number | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_expenses: {
        Row: {
          base_value: number
          category: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          documents: Json | null
          expense_date: string | null
          expense_id: string
          expense_month: number | null
          expense_name: string | null
          expense_quarter: number | null
          expense_year: number | null
          icon: Json | null
          id: string
          is_recurring: boolean | null
          location: string
          member_id: string | null
          monthly_equivalent: number | null
          parent_expense_id: string | null
          paused_until: string | null
          payment_method: string | null
          periodicity: string | null
          recurrence_day: number | null
          recurrence_end_date: string | null
          renewal_date: string | null
          source_id: string | null
          source_type: string | null
          status: string
          supplier_id: string | null
          total_with_vat: number
          updated_at: string
          vat_deductible_amount: number | null
          vat_rate: number
        }
        Insert: {
          base_value?: number
          category?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          documents?: Json | null
          expense_date?: string | null
          expense_id?: string
          expense_month?: number | null
          expense_name?: string | null
          expense_quarter?: number | null
          expense_year?: number | null
          icon?: Json | null
          id?: string
          is_recurring?: boolean | null
          location?: string
          member_id?: string | null
          monthly_equivalent?: number | null
          parent_expense_id?: string | null
          paused_until?: string | null
          payment_method?: string | null
          periodicity?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          renewal_date?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          total_with_vat?: number
          updated_at?: string
          vat_deductible_amount?: number | null
          vat_rate?: number
        }
        Update: {
          base_value?: number
          category?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          documents?: Json | null
          expense_date?: string | null
          expense_id?: string
          expense_month?: number | null
          expense_name?: string | null
          expense_quarter?: number | null
          expense_year?: number | null
          icon?: Json | null
          id?: string
          is_recurring?: boolean | null
          location?: string
          member_id?: string | null
          monthly_equivalent?: number | null
          parent_expense_id?: string | null
          paused_until?: string | null
          payment_method?: string | null
          periodicity?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          renewal_date?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          total_with_vat?: number
          updated_at?: string
          vat_deductible_amount?: number | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string | null
          expense_target: number | null
          id: string
          month: number
          notes: string | null
          profit_target: number | null
          revenue_target: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          expense_target?: number | null
          id?: string
          month: number
          notes?: string | null
          profit_target?: number | null
          revenue_target?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          expense_target?: number | null
          id?: string
          month?: number
          notes?: string | null
          profit_target?: number | null
          revenue_target?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      financial_payroll: {
        Row: {
          collaborator_name: string
          created_at: string
          created_by: string | null
          expense_id: string | null
          gross_salary: number
          id: string
          month: number
          net_salary: number
          profile_id: string | null
          ss_employee: number
          ss_employer: number
          status: string
          total_cost: number
          updated_at: string
          withholding_rate: number
          withholding_value: number
          year: number
        }
        Insert: {
          collaborator_name: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          gross_salary?: number
          id?: string
          month: number
          net_salary?: number
          profile_id?: string | null
          ss_employee?: number
          ss_employer?: number
          status?: string
          total_cost?: number
          updated_at?: string
          withholding_rate?: number
          withholding_value?: number
          year: number
        }
        Update: {
          collaborator_name?: string
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          gross_salary?: number
          id?: string
          month?: number
          net_salary?: number
          profile_id?: string | null
          ss_employee?: number
          ss_employer?: number
          status?: string
          total_cost?: number
          updated_at?: string
          withholding_rate?: number
          withholding_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_payroll_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_subscriptions: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          location: string
          monthly_equivalent: number
          notes: string | null
          periodicity: string
          platform_name: string
          renewal_date: string | null
          start_date: string | null
          status: string
          supplier_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          monthly_equivalent?: number
          notes?: string | null
          periodicity?: string
          platform_name: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          monthly_equivalent?: number
          notes?: string | null
          periodicity?: string
          platform_name?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_subscriptions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_subscriptions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_deadline_completions: {
        Row: {
          completed_by: string | null
          completion_date: string | null
          created_at: string
          deadline_key: string
          id: string
          notes: string | null
          year: number | null
        }
        Insert: {
          completed_by?: string | null
          completion_date?: string | null
          created_at?: string
          deadline_key: string
          id?: string
          notes?: string | null
          year?: number | null
        }
        Update: {
          completed_by?: string | null
          completion_date?: string | null
          created_at?: string
          deadline_key?: string
          id?: string
          notes?: string | null
          year?: number | null
        }
        Relationships: []
      }
      fiscal_monthly_checks: {
        Row: {
          check_key: string
          checked: boolean
          checked_at: string | null
          created_at: string
          id: string
          month: number
          notes: string | null
          year: number
        }
        Insert: {
          check_key: string
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          year: number
        }
        Update: {
          check_key?: string
          checked?: boolean
          checked_at?: string | null
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          year?: number
        }
        Relationships: []
      }
      hiring_simulations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phantoms: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phantoms?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phantoms?: Json
          updated_at?: string
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          ended_at: string | null
          id: string
          owner_user_id: string
          started_at: string
          target_member_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          owner_user_id: string
          started_at?: string
          target_member_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          owner_user_id?: string
          started_at?: string
          target_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_member_id_fkey"
            columns: ["target_member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      innovation_docs: {
        Row: {
          content: string | null
          doc_key: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          doc_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          doc_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      innovation_ideas: {
        Row: {
          completed: boolean
          context: string
          created_at: string
          id: string
          idea: string
          implementation_date: string | null
          plan: string
        }
        Insert: {
          completed?: boolean
          context?: string
          created_at?: string
          id?: string
          idea: string
          implementation_date?: string | null
          plan?: string
        }
        Update: {
          completed?: boolean
          context?: string
          created_at?: string
          id?: string
          idea?: string
          implementation_date?: string | null
          plan?: string
        }
        Relationships: []
      }
      internal_documents: {
        Row: {
          category: string
          content: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          doc_type: string
          file_url: string | null
          icon: Json | null
          id: string
          notes: string | null
          responsible_id: string | null
          status: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: string
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url?: string | null
          icon?: Json | null
          id?: string
          notes?: string | null
          responsible_id?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url?: string | null
          icon?: Json | null
          id?: string
          notes?: string | null
          responsible_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      iva_payments: {
        Row: {
          created_at: string
          created_by: string | null
          expense_id: string | null
          id: string
          notes: string | null
          paid_amount: number
          paid_date: string | null
          quarter: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          quarter: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_date?: string | null
          quarter?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "iva_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "financial_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_settings: {
        Row: {
          area: string
          business_id: string
          created_at: string
          enabled: boolean
          id: string
          kpi_key: string
        }
        Insert: {
          area: string
          business_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          kpi_key: string
        }
        Update: {
          area?: string
          business_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kpi_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_data: {
        Row: {
          analise_publico_descricao: string | null
          analise_publico_dores: Json | null
          brainstorming: string | null
          created_at: string
          cronograma: Json | null
          estrategia_indicadores: Json | null
          estrategia_macro_fases: Json | null
          estrategia_objetivo: string | null
          estrategia_pilares: Json | null
          id: string
          links_uteis: Json | null
          mapa_objeccoes: Json | null
          materiais_antecipacao: Json | null
          materiais_venda: Json | null
          objetivo_geral: string | null
          produto_cliente_ideal: string | null
          produto_faqs: string | null
          produto_feedbacks: string | null
          produto_oferta: string | null
          produto_por_dentro: string | null
          project_id: string
          sobre_lancamento: string | null
          tracking_performance_diaria: Json | null
          tracking_resultados_globais: Json | null
          tracking_trafego: Json | null
        }
        Insert: {
          analise_publico_descricao?: string | null
          analise_publico_dores?: Json | null
          brainstorming?: string | null
          created_at?: string
          cronograma?: Json | null
          estrategia_indicadores?: Json | null
          estrategia_macro_fases?: Json | null
          estrategia_objetivo?: string | null
          estrategia_pilares?: Json | null
          id?: string
          links_uteis?: Json | null
          mapa_objeccoes?: Json | null
          materiais_antecipacao?: Json | null
          materiais_venda?: Json | null
          objetivo_geral?: string | null
          produto_cliente_ideal?: string | null
          produto_faqs?: string | null
          produto_feedbacks?: string | null
          produto_oferta?: string | null
          produto_por_dentro?: string | null
          project_id: string
          sobre_lancamento?: string | null
          tracking_performance_diaria?: Json | null
          tracking_resultados_globais?: Json | null
          tracking_trafego?: Json | null
        }
        Update: {
          analise_publico_descricao?: string | null
          analise_publico_dores?: Json | null
          brainstorming?: string | null
          created_at?: string
          cronograma?: Json | null
          estrategia_indicadores?: Json | null
          estrategia_macro_fases?: Json | null
          estrategia_objetivo?: string | null
          estrategia_pilares?: Json | null
          id?: string
          links_uteis?: Json | null
          mapa_objeccoes?: Json | null
          materiais_antecipacao?: Json | null
          materiais_venda?: Json | null
          objetivo_geral?: string | null
          produto_cliente_ideal?: string | null
          produto_faqs?: string | null
          produto_feedbacks?: string | null
          produto_oferta?: string | null
          produto_por_dentro?: string | null
          project_id?: string
          sobre_lancamento?: string | null
          tracking_performance_diaria?: Json | null
          tracking_resultados_globais?: Json | null
          tracking_trafego?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          phase: Database["public"]["Enums"]["launch_phase"]
          project_id: string
          responsible_id: string | null
          sector_area: string | null
          status: Database["public"]["Enums"]["launch_task_status"]
          task_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["launch_phase"]
          project_id: string
          responsible_id?: string | null
          sector_area?: string | null
          status?: Database["public"]["Enums"]["launch_task_status"]
          task_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["launch_phase"]
          project_id?: string
          responsible_id?: string | null
          sector_area?: string | null
          status?: Database["public"]["Enums"]["launch_task_status"]
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_tasks_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automations: {
        Row: {
          condicoes: Json | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          fluxo: Json | null
          gatilho: string | null
          icon: Json | null
          id: string
          links: Json | null
          name: string
          notas: string | null
          objetivo: string | null
          oferta_final: string | null
          plataforma: string | null
          plataformas_envolvidas: Json | null
          product_id: string | null
          product_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          condicoes?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          fluxo?: Json | null
          gatilho?: string | null
          icon?: Json | null
          id?: string
          links?: Json | null
          name: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataforma?: string | null
          plataformas_envolvidas?: Json | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          condicoes?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          fluxo?: Json | null
          gatilho?: string | null
          icon?: Json | null
          id?: string
          links?: Json | null
          name?: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataforma?: string | null
          plataformas_envolvidas?: Json | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_automations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_channel_accounts: {
        Row: {
          account_handle: string
          account_url: string | null
          channel_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          notes: string | null
          responsible_member_id: string | null
        }
        Insert: {
          account_handle: string
          account_url?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          responsible_member_id?: string | null
        }
        Update: {
          account_handle?: string
          account_url?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          responsible_member_id?: string | null
        }
        Relationships: []
      }
      marketing_channels: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          is_active: boolean
          link: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketing_funnels: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          entry_points: Json | null
          etapas: Json | null
          fluxo_resumido: string | null
          icon: Json | null
          id: string
          name: string
          notas: string | null
          objetivo: string | null
          oferta_final: string | null
          plataformas: Json | null
          product_id: string | null
          product_name: string | null
          status: string
          tipo_funil: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          entry_points?: Json | null
          etapas?: Json | null
          fluxo_resumido?: string | null
          icon?: Json | null
          id?: string
          name: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataformas?: Json | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          tipo_funil?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          entry_points?: Json | null
          etapas?: Json | null
          fluxo_resumido?: string | null
          icon?: Json | null
          id?: string
          name?: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataformas?: Json | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          tipo_funil?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_funnels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_goals: {
        Row: {
          channel_id: string | null
          created_at: string
          current_value: number
          id: string
          metric_key: string
          metric_label: string
          month: number
          notes: string | null
          sort_order: number
          target_value: number
          updated_at: string
          year: number
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          current_value?: number
          id?: string
          metric_key?: string
          metric_label?: string
          month: number
          notes?: string | null
          sort_order?: number
          target_value?: number
          updated_at?: string
          year: number
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          current_value?: number
          id?: string
          metric_key?: string
          metric_label?: string
          month?: number
          notes?: string | null
          sort_order?: number
          target_value?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_goals_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_ideas: {
        Row: {
          category: string
          channel: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          format: string | null
          id: string
          idea: string
        }
        Insert: {
          category?: string
          channel?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          idea: string
        }
        Update: {
          category?: string
          channel?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          id?: string
          idea?: string
        }
        Relationships: []
      }
      marketing_monthly_analysis: {
        Row: {
          created_at: string
          id: string
          month: number
          what_went_well: string | null
          what_went_wrong: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          what_went_well?: string | null
          what_went_wrong?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          what_went_well?: string | null
          what_went_wrong?: string | null
          year?: number
        }
        Relationships: []
      }
      marketing_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          page_key: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          page_key: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          page_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_resource_links: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string
          sort_order: number
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_projects: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_projects_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          actual_duration_minutes: number | null
          client_actions: Json | null
          client_id: string | null
          client_name: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          date_time: string
          department: string | null
          discussion_notes: string | null
          discussion_points: Json | null
          documents: Json | null
          duration_minutes: number | null
          final_notes: Json | null
          google_calendar_db_id: string | null
          icon: Json | null
          id: string
          is_recurring: boolean
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          meeting_url: string | null
          owner_actions: Json | null
          parent_meeting_id: string | null
          planned_duration_minutes: number | null
          portal_notes: string | null
          priorities: Json | null
          product_id: string | null
          product_name: string | null
          project_id: string | null
          project_name: string | null
          recurrence_end_date: string | null
          recurrence_frequency: string | null
          routine_id: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript_url: string | null
          updated_at: string
          visible_in_portal: boolean
          with_meet: boolean
        }
        Insert: {
          actual_duration_minutes?: number | null
          client_actions?: Json | null
          client_id?: string | null
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          date_time: string
          department?: string | null
          discussion_notes?: string | null
          discussion_points?: Json | null
          documents?: Json | null
          duration_minutes?: number | null
          final_notes?: Json | null
          google_calendar_db_id?: string | null
          icon?: Json | null
          id?: string
          is_recurring?: boolean
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          owner_actions?: Json | null
          parent_meeting_id?: string | null
          planned_duration_minutes?: number | null
          portal_notes?: string | null
          priorities?: Json | null
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          project_name?: string | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          routine_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript_url?: string | null
          updated_at?: string
          visible_in_portal?: boolean
          with_meet?: boolean
        }
        Update: {
          actual_duration_minutes?: number | null
          client_actions?: Json | null
          client_id?: string | null
          client_name?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          date_time?: string
          department?: string | null
          discussion_notes?: string | null
          discussion_points?: Json | null
          documents?: Json | null
          duration_minutes?: number | null
          final_notes?: Json | null
          google_calendar_db_id?: string | null
          icon?: Json | null
          id?: string
          is_recurring?: boolean
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          meeting_url?: string | null
          owner_actions?: Json | null
          parent_meeting_id?: string | null
          planned_duration_minutes?: number | null
          portal_notes?: string | null
          priorities?: Json | null
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          project_name?: string | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string | null
          routine_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          transcript_url?: string | null
          updated_at?: string
          visible_in_portal?: boolean
          with_meet?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "planning_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      member_contracts: {
        Row: {
          contract_type: string
          contracted_hours: string | null
          created_at: string
          document_url: string | null
          end_date: string | null
          id: string
          member_id: string
          monthly_value: number | null
          notes: string | null
          payment_day: number | null
          payment_method: string | null
          payment_start_date: string | null
          previous_contract_id: string | null
          ss_employer_rate: number
          start_date: string | null
          status: string
          updated_at: string
          use_custom_payment_start: boolean
          value_includes_vat: boolean
        }
        Insert: {
          contract_type?: string
          contracted_hours?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          member_id: string
          monthly_value?: number | null
          notes?: string | null
          payment_day?: number | null
          payment_method?: string | null
          payment_start_date?: string | null
          previous_contract_id?: string | null
          ss_employer_rate?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          use_custom_payment_start?: boolean
          value_includes_vat?: boolean
        }
        Update: {
          contract_type?: string
          contracted_hours?: string | null
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          member_id?: string
          monthly_value?: number | null
          notes?: string | null
          payment_day?: number | null
          payment_method?: string | null
          payment_start_date?: string | null
          previous_contract_id?: string | null
          ss_employer_rate?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          use_custom_payment_start?: boolean
          value_includes_vat?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "member_contracts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contracts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_contracts_previous_contract_id_fkey"
            columns: ["previous_contract_id"]
            isOneToOne: false
            referencedRelation: "member_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      member_onboarding: {
        Row: {
          completed: boolean
          created_at: string
          deadline_date: string | null
          id: string
          member_id: string
          sort_order: number
          task: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deadline_date?: string | null
          id?: string
          member_id: string
          sort_order?: number
          task: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          deadline_date?: string | null
          id?: string
          member_id?: string
          sort_order?: number
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_onboarding_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      member_payments: {
        Row: {
          created_at: string
          document_url: string | null
          gross_value: number
          id: string
          member_id: string
          month: number
          net_value: number
          payment_type: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          gross_value?: number
          id?: string
          member_id: string
          month: number
          net_value?: number
          payment_type?: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          document_url?: string | null
          gross_value?: number
          id?: string
          member_id?: string
          month?: number
          net_value?: number
          payment_type?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      member_personal_images: {
        Row: {
          id: string
          image_url: string
          member_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          image_url: string
          member_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          image_url?: string
          member_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      member_personal_links: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      member_personal_notes: {
        Row: {
          content: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      member_quick_links: {
        Row: {
          created_at: string
          description: string | null
          icon: Json | null
          id: string
          member_id: string
          name: string
          sort_order: number
          tags: string[]
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: Json | null
          id?: string
          member_id: string
          name: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: Json | null
          id?: string
          member_id?: string
          name?: string
          sort_order?: number
          tags?: string[]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_quick_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_quick_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      member_sensitive_access: {
        Row: {
          category: string
          granted: boolean
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          category: string
          granted?: boolean
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          granted?: boolean
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_sensitive_access_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_sensitive_access_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_history: {
        Row: {
          created_at: string
          id: string
          metric_id: string
          notes: string | null
          recorded_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_id: string
          notes?: string | null
          recorded_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_id?: string
          notes?: string | null
          recorded_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "metric_history_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "objective_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reflection: {
        Row: {
          business_id: string | null
          created_at: string
          decisoes_mes_seguinte: string | null
          id: string
          month: number
          o_que_correu_bem: string | null
          o_que_nao_correu: string | null
          revisto: boolean
          revisto_em: string | null
          updated_at: string
          year: number
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          decisoes_mes_seguinte?: string | null
          id?: string
          month: number
          o_que_correu_bem?: string | null
          o_que_nao_correu?: string | null
          revisto?: boolean
          revisto_em?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          business_id?: string | null
          created_at?: string
          decisoes_mes_seguinte?: string | null
          id?: string
          month?: number
          o_que_correu_bem?: string | null
          o_que_nao_correu?: string | null
          revisto?: boolean
          revisto_em?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          month: number
          report_data: Json | null
          started_at: string
          status: string
          trigger_type: string
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          month: number
          report_data?: Json | null
          started_at?: string
          status?: string
          trigger_type?: string
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          month?: number
          report_data?: Json | null
          started_at?: string
          status?: string
          trigger_type?: string
          year?: number
        }
        Relationships: []
      }
      mural_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mural_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "mural_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      mural_posts: {
        Row: {
          author_id: string
          body: string
          category: string
          created_at: string
          files: Json | null
          id: string
          images: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          category?: string
          created_at?: string
          files?: Json | null
          id?: string
          images?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          files?: Json | null
          id?: string
          images?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mural_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mural_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "mural_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dedup_key: string | null
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      objective_actions: {
        Row: {
          action_type: string
          created_at: string
          deadline: string | null
          description: string
          id: string
          objective_id: string
          responsible_id: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          objective_id: string
          responsible_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          deadline?: string | null
          description?: string
          id?: string
          objective_id?: string
          responsible_id?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_actions_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "executive_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objective_actions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_criteria: {
        Row: {
          completed: boolean
          created_at: string
          description: string
          id: string
          objective_id: string
          sort_order: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          objective_id: string
          sort_order?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          description?: string
          id?: string
          objective_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "objective_criteria_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "executive_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_metrics: {
        Row: {
          cadence: string
          created_at: string
          current_value: number | null
          green_threshold: number | null
          id: string
          last_updated_at: string | null
          measurement_type: string
          name: string
          objective_id: string
          product_id: string | null
          source: string
          target_unit: string | null
          target_value: number | null
          yellow_threshold: number | null
        }
        Insert: {
          cadence?: string
          created_at?: string
          current_value?: number | null
          green_threshold?: number | null
          id?: string
          last_updated_at?: string | null
          measurement_type?: string
          name?: string
          objective_id: string
          product_id?: string | null
          source?: string
          target_unit?: string | null
          target_value?: number | null
          yellow_threshold?: number | null
        }
        Update: {
          cadence?: string
          created_at?: string
          current_value?: number | null
          green_threshold?: number | null
          id?: string
          last_updated_at?: string | null
          measurement_type?: string
          name?: string
          objective_id?: string
          product_id?: string | null
          source?: string
          target_unit?: string | null
          target_value?: number | null
          yellow_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objective_metrics_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "executive_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objective_metrics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      page_access_grants: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          page_path: string
          page_title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_path: string
          page_title: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          page_path?: string
          page_title?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_monthly: {
        Row: {
          comments: string | null
          created_at: string
          hours_worked: number | null
          id: string
          member_id: string
          month: number
          notes: string | null
          overall_status: string
          projects_active: number | null
          rating: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          updated_at: string
          year: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          member_id: string
          month: number
          notes?: string | null
          overall_status?: string
          projects_active?: number | null
          rating?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          hours_worked?: number | null
          id?: string
          member_id?: string
          month?: number
          notes?: string | null
          overall_status?: string
          projects_active?: number | null
          rating?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_monthly_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_monthly_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_weekly: {
        Row: {
          created_at: string
          id: string
          member_id: string
          notes: string | null
          overall_status: string
          projects_active: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          notes?: string | null
          overall_status?: string
          projects_active?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          updated_at?: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          notes?: string | null
          overall_status?: string
          projects_active?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_weekly_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_weekly_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_goals: {
        Row: {
          actual_value: string | null
          created_at: string
          deviation: string | null
          deviation_decision: string | null
          id: string
          notes: string | null
          objective_id: string
          period: string
          period_type: string
          status: string
          target_value: string | null
          updated_at: string
          year: number
        }
        Insert: {
          actual_value?: string | null
          created_at?: string
          deviation?: string | null
          deviation_decision?: string | null
          id?: string
          notes?: string | null
          objective_id: string
          period: string
          period_type?: string
          status?: string
          target_value?: string | null
          updated_at?: string
          year?: number
        }
        Update: {
          actual_value?: string | null
          created_at?: string
          deviation?: string | null
          deviation_decision?: string | null
          id?: string
          notes?: string | null
          objective_id?: string
          period?: string
          period_type?: string
          status?: string
          target_value?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "planning_goals_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "executive_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_routines: {
        Row: {
          active: boolean
          adjust_to_business_day: boolean
          cover_url: string | null
          created_at: string
          created_by: string | null
          department: string | null
          estimated_minutes: number | null
          estimated_time: number | null
          format: string
          hour_time: string | null
          icon: Json | null
          id: string
          month_day: number | null
          project_id: string | null
          recurrence_type: string
          responsible: string | null
          role_function: string | null
          sop_id: string | null
          title: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          adjust_to_business_day?: boolean
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          format?: string
          hour_time?: string | null
          icon?: Json | null
          id?: string
          month_day?: number | null
          project_id?: string | null
          recurrence_type?: string
          responsible?: string | null
          role_function?: string | null
          sop_id?: string | null
          title: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          adjust_to_business_day?: boolean
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          format?: string
          hour_time?: string | null
          icon?: Json | null
          id?: string
          month_day?: number | null
          project_id?: string | null
          recurrence_type?: string
          responsible?: string | null
          role_function?: string | null
          sop_id?: string | null
          title?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planning_routines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_routines_responsible_fkey"
            columns: ["responsible"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_routines_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_accesses: {
        Row: {
          created_at: string
          created_by: string | null
          direct_link: string | null
          encrypted_password: string
          id: string
          notes: string | null
          platform_name: string
          platform_type: string
          updated_at: string
          username_email: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direct_link?: string | null
          encrypted_password: string
          id?: string
          notes?: string | null
          platform_name: string
          platform_type?: string
          updated_at?: string
          username_email: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direct_link?: string | null
          encrypted_password?: string
          id?: string
          notes?: string | null
          platform_name?: string
          platform_type?: string
          updated_at?: string
          username_email?: string
        }
        Relationships: []
      }
      portal_comments: {
        Row: {
          author: Database["public"]["Enums"]["portal_comment_author"]
          author_name: string
          content: string
          created_at: string
          id: string
          portal_id: string
        }
        Insert: {
          author: Database["public"]["Enums"]["portal_comment_author"]
          author_name: string
          content: string
          created_at?: string
          id?: string
          portal_id: string
        }
        Update: {
          author?: Database["public"]["Enums"]["portal_comment_author"]
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_comments_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_faqs: {
        Row: {
          answer: string | null
          created_at: string
          from_template: boolean
          id: string
          portal_id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer?: string | null
          created_at?: string
          from_template?: boolean
          id?: string
          portal_id: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string | null
          created_at?: string
          from_template?: boolean
          id?: string
          portal_id?: string
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_faqs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feedback: {
        Row: {
          content: string
          created_at: string
          id: string
          portal_id: string
          submitted_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          portal_id: string
          submitted_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          portal_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_feedback_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_initial_questions: {
        Row: {
          answer: string | null
          answer_type: string
          answered_at: string | null
          created_at: string
          file_urls: Json | null
          group_sort_order: number
          id: string
          portal_id: string
          question: string
          question_group: string | null
          sort_order: number
        }
        Insert: {
          answer?: string | null
          answer_type?: string
          answered_at?: string | null
          created_at?: string
          file_urls?: Json | null
          group_sort_order?: number
          id?: string
          portal_id: string
          question: string
          question_group?: string | null
          sort_order?: number
        }
        Update: {
          answer?: string | null
          answer_type?: string
          answered_at?: string | null
          created_at?: string
          file_urls?: Json | null
          group_sort_order?: number
          id?: string
          portal_id?: string
          question?: string
          question_group?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_initial_questions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_monthly_summaries: {
        Row: {
          content: string
          created_at: string
          id: string
          month: number
          portal_id: string
          year: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          month: number
          portal_id: string
          year: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          month?: number
          portal_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_monthly_summaries_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_project_history: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          monthly_summaries: Json | null
          notes: string | null
          portal_id: string
          product_id: string | null
          product_name: string | null
          project_id: string | null
          project_name: string
          start_date: string | null
          status: string | null
          timeline_phases: Json | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_summaries?: Json | null
          notes?: string | null
          portal_id: string
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          project_name?: string
          start_date?: string | null
          status?: string | null
          timeline_phases?: Json | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_summaries?: Json | null
          notes?: string | null
          portal_id?: string
          product_id?: string | null
          product_name?: string | null
          project_id?: string | null
          project_name?: string
          start_date?: string | null
          status?: string | null
          timeline_phases?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_project_history_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_project_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_project_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_timeline_phases: {
        Row: {
          created_at: string
          from_template: boolean
          id: string
          portal_id: string
          sort_order: number
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          from_template?: boolean
          id?: string
          portal_id: string
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          from_template?: boolean
          id?: string
          portal_id?: string
          sort_order?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_timeline_phases_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_visits: {
        Row: {
          email: string
          id: string
          portal_id: string
          visited_at: string
        }
        Insert: {
          email: string
          id?: string
          portal_id: string
          visited_at?: string
        }
        Update: {
          email?: string
          id?: string
          portal_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_visits_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "client_portals"
            referencedColumns: ["id"]
          },
        ]
      }
      product_automations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          product_id: string | null
          sort_order: number | null
          status: string | null
          trigger: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          status?: string | null
          trigger?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          status?: string | null
          trigger?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_automations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_name: string
          cost_type: string | null
          cost_value: number | null
          created_at: string
          hourly_rate: number | null
          hours: number | null
          id: string
          member_id: string | null
          notes: string | null
          product_id: string | null
          recurrence: string | null
          scenario_id: string | null
          sort_order: number | null
          unit: string | null
          usage_desc: string | null
        }
        Insert: {
          cost_name: string
          cost_type?: string | null
          cost_value?: number | null
          created_at?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          member_id?: string | null
          notes?: string | null
          product_id?: string | null
          recurrence?: string | null
          scenario_id?: string | null
          sort_order?: number | null
          unit?: string | null
          usage_desc?: string | null
        }
        Update: {
          cost_name?: string
          cost_type?: string | null
          cost_value?: number | null
          created_at?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          member_id?: string | null
          notes?: string | null
          product_id?: string | null
          recurrence?: string | null
          scenario_id?: string | null
          sort_order?: number | null
          unit?: string | null
          usage_desc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_scenario_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "product_offer_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      product_deliverable_templates: {
        Row: {
          created_at: string
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          description: string | null
          document_file_path: string | null
          document_url: string | null
          duration_days: number | null
          duration_unit: string
          estimated_minutes: number | null
          id: string
          is_meeting: boolean
          is_recurring: boolean
          link_url: string | null
          linked_sop_id: string | null
          meeting_title_template: string | null
          name: string
          offset_days: number
          offset_trigger: string
          phase_id: string | null
          portal_visible: boolean
          product_id: string
          responsible_role: string | null
          responsible_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"]
          description?: string | null
          document_file_path?: string | null
          document_url?: string | null
          duration_days?: number | null
          duration_unit?: string
          estimated_minutes?: number | null
          id?: string
          is_meeting?: boolean
          is_recurring?: boolean
          link_url?: string | null
          linked_sop_id?: string | null
          meeting_title_template?: string | null
          name?: string
          offset_days?: number
          offset_trigger?: string
          phase_id?: string | null
          portal_visible?: boolean
          product_id: string
          responsible_role?: string | null
          responsible_type?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"]
          description?: string | null
          document_file_path?: string | null
          document_url?: string | null
          duration_days?: number | null
          duration_unit?: string
          estimated_minutes?: number | null
          id?: string
          is_meeting?: boolean
          is_recurring?: boolean
          link_url?: string | null
          linked_sop_id?: string | null
          meeting_title_template?: string | null
          name?: string
          offset_days?: number
          offset_trigger?: string
          phase_id?: string | null
          portal_visible?: boolean
          product_id?: string
          responsible_role?: string | null
          responsible_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_deliverable_templates_linked_sop_id_fkey"
            columns: ["linked_sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_deliverable_templates_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "product_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_deliverable_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_diagnostic_questions: {
        Row: {
          answer_type: string
          created_at: string
          group_sort_order: number
          id: string
          internal_note: string | null
          product_id: string
          question: string
          question_group: string
          sort_order: number
        }
        Insert: {
          answer_type?: string
          created_at?: string
          group_sort_order?: number
          id?: string
          internal_note?: string | null
          product_id: string
          question?: string
          question_group?: string
          sort_order?: number
        }
        Update: {
          answer_type?: string
          created_at?: string
          group_sort_order?: number
          id?: string
          internal_note?: string | null
          product_id?: string
          question?: string
          question_group?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_diagnostic_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_path: string | null
          file_type: string | null
          file_url: string | null
          id: string
          name: string
          notes: string | null
          product_id: string | null
          sort_order: number
          tags: string[]
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_path?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feedbacks: {
        Row: {
          client_name: string | null
          created_at: string
          feedback_text: string | null
          id: string
          product_id: string | null
          rating: number | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          product_id?: string | null
          rating?: number | null
        }
        Update: {
          client_name?: string | null
          created_at?: string
          feedback_text?: string | null
          id?: string
          product_id?: string | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_feedbacks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_funnels: {
        Row: {
          conversion_rate: number | null
          created_at: string
          description: string | null
          funnel_type: string | null
          id: string
          name: string
          notes: string | null
          product_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          funnel_type?: string | null
          id?: string
          name: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string
          description?: string | null
          funnel_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_funnels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_improvements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: string | null
          product_id: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          product_id?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          product_id?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_improvements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kpi_reports: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string | null
          report_month: number | null
          report_year: number | null
          summary: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          report_month?: number | null
          report_year?: number | null
          summary?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          report_month?: number | null
          report_year?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_kpi_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kpi_values: {
        Row: {
          created_at: string
          id: string
          kpi_id: string | null
          notes: string | null
          period_label: string | null
          product_id: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id?: string | null
          notes?: string | null
          period_label?: string | null
          product_id?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string | null
          notes?: string | null
          period_label?: string | null
          product_id?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_kpi_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_kpis: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          product_id: string | null
          sort_order: number | null
          target_value: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          product_id?: string | null
          sort_order?: number | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          product_id?: string | null
          sort_order?: number | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_kpis_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_metrics_analysis: {
        Row: {
          created_at: string
          id: string
          month: number | null
          notes: string | null
          product_id: string | null
          what_went_well: string | null
          what_went_wrong: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          month?: number | null
          notes?: string | null
          product_id?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          month?: number | null
          notes?: string | null
          product_id?: string | null
          what_went_well?: string | null
          what_went_wrong?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_metrics_analysis_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_milestones: {
        Row: {
          created_at: string
          days_after_start: number
          id: string
          milestone: string
          milestone_type: string
          notes: string | null
          product_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_after_start?: number
          id?: string
          milestone?: string
          milestone_type?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_after_start?: number
          id?: string
          milestone?: string
          milestone_type?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_milestones_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_dimensions: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_dimensions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_levels: {
        Row: {
          created_at: string
          dimension_id: string
          id: string
          label: string
          multiplier: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension_id: string
          id?: string
          label: string
          multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension_id?: string
          id?: string
          label?: string
          multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_levels_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "product_modifier_dimensions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_nps_config: {
        Row: {
          cadence_days: number
          collection_message: string | null
          created_at: string
          id: string
          nps_form_url: string | null
          product_id: string
          responsible_id: string | null
          updated_at: string
        }
        Insert: {
          cadence_days?: number
          collection_message?: string | null
          created_at?: string
          id?: string
          nps_form_url?: string | null
          product_id: string
          responsible_id?: string | null
          updated_at?: string
        }
        Update: {
          cadence_days?: number
          collection_message?: string | null
          created_at?: string
          id?: string
          nps_form_url?: string | null
          product_id?: string
          responsible_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_nps_config_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_nps_config_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_nps_config_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_nps_records: {
        Row: {
          client_id: string | null
          client_name: string | null
          collection_date: string
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          nps_score: number | null
          product_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          collection_date?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          nps_score?: number | null
          product_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          collection_date?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          nps_score?: number | null
          product_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_nps_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_nps_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_nps_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offboarding_templates: {
        Row: {
          created_at: string
          deliverable_type: string | null
          description: string | null
          id: string
          is_meeting: boolean | null
          name: string
          notes: string | null
          product_id: string | null
          responsible_type: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deliverable_type?: string | null
          description?: string | null
          id?: string
          is_meeting?: boolean | null
          name: string
          notes?: string | null
          product_id?: string | null
          responsible_type?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deliverable_type?: string | null
          description?: string | null
          id?: string
          is_meeting?: boolean | null
          name?: string
          notes?: string | null
          product_id?: string | null
          responsible_type?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offboarding_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_offer_scenarios: {
        Row: {
          amortization_mode: string
          created_at: string
          desired_margin: number
          estimated_sales: number | null
          id: string
          is_default: boolean
          last_test_price: number | null
          lifetime_months: number | null
          name: string
          notes: string | null
          price_breakdown: Json | null
          price_role: string | null
          product_id: string
          sort_order: number | null
          ss_rate: number
          tax_rate: number
          tax_regime: string
          updated_at: string
        }
        Insert: {
          amortization_mode?: string
          created_at?: string
          desired_margin?: number
          estimated_sales?: number | null
          id?: string
          is_default?: boolean
          last_test_price?: number | null
          lifetime_months?: number | null
          name: string
          notes?: string | null
          price_breakdown?: Json | null
          price_role?: string | null
          product_id: string
          sort_order?: number | null
          ss_rate?: number
          tax_rate?: number
          tax_regime?: string
          updated_at?: string
        }
        Update: {
          amortization_mode?: string
          created_at?: string
          desired_margin?: number
          estimated_sales?: number | null
          id?: string
          is_default?: boolean
          last_test_price?: number | null
          lifetime_months?: number | null
          name?: string
          notes?: string | null
          price_breakdown?: Json | null
          price_role?: string | null
          product_id?: string
          sort_order?: number | null
          ss_rate?: number
          tax_rate?: number
          tax_regime?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offer_scenarios_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_onboarding_templates: {
        Row: {
          activity: string
          created_at: string
          documents_links: string | null
          id: string
          phase: string | null
          product_id: string
          responsible: string | null
          rule: string | null
          rule_days: number | null
          rule_trigger: string | null
          rule_unit: string | null
          sort_order: number
        }
        Insert: {
          activity?: string
          created_at?: string
          documents_links?: string | null
          id?: string
          phase?: string | null
          product_id: string
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
        }
        Update: {
          activity?: string
          created_at?: string
          documents_links?: string | null
          id?: string
          phase?: string | null
          product_id?: string
          responsible?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_onboarding_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payment_methods: {
        Row: {
          id: string
          method: string
          notes: string | null
          product_id: string | null
        }
        Insert: {
          id?: string
          method: string
          notes?: string | null
          product_id?: string | null
        }
        Update: {
          id?: string
          method?: string
          notes?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_payment_methods_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_phases: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number | null
          duration_unit: string
          id: string
          is_offboarding: boolean
          is_onboarding: boolean
          is_recurring: boolean
          linked_sop_id: string | null
          name: string
          offset_days: number | null
          offset_trigger: string
          product_id: string
          recurrence_anchor_day: number | null
          recurrence_frequency: string | null
          recurrence_lead_days: number | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_unit?: string
          id?: string
          is_offboarding?: boolean
          is_onboarding?: boolean
          is_recurring?: boolean
          linked_sop_id?: string | null
          name?: string
          offset_days?: number | null
          offset_trigger?: string
          product_id: string
          recurrence_anchor_day?: number | null
          recurrence_frequency?: string | null
          recurrence_lead_days?: number | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_unit?: string
          id?: string
          is_offboarding?: boolean
          is_onboarding?: boolean
          is_recurring?: boolean
          linked_sop_id?: string | null
          name?: string
          offset_days?: number | null
          offset_trigger?: string
          product_id?: string
          recurrence_anchor_day?: number | null
          recurrence_frequency?: string | null
          recurrence_lead_days?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_phases_linked_sop_id_fkey"
            columns: ["linked_sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_phases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_drivers: {
        Row: {
          created_at: string
          default_qty: number
          description: string | null
          id: string
          name: string
          product_id: string
          sort_order: number
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_qty?: number
          description?: string | null
          id?: string
          name: string
          product_id: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_qty?: number
          description?: string | null
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_drivers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_quotes: {
        Row: {
          base_price: number | null
          client_id: string | null
          complexity_key: string | null
          complexity_multiplier: number | null
          created_at: string
          created_by: string | null
          discount_pct: number | null
          drivers_snapshot: Json
          id: string
          lead_id: string | null
          name: string | null
          notes: string | null
          pricing_mode: string
          product_id: string
          selected_tier_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          base_price?: number | null
          client_id?: string | null
          complexity_key?: string | null
          complexity_multiplier?: number | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          drivers_snapshot?: Json
          id?: string
          lead_id?: string | null
          name?: string | null
          notes?: string | null
          pricing_mode?: string
          product_id: string
          selected_tier_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          base_price?: number | null
          client_id?: string | null
          complexity_key?: string | null
          complexity_multiplier?: number | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          drivers_snapshot?: Json
          id?: string
          lead_id?: string | null
          name?: string | null
          notes?: string | null
          pricing_mode?: string
          product_id?: string
          selected_tier_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_quotes_selected_tier_id_fkey"
            columns: ["selected_tier_id"]
            isOneToOne: false
            referencedRelation: "product_price_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_renewal_templates: {
        Row: {
          activity: string | null
          created_at: string
          deliverable_type: string | null
          description: string | null
          documents_links: string | null
          id: string
          is_meeting: boolean
          name: string | null
          notes: string | null
          phase: string | null
          product_id: string
          responsible: string | null
          responsible_type: string | null
          rule: string | null
          rule_days: number | null
          rule_trigger: string | null
          rule_unit: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          activity?: string | null
          created_at?: string
          deliverable_type?: string | null
          description?: string | null
          documents_links?: string | null
          id?: string
          is_meeting?: boolean
          name?: string | null
          notes?: string | null
          phase?: string | null
          product_id: string
          responsible?: string | null
          responsible_type?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          activity?: string | null
          created_at?: string
          deliverable_type?: string | null
          description?: string | null
          documents_links?: string | null
          id?: string
          is_meeting?: boolean
          name?: string | null
          notes?: string | null
          phase?: string | null
          product_id?: string
          responsible?: string | null
          responsible_type?: string | null
          rule?: string | null
          rule_days?: number | null
          rule_trigger?: string | null
          rule_unit?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_renewal_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_team_members: {
        Row: {
          created_at: string
          id: string
          member_id: string | null
          product_id: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id?: string | null
          product_id?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string | null
          product_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_team_members_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_traffic_ads: {
        Row: {
          ad_name: string
          budget: number | null
          created_at: string
          id: string
          notes: string | null
          platform: string | null
          product_id: string | null
          status: string | null
        }
        Insert: {
          ad_name: string
          budget?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          platform?: string | null
          product_id?: string | null
          status?: string | null
        }
        Update: {
          ad_name?: string
          budget?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          platform?: string | null
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_traffic_ads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_useful_links: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          product_id: string | null
          sort_order: number | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          product_id?: string | null
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_useful_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          about_content: string | null
          accounting_notes: string | null
          archive_notes: string | null
          base_price: number | null
          brainstorming_content: string | null
          branding: Json
          calendar_color: string | null
          client_profile: Json | null
          competitors: Json | null
          complexity_levels: Json
          cover_url: string | null
          created_at: string
          created_by: string | null
          cycle_duration: number | null
          default_project_mode: string
          description: string | null
          drive_url: string | null
          escada: string | null
          estimated_project_hours: number | null
          faqs: Json | null
          icon: Json | null
          id: string
          included_items: Json | null
          invoice_denomination: string | null
          logo_url: string | null
          max_simultaneous_clients: number | null
          monthly_hours_per_client: number | null
          name: string
          portal_branding: Json
          price_max: number | null
          price_min: number | null
          product_type: string | null
          renewal_advance_days: number | null
          sales_benefits: Json
          sales_case_studies: Json
          sales_materials: Json
          sales_objections: Json
          sales_page: Json
          sales_page_url: string | null
          sales_pitch: string | null
          sales_presentation_url: string | null
          sales_type: string | null
          session_count: number | null
          session_duration_minutes: number | null
          status: string
          target_price: number | null
          task_mode: string
          task_modes: string[]
          ticket: string | null
          ticket_type: string
          updated_at: string
          vat_rate: string | null
          volume_discounts: Json
          welcome_email_accent_color: string | null
          welcome_email_banner_url: string | null
        }
        Insert: {
          about_content?: string | null
          accounting_notes?: string | null
          archive_notes?: string | null
          base_price?: number | null
          brainstorming_content?: string | null
          branding?: Json
          calendar_color?: string | null
          client_profile?: Json | null
          competitors?: Json | null
          complexity_levels?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cycle_duration?: number | null
          default_project_mode?: string
          description?: string | null
          drive_url?: string | null
          escada?: string | null
          estimated_project_hours?: number | null
          faqs?: Json | null
          icon?: Json | null
          id?: string
          included_items?: Json | null
          invoice_denomination?: string | null
          logo_url?: string | null
          max_simultaneous_clients?: number | null
          monthly_hours_per_client?: number | null
          name: string
          portal_branding?: Json
          price_max?: number | null
          price_min?: number | null
          product_type?: string | null
          renewal_advance_days?: number | null
          sales_benefits?: Json
          sales_case_studies?: Json
          sales_materials?: Json
          sales_objections?: Json
          sales_page?: Json
          sales_page_url?: string | null
          sales_pitch?: string | null
          sales_presentation_url?: string | null
          sales_type?: string | null
          session_count?: number | null
          session_duration_minutes?: number | null
          status?: string
          target_price?: number | null
          task_mode?: string
          task_modes?: string[]
          ticket?: string | null
          ticket_type?: string
          updated_at?: string
          vat_rate?: string | null
          volume_discounts?: Json
          welcome_email_accent_color?: string | null
          welcome_email_banner_url?: string | null
        }
        Update: {
          about_content?: string | null
          accounting_notes?: string | null
          archive_notes?: string | null
          base_price?: number | null
          brainstorming_content?: string | null
          branding?: Json
          calendar_color?: string | null
          client_profile?: Json | null
          competitors?: Json | null
          complexity_levels?: Json
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cycle_duration?: number | null
          default_project_mode?: string
          description?: string | null
          drive_url?: string | null
          escada?: string | null
          estimated_project_hours?: number | null
          faqs?: Json | null
          icon?: Json | null
          id?: string
          included_items?: Json | null
          invoice_denomination?: string | null
          logo_url?: string | null
          max_simultaneous_clients?: number | null
          monthly_hours_per_client?: number | null
          name?: string
          portal_branding?: Json
          price_max?: number | null
          price_min?: number | null
          product_type?: string | null
          renewal_advance_days?: number | null
          sales_benefits?: Json
          sales_case_studies?: Json
          sales_materials?: Json
          sales_objections?: Json
          sales_page?: Json
          sales_page_url?: string | null
          sales_pitch?: string | null
          sales_presentation_url?: string | null
          sales_type?: string | null
          session_count?: number | null
          session_duration_minutes?: number | null
          status?: string
          target_price?: number | null
          task_mode?: string
          task_modes?: string[]
          ticket?: string | null
          ticket_type?: string
          updated_at?: string
          vat_rate?: string | null
          volume_discounts?: Json
          welcome_email_accent_color?: string | null
          welcome_email_banner_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          icon: Json | null
          id: string
          onboarding_completed: boolean
          phone: string | null
          role_title: string | null
          updated_at: string
          user_id: string
          work_schedule: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          icon?: Json | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          user_id: string
          work_schedule?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          icon?: Json | null
          id?: string
          onboarding_completed?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string
          work_schedule?: string | null
        }
        Relationships: []
      }
      project_assets: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          mime_type: string | null
          page_key: string
          project_id: string
          size_bytes: number | null
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          page_key: string
          project_id: string
          size_bytes?: number | null
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          page_key?: string
          project_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverables: {
        Row: {
          assigned_to: string | null
          created_at: string
          deadline: string | null
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          description: string | null
          document_file_path: string | null
          document_url: string | null
          duration_days: number | null
          duration_unit: string
          estimated_minutes: number | null
          id: string
          is_meeting: boolean
          is_recurring: boolean
          link_url: string | null
          linked_sop_id: string | null
          meeting_id: string | null
          meeting_title_template: string | null
          name: string
          offset_days: number
          offset_trigger: string
          phase_id: string | null
          planned_end: string | null
          planned_start: string | null
          portal_visible: boolean
          project_id: string
          recurrence_label: string | null
          recurrence_week: number | null
          recurrence_weekday: number | null
          responsible_role: string | null
          responsible_type: string
          scheduled_date: string | null
          sort_order: number
          source_template_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          deadline?: string | null
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"]
          description?: string | null
          document_file_path?: string | null
          document_url?: string | null
          duration_days?: number | null
          duration_unit?: string
          estimated_minutes?: number | null
          id?: string
          is_meeting?: boolean
          is_recurring?: boolean
          link_url?: string | null
          linked_sop_id?: string | null
          meeting_id?: string | null
          meeting_title_template?: string | null
          name?: string
          offset_days?: number
          offset_trigger?: string
          phase_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          portal_visible?: boolean
          project_id: string
          recurrence_label?: string | null
          recurrence_week?: number | null
          recurrence_weekday?: number | null
          responsible_role?: string | null
          responsible_type?: string
          scheduled_date?: string | null
          sort_order?: number
          source_template_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          deadline?: string | null
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"]
          description?: string | null
          document_file_path?: string | null
          document_url?: string | null
          duration_days?: number | null
          duration_unit?: string
          estimated_minutes?: number | null
          id?: string
          is_meeting?: boolean
          is_recurring?: boolean
          link_url?: string | null
          linked_sop_id?: string | null
          meeting_id?: string | null
          meeting_title_template?: string | null
          name?: string
          offset_days?: number
          offset_trigger?: string
          phase_id?: string | null
          planned_end?: string | null
          planned_start?: string | null
          portal_visible?: boolean
          project_id?: string
          recurrence_label?: string | null
          recurrence_week?: number | null
          recurrence_weekday?: number | null
          responsible_role?: string | null
          responsible_type?: string
          scheduled_date?: string | null
          sort_order?: number
          source_template_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_linked_sop_id_fkey"
            columns: ["linked_sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_deliverables_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "product_deliverable_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          duration_unit: string
          id: string
          is_offboarding: boolean
          is_onboarding: boolean
          is_recurring: boolean
          linked_sop_id: string | null
          name: string
          offset_days: number | null
          offset_trigger: string
          planned_end: string | null
          planned_start: string | null
          project_id: string
          recurrence_anchor_day: number | null
          recurrence_frequency: string | null
          recurrence_lead_days: number | null
          recurrence_period: string | null
          sort_order: number
          source_phase_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_unit?: string
          id?: string
          is_offboarding?: boolean
          is_onboarding?: boolean
          is_recurring?: boolean
          linked_sop_id?: string | null
          name?: string
          offset_days?: number | null
          offset_trigger?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id: string
          recurrence_anchor_day?: number | null
          recurrence_frequency?: string | null
          recurrence_lead_days?: number | null
          recurrence_period?: string | null
          sort_order?: number
          source_phase_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          duration_unit?: string
          id?: string
          is_offboarding?: boolean
          is_onboarding?: boolean
          is_recurring?: boolean
          linked_sop_id?: string | null
          name?: string
          offset_days?: number | null
          offset_trigger?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string
          recurrence_anchor_day?: number | null
          recurrence_frequency?: string | null
          recurrence_lead_days?: number | null
          recurrence_period?: string | null
          sort_order?: number
          source_phase_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_linked_sop_id_fkey"
            columns: ["linked_sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_source_phase_id_fkey"
            columns: ["source_phase_id"]
            isOneToOne: false
            referencedRelation: "product_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      project_responsibilities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          notes: string | null
          party: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          notes?: string | null
          party?: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          notes?: string | null
          party?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_responsibilities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          brainstorming: string | null
          budget: number | null
          budgeted_minutes: number | null
          client_id: string | null
          client_name: string | null
          closure_bad: string | null
          closure_good: string | null
          closure_lessons: string | null
          contract_documents: Json | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          cronograma: string | null
          deadline: string | null
          department: string | null
          departments: Json | null
          diretrizes: string | null
          entregaveis: string | null
          icon: Json | null
          id: string
          name: string
          notes: string | null
          objetivo: string | null
          objetivo_curto: string | null
          payment_config: Json | null
          payment_method: string | null
          product_id: string | null
          product_name: string | null
          progress: number
          project_mode: string
          project_notes: string | null
          recursos: string | null
          session_count: number | null
          session_duration_minutes: number | null
          source_quote_id: string | null
          start_date: string | null
          status: string
          task_mode: string
          task_modes: string[]
          total_time_minutes: number | null
          type: string
          updated_at: string
          whatsapp_group_url: string | null
        }
        Insert: {
          archived_at?: string | null
          brainstorming?: string | null
          budget?: number | null
          budgeted_minutes?: number | null
          client_id?: string | null
          client_name?: string | null
          closure_bad?: string | null
          closure_good?: string | null
          closure_lessons?: string | null
          contract_documents?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          deadline?: string | null
          department?: string | null
          departments?: Json | null
          diretrizes?: string | null
          entregaveis?: string | null
          icon?: Json | null
          id?: string
          name: string
          notes?: string | null
          objetivo?: string | null
          objetivo_curto?: string | null
          payment_config?: Json | null
          payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          progress?: number
          project_mode?: string
          project_notes?: string | null
          recursos?: string | null
          session_count?: number | null
          session_duration_minutes?: number | null
          source_quote_id?: string | null
          start_date?: string | null
          status?: string
          task_mode?: string
          task_modes?: string[]
          total_time_minutes?: number | null
          type?: string
          updated_at?: string
          whatsapp_group_url?: string | null
        }
        Update: {
          archived_at?: string | null
          brainstorming?: string | null
          budget?: number | null
          budgeted_minutes?: number | null
          client_id?: string | null
          client_name?: string | null
          closure_bad?: string | null
          closure_good?: string | null
          closure_lessons?: string | null
          contract_documents?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          deadline?: string | null
          department?: string | null
          departments?: Json | null
          diretrizes?: string | null
          entregaveis?: string | null
          icon?: Json | null
          id?: string
          name?: string
          notes?: string | null
          objetivo?: string | null
          objetivo_curto?: string | null
          payment_config?: Json | null
          payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          progress?: number
          project_mode?: string
          project_notes?: string | null
          recursos?: string | null
          session_count?: number | null
          session_duration_minutes?: number | null
          source_quote_id?: string | null
          start_date?: string | null
          status?: string
          task_mode?: string
          task_modes?: string[]
          total_time_minutes?: number | null
          type?: string
          updated_at?: string
          whatsapp_group_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "product_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      publico_alvo_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          nav_group: string
          section_key: string
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          nav_group?: string
          section_key: string
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          nav_group?: string
          section_key?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          impacted_area: string
          member_name: string
          recommendation: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impacted_area?: string
          member_name: string
          recommendation: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impacted_area?: string
          member_name?: string
          recommendation?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ritual_banner_state: {
        Row: {
          completado: boolean
          completado_em: string | null
          created_at: string
          dispensado_em: string | null
          id: string
          periodo: string
          ritual_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          dispensado_em?: string | null
          id?: string
          periodo: string
          ritual_type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          dispensado_em?: string | null
          id?: string
          periodo?: string
          ritual_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_activity_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          target_member_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_member_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_view: boolean
          custom_role_id: string
          id: string
          module_key: string
        }
        Insert: {
          can_view?: boolean
          custom_role_id: string
          id?: string
          module_key: string
        }
        Update: {
          can_view?: boolean
          custom_role_id?: string
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          assigned_to: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          department: string
          frequency: string
          icon: Json | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          frequency?: string
          icon?: Json | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          frequency?: string
          icon?: Json | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      secretaria_custom_views: {
        Row: {
          columns: Json
          created_at: string
          filters: Json
          group_by: string
          id: string
          layout: string
          name: string
          scope: string
          sort_by: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          filters?: Json
          group_by?: string
          id?: string
          layout?: string
          name: string
          scope: string
          sort_by?: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string
          filters?: Json
          group_by?: string
          id?: string
          layout?: string
          name?: string
          scope?: string
          sort_by?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sop_categories: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          value?: string
        }
        Relationships: []
      }
      sop_step_documents: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          sop_id: string | null
          step_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          sop_id?: string | null
          step_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          sop_id?: string | null
          step_id?: string | null
        }
        Relationships: []
      }
      sop_steps: {
        Row: {
          created_at: string
          deadline_days: number | null
          deadline_trigger: string | null
          deadline_unit: string | null
          description: string
          id: string
          responsible: string | null
          sop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_days?: number | null
          deadline_trigger?: string | null
          deadline_unit?: string | null
          description?: string
          id?: string
          responsible?: string | null
          sop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_days?: number | null
          deadline_trigger?: string | null
          deadline_unit?: string | null
          description?: string
          id?: string
          responsible?: string | null
          sop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_steps_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          apply_to_all_active_clients: boolean
          cover_url: string | null
          created_at: string
          created_by: string | null
          custom_role_id: string | null
          decisoes: Json | null
          department: string
          departments: string[] | null
          estimated_minutes: number | null
          estimated_time: number | null
          icon: Json | null
          id: string
          inputs: Json | null
          linked_entity_id: string | null
          linked_entity_type: string
          name: string
          notas: Json | null
          objetivo: string | null
          outputs: Json | null
          passos: Json | null
          product_id: string | null
          product_name: string | null
          role_title: string | null
          routine_id: string | null
          sop_id: string
          sop_type: string
          sort_order: number
          status: string
          updated_at: string
          utilizacao_nao_usado: Json | null
          utilizacao_usado: Json | null
          version: number | null
          version_notes: string | null
        }
        Insert: {
          apply_to_all_active_clients?: boolean
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          decisoes?: Json | null
          department?: string
          departments?: string[] | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          icon?: Json | null
          id?: string
          inputs?: Json | null
          linked_entity_id?: string | null
          linked_entity_type?: string
          name: string
          notas?: Json | null
          objetivo?: string | null
          outputs?: Json | null
          passos?: Json | null
          product_id?: string | null
          product_name?: string | null
          role_title?: string | null
          routine_id?: string | null
          sop_id?: string
          sop_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
          utilizacao_nao_usado?: Json | null
          utilizacao_usado?: Json | null
          version?: number | null
          version_notes?: string | null
        }
        Update: {
          apply_to_all_active_clients?: boolean
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          decisoes?: Json | null
          department?: string
          departments?: string[] | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          icon?: Json | null
          id?: string
          inputs?: Json | null
          linked_entity_id?: string | null
          linked_entity_type?: string
          name?: string
          notas?: Json | null
          objetivo?: string | null
          outputs?: Json | null
          passos?: Json | null
          product_id?: string | null
          product_name?: string | null
          role_title?: string | null
          routine_id?: string | null
          sop_id?: string
          sop_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
          utilizacao_nao_usado?: Json | null
          utilizacao_usado?: Json | null
          version?: number | null
          version_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sops_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sops_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sops_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "planning_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_directives: {
        Row: {
          area: string | null
          created_at: string
          created_by: string | null
          description: string | null
          horizon: string
          id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          horizon?: string
          id?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          horizon?: string
          id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      strategy_channel_details: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          notes: string | null
          periodicity: string | null
          positioning: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          notes?: string | null
          periodicity?: string | null
          positioning?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          periodicity?: string | null
          positioning?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_channel_details_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_channel_formats: {
        Row: {
          channel_id: string
          created_at: string
          exemplos: string
          formato: string
          id: string
          objetivo: string
          sort_order: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          exemplos?: string
          formato?: string
          id?: string
          objetivo?: string
          sort_order?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          exemplos?: string
          formato?: string
          id?: string
          objetivo?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_channel_formats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_channel_frames: {
        Row: {
          channel_id: string
          created_at: string
          formato: string
          frequencia: string
          id: string
          nome: string
          notas: string
          sort_order: number
        }
        Insert: {
          channel_id: string
          created_at?: string
          formato?: string
          frequencia?: string
          id?: string
          nome?: string
          notas?: string
          sort_order?: number
        }
        Update: {
          channel_id?: string
          created_at?: string
          formato?: string
          frequencia?: string
          id?: string
          nome?: string
          notas?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_channel_frames_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_distribution_cards: {
        Row: {
          channel: string | null
          column_key: string
          created_at: string
          description: string | null
          files: Json | null
          id: string
          link_url: string | null
          sort_order: number
          title: string
        }
        Insert: {
          channel?: string | null
          column_key: string
          created_at?: string
          description?: string | null
          files?: Json | null
          id?: string
          link_url?: string | null
          sort_order?: number
          title?: string
        }
        Update: {
          channel?: string | null
          column_key?: string
          created_at?: string
          description?: string | null
          files?: Json | null
          id?: string
          link_url?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      strategy_editorial_lines: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pilar: string
          sort_order: number
          tipos_conteudo: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          id?: string
          pilar?: string
          sort_order?: number
          tipos_conteudo?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pilar?: string
          sort_order?: number
          tipos_conteudo?: string
        }
        Relationships: []
      }
      strategy_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          default_vat_rate: number | null
          department: string | null
          documents: Json | null
          email: string | null
          expense_description_template: string | null
          iban: string | null
          id: string
          is_active: boolean | null
          last_renewal_date: string | null
          location: string
          member_id: string | null
          name: string
          nif: string | null
          notes: string | null
          paused_until: string | null
          payment_method: string | null
          phone: string | null
          renewal_history: Json | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          department?: string | null
          documents?: Json | null
          email?: string | null
          expense_description_template?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          last_renewal_date?: string | null
          location?: string
          member_id?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          paused_until?: string | null
          payment_method?: string | null
          phone?: string | null
          renewal_history?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          department?: string | null
          documents?: Json | null
          email?: string | null
          expense_description_template?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean | null
          last_renewal_date?: string | null
          location?: string
          member_id?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          paused_until?: string | null
          payment_method?: string | null
          phone?: string | null
          renewal_history?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          email: string
          id: string
          reason: string | null
          suppressed_at: string
        }
        Insert: {
          email: string
          id?: string
          reason?: string | null
          suppressed_at?: string
        }
        Update: {
          email?: string
          id?: string
          reason?: string | null
          suppressed_at?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_time_entries: {
        Row: {
          created_at: string
          duration_minutes: number
          ended_at: string | null
          id: string
          is_manual: boolean
          note: string | null
          started_at: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          is_manual?: boolean
          note?: string | null
          started_at?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          is_manual?: boolean
          note?: string | null
          started_at?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          content_id: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deliverable_id: string | null
          department: string | null
          estimated_minutes: number | null
          estimated_time: number | null
          icon: Json | null
          id: string
          name: string
          notes: string | null
          onboarding_id: string | null
          original_assignee: string | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          recurrence_end: string | null
          recurrence_interval_days: number | null
          recurrence_type: string | null
          renewal_id: string | null
          routine_id: string | null
          scheduled_time: string | null
          sop_id: string | null
          status: string
          tag: string | null
          updated_at: string
          visible_in_portal: boolean
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          content_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_id?: string | null
          department?: string | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          icon?: Json | null
          id?: string
          name: string
          notes?: string | null
          onboarding_id?: string | null
          original_assignee?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_interval_days?: number | null
          recurrence_type?: string | null
          renewal_id?: string | null
          routine_id?: string | null
          scheduled_time?: string | null
          sop_id?: string | null
          status?: string
          tag?: string | null
          updated_at?: string
          visible_in_portal?: boolean
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          content_id?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deliverable_id?: string | null
          department?: string | null
          estimated_minutes?: number | null
          estimated_time?: number | null
          icon?: Json | null
          id?: string
          name?: string
          notes?: string | null
          onboarding_id?: string | null
          original_assignee?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_interval_days?: number | null
          recurrence_type?: string | null
          renewal_id?: string | null
          routine_id?: string | null
          scheduled_time?: string | null
          sop_id?: string | null
          status?: string
          tag?: string | null
          updated_at?: string
          visible_in_portal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "project_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "member_onboarding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_original_assignee_fkey"
            columns: ["original_assignee"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_renewal_id_fkey"
            columns: ["renewal_id"]
            isOneToOne: false
            referencedRelation: "client_renewals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "planning_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_vacations: {
        Row: {
          created_at: string
          end_date: string
          id: string
          member_id: string
          notes: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          member_id: string
          notes?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          member_id?: string
          notes?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_vacations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_vacations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          access_revoked: boolean | null
          access_suspended: boolean
          access_suspended_at: string | null
          access_suspended_by: string | null
          birthday: string | null
          cover_url: string | null
          created_at: string
          custom_holidays: Json | null
          custom_role_id: string | null
          department: string | null
          departments: Json | null
          email: string | null
          expected_weekly_hours: number
          fiscal_address: string | null
          full_name: string
          hourly_cost: number | null
          iban: string | null
          icon: Json | null
          id: string
          identification: string | null
          inactivated_at: string | null
          is_external: boolean
          member_type: string
          payment_method: string | null
          photo_url: string | null
          presentation: string | null
          profile_id: string | null
          responsibilities: string | null
          role_color: string | null
          role_title: string | null
          settlement_date: string | null
          settlement_notes: string | null
          settlement_value: number | null
          ss_employer_rate: number
          start_date: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          work_areas: Json
          work_schedule: string | null
          works_holidays: boolean
          works_with_clients: boolean
        }
        Insert: {
          access_revoked?: boolean | null
          access_suspended?: boolean
          access_suspended_at?: string | null
          access_suspended_by?: string | null
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          custom_holidays?: Json | null
          custom_role_id?: string | null
          department?: string | null
          departments?: Json | null
          email?: string | null
          expected_weekly_hours?: number
          fiscal_address?: string | null
          full_name: string
          hourly_cost?: number | null
          iban?: string | null
          icon?: Json | null
          id?: string
          identification?: string | null
          inactivated_at?: string | null
          is_external?: boolean
          member_type?: string
          payment_method?: string | null
          photo_url?: string | null
          presentation?: string | null
          profile_id?: string | null
          responsibilities?: string | null
          role_color?: string | null
          role_title?: string | null
          settlement_date?: string | null
          settlement_notes?: string | null
          settlement_value?: number | null
          ss_employer_rate?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          work_areas?: Json
          work_schedule?: string | null
          works_holidays?: boolean
          works_with_clients?: boolean
        }
        Update: {
          access_revoked?: boolean | null
          access_suspended?: boolean
          access_suspended_at?: string | null
          access_suspended_by?: string | null
          birthday?: string | null
          cover_url?: string | null
          created_at?: string
          custom_holidays?: Json | null
          custom_role_id?: string | null
          department?: string | null
          departments?: Json | null
          email?: string | null
          expected_weekly_hours?: number
          fiscal_address?: string | null
          full_name?: string
          hourly_cost?: number | null
          iban?: string | null
          icon?: Json | null
          id?: string
          identification?: string | null
          inactivated_at?: string | null
          is_external?: boolean
          member_type?: string
          payment_method?: string | null
          photo_url?: string | null
          presentation?: string | null
          profile_id?: string | null
          responsibilities?: string | null
          role_color?: string | null
          role_title?: string | null
          settlement_date?: string | null
          settlement_notes?: string | null
          settlement_value?: number | null
          ss_employer_rate?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          work_areas?: Json
          work_schedule?: string | null
          works_holidays?: boolean
          works_with_clients?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "team_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_role_presets: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          label: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          category: string
          client_id: string | null
          created_at: string
          description: string | null
          duration: number
          entry_date: string
          entry_id: string
          entry_month: number | null
          entry_quarter: number | null
          entry_week: number | null
          entry_year: number | null
          id: string
          member_id: string | null
          project_id: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          duration?: number
          entry_date?: string
          entry_id?: string
          entry_month?: number | null
          entry_quarter?: number | null
          entry_week?: number | null
          entry_year?: number | null
          id?: string
          member_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          duration?: number
          entry_date?: string
          entry_id?: string
          entry_month?: number | null
          entry_quarter?: number | null
          entry_week?: number | null
          entry_year?: number | null
          id?: string
          member_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_creatives: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          formato: string | null
          headline: string | null
          icon: Json | null
          id: string
          legenda: string | null
          link: string | null
          name: string
          objetivo: string | null
          oferta_goal: string | null
          product_id: string | null
          product_name: string | null
          start_date: string | null
          status: string
          titulo_principal: string | null
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string | null
          headline?: string | null
          icon?: Json | null
          id?: string
          legenda?: string | null
          link?: string | null
          name: string
          objetivo?: string | null
          oferta_goal?: string | null
          product_id?: string | null
          product_name?: string | null
          start_date?: string | null
          status?: string
          titulo_principal?: string | null
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          formato?: string | null
          headline?: string | null
          icon?: Json | null
          id?: string
          legenda?: string | null
          link?: string | null
          name?: string
          objetivo?: string | null
          oferta_goal?: string | null
          product_id?: string | null
          product_name?: string | null
          start_date?: string | null
          status?: string
          titulo_principal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_creatives_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_report_cards: {
        Row: {
          card_type: string | null
          created_at: string
          data: Json | null
          id: string
          notes: string | null
          product_id: string | null
          report_id: string | null
          sort_order: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          card_type?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          product_id?: string | null
          report_id?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          card_type?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          product_id?: string | null
          report_id?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      traffic_report_files: {
        Row: {
          card_id: string | null
          created_at: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
        }
        Update: {
          card_id?: string | null
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_report_files_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "traffic_report_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      training_courses: {
        Row: {
          contract_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contract_url?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contract_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_doubts: {
        Row: {
          course_id: string
          created_at: string
          doubt: string
          doubt_date: string
          id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          doubt: string
          doubt_date?: string
          id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          doubt?: string
          doubt_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_doubts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          page_icon: string
          page_path: string
          page_title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_icon?: string
          page_path: string
          page_title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_icon?: string
          page_path?: string
          page_title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_task_views: {
        Row: {
          created_at: string
          filters: Json
          group_by: string | null
          id: string
          name: string
          scope: string
          sort_order: number
          updated_at: string
          user_id: string
          view_type: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          group_by?: string | null
          id?: string
          name: string
          scope?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          view_type?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          group_by?: string | null
          id?: string
          name?: string
          scope?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          view_type?: string
        }
        Relationships: []
      }
      user_views: {
        Row: {
          created_at: string
          filter_config: Json
          id: string
          is_default: boolean | null
          label: string
          page_key: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_config?: Json
          id?: string
          is_default?: boolean | null
          label: string
          page_key: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_config?: Json
          id?: string
          is_default?: boolean | null
          label?: string
          page_key?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visao_5_anos: {
        Row: {
          alinhamento_anual: string | null
          ano_alvo: number
          business_id: string | null
          condicoes_necessarias: string | null
          created_at: string
          id: string
          onde_quero_estar: Json | null
          riscos: string | null
          updated_at: string
        }
        Insert: {
          alinhamento_anual?: string | null
          ano_alvo: number
          business_id?: string | null
          condicoes_necessarias?: string | null
          created_at?: string
          id?: string
          onde_quero_estar?: Json | null
          riscos?: string | null
          updated_at?: string
        }
        Update: {
          alinhamento_anual?: string | null
          ano_alvo?: number
          business_id?: string | null
          condicoes_necessarias?: string | null
          created_at?: string
          id?: string
          onde_quero_estar?: Json | null
          riscos?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      website_page_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          page_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          page_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_page_files_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          channel_id: string
          copy_content: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          copy_content?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          copy_content?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_pages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_align_notes: {
        Row: {
          blockers: string | null
          created_at: string | null
          decisions: string | null
          id: string
          key_points: string | null
          updated_at: string | null
          week_start: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string | null
          decisions?: string | null
          id?: string
          key_points?: string | null
          updated_at?: string | null
          week_start: string
        }
        Update: {
          blockers?: string | null
          created_at?: string | null
          decisions?: string | null
          id?: string
          key_points?: string | null
          updated_at?: string | null
          week_start?: string
        }
        Relationships: []
      }
      year_review: {
        Row: {
          alinhamento_visao_5_anos: string | null
          area_notes: Json
          created_at: string
          decisoes_ano_seguinte: string | null
          fechado_em: string | null
          id: string
          o_que_funcionou: string | null
          o_que_mudar: string | null
          status: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          alinhamento_visao_5_anos?: string | null
          area_notes?: Json
          created_at?: string
          decisoes_ano_seguinte?: string | null
          fechado_em?: string | null
          id?: string
          o_que_funcionou?: string | null
          o_que_mudar?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          year: number
        }
        Update: {
          alinhamento_visao_5_anos?: string | null
          area_notes?: Json
          created_at?: string
          decisoes_ano_seguinte?: string | null
          fechado_em?: string | null
          id?: string
          o_que_funcionou?: string | null
          o_que_mudar?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      business_setup_public: {
        Row: {
          business_email: string | null
          business_legal_name: string | null
          business_website: string | null
          cae_principal: string | null
          cae_secundarios: string | null
          created_at: string | null
          id: string | null
          notas: string | null
          payment_methods: Json | null
          regime_fiscal: string | null
          regime_iva: string | null
          updated_at: string | null
        }
        Insert: {
          business_email?: string | null
          business_legal_name?: string | null
          business_website?: string | null
          cae_principal?: string | null
          cae_secundarios?: string | null
          created_at?: string | null
          id?: string | null
          notas?: string | null
          payment_methods?: Json | null
          regime_fiscal?: string | null
          regime_iva?: string | null
          updated_at?: string | null
        }
        Update: {
          business_email?: string | null
          business_legal_name?: string | null
          business_website?: string | null
          cae_principal?: string | null
          cae_secundarios?: string | null
          created_at?: string | null
          id?: string | null
          notas?: string | null
          payment_methods?: Json | null
          regime_fiscal?: string | null
          regime_iva?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_contacts_public: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string | null
          name: string | null
          notes: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_public: {
        Row: {
          client_files: Json | null
          client_id: string | null
          conversion_date: string | null
          created_at: string | null
          created_by: string | null
          current_product: string | null
          current_product_id: string | null
          documents: string | null
          dp: string | null
          drive_folder_url: string | null
          email: string | null
          end_of_cycle: string | null
          full_name: string | null
          id: string | null
          observations: string | null
          portal_deactivation_date: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          whatsapp_group_url: string | null
        }
        Insert: {
          client_files?: Json | null
          client_id?: string | null
          conversion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_product?: string | null
          current_product_id?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          full_name?: string | null
          id?: string | null
          observations?: string | null
          portal_deactivation_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_group_url?: string | null
        }
        Update: {
          client_files?: Json | null
          client_id?: string | null
          conversion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          current_product?: string | null
          current_product_id?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          full_name?: string | null
          id?: string | null
          observations?: string | null
          portal_deactivation_date?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_group_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_current_product_id_fkey"
            columns: ["current_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers_public: {
        Row: {
          category: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          default_vat_rate: number | null
          expense_description_template: string | null
          id: string | null
          is_active: boolean | null
          last_renewal_date: string | null
          location: string | null
          member_id: string | null
          name: string | null
          notes: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          category?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          expense_description_template?: string | null
          id?: string | null
          is_active?: boolean | null
          last_renewal_date?: string | null
          location?: string | null
          member_id?: string | null
          name?: string | null
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          category?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          default_vat_rate?: number | null
          expense_description_template?: string | null
          id?: string | null
          is_active?: boolean | null
          last_renewal_date?: string | null
          location?: string | null
          member_id?: string | null
          name?: string | null
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members_public: {
        Row: {
          access_revoked: boolean | null
          access_suspended: boolean | null
          created_at: string | null
          custom_role_id: string | null
          department: string | null
          departments: Json | null
          email: string | null
          full_name: string | null
          id: string | null
          inactivated_at: string | null
          photo_url: string | null
          profile_id: string | null
          role_title: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          work_areas: Json | null
        }
        Insert: {
          access_revoked?: boolean | null
          access_suspended?: boolean | null
          created_at?: string | null
          custom_role_id?: string | null
          department?: string | null
          departments?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          inactivated_at?: string | null
          photo_url?: string | null
          profile_id?: string | null
          role_title?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          work_areas?: Json | null
        }
        Update: {
          access_revoked?: boolean | null
          access_suspended?: boolean | null
          created_at?: string | null
          custom_role_id?: string | null
          department?: string | null
          departments?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          inactivated_at?: string | null
          photo_url?: string | null
          profile_id?: string | null
          role_title?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          work_areas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accountant_access_enabled: { Args: never; Returns: boolean }
      activate_renewal_project: { Args: { _project_id: string }; Returns: Json }
      add_business_hours: {
        Args: { _from: string; _hours: number }
        Returns: string
      }
      apply_product_portal_template: {
        Args: {
          _mode?: string
          _portal_id: string
          _product_id: string
          _sections?: string[]
        }
        Returns: Json
      }
      apply_project_deliverable_tasks: {
        Args: { _project_id: string }
        Returns: number
      }
      backfill_deliverable_tasks: { Args: never; Returns: number }
      can_edit_event: { Args: { _event_id: string }; Returns: boolean }
      can_edit_marketing_metrics: { Args: never; Returns: boolean }
      can_edit_operational_kpis: { Args: never; Returns: boolean }
      can_edit_project: { Args: { _project_id: string }; Returns: boolean }
      can_edit_sop: { Args: { _sop_id: string }; Returns: boolean }
      can_edit_task: { Args: { _task_id: string }; Returns: boolean }
      cancel_scheduled_renewal: { Args: { _client_id: string }; Returns: Json }
      current_team_member_id: { Args: never; Returns: string }
      current_user_departments: { Args: never; Returns: string[] }
      current_user_has_sensitive_access: {
        Args: { _category: string }
        Returns: boolean
      }
      current_user_is_suspended: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_portal_branding: { Args: { _token: string }; Returns: Json }
      get_portal_by_slug: {
        Args: { _slug: string }
        Returns: {
          client_id: string
          id: string
          is_active: boolean
          portal_type: string
          show_faqs: boolean
          show_meetings: boolean
          show_monthly_summary: boolean
          show_onboarding: boolean
          show_payments: boolean
          show_timeline: boolean
          show_workspace: boolean
          slug: string
          token: string
        }[]
      }
      get_portal_by_token: {
        Args: { _token: string }
        Returns: {
          client_id: string
          id: string
          is_active: boolean
          portal_type: string
          show_faqs: boolean
          show_meetings: boolean
          show_monthly_summary: boolean
          show_onboarding: boolean
          show_payments: boolean
          show_timeline: boolean
          show_workspace: boolean
          slug: string
          token: string
        }[]
      }
      get_portal_client_context: {
        Args: { _token: string }
        Returns: {
          documents: string
          drive_folder_url: string
          full_name: string
          id: string
        }[]
      }
      get_portal_comments: {
        Args: { _token: string }
        Returns: {
          author: Database["public"]["Enums"]["portal_comment_author"]
          author_name: string
          content: string
          created_at: string
          id: string
          portal_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_contract_documents: {
        Args: { _token: string }
        Returns: {
          contract_documents: Json
          project_name: string
        }[]
      }
      get_portal_deliverable_file_url: {
        Args: { _deliverable_id: string; _token: string }
        Returns: string
      }
      get_portal_faqs: {
        Args: { _token: string }
        Returns: {
          answer: string | null
          created_at: string
          from_template: boolean
          id: string
          portal_id: string
          question: string
          sort_order: number
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_faqs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_feedback: {
        Args: { _token: string }
        Returns: {
          content: string
          created_at: string
          id: string
          portal_id: string
          submitted_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_feedback"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_initial_questions: {
        Args: { _token: string }
        Returns: {
          answer: string | null
          answer_type: string
          answered_at: string | null
          created_at: string
          file_urls: Json | null
          group_sort_order: number
          id: string
          portal_id: string
          question: string
          question_group: string | null
          sort_order: number
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_initial_questions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_meetings: {
        Args: { _token: string }
        Returns: {
          client_actions: Json
          client_id: string
          date_time: string
          department: string
          discussion_notes: string
          discussion_points: Json
          documents: Json
          duration_minutes: number
          final_notes: Json
          id: string
          meeting_url: string
          portal_notes: string
          priorities: Json
          project_id: string
          project_name: string
          status: string
          title: string
        }[]
      }
      get_portal_monthly_summaries: {
        Args: { _token: string }
        Returns: {
          content: string
          created_at: string
          id: string
          month: number
          portal_id: string
          year: number
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_monthly_summaries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_portal_onboarding: {
        Args: { _token: string }
        Returns: {
          activity: string
          completed: boolean
          documents_links: string
          due_date: string
          id: string
          phase: string
          responsible: string
          sort_order: number
        }[]
      }
      get_portal_payment_methods: { Args: { _token: string }; Returns: Json }
      get_portal_payments: {
        Args: { _token: string }
        Returns: {
          documents: Json
          id: string
          payment_date: string
          sale_month: number
          status: string
        }[]
      }
      get_portal_phases: { Args: { _token: string }; Returns: Json }
      get_portal_project_history: {
        Args: { _token: string }
        Returns: {
          created_at: string
          end_date: string
          id: string
          monthly_summaries: Json
          notes: string
          product_name: string
          project_name: string
          start_date: string
          status: string
          timeline_phases: Json
        }[]
      }
      get_portal_responsibilities: {
        Args: { _token: string }
        Returns: {
          description: string
          id: string
          notes: string
          party: string
          project_id: string
          project_name: string
          sort_order: number
        }[]
      }
      get_portal_routines: {
        Args: { _token: string }
        Returns: {
          estimated_time: number
          hour_time: string
          id: string
          month_day: number
          project_id: string
          project_name: string
          recurrence_type: string
          title: string
          weekday: number
        }[]
      }
      get_portal_timeline_phases: {
        Args: { _token: string }
        Returns: {
          created_at: string
          from_template: boolean
          id: string
          portal_id: string
          sort_order: number
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "portal_timeline_phases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profiles_basic: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          user_id: string
        }[]
      }
      get_system_config_value: { Args: { _key: string }; Returns: string }
      has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: never; Returns: boolean }
      is_hr_or_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_self_team_member: { Args: { _member_id: string }; Returns: boolean }
      log_audit_entry: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_meetings_missing_link: { Args: never; Returns: number }
      notify_portal_meeting_confirmed: {
        Args: {
          _client_name: string
          _meeting_id: string
          _meeting_title: string
        }
        Returns: undefined
      }
      notify_portal_questions_submitted: {
        Args: { _client_id: string; _client_name: string }
        Returns: undefined
      }
      portal_add_comment: {
        Args: { _author: string; _content: string; _token: string }
        Returns: string
      }
      portal_add_meeting_notes: {
        Args: { _meeting_id: string; _notes: string; _token: string }
        Returns: boolean
      }
      portal_answer_initial_question: {
        Args: {
          _answer: string
          _file_urls?: Json
          _question_id: string
          _token: string
        }
        Returns: boolean
      }
      portal_confirm_meeting: {
        Args: { _meeting_id: string; _token: string }
        Returns: boolean
      }
      portal_email_allowed: {
        Args: { _email: string; _token: string }
        Returns: boolean
      }
      portal_record_visit:
        | { Args: { _token: string }; Returns: undefined }
        | { Args: { _email?: string; _token: string }; Returns: undefined }
      portal_submit_feedback: {
        Args: { _payload: Json; _token: string }
        Returns: string
      }
      portal_submit_initial_questions: {
        Args: { _token: string }
        Returns: boolean
      }
      portal_toggle_deliverable: {
        Args: { _completed: boolean; _deliverable_id: string; _token: string }
        Returns: boolean
      }
      portal_toggle_onboarding_step: {
        Args: { _completed: boolean; _step_id: string; _token: string }
        Returns: boolean
      }
      portal_token_active: { Args: { _token: string }; Returns: boolean }
      profile_id_to_user_id: { Args: { _profile_id: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_deliverable_assignee: {
        Args: { _deliverable_id: string }
        Returns: string
      }
      rollback_renewal_project: { Args: { _project_id: string }; Returns: Json }
      run_e2e_tests: { Args: never; Returns: Json }
      send_notification_to_user: {
        Args: {
          _link?: string
          _message?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      suggest_task_estimate: {
        Args: {
          _deliverable_template_id?: string
          _name: string
          _project_id?: string
          _sop_id?: string
        }
        Returns: {
          avg_minutes: number
          confidence: string
          matched_task_name: string
          sample_count: number
        }[]
      }
      sync_portal_faqs_from_product: {
        Args: { _portal_id: string }
        Returns: undefined
      }
      sync_project_with_template: {
        Args: { _project_id: string }
        Returns: Json
      }
      sync_supplier_expenses_from_contract: {
        Args: { p_member_id: string; p_supplier_id: string }
        Returns: undefined
      }
      test_payment_sync_e2e: {
        Args: never
        Returns: {
          actual: string
          expected: string
          passed: boolean
          test_name: string
        }[]
      }
      test_product_rename_cascade: {
        Args: never
        Returns: {
          actual: string
          expected: string
          passed: boolean
          table_name: string
        }[]
      }
      user_can_access_client: { Args: { _client_id: string }; Returns: boolean }
      user_can_access_portal: { Args: { _portal_id: string }; Returns: boolean }
      user_can_access_project: {
        Args: { _project_id: string }
        Returns: boolean
      }
      user_can_open_client: { Args: { _client_id: string }; Returns: boolean }
      user_can_open_meeting: { Args: { _meeting_id: string }; Returns: boolean }
      user_can_open_project: { Args: { _project_id: string }; Returns: boolean }
      user_in_department: { Args: { _dept: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "member"
        | "accountant"
        | "hr"
        | "admin_staff"
        | "sales"
        | "team_member"
        | "viewer"
      brain_dump_status: "em_ideia" | "aplicado" | "desconsiderado"
      deliverable_type:
        | "tarefa"
        | "reuniao"
        | "documento"
        | "aprovacao"
        | "link"
      digest_frequency: "diario" | "semanal" | "mensal"
      google_calendar_scope:
        | "produto"
        | "cliente"
        | "reunioes"
        | "geral"
        | "ignorar"
      launch_phase:
        | "estrategia"
        | "antecipacao"
        | "captacao"
        | "produto_servico"
        | "venda"
        | "debriefing_pos_fecho"
      launch_task_status: "por_comecar" | "em_curso" | "concluido" | "bloqueado"
      meeting_status:
        | "por_confirmar"
        | "marcada"
        | "terminada"
        | "confirmada"
        | "por_organizar"
        | "realizada"
        | "cancelada"
      meeting_type:
        | "recorrente"
        | "projeto"
        | "cliente"
        | "diagnostico"
        | "inicial"
      portal_comment_author: "client" | "team"
      portal_type: "projeto_unico" | "servico_mensal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "owner",
        "admin",
        "member",
        "accountant",
        "hr",
        "admin_staff",
        "sales",
        "team_member",
        "viewer",
      ],
      brain_dump_status: ["em_ideia", "aplicado", "desconsiderado"],
      deliverable_type: ["tarefa", "reuniao", "documento", "aprovacao", "link"],
      digest_frequency: ["diario", "semanal", "mensal"],
      google_calendar_scope: [
        "produto",
        "cliente",
        "reunioes",
        "geral",
        "ignorar",
      ],
      launch_phase: [
        "estrategia",
        "antecipacao",
        "captacao",
        "produto_servico",
        "venda",
        "debriefing_pos_fecho",
      ],
      launch_task_status: ["por_comecar", "em_curso", "concluido", "bloqueado"],
      meeting_status: [
        "por_confirmar",
        "marcada",
        "terminada",
        "confirmada",
        "por_organizar",
        "realizada",
        "cancelada",
      ],
      meeting_type: [
        "recorrente",
        "projeto",
        "cliente",
        "diagnostico",
        "inicial",
      ],
      portal_comment_author: ["client", "team"],
      portal_type: ["projeto_unico", "servico_mensal"],
    },
  },
} as const
