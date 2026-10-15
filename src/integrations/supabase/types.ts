export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      community_records: {
        Row: {
          id: string;
          user_id: string;
          department: "training" | "care";
          program_id: string;
          beneficiary_name: string;
          beneficiary_type: "individual" | "child" | "family" | "orphan";
          phone: string | null;
          guardian_name: string | null;
          address: string | null;
          service_date: string;
          status: "registered" | "in_progress" | "completed" | "cancelled";
          group_name: string | null;
          sponsor_name: string | null;
          amount: number | null;
          currency: "YER" | "SAR" | "USD" | null;
          quantity: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          department: "training" | "care";
          program_id: string;
          beneficiary_name: string;
          beneficiary_type: "individual" | "child" | "family" | "orphan";
          phone?: string | null;
          guardian_name?: string | null;
          address?: string | null;
          service_date: string;
          status?: "registered" | "in_progress" | "completed" | "cancelled";
          group_name?: string | null;
          sponsor_name?: string | null;
          amount?: number | null;
          currency?: "YER" | "SAR" | "USD" | null;
          quantity?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          department?: "training" | "care";
          program_id?: string;
          beneficiary_name?: string;
          beneficiary_type?: "individual" | "child" | "family" | "orphan";
          phone?: string | null;
          guardian_name?: string | null;
          address?: string | null;
          service_date?: string;
          status?: "registered" | "in_progress" | "completed" | "cancelled";
          group_name?: string | null;
          sponsor_name?: string | null;
          amount?: number | null;
          currency?: "YER" | "SAR" | "USD" | null;
          quantity?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_questions: {
        Row: {
          category: string;
          choices: Json;
          correct_answer: string | null;
          created_at: string;
          difficulty: string;
          id: string;
          notes: string | null;
          question: string;
          question_type: string;
          subject: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          category?: string;
          choices?: Json;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: string;
          id?: string;
          notes?: string | null;
          question?: string;
          question_type?: string;
          subject?: string;
          updated_at?: string;
          user_id: string;
          year?: string;
        };
        Update: {
          category?: string;
          choices?: Json;
          correct_answer?: string | null;
          created_at?: string;
          difficulty?: string;
          id?: string;
          notes?: string | null;
          question?: string;
          question_type?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      awards: {
        Row: {
          amount: number;
          award_kind: string;
          award_type: string;
          awarded_at: string;
          created_at: string;
          funded_by: string | null;
          id: string;
          item: string | null;
          notes: string | null;
          recipient_name: string;
          recipient_type: string;
          student_name: string | null;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          amount?: number;
          award_kind?: string;
          award_type: string;
          awarded_at?: string;
          created_at?: string;
          funded_by?: string | null;
          id?: string;
          item?: string | null;
          notes?: string | null;
          recipient_name: string;
          recipient_type: string;
          student_name?: string | null;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          amount?: number;
          award_kind?: string;
          award_type?: string;
          awarded_at?: string;
          created_at?: string;
          funded_by?: string | null;
          id?: string;
          item?: string | null;
          notes?: string | null;
          recipient_name?: string;
          recipient_type?: string;
          student_name?: string | null;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      ceremony_expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          description: string;
          funded_by: string | null;
          id: string;
          notes: string | null;
          spent_at: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          amount?: number;
          category?: string;
          created_at?: string;
          description?: string;
          funded_by?: string | null;
          id?: string;
          notes?: string | null;
          spent_at?: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          description?: string;
          funded_by?: string | null;
          id?: string;
          notes?: string | null;
          spent_at?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          cert_type: string;
          created_at: string;
          id: string;
          issued_at: string;
          notes: string | null;
          recipient_name: string;
          recipient_type: string;
          title: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          cert_type?: string;
          created_at?: string;
          id?: string;
          issued_at?: string;
          notes?: string | null;
          recipient_name: string;
          recipient_type?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          cert_type?: string;
          created_at?: string;
          id?: string;
          issued_at?: string;
          notes?: string | null;
          recipient_name?: string;
          recipient_type?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      data_access_grants: {
        Row: {
          access_level: string;
          created_at: string;
          grantee_id: string;
          id: string;
          note: string | null;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          access_level?: string;
          created_at?: string;
          grantee_id: string;
          id?: string;
          note?: string | null;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          access_level?: string;
          created_at?: string;
          grantee_id?: string;
          id?: string;
          note?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_access_grants_grantee_id_fkey";
            columns: ["grantee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "data_access_grants_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      donors: {
        Row: {
          created_at: string;
          donor_type: string;
          id: string;
          in_kind: string | null;
          name: string;
          notes: string | null;
          paid_amount: number;
          phone: string | null;
          pledged_amount: number;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          created_at?: string;
          donor_type?: string;
          id?: string;
          in_kind?: string | null;
          name: string;
          notes?: string | null;
          paid_amount?: number;
          phone?: string | null;
          pledged_amount?: number;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          created_at?: string;
          donor_type?: string;
          id?: string;
          in_kind?: string | null;
          name?: string;
          notes?: string | null;
          paid_amount?: number;
          phone?: string | null;
          pledged_amount?: number;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      hifz_history: {
        Row: {
          created_at: string;
          id: string;
          student_id: number;
          user_id: string;
          value: string;
          year_key: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          student_id: number;
          user_id: string;
          value?: string;
          year_key: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          student_id?: number;
          user_id?: string;
          value?: string;
          year_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hifz_history_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      external_competitions: {
        Row: {
          category: string;
          competition_name: string;
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          organizer: string;
          prize: string;
          rank: string;
          score: number;
          student_id: number;
          student_name: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          category: string;
          competition_name: string;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          organizer: string;
          prize?: string;
          rank?: string;
          score?: number;
          student_id: number;
          student_name: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          category?: string;
          competition_name?: string;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          organizer?: string;
          prize?: string;
          rank?: string;
          score?: number;
          student_id?: number;
          student_name?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "external_competitions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      internal_competitions: {
        Row: {
          category: string;
          competition_name: string;
          created_at: string;
          date: string;
          id: string;
          notes: string | null;
          prize: string;
          rank: string;
          score: number;
          student_id: number;
          student_name: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          category: string;
          competition_name: string;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          prize?: string;
          rank?: string;
          score?: number;
          student_id: number;
          student_name: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          category?: string;
          competition_name?: string;
          created_at?: string;
          date?: string;
          id?: string;
          notes?: string | null;
          prize?: string;
          rank?: string;
          score?: number;
          student_id?: number;
          student_name?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "internal_competitions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          created_at: string;
          file_path: string;
          file_size: number;
          file_type: string;
          id: string;
          month: number;
          title: string;
          user_id: string;
          year: string;
        };
        Insert: {
          created_at?: string;
          file_path: string;
          file_size?: number;
          file_type: string;
          id?: string;
          month: number;
          title?: string;
          user_id: string;
          year: string;
        };
        Update: {
          created_at?: string;
          file_path?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          month?: number;
          title?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      monthly_submissions: {
        Row: {
          attendance_score: number;
          behavior_score: number;
          code: string | null;
          created_at: string;
          id: string;
          memorization_from_ayah: number | null;
          memorization_from_surah: number | null;
          memorization_hifz_score: number;
          memorization_recitation_score: number;
          memorization_to_ayah: number | null;
          memorization_to_surah: number | null;
          month: number;
          notes: string | null;
          portal_id: string | null;
          reviewed_at: string | null;
          review_from_ayah: number | null;
          review_from_surah: number | null;
          review_hifz_score: number;
          review_note: string | null;
          review_recitation_score: number;
          review_to_ayah: number | null;
          review_to_surah: number | null;
          source: string;
          status: string;
          student_id: number;
          student_name: string;
          teacher_name: string | null;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          attendance_score?: number;
          behavior_score?: number;
          code?: string | null;
          created_at?: string;
          id?: string;
          memorization_from_ayah?: number | null;
          memorization_from_surah?: number | null;
          memorization_hifz_score?: number;
          memorization_recitation_score?: number;
          memorization_to_ayah?: number | null;
          memorization_to_surah?: number | null;
          month: number;
          notes?: string | null;
          portal_id?: string | null;
          reviewed_at?: string | null;
          review_from_ayah?: number | null;
          review_from_surah?: number | null;
          review_hifz_score?: number;
          review_note?: string | null;
          review_recitation_score?: number;
          review_to_ayah?: number | null;
          review_to_surah?: number | null;
          source?: string;
          status?: string;
          student_id: number;
          student_name: string;
          teacher_name?: string | null;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          attendance_score?: number;
          behavior_score?: number;
          code?: string | null;
          created_at?: string;
          id?: string;
          memorization_from_ayah?: number | null;
          memorization_from_surah?: number | null;
          memorization_hifz_score?: number;
          memorization_recitation_score?: number;
          memorization_to_ayah?: number | null;
          memorization_to_surah?: number | null;
          month?: number;
          notes?: string | null;
          portal_id?: string | null;
          reviewed_at?: string | null;
          review_from_ayah?: number | null;
          review_from_surah?: number | null;
          review_hifz_score?: number;
          review_note?: string | null;
          review_recitation_score?: number;
          review_to_ayah?: number | null;
          review_to_surah?: number | null;
          source?: string;
          status?: string;
          student_id?: number;
          student_name?: string;
          teacher_name?: string | null;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_submissions_portal_id_fkey";
            columns: ["portal_id"];
            isOneToOne: false;
            referencedRelation: "teacher_portals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monthly_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monthly_submissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_tracking: {
        Row: {
          attendance_score: number;
          behavior_score: number;
          created_at: string;
          id: string;
          memorization_from_ayah: number | null;
          memorization_from_surah: number | null;
          memorization_hifz_score: number;
          memorization_recitation_score: number;
          memorization_to_ayah: number | null;
          memorization_to_surah: number | null;
          month: number;
          review_from_ayah: number | null;
          review_from_surah: number | null;
          review_hifz_score: number;
          review_recitation_score: number;
          review_to_ayah: number | null;
          review_to_surah: number | null;
          student_id: number;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          attendance_score?: number;
          behavior_score?: number;
          created_at?: string;
          id?: string;
          memorization_from_ayah?: number | null;
          memorization_from_surah?: number | null;
          memorization_hifz_score?: number;
          memorization_recitation_score?: number;
          memorization_to_ayah?: number | null;
          memorization_to_surah?: number | null;
          month: number;
          review_from_ayah?: number | null;
          review_from_surah?: number | null;
          review_hifz_score?: number;
          review_recitation_score?: number;
          review_to_ayah?: number | null;
          review_to_surah?: number | null;
          student_id: number;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          attendance_score?: number;
          behavior_score?: number;
          created_at?: string;
          id?: string;
          memorization_from_ayah?: number | null;
          memorization_from_surah?: number | null;
          memorization_hifz_score?: number;
          memorization_recitation_score?: number;
          memorization_to_ayah?: number | null;
          memorization_to_surah?: number | null;
          month?: number;
          review_from_ayah?: number | null;
          review_from_surah?: number | null;
          review_hifz_score?: number;
          review_recitation_score?: number;
          review_to_ayah?: number | null;
          review_to_surah?: number | null;
          student_id?: number;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monthly_tracking_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          created_at: string;
          custom_fields: Json;
          first_competition_year: string | null;
          gender: string | null;
          guardian_phone: string | null;
          hijri_join_date: string | null;
          id: number;
          initial_hifz: string | null;
          name: string;
          notes: string | null;
          school_grade: string | null;
          status: string | null;
          student_phone: string | null;
          teacher: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          custom_fields?: Json;
          first_competition_year?: string | null;
          gender?: string | null;
          guardian_phone?: string | null;
          hijri_join_date?: string | null;
          id?: number;
          initial_hifz?: string | null;
          name?: string;
          notes?: string | null;
          school_grade?: string | null;
          status?: string | null;
          student_phone?: string | null;
          teacher?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          custom_fields?: Json;
          first_competition_year?: string | null;
          gender?: string | null;
          guardian_phone?: string | null;
          hijri_join_date?: string | null;
          id?: number;
          initial_hifz?: string | null;
          name?: string;
          notes?: string | null;
          school_grade?: string | null;
          status?: string | null;
          student_phone?: string | null;
          teacher?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      teacher_bonuses: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          month: number;
          teacher_name: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          month: number;
          teacher_name: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          month?: number;
          teacher_name?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      teacher_portals: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          month: number;
          teacher_name: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          month: number;
          teacher_name: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          month?: number;
          teacher_name?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_portals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teachers: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          active_year: string;
          created_at: string;
          id: string;
          student_custom_columns: Json;
          student_statuses: Json;
          table_filters: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_year?: string;
          created_at?: string;
          id?: string;
          student_custom_columns?: Json;
          student_statuses?: Json;
          table_filters?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_year?: string;
          created_at?: string;
          id?: string;
          student_custom_columns?: Json;
          student_statuses?: Json;
          table_filters?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      year_data: {
        Row: {
          annual: string;
          base_hifz: string;
          created_at: string;
          grade: string;
          id: string;
          memorization: string;
          parts: string;
          prize: string;
          rank: string;
          recitation: string;
          status_prize: string;
          student_id: number;
          teacher: string;
          total: string;
          total_hifz: string;
          updated_at: string;
          user_id: string;
          year: string;
        };
        Insert: {
          annual?: string;
          base_hifz?: string;
          created_at?: string;
          grade?: string;
          id?: string;
          memorization?: string;
          parts?: string;
          prize?: string;
          rank?: string;
          recitation?: string;
          status_prize?: string;
          student_id: number;
          teacher?: string;
          total?: string;
          total_hifz?: string;
          updated_at?: string;
          user_id: string;
          year: string;
        };
        Update: {
          annual?: string;
          base_hifz?: string;
          created_at?: string;
          grade?: string;
          id?: string;
          memorization?: string;
          parts?: string;
          prize?: string;
          rank?: string;
          recitation?: string;
          status_prize?: string;
          student_id?: number;
          teacher?: string;
          total?: string;
          total_hifz?: string;
          updated_at?: string;
          user_id?: string;
          year?: string;
        };
        Relationships: [
          {
            foreignKeyName: "year_data_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      open_teacher_portal: {
        Args: { p_code: string };
        Returns: {
          code: string;
          teacher_name: string;
          year: string;
          month: number;
          student_id: number;
          student_name: string;
          prev_memo_surah: number | null;
          prev_memo_ayah: number | null;
          prev_review_surah: number | null;
          prev_review_ayah: number | null;
          submission: {
            status: string;
            memorization_from_surah: number | null;
            memorization_from_ayah: number | null;
            memorization_to_surah: number | null;
            memorization_to_ayah: number | null;
            memorization_hifz_score: number;
            memorization_recitation_score: number;
            review_from_surah: number | null;
            review_from_ayah: number | null;
            review_to_surah: number | null;
            review_to_ayah: number | null;
            review_hifz_score: number;
            review_recitation_score: number;
            attendance_score: number;
            behavior_score: number;
            notes: string | null;
            submitted_at: string;
          } | null;
        }[];
      };
      submit_teacher_monthly: {
        Args: {
          p_code: string;
          p_student_id: number;
          p_student_name: string;
          p_year: string;
          p_month: number;
          p_memorization_from_surah?: number | null;
          p_memorization_from_ayah?: number | null;
          p_memorization_to_surah?: number | null;
          p_memorization_to_ayah?: number | null;
          p_memorization_hifz_score?: number;
          p_memorization_recitation_score?: number;
          p_review_from_surah?: number | null;
          p_review_from_ayah?: number | null;
          p_review_to_surah?: number | null;
          p_review_to_ayah?: number | null;
          p_review_hifz_score?: number;
          p_review_recitation_score?: number;
          p_attendance_score?: number;
          p_behavior_score?: number;
          p_notes?: string | null;
        };
        Returns: {
          id: string;
          user_id: string;
          portal_id: string;
          code: string;
          student_id: number;
          student_name: string;
          year: string;
          month: number;
          memorization_from_surah: number | null;
          memorization_from_ayah: number | null;
          memorization_to_surah: number | null;
          memorization_to_ayah: number | null;
          memorization_hifz_score: number;
          memorization_recitation_score: number;
          review_from_surah: number | null;
          review_from_ayah: number | null;
          review_to_surah: number | null;
          review_to_ayah: number | null;
          review_hifz_score: number;
          review_recitation_score: number;
          attendance_score: number;
          behavior_score: number;
          notes: string | null;
          status: string;
          review_note: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
