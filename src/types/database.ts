export type Role = "admin" | "colaboradora";
export type ActivityTipo = "recurrente" | "eventual";
export type EstadoAprobacion = "aprobada" | "pendiente" | "rechazada";
export type TimeEntryEstado =
  | "activo"
  | "finalizado"
  | "cerrado_automaticamente"
  | "ajustado_manualmente";
export type CorrectionEstado = "pendiente" | "aprobada" | "rechazada";

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
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          nit?: string | null;
          activo?: boolean;
        };
        Update: {
          nombre?: string;
          nit?: string | null;
          activo?: boolean;
        };
        Relationships: [];
      };
      client_rates: {
        Row: {
          client_id: string;
          tarifa_mensual: number | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          tarifa_mensual?: number | null;
        };
        Update: {
          tarifa_mensual?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_rates_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      user_salaries: {
        Row: {
          user_id: string;
          salario_mensual: number | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          salario_mensual?: number | null;
        };
        Update: {
          salario_mensual?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_salaries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      activities: {
        Row: {
          id: string;
          client_id: string;
          nombre: string;
          activo: boolean;
          tipo: ActivityTipo;
          mes_aplicable: string | null;
          estado_aprobacion: EstadoAprobacion;
          sugerida_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          nombre: string;
          activo?: boolean;
          tipo?: ActivityTipo;
          mes_aplicable?: string | null;
          estado_aprobacion?: EstadoAprobacion;
          sugerida_por?: string | null;
        };
        Update: {
          client_id?: string;
          nombre?: string;
          activo?: boolean;
          tipo?: ActivityTipo;
          mes_aplicable?: string | null;
          estado_aprobacion?: EstadoAprobacion;
        };
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey";
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
          activity_id: string;
          start_time: string;
          end_time: string | null;
          duration_seconds: number | null;
          estado: TimeEntryEstado;
          nota_ajuste: string | null;
          sincronizado_offline: boolean;
          tiene_conflicto: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          activity_id: string;
          start_time?: string;
          end_time?: string | null;
          estado?: TimeEntryEstado;
          nota_ajuste?: string | null;
          sincronizado_offline?: boolean;
        };
        Update: {
          end_time?: string | null;
          estado?: TimeEntryEstado;
          nota_ajuste?: string | null;
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
            foreignKeyName: "time_entries_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          }
        ];
      };
      activity_corrections: {
        Row: {
          id: string;
          time_entry_id: string;
          user_id: string;
          motivo: string;
          nueva_hora_fin_sugerida: string;
          estado: CorrectionEstado;
          revisado_por: string | null;
          nota_revision: string | null;
          fecha_revision: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          time_entry_id: string;
          user_id: string;
          motivo: string;
          nueva_hora_fin_sugerida: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "activity_corrections_time_entry_id_fkey";
            columns: ["time_entry_id"];
            isOneToOne: false;
            referencedRelation: "time_entries";
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
      start_activity: {
        Args: { p_client_id: string; p_activity_id: string };
        Returns: {
          entry: Database["public"]["Tables"]["time_entries"]["Row"];
          auto_stopped: {
            activity_nombre: string;
            client_nombre: string;
            duration_seconds: number;
          } | null;
        };
      };
      stop_activity: {
        Args: { p_nota_ajuste?: string | null };
        Returns: Database["public"]["Tables"]["time_entries"]["Row"];
      };
      resolve_stale_timer: {
        Args: {
          p_choice: "seguido" | "ajustado";
          p_actual_end_time?: string | null;
          p_nota_ajuste?: string | null;
        };
        Returns: Database["public"]["Tables"]["time_entries"]["Row"];
      };
      approve_correction: {
        Args: { p_correction_id: string };
        Returns: Database["public"]["Tables"]["time_entries"]["Row"];
      };
      reject_correction: {
        Args: { p_correction_id: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["activity_corrections"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientRateRow = Database["public"]["Tables"]["client_rates"]["Row"];
export type UserSalaryRow = Database["public"]["Tables"]["user_salaries"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type ClientAssignmentRow =
  Database["public"]["Tables"]["client_assignments"]["Row"];
export type TimeEntryRow = Database["public"]["Tables"]["time_entries"]["Row"];
export type ActivityCorrectionRow =
  Database["public"]["Tables"]["activity_corrections"]["Row"];
export type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
