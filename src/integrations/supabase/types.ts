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
      brand_kanban_items: {
        Row: {
          content: string | null
          created_at: string
          group_key: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          group_key: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          group_key?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          card_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
        }
        Update: {
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
          background_color: string
          business_name: string
          created_at: string
          font_body: string
          font_display: string
          id: string
          login_bg_url: string | null
          logo_url: string | null
          primary_color: string
          proposta_unica_valor: string | null
          secondary_color: string
          text_color: string
          updated_at: string
          welcome_text: string | null
        }
        Insert: {
          about_text?: string | null
          accent_color?: string
          background_color?: string
          business_name: string
          created_at?: string
          font_body?: string
          font_display?: string
          id?: string
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          proposta_unica_valor?: string | null
          secondary_color?: string
          text_color?: string
          updated_at?: string
          welcome_text?: string | null
        }
        Update: {
          about_text?: string | null
          accent_color?: string
          background_color?: string
          business_name?: string
          created_at?: string
          font_body?: string
          font_display?: string
          id?: string
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          proposta_unica_valor?: string | null
          secondary_color?: string
          text_color?: string
          updated_at?: string
          welcome_text?: string | null
        }
        Relationships: []
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
          channel_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          title: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          title: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_reports_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "marketing_channels"
            referencedColumns: ["id"]
          },
        ]
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
        ]
      }
      client_history: {
        Row: {
          client_id: string
          created_at: string
          entry_date: string
          id: string
          milestone: string
          observations: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          entry_date?: string
          id?: string
          milestone?: string
          observations?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          entry_date?: string
          id?: string
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
            foreignKeyName: "client_nps_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          id: string
          phase: string | null
          responsible: string | null
          rule: string | null
          sort_order: number | null
        }
        Insert: {
          activity?: string
          client_id: string
          completed?: boolean | null
          created_at?: string | null
          documents_links?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          sort_order?: number | null
        }
        Update: {
          activity?: string
          client_id?: string
          completed?: boolean | null
          created_at?: string | null
          documents_links?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
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
        ]
      }
      client_onboarding: {
        Row: {
          activity: string
          client_id: string
          completed: boolean
          created_at: string
          documents_links: string | null
          id: string
          phase: string | null
          responsible: string | null
          rule: string | null
          sort_order: number
        }
        Insert: {
          activity?: string
          client_id: string
          completed?: boolean
          created_at?: string
          documents_links?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
          sort_order?: number
        }
        Update: {
          activity?: string
          client_id?: string
          completed?: boolean
          created_at?: string
          documents_links?: string | null
          id?: string
          phase?: string | null
          responsible?: string | null
          rule?: string | null
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
        ]
      }
      clients: {
        Row: {
          birthday: string | null
          client_id: string
          created_at: string
          created_by: string | null
          current_product: string | null
          documents: string | null
          dp: string | null
          drive_folder_url: string | null
          email: string | null
          end_of_cycle: string | null
          fiscal_address: string | null
          full_name: string
          id: string
          nif: string | null
          observations: string | null
          payment_method: string | null
          start_date: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          birthday?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_product?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          fiscal_address?: string | null
          full_name: string
          id?: string
          nif?: string | null
          observations?: string | null
          payment_method?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          birthday?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_product?: string | null
          documents?: string | null
          dp?: string | null
          drive_folder_url?: string | null
          email?: string | null
          end_of_cycle?: string | null
          fiscal_address?: string | null
          full_name?: string
          id?: string
          nif?: string | null
          observations?: string | null
          payment_method?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
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
          result?: string
          results_numbers?: string | null
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          what_didnt_work?: string | null
          what_worked?: string | null
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
          product_name?: string
          sort_order?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
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
          base_value: number
          client: string | null
          created_at: string
          created_by: string | null
          description: string | null
          documents: Json | null
          id: string
          invoice_total: number
          payment_date: string | null
          product: string | null
          sale_id: string
          sale_month: number | null
          sale_quarter: number | null
          sale_year: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_value?: number
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          id?: string
          invoice_total?: number
          payment_date?: string | null
          product?: string | null
          sale_id: string
          sale_month?: number | null
          sale_quarter?: number | null
          sale_year?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_value?: number
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          id?: string
          invoice_total?: number
          payment_date?: string | null
          product?: string | null
          sale_id?: string
          sale_month?: number | null
          sale_quarter?: number | null
          sale_year?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      commercial_sales_actions: {
        Row: {
          action_name: string
          action_type: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          objective: string | null
          product: string | null
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
          id?: string
          objective?: string | null
          product?: string | null
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
          id?: string
          objective?: string | null
          product?: string | null
          result?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      commercial_strategy: {
        Row: {
          created_at: string
          id: string
          period: string
          sections: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period?: string
          sections?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period?: string
          sections?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_attachments: {
        Row: {
          content_id: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
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
      content_items: {
        Row: {
          assigned_to: string | null
          content_type: string | null
          copy_content: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          format: string | null
          funnel_stage: string | null
          id: string
          objective: string | null
          product_name: string | null
          project_id: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          content_type?: string | null
          copy_content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          funnel_stage?: string | null
          id?: string
          objective?: string | null
          product_name?: string | null
          project_id?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          content_type?: string | null
          copy_content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          format?: string | null
          funnel_stage?: string | null
          id?: string
          objective?: string | null
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
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      crm_leads: {
        Row: {
          added_at: string
          closed_product: string | null
          context: string | null
          created_at: string
          created_by: string | null
          documents: string | null
          email: string | null
          estimated_value: number | null
          followup_notes: string | null
          id: string
          lost_reason: string | null
          name: string
          next_followup: string | null
          phone: string | null
          potential_product: string | null
          responsible_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          closed_product?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          documents?: string | null
          email?: string | null
          estimated_value?: number | null
          followup_notes?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          next_followup?: string | null
          phone?: string | null
          potential_product?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          closed_product?: string | null
          context?: string | null
          created_at?: string
          created_by?: string | null
          documents?: string | null
          email?: string | null
          estimated_value?: number | null
          followup_notes?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          next_followup?: string | null
          phone?: string | null
          potential_product?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_owner?: boolean
          name?: string
          updated_at?: string
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
          created_at: string
          created_by: string | null
          department: string | null
          end_date: string | null
          event_type_id: string | null
          id: string
          meeting_url: string | null
          notes: string | null
          product_name: string | null
          recurrence_end: string | null
          recurrence_type: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_date?: string | null
          event_type_id?: string | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          product_name?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_date?: string | null
          event_type_id?: string | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          product_name?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_brain_dump: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          task: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          task: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          task?: string
        }
        Relationships: []
      }
      executive_goals: {
        Row: {
          achieved_date: string | null
          area: string
          created_at: string
          id: string
          meta: string
          month: number | null
          objective_id: string | null
          quarter: number | null
          status: string
          target_date: string | null
          updated_at: string
          year: number
        }
        Insert: {
          achieved_date?: string | null
          area?: string
          created_at?: string
          id?: string
          meta: string
          month?: number | null
          objective_id?: string | null
          quarter?: number | null
          status?: string
          target_date?: string | null
          updated_at?: string
          year?: number
        }
        Update: {
          achieved_date?: string | null
          area?: string
          created_at?: string
          id?: string
          meta?: string
          month?: number | null
          objective_id?: string | null
          quarter?: number | null
          status?: string
          target_date?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_goals_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "executive_objectives"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          measurement_type: string
          objective_type: string
          product_id: string | null
          progress: number
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
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          measurement_type?: string
          objective_type?: string
          product_id?: string | null
          progress?: number
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
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          measurement_type?: string
          objective_type?: string
          product_id?: string | null
          progress?: number
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
        Relationships: []
      }
      financial_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_type: string
          document_name: string | null
          document_url: string | null
          due_date: string | null
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
          created_at?: string
          created_by?: string | null
          doc_type?: string
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
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
          created_at?: string
          created_by?: string | null
          doc_type?: string
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
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
          created_at: string
          created_by: string | null
          description: string | null
          documents: Json | null
          expense_date: string | null
          expense_id: string
          expense_month: number | null
          expense_quarter: number | null
          expense_year: number | null
          id: string
          location: string
          source_id: string | null
          source_type: string | null
          status: string
          total_with_vat: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          base_value?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          expense_date?: string | null
          expense_id?: string
          expense_month?: number | null
          expense_quarter?: number | null
          expense_year?: number | null
          id?: string
          location?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          total_with_vat?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          base_value?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          documents?: Json | null
          expense_date?: string | null
          expense_id?: string
          expense_month?: number | null
          expense_quarter?: number | null
          expense_year?: number | null
          id?: string
          location?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          total_with_vat?: number
          updated_at?: string
          vat_rate?: number
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
          documents: Json | null
          id: string
          includes_vat: boolean
          location: string
          monthly_equivalent: number
          notes: string | null
          periodicity: string
          platform_name: string
          renewal_date: string | null
          start_date: string | null
          status: string
          updated_at: string
          value: number
          vat_rate: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          id?: string
          includes_vat?: boolean
          location?: string
          monthly_equivalent?: number
          notes?: string | null
          periodicity?: string
          platform_name: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number
          vat_rate?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          documents?: Json | null
          id?: string
          includes_vat?: boolean
          location?: string
          monthly_equivalent?: number
          notes?: string | null
          periodicity?: string
          platform_name?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number
          vat_rate?: number
        }
        Relationships: []
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
          created_at: string
          created_by: string | null
          doc_type: string
          file_url: string | null
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
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url?: string | null
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
          created_at?: string
          created_by?: string | null
          doc_type?: string
          file_url?: string | null
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
      marketing_automations: {
        Row: {
          condicoes: Json | null
          created_at: string
          created_by: string | null
          fluxo: Json | null
          gatilho: string | null
          id: string
          links: Json | null
          name: string
          notas: string | null
          objetivo: string | null
          oferta_final: string | null
          plataforma: string | null
          plataformas_envolvidas: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          condicoes?: Json | null
          created_at?: string
          created_by?: string | null
          fluxo?: Json | null
          gatilho?: string | null
          id?: string
          links?: Json | null
          name: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataforma?: string | null
          plataformas_envolvidas?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          condicoes?: Json | null
          created_at?: string
          created_by?: string | null
          fluxo?: Json | null
          gatilho?: string | null
          id?: string
          links?: Json | null
          name?: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataforma?: string | null
          plataformas_envolvidas?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          link: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
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
          created_at: string
          created_by: string | null
          entry_points: Json | null
          etapas: Json | null
          fluxo_resumido: string | null
          id: string
          name: string
          notas: string | null
          objetivo: string | null
          oferta_final: string | null
          plataformas: Json | null
          status: string
          tipo_funil: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_points?: Json | null
          etapas?: Json | null
          fluxo_resumido?: string | null
          id?: string
          name: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataformas?: Json | null
          status?: string
          tipo_funil?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_points?: Json | null
          etapas?: Json | null
          fluxo_resumido?: string | null
          id?: string
          name?: string
          notas?: string | null
          objetivo?: string | null
          oferta_final?: string | null
          plataformas?: Json | null
          status?: string
          tipo_funil?: string | null
          updated_at?: string
        }
        Relationships: []
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
      meetings: {
        Row: {
          client_actions: Json | null
          client_name: string | null
          created_at: string
          created_by: string | null
          date_time: string
          department: string | null
          discussion_points: Json | null
          final_notes: Json | null
          id: string
          owner_actions: Json | null
          priorities: Json | null
          project_id: string | null
          project_name: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript_url: string | null
          updated_at: string
        }
        Insert: {
          client_actions?: Json | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          date_time: string
          department?: string | null
          discussion_points?: Json | null
          final_notes?: Json | null
          id?: string
          owner_actions?: Json | null
          priorities?: Json | null
          project_id?: string | null
          project_name?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript_url?: string | null
          updated_at?: string
        }
        Update: {
          client_actions?: Json | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          date_time?: string
          department?: string | null
          discussion_points?: Json | null
          final_notes?: Json | null
          id?: string
          owner_actions?: Json | null
          priorities?: Json | null
          project_id?: string | null
          project_name?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          transcript_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          start_date: string | null
          status: string
          updated_at: string
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
          start_date?: string | null
          status?: string
          updated_at?: string
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
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_contracts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_onboarding: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          member_id: string
          sort_order: number
          task: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          member_id: string
          sort_order?: number
          task: string
        }
        Update: {
          completed?: boolean
          created_at?: string
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
        ]
      }
      member_personal_images: {
        Row: {
          id: string
          image_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          image_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          image_url?: string
          updated_at?: string
          user_id?: string
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
      members: {
        Row: {
          created_at: string
          custom_role_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_role_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_role_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
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
      mural_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
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
        ]
      }
      planning_goals: {
        Row: {
          actual_value: string | null
          created_at: string
          deviation: string | null
          deviation_decision: string | null
          id: string
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
      product_automations: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          objective: string | null
          offer: string | null
          platform: string | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          offer?: string | null
          platform?: string | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          offer?: string | null
          platform?: string | null
          product_id?: string
          status?: string
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
          created_at: string
          id: string
          name: string | null
          product_id: string
          sort_order: number
          usage_desc: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          product_id: string
          sort_order?: number
          usage_desc?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          product_id?: string
          sort_order?: number
          usage_desc?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
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
          feedback: string | null
          id: string
          image_url: string | null
          product_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          image_url?: string | null
          product_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          image_url?: string | null
          product_id?: string
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
          created_at: string
          entry_points: Json | null
          funnel_type: string | null
          id: string
          name: string
          notes: string | null
          objective: string | null
          offer: string | null
          platforms: Json | null
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_points?: Json | null
          funnel_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          offer?: string | null
          platforms?: Json | null
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_points?: Json | null
          funnel_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          objective?: string | null
          offer?: string | null
          platforms?: Json | null
          product_id?: string
          status?: string
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
      product_kpi_reports: {
        Row: {
          content: string | null
          created_at: string
          id: string
          month: number
          product_id: string
          updated_at: string
          year: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          month: number
          product_id: string
          updated_at?: string
          year: number
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          month?: number
          product_id?: string
          updated_at?: string
          year?: number
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
      product_milestones: {
        Row: {
          created_at: string
          days_after_start: number
          id: string
          milestone: string
          milestone_type: string
          product_id: string
          responsible_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_after_start?: number
          id?: string
          milestone?: string
          milestone_type?: string
          product_id: string
          responsible_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_after_start?: number
          id?: string
          milestone?: string
          milestone_type?: string
          product_id?: string
          responsible_id?: string | null
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
          {
            foreignKeyName: "product_milestones_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
          product_id: string
          responsible_id: string | null
          updated_at: string
        }
        Insert: {
          cadence_days?: number
          collection_message?: string | null
          created_at?: string
          id?: string
          product_id: string
          responsible_id?: string | null
          updated_at?: string
        }
        Update: {
          cadence_days?: number
          collection_message?: string | null
          created_at?: string
          id?: string
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
        ]
      }
      product_nps_records: {
        Row: {
          client_name: string
          collection_date: string
          created_at: string
          id: string
          notes: string | null
          nps_score: number | null
          product_id: string
          status: string
        }
        Insert: {
          client_name?: string
          collection_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          nps_score?: number | null
          product_id: string
          status?: string
        }
        Update: {
          client_name?: string
          collection_date?: string
          created_at?: string
          id?: string
          notes?: string | null
          nps_score?: number | null
          product_id?: string
          status?: string
        }
        Relationships: [
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
          activity: string
          created_at: string | null
          documents_links: string | null
          id: string
          phase: string | null
          product_id: string
          responsible: string | null
          rule: string | null
          sort_order: number | null
        }
        Insert: {
          activity?: string
          created_at?: string | null
          documents_links?: string | null
          id?: string
          phase?: string | null
          product_id: string
          responsible?: string | null
          rule?: string | null
          sort_order?: number | null
        }
        Update: {
          activity?: string
          created_at?: string | null
          documents_links?: string | null
          id?: string
          phase?: string | null
          product_id?: string
          responsible?: string | null
          rule?: string | null
          sort_order?: number | null
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
      product_project_templates: {
        Row: {
          created_at: string
          id: string
          phase: string | null
          product_id: string
          responsible: string | null
          sort_order: number
          task_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          phase?: string | null
          product_id: string
          responsible?: string | null
          sort_order?: number
          task_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          phase?: string | null
          product_id?: string
          responsible?: string | null
          sort_order?: number
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_project_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_traffic_ads: {
        Row: {
          created_at: string
          creative_url: string | null
          format: string | null
          id: string
          link: string | null
          objective: string | null
          offer_goal: string | null
          product_id: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          creative_url?: string | null
          format?: string | null
          id?: string
          link?: string | null
          objective?: string | null
          offer_goal?: string | null
          product_id: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          creative_url?: string | null
          format?: string | null
          id?: string
          link?: string | null
          objective?: string | null
          offer_goal?: string | null
          product_id?: string
          start_date?: string | null
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
          name: string | null
          product_id: string
          sort_order: number
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          product_id: string
          sort_order?: number
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          product_id?: string
          sort_order?: number
          url?: string | null
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
          brainstorming_content: string | null
          client_profile: Json | null
          competitors: Json | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          cycle_duration: number | null
          description: string | null
          drive_url: string | null
          escada: string | null
          faqs: Json | null
          id: string
          important_dates: Json | null
          improvements_content: string | null
          included_items: Json | null
          invoice_denomination: string | null
          logo_url: string | null
          monthly_hours_per_client: number | null
          name: string
          product_type: string | null
          sales_page_url: string | null
          sales_type: string | null
          status: string
          ticket: string | null
          updated_at: string
          vat_rate: string | null
        }
        Insert: {
          about_content?: string | null
          accounting_notes?: string | null
          brainstorming_content?: string | null
          client_profile?: Json | null
          competitors?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cycle_duration?: number | null
          description?: string | null
          drive_url?: string | null
          escada?: string | null
          faqs?: Json | null
          id?: string
          important_dates?: Json | null
          improvements_content?: string | null
          included_items?: Json | null
          invoice_denomination?: string | null
          logo_url?: string | null
          monthly_hours_per_client?: number | null
          name: string
          product_type?: string | null
          sales_page_url?: string | null
          sales_type?: string | null
          status?: string
          ticket?: string | null
          updated_at?: string
          vat_rate?: string | null
        }
        Update: {
          about_content?: string | null
          accounting_notes?: string | null
          brainstorming_content?: string | null
          client_profile?: Json | null
          competitors?: Json | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cycle_duration?: number | null
          description?: string | null
          drive_url?: string | null
          escada?: string | null
          faqs?: Json | null
          id?: string
          important_dates?: Json | null
          improvements_content?: string | null
          included_items?: Json | null
          invoice_denomination?: string | null
          logo_url?: string | null
          monthly_hours_per_client?: number | null
          name?: string
          product_type?: string | null
          sales_page_url?: string | null
          sales_type?: string | null
          status?: string
          ticket?: string | null
          updated_at?: string
          vat_rate?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
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
          id?: string
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
          id?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string
          work_schedule?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
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
      projects: {
        Row: {
          client_name: string | null
          closure_bad: string | null
          closure_good: string | null
          closure_lessons: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          cronograma: string | null
          deadline: string | null
          department: string | null
          dependencias: string | null
          diretrizes: string | null
          entregaveis: string | null
          id: string
          name: string
          notes: string | null
          objetivo: string | null
          progress: number
          project_notes: string | null
          recursos: string | null
          start_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          closure_bad?: string | null
          closure_good?: string | null
          closure_lessons?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          deadline?: string | null
          department?: string | null
          dependencias?: string | null
          diretrizes?: string | null
          entregaveis?: string | null
          id?: string
          name: string
          notes?: string | null
          objetivo?: string | null
          progress?: number
          project_notes?: string | null
          recursos?: string | null
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          closure_bad?: string | null
          closure_good?: string | null
          closure_lessons?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          cronograma?: string | null
          deadline?: string | null
          department?: string | null
          dependencias?: string | null
          diretrizes?: string | null
          entregaveis?: string | null
          id?: string
          name?: string
          notes?: string | null
          objetivo?: string | null
          progress?: number
          project_notes?: string | null
          recursos?: string | null
          start_date?: string | null
          status?: string
          type?: string
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
          created_at: string
          created_by: string | null
          department: string
          frequency: string
          id: string
          name: string
          sop_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          frequency?: string
          id?: string
          name: string
          sop_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          frequency?: string
          id?: string
          name?: string
          sop_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routines_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          created_at: string
          created_by: string | null
          custom_role_id: string | null
          decisoes: Json | null
          department: string
          id: string
          inputs: Json | null
          name: string
          notas: Json | null
          objetivo: string | null
          outputs: Json | null
          passos: Json | null
          product_name: string | null
          sop_id: string
          status: string
          updated_at: string
          utilizacao_nao_usado: Json | null
          utilizacao_usado: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          decisoes?: Json | null
          department?: string
          id?: string
          inputs?: Json | null
          name: string
          notas?: Json | null
          objetivo?: string | null
          outputs?: Json | null
          passos?: Json | null
          product_name?: string | null
          sop_id?: string
          status?: string
          updated_at?: string
          utilizacao_nao_usado?: Json | null
          utilizacao_usado?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          decisoes?: Json | null
          department?: string
          id?: string
          inputs?: Json | null
          name?: string
          notas?: Json | null
          objetivo?: string | null
          outputs?: Json | null
          passos?: Json | null
          product_name?: string | null
          sop_id?: string
          status?: string
          updated_at?: string
          utilizacao_nao_usado?: Json | null
          utilizacao_usado?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sops_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_channel_details: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          periodicity: string | null
          positioning: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          periodicity?: string | null
          positioning?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
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
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          channel?: string | null
          column_key: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Update: {
          channel?: string | null
          column_key?: string
          created_at?: string
          description?: string | null
          id?: string
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
          created_at: string
          created_by: string | null
          deadline: string | null
          department: string | null
          estimated_time: number | null
          id: string
          name: string
          notes: string | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          recurrence_end: string | null
          recurrence_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          estimated_time?: number | null
          id?: string
          name: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          estimated_time?: number | null
          id?: string
          name?: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
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
        ]
      }
      team_members: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          expected_weekly_hours: number
          full_name: string
          id: string
          identification: string | null
          member_type: string
          presentation: string | null
          profile_id: string | null
          responsibilities: string | null
          role_color: string | null
          role_title: string | null
          start_date: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          work_schedule: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          expected_weekly_hours?: number
          full_name: string
          id?: string
          identification?: string | null
          member_type?: string
          presentation?: string | null
          profile_id?: string | null
          responsibilities?: string | null
          role_color?: string | null
          role_title?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          work_schedule?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          expected_weekly_hours?: number
          full_name?: string
          id?: string
          identification?: string | null
          member_type?: string
          presentation?: string | null
          profile_id?: string | null
          responsibilities?: string | null
          role_color?: string | null
          role_title?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        ]
      }
      traffic_creatives: {
        Row: {
          created_at: string
          created_by: string | null
          formato: string | null
          headline: string | null
          id: string
          legenda: string | null
          link: string | null
          name: string
          objetivo: string | null
          oferta_goal: string | null
          start_date: string | null
          status: string
          titulo_principal: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          formato?: string | null
          headline?: string | null
          id?: string
          legenda?: string | null
          link?: string | null
          name: string
          objetivo?: string | null
          oferta_goal?: string | null
          start_date?: string | null
          status?: string
          titulo_principal?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          formato?: string | null
          headline?: string | null
          id?: string
          legenda?: string | null
          link?: string | null
          name?: string
          objetivo?: string | null
          oferta_goal?: string | null
          start_date?: string | null
          status?: string
          titulo_principal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      traffic_report_cards: {
        Row: {
          content: string | null
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      traffic_report_files: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
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
      user_views: {
        Row: {
          created_at: string
          filter_config: Json
          id: string
          label: string
          page_key: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_config?: Json
          id?: string
          label: string
          page_key: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          filter_config?: Json
          id?: string
          label?: string
          page_key?: string
          sort_order?: number
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
      meeting_status: "por_confirmar" | "marcada" | "terminada"
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
      app_role: ["owner", "admin", "member"],
      meeting_status: ["por_confirmar", "marcada", "terminada"],
    },
  },
} as const
