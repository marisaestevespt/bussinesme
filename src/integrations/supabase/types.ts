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
      business_settings: {
        Row: {
          about_text: string | null
          background_color: string
          business_name: string
          created_at: string
          font_body: string
          font_display: string
          id: string
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
          background_color?: string
          business_name: string
          created_at?: string
          font_body?: string
          font_display?: string
          id?: string
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
          background_color?: string
          business_name?: string
          created_at?: string
          font_body?: string
          font_display?: string
          id?: string
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
      internal_documents: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          title?: string
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
          id: string
          name: string
          notes: string | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          id?: string
          name: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          id?: string
          name?: string
          notes?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
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
