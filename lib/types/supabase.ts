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
      certificate_reference_counters: {
        Row: {
          id: number
          next_value: number
        }
        Insert: {
          id?: number
          next_value?: number
        }
        Update: {
          id?: number
          next_value?: number
        }
        Relationships: []
      }
      certificate_references: {
        Row: {
          inter_uni_achievement_id: string | null
          inter_uni_record_id: string | null
          reference_no: string
          sport_record_id: string | null
          sports_achievement_id: string | null
        }
        Insert: {
          inter_uni_achievement_id?: string | null
          inter_uni_record_id?: string | null
          reference_no: string
          sport_record_id?: string | null
          sports_achievement_id?: string | null
        }
        Update: {
          inter_uni_achievement_id?: string | null
          inter_uni_record_id?: string | null
          reference_no?: string
          sport_record_id?: string | null
          sports_achievement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_references_inter_uni_achievement_id_fkey"
            columns: ["inter_uni_achievement_id"]
            isOneToOne: true
            referencedRelation: "inter_uni_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_references_inter_uni_record_id_fkey"
            columns: ["inter_uni_record_id"]
            isOneToOne: true
            referencedRelation: "inter_uni_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_references_sport_record_id_fkey"
            columns: ["sport_record_id"]
            isOneToOne: true
            referencedRelation: "sport_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_references_sports_achievement_id_fkey"
            columns: ["sports_achievement_id"]
            isOneToOne: true
            referencedRelation: "sports_achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      inter_uni_achievement_winners: {
        Row: {
          achievement_id: string
          id: string
          place: string | null
          student_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          place?: string | null
          student_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          place?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_uni_achievement_winners_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "inter_uni_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_uni_achievement_winners_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_uni_achievements: {
        Row: {
          achievement_type: string
          created_at: string
          id: string
          meet_year: number
          notes: string | null
          sport: string
          team_name: string | null
        }
        Insert: {
          achievement_type: string
          created_at?: string
          id?: string
          meet_year: number
          notes?: string | null
          sport: string
          team_name?: string | null
        }
        Update: {
          achievement_type?: string
          created_at?: string
          id?: string
          meet_year?: number
          notes?: string | null
          sport?: string
          team_name?: string | null
        }
        Relationships: []
      }
      inter_uni_records: {
        Row: {
          id: string
          recorded_at: string
          student_id: string
          track_id: string
          value: number
          year: number
        }
        Insert: {
          id?: string
          recorded_at?: string
          student_id: string
          track_id: string
          value: number
          year: number
        }
        Update: {
          id?: string
          recorded_at?: string
          student_id?: string
          track_id?: string
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "inter_uni_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_uni_records_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "sport_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      issued_certificates: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          image_bytes: string
          reference_no: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          image_bytes: string
          reference_no: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          image_bytes?: string
          reference_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "issued_certificates_reference_no_fkey"
            columns: ["reference_no"]
            isOneToOne: false
            referencedRelation: "certificate_references"
            referencedColumns: ["reference_no"]
          },
        ]
      }
      sport_records: {
        Row: {
          id: string
          recorded_at: string
          student_id: string
          track_id: string
          value: number
          year: number
        }
        Insert: {
          id?: string
          recorded_at?: string
          student_id: string
          track_id: string
          value: number
          year: number
        }
        Update: {
          id?: string
          recorded_at?: string
          student_id?: string
          track_id?: string
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sport_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_records_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "sport_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_tracks: {
        Row: {
          id: string
          lower_is_better: boolean
          name: string
          unit: string
        }
        Insert: {
          id?: string
          lower_is_better?: boolean
          name: string
          unit?: string
        }
        Update: {
          id?: string
          lower_is_better?: boolean
          name?: string
          unit?: string
        }
        Relationships: []
      }
      sports: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      sports_achievement_winners: {
        Row: {
          achievement_id: string
          id: string
          place: string | null
          student_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          place?: string | null
          student_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          place?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sports_achievement_winners_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "sports_achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_achievement_winners_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_achievements: {
        Row: {
          achievement_type: string
          category: string
          created_at: string
          id: string
          meet_year: number
          notes: string | null
          sport: string
          team_name: string | null
          track_id: string | null
        }
        Insert: {
          achievement_type: string
          category?: string
          created_at?: string
          id?: string
          meet_year: number
          notes?: string | null
          sport: string
          team_name?: string | null
          track_id?: string | null
        }
        Update: {
          achievement_type?: string
          category?: string
          created_at?: string
          id?: string
          meet_year?: number
          notes?: string | null
          sport?: string
          team_name?: string | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sports_achievements_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "sport_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          degree_programme: string | null
          email: string | null
          faculty: string | null
          full_name: string
          gender: string | null
          house_id: string | null
          id: string
          intake: string | null
          mobile: string | null
          nic: string | null
          serial_no: number | null
          student_id: string | null
          title: string | null
          university: string | null
        }
        Insert: {
          created_at?: string
          degree_programme?: string | null
          email?: string | null
          faculty?: string | null
          full_name: string
          gender?: string | null
          house_id?: string | null
          id?: string
          intake?: string | null
          mobile?: string | null
          nic?: string | null
          serial_no?: number | null
          student_id?: string | null
          title?: string | null
          university?: string | null
        }
        Update: {
          created_at?: string
          degree_programme?: string | null
          email?: string | null
          faculty?: string | null
          full_name?: string
          gender?: string | null
          house_id?: string | null
          id?: string
          intake?: string | null
          mobile?: string | null
          nic?: string | null
          serial_no?: number | null
          student_id?: string | null
          title?: string | null
          university?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      achievement_years: {
        Args: never
        Returns: {
          year: number
        }[]
      }
      attach_issued_certificate: {
        Args: {
          p_content_type: string
          p_file_name: string
          p_image_base64: string
          p_reference: string
        }
        Returns: string
      }
      get_issued_certificate: {
        Args: { p_id: string }
        Returns: {
          content_type: string
          file_name: string
          image_base64: string
        }[]
      }
      inter_uni_achievement_years: {
        Args: never
        Returns: {
          year: number
        }[]
      }
      remove_issued_certificate: { Args: { p_id: string }; Returns: undefined }
      rename_certificate_reference: {
        Args: { p_new: string; p_old: string }
        Returns: string
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
    Enums: {},
  },
} as const
