export type Role = "admin" | "colaboradora";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          nombre: string;
          role: Role;
          activo: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          nombre: string;
          role?: Role;
          activo?: boolean;
          deleted_at?: string | null;
        };
        Update: {
          email?: string;
          nombre?: string;
          role?: Role;
          activo?: boolean;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          nombre: string;
          nit: string | null;
          tarifa_mensual: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          nit?: string | null;
          tarifa_mensual?: number;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          nit?: string | null;
          tarifa_mensual?: number;
          activo?: boolean;
        };
        Relationships: [];
      };
      processes: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          activo?: boolean;
        };
        Update: {
          client_id?: string;
          nombre?: string;
          activo?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "processes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      client_assignments: {
        Row: {
          id: string;
          client_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          process_id: string;
          start_time: string;
          end_time: string | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          process_id: string;
          start_time?: string;
          end_time?: string | null;
        };
        Update: {
          end_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "time_entries_process_id_fkey";
            columns: ["process_id"];
            isOneToOne: false;
            referencedRelation: "processes";
            referencedColumns: ["id"];
          }
        ];
      };
      app_settings: {
        Row: {
          id: true;
          costo_hora_promedio: number;
          updated_at: string;
        };
        Insert: {
          id?: true;
          costo_hora_promedio?: number;
        };
        Update: {
          costo_hora_promedio?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      start_timer: {
        Args: { p_client_id: string; p_process_id: string };
        Returns: Database["public"]["Tables"]["time_entries"]["Row"];
      };
      stop_timer: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["time_entries"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ProcessRow = Database["public"]["Tables"]["processes"]["Row"];
export type ClientAssignmentRow =
  Database["public"]["Tables"]["client_assignments"]["Row"];
export type TimeEntryRow = Database["public"]["Tables"]["time_entries"]["Row"];
export type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
