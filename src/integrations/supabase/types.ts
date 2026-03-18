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
          secondary_color?: string
          text_color?: string
          updated_at?: string
          welcome_text?: string | null
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
          created_at: string
          created_by: string | null
          end_date: string | null
          event_type_id: string | null
          id: string
          notes: string | null
          product_name: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type_id?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type_id?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
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
          project_name?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          transcript_url?: string | null
          updated_at?: string
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
