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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
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
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number | null
          created_at: string | null
          id: string
          referral_code: string | null
          referred_by: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          id: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number | null
          created_at?: string | null
          id?: string
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: number
          Model: string | null
          "Model Photo": string | null
          "Model Video": string | null
          photo_id: string | null
          promt: string | null
          subscription_end: string | null
          subscription_start: string
          subscription_status: string
          subscription_type: string
          type_of_answer: string | null
          user_id: number
          username: string
        }
        Insert: {
          id?: number
          Model?: string | null
          "Model Photo"?: string | null
          "Model Video"?: string | null
          photo_id?: string | null
          promt?: string | null
          subscription_end?: string | null
          subscription_start: string
          subscription_status: string
          subscription_type: string
          type_of_answer?: string | null
          user_id: number
          username: string
        }
        Update: {
          id?: number
          Model?: string | null
          "Model Photo"?: string | null
          "Model Video"?: string | null
          photo_id?: string | null
          promt?: string | null
          subscription_end?: string | null
          subscription_start?: string
          subscription_status?: string
          subscription_type?: string
          type_of_answer?: string | null
          user_id?: number
          username?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string | null
          error: Json
          id: string
          input: Json
          meta: Json
          model: string
          output: Json | null
          status: string
          task_id: string
          task_type: string
        }
        Insert: {
          created_at?: string | null
          error: Json
          id?: string
          input: Json
          meta: Json
          model: string
          output?: Json | null
          status: string
          task_id: string
          task_type: string
        }
        Update: {
          created_at?: string | null
          error?: Json
          id?: string
          input?: Json
          meta?: Json
          model?: string
          output?: Json | null
          status?: string
          task_id?: string
          task_type?: string
        }
        Relationships: []
      }
      user_captcha: {
        Row: {
          captcha: number | null
          created_at: string | null
          id: number
          status: boolean
          user_id: number
        }
        Insert: {
          captcha?: number | null
          created_at?: string | null
          id?: number
          status?: boolean
          user_id: number
        }
        Update: {
          captcha?: number | null
          created_at?: string | null
          id?: number
          status?: boolean
          user_id?: number
        }
        Relationships: []
      }
      photos: {
        Row: {
          id: string
          user_id: string
          url: string
          photo_url: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          operation_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          photo_url?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          operation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          photo_url?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          operation_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_photos: {
        Row: {
          compressed_url: string | null
          created_at: string | null
          file_name: string
          file_size: number
          height: number | null
          id: string
          is_valid: boolean | null
          mime_type: string
          original_url: string
          quality_score: number | null
          updated_at: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          compressed_url?: string | null
          created_at?: string | null
          file_name: string
          file_size: number
          height?: number | null
          id?: string
          is_valid?: boolean | null
          mime_type: string
          original_url: string
          quality_score?: number | null
          updated_at?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          compressed_url?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number
          height?: number | null
          id?: string
          is_valid?: boolean | null
          mime_type?: string
          original_url?: string
          quality_score?: number | null
          updated_at?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      generated_photos: {
        Row: {
          id: string
          user_id: string
          scraped_photo_id: string
          user_photo_id: string
          generated_urls: string[]
          status: 'pending' | 'processing' | 'completed' | 'failed'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scraped_photo_id: string
          user_photo_id: string
          generated_urls?: string[]
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scraped_photo_id?: string
          user_photo_id?: string
          generated_urls?: string[]
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_captcha: {
        Args: { p_user_id: number }
        Returns: {
          captcha_id: number
          highlighted_positions: number[]
          snake_positions: number[]
        }[]
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      solve_captcha: {
        Args: { p_captcha_id: number; p_user_id: number }
        Returns: {
          new_subscription_until: string
          user_id: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const