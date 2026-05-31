export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      houses: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          name: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      sport_records: {
        Row: {
          id: string;
          recorded_at: string;
          student_id: string;
          track_id: string;
          value: number;
          year: number;
        };
        Insert: {
          id?: string;
          recorded_at?: string;
          student_id: string;
          track_id: string;
          value: number;
          year: number;
        };
        Update: {
          id?: string;
          recorded_at?: string;
          student_id?: string;
          track_id?: string;
          value?: number;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sport_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sport_records_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "sport_tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      sport_tracks: {
        Row: {
          id: string;
          lower_is_better: boolean;
          name: string;
          unit: string;
        };
        Insert: {
          id?: string;
          lower_is_better?: boolean;
          name: string;
          unit?: string;
        };
        Update: {
          id?: string;
          lower_is_better?: boolean;
          name?: string;
          unit?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          created_at: string;
          full_name: string;
          house_id: string;
          id: string;
          student_id: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          house_id: string;
          id?: string;
          student_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          house_id?: string;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_house_id_fkey";
            columns: ["house_id"];
            isOneToOne: false;
            referencedRelation: "houses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
