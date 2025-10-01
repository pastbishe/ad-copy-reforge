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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      "2050457793_36610cd3-fce0-48fb-a6b2-4dc37c397275": {
        Row: {
          task_id: string
          user_id: number
        }
        Insert: {
          task_id: string
          user_id: number
        }
        Update: {
          task_id?: string
          user_id?: number
        }
        Relationships: []
      }
      "2050457793_38a42a04-f2ff-4a10-a55f-70cee52ebac6": {
        Row: {
          task_id: string
          user_id: number
        }
        Insert: {
          task_id: string
          user_id: number
        }
        Update: {
          task_id?: string
          user_id?: number
        }
        Relationships: []
      }
      "2050457793_7918854c-8471-4da9-9a01-6bfa9b0cfd64": {
        Row: {
          task_id: string
          user_id: number
        }
        Insert: {
          task_id: string
          user_id: number
        }
        Update: {
          task_id?: string
          user_id?: number
        }
        Relationships: []
      }
      "2050457793_947b7be0-7833-4f57-ad62-24c5aec7090d": {
        Row: {
          task_id: string
          user_id: number
        }
        Insert: {
          task_id: string
          user_id: number
        }
        Update: {
          task_id?: string
          user_id?: number
        }
        Relationships: []
      }
      admin_action_logs: {
        Row: {
          action: string
          admin_user_id: string
          admin_username: string
          created_at: string
          details: Json | null
          id: string
          status: string
          target_user_id: string | null
          target_username: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          admin_username: string
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          target_user_id?: string | null
          target_username?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          admin_username?: string
          created_at?: string
          details?: Json | null
          id?: string
          status?: string
          target_user_id?: string | null
          target_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_action_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_action_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          password_hash: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          password_hash: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_memory: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      captchas: {
        Row: {
          captcha: number
          id: number
          status: string
          user_id: number
        }
        Insert: {
          captcha: number
          id?: never
          status: string
          user_id: number
        }
        Update: {
          captcha?: number
          id?: never
          status?: string
          user_id?: number
        }
        Relationships: []
      }
      cron_jobs: {
        Row: {
          cron_id: string
          id: number
          is_recurring: boolean
          run_time: string
        }
        Insert: {
          cron_id: string
          id?: number
          is_recurring?: boolean
          run_time: string
        }
        Update: {
          cron_id?: string
          id?: number
          is_recurring?: boolean
          run_time?: string
        }
        Relationships: []
      }
      main_memory: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: number
          message_id: number
          user_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          message_id: number
          user_id: number
        }
        Update: {
          created_at?: string
          id?: number
          message_id?: number
          user_id?: number
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_web_memory: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      prai_errors: {
        Row: {
          created_at: string
          description: string | null
          error_level: string | null
          id: number
          last_node: string | null
          status: string | null
          url: string | null
          workflow_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          error_level?: string | null
          id?: number
          last_node?: string | null
          status?: string | null
          url?: string | null
          workflow_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          error_level?: string | null
          id?: number
          last_node?: string | null
          status?: string | null
          url?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      prompts: {
        Row: {
          id: number
          prompt1: string | null
          prompt10: string | null
          prompt2: string | null
          prompt3: string | null
          prompt4: string | null
          prompt5: string | null
          prompt6: string | null
          prompt7: string | null
          prompt8: string | null
          prompt9: string | null
          user_id: number
        }
        Insert: {
          id?: number
          prompt1?: string | null
          prompt10?: string | null
          prompt2?: string | null
          prompt3?: string | null
          prompt4?: string | null
          prompt5?: string | null
          prompt6?: string | null
          prompt7?: string | null
          prompt8?: string | null
          prompt9?: string | null
          user_id: number
        }
        Update: {
          id?: number
          prompt1?: string | null
          prompt10?: string | null
          prompt2?: string | null
          prompt3?: string | null
          prompt4?: string | null
          prompt5?: string | null
          prompt6?: string | null
          prompt7?: string | null
          prompt8?: string | null
          prompt9?: string | null
          user_id?: number
        }
        Relationships: []
      }
      reservations: {
        Row: {
          city: string
          created_at: string | null
          id: number
          order_number: number
          party_size: number | null
          reserver_name: string | null
          restaurant_address: string | null
          restaurant_name: string | null
          restaurant_phone: string | null
          restaurant_photo_url: string | null
          status: string
          telegram_user_id: number
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: number
          order_number: number
          party_size?: number | null
          reserver_name?: string | null
          restaurant_address?: string | null
          restaurant_name?: string | null
          restaurant_phone?: string | null
          restaurant_photo_url?: string | null
          status: string
          telegram_user_id: number
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: number
          order_number?: number
          party_size?: number | null
          reserver_name?: string | null
          restaurant_address?: string | null
          restaurant_name?: string | null
          restaurant_phone?: string | null
          restaurant_photo_url?: string | null
          status?: string
          telegram_user_id?: number
        }
        Relationships: []
      }
      restaurant_bookings: {
        Row: {
          booking_name: string
          city: string | null
          id: string
          order_number: string | null
          party_size: number
          restaurant_name: string
          restaurant_phone: string
          status: string | null
        }
        Insert: {
          booking_name: string
          city?: string | null
          id?: string
          order_number?: string | null
          party_size: number
          restaurant_name: string
          restaurant_phone: string
          status?: string | null
        }
        Update: {
          booking_name?: string
          city?: string | null
          id?: string
          order_number?: string | null
          party_size?: number
          restaurant_name?: string
          restaurant_phone?: string
          status?: string | null
        }
        Relationships: []
      }
      rpk_users: {
        Row: {
          ai_model: string | null
          gender: string | null
          language: string | null
          name: string | null
          points: number
          registration_date: string
          subscription_expiration_date: string
          subscription_status: string
          subscription_type: string
          user_id: number
        }
        Insert: {
          ai_model?: string | null
          gender?: string | null
          language?: string | null
          name?: string | null
          points: number
          registration_date: string
          subscription_expiration_date: string
          subscription_status: string
          subscription_type: string
          user_id: number
        }
        Update: {
          ai_model?: string | null
          gender?: string | null
          language?: string | null
          name?: string | null
          points?: number
          registration_date?: string
          subscription_expiration_date?: string
          subscription_status?: string
          subscription_type?: string
          user_id?: number
        }
        Relationships: []
      }
      scheduled_broadcasts: {
        Row: {
          attached_image: Json | null
          audience: string
          created_at: string
          error_message: string | null
          id: string
          inline_buttons: Json | null
          message: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
          webhook_url: string
        }
        Insert: {
          attached_image?: Json | null
          audience: string
          created_at?: string
          error_message?: string | null
          id?: string
          inline_buttons?: Json | null
          message: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
          webhook_url: string
        }
        Update: {
          attached_image?: Json | null
          audience?: string
          created_at?: string
          error_message?: string | null
          id?: string
          inline_buttons?: Json | null
          message?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
          webhook_url?: string
        }
        Relationships: []
      }
      subscriptions_test: {
        Row: {
          captcha: string | null
          end_date: string | null
          id: number
          start_date: string
          status: string
          subscription_type: string
          user_id: number
        }
        Insert: {
          captcha?: string | null
          end_date?: string | null
          id?: number
          start_date: string
          status: string
          subscription_type: string
          user_id: number
        }
        Update: {
          captcha?: string | null
          end_date?: string | null
          id?: number
          start_date?: string
          status?: string
          subscription_type?: string
          user_id?: number
        }
        Relationships: []
      }
      table_2050457793: {
        Row: {
          date: string | null
          items: string | null
          merchant: string | null
          total: number | null
        }
        Insert: {
          date?: string | null
          items?: string | null
          merchant?: string | null
          total?: number | null
        }
        Update: {
          date?: string | null
          items?: string | null
          merchant?: string | null
          total?: number | null
        }
        Relationships: []
      }
      tryon_requests: {
        Row: {
          created_at: string
          garment_image: string
          id: number
          model_image: string
          user_id: number
        }
        Insert: {
          created_at?: string
          garment_image?: string
          id?: number
          model_image?: string
          user_id: number
        }
        Update: {
          created_at?: string
          garment_image?: string
          id?: number
          model_image?: string
          user_id?: number
        }
        Relationships: []
      }
      user_issues: {
        Row: {
          created_at: string
          id: number
          problem: string
          reply: string | null
          status: string | null
          user_id: number
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          problem: string
          reply?: string | null
          status?: string | null
          user_id: number
          user_name: string
        }
        Update: {
          created_at?: string
          id?: number
          problem?: string
          reply?: string | null
          status?: string | null
          user_id?: number
          user_name?: string
        }
        Relationships: []
      }
      user_languages: {
        Row: {
          id: number
          language: string
          user_id: number
        }
        Insert: {
          id?: number
          language: string
          user_id: number
        }
        Update: {
          id?: number
          language?: string
          user_id?: number
        }
        Relationships: []
      }
      user_model: {
        Row: {
          file_id: string | null
          id: number
          model: string | null
          negative: string | null
          prompt: string | null
          size: string | null
          style: string | null
          type: string | null
          user_id: number
        }
        Insert: {
          file_id?: string | null
          id?: number
          model?: string | null
          negative?: string | null
          prompt?: string | null
          size?: string | null
          style?: string | null
          type?: string | null
          user_id: number
        }
        Update: {
          file_id?: string | null
          id?: number
          model?: string | null
          negative?: string | null
          prompt?: string | null
          size?: string | null
          style?: string | null
          type?: string | null
          user_id?: number
        }
        Relationships: []
      }
      user_orders_tasks: {
        Row: {
          id: number
          order_number: string
          task_id: string
          user_id: number
        }
        Insert: {
          id?: number
          order_number: string
          task_id: string
          user_id: number
        }
        Update: {
          id?: number
          order_number?: string
          task_id?: string
          user_id?: number
        }
        Relationships: []
      }
      user_problems: {
        Row: {
          id: number
          problem: string
          user_id: number
        }
        Insert: {
          id?: number
          problem: string
          user_id: number
        }
        Update: {
          id?: number
          problem?: string
          user_id?: number
        }
        Relationships: []
      }
      user_urls: {
        Row: {
          id: number
          url1: string | null
          url10: string | null
          url2: string | null
          url3: string | null
          url4: string | null
          url5: string | null
          url6: string | null
          url7: string | null
          url8: string | null
          url9: string | null
          user_id: number
        }
        Insert: {
          id?: number
          url1?: string | null
          url10?: string | null
          url2?: string | null
          url3?: string | null
          url4?: string | null
          url5?: string | null
          url6?: string | null
          url7?: string | null
          url8?: string | null
          url9?: string | null
          user_id: number
        }
        Update: {
          id?: number
          url1?: string | null
          url10?: string | null
          url2?: string | null
          url3?: string | null
          url4?: string | null
          url5?: string | null
          url6?: string | null
          url7?: string | null
          url8?: string | null
          url9?: string | null
          user_id?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          id: number
          sheet_id: string
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          sheet_id: string
          telegram_chat_id: number
        }
        Update: {
          created_at?: string
          id?: number
          sheet_id?: string
          telegram_chat_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_admin_user: {
        Args: {
          input_password: string
          input_role: Database["public"]["Enums"]["admin_role"]
          input_username: string
        }
        Returns: string
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_admin_user_id: string
          p_admin_username: string
          p_details?: Json
          p_status?: string
          p_target_user_id?: string
          p_target_username?: string
        }
        Returns: string
      }
      reset_admin_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: boolean
      }
      toggle_admin_user_status: {
        Args: { new_status: boolean; target_user_id: string }
        Returns: boolean
      }
      update_admin_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["admin_role"]
          target_user_id: string
        }
        Returns: boolean
      }
      verify_admin_login: {
        Args: { input_password: string; input_username: string }
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          username: string
        }[]
      }
    }
    Enums: {
      admin_role: "helper" | "admin" | "founder"
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
      admin_role: ["helper", "admin", "founder"],
    },
  },
} as const
