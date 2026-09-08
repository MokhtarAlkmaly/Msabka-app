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
      awards: {
        Row: {
          amount: number
          award_kind: string
          award_type: string
          awarded_at: string
          created_at: string
          funded_by: string | null
          id: string
          item: string | null
          notes: string | null
          recipient_name: string
          recipient_type: string
          student_name: string | null
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          amount?: number
          award_kind?: string
          award_type: string
          awarded_at?: string
          created_at?: string
          funded_by?: string | null
          id?: string
          item?: string | null
          notes?: string | null
          recipient_name: string
          recipient_type: string
          student_name?: string | null
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          amount?: number
          award_kind?: string
          award_type?: string
          awarded_at?: string
          created_at?: string
          funded_by?: string | null
          id?: string
          item?: string | null
          notes?: string | null
          recipient_name?: string
          recipient_type?: string
          student_name?: string | null
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      ceremony_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          funded_by: string | null
          id: string
          notes: string | null
          spent_at: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          funded_by?: string | null
          id?: string
          notes?: string | null
          spent_at?: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          funded_by?: string | null
          id?: string
          notes?: string | null
          spent_at?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          cert_type: string
          created_at: string
          id: string
          issued_at: string
          notes: string | null
          recipient_name: string
          recipient_type: string
          title: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          cert_type?: string
          created_at?: string
          id?: string
          issued_at?: string
          notes?: string | null
          recipient_name: string
          recipient_type?: string
          title?: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          cert_type?: string
          created_at?: string
          id?: string
          issued_at?: string
          notes?: string | null
          recipient_name?: string
          recipient_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      donors: {
        Row: {
          created_at: string
          donor_type: string
          id: string
          in_kind: string | null
          name: string
          notes: string | null
          paid_amount: number
          phone: string | null
          pledged_amount: number
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          created_at?: string
          donor_type?: string
          id?: string
          in_kind?: string | null
          name: string
          notes?: string | null
          paid_amount?: number
          phone?: string | null
          pledged_amount?: number
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          created_at?: string
          donor_type?: string
          id?: string
          in_kind?: string | null
          name?: string
          notes?: string | null
          paid_amount?: number
          phone?: string | null
          pledged_amount?: number
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      hifz_history: {
        Row: {
          created_at: string
          id: string
          student_id: number
          user_id: string
          value: string
          year_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: number
          user_id: string
          value?: string
          year_key: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: number
          user_id?: string
          value?: string
          year_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "hifz_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          month: number
          title: string
          user_id: string
          year: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number
          file_type: string
          id?: string
          month: number
          title?: string
          user_id: string
          year: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          month?: number
          title?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string
          id: number
          name: string
          teacher: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string
          teacher?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          teacher?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_bonuses: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          teacher_name: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month: number
          teacher_name: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          teacher_name?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_year: string
          created_at: string
          id: string
          table_filters: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_year?: string
          created_at?: string
          id?: string
          table_filters?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_year?: string
          created_at?: string
          id?: string
          table_filters?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      year_data: {
        Row: {
          annual: string
          base_hifz: string
          created_at: string
          grade: string
          id: string
          memorization: string
          parts: string
          prize: string
          rank: string
          recitation: string
          status_prize: string
          student_id: number
          teacher: string
          total: string
          total_hifz: string
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          annual?: string
          base_hifz?: string
          created_at?: string
          grade?: string
          id?: string
          memorization?: string
          parts?: string
          prize?: string
          rank?: string
          recitation?: string
          status_prize?: string
          student_id: number
          teacher?: string
          total?: string
          total_hifz?: string
          updated_at?: string
          user_id: string
          year: string
        }
        Update: {
          annual?: string
          base_hifz?: string
          created_at?: string
          grade?: string
          id?: string
          memorization?: string
          parts?: string
          prize?: string
          rank?: string
          recitation?: string
          status_prize?: string
          student_id?: number
          teacher?: string
          total?: string
          total_hifz?: string
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "year_data_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
