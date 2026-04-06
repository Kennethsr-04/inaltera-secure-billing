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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nif: string
          nombre: string
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nif: string
          nombre: string
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nif?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conexiones_bd: {
        Row: {
          activa: boolean
          created_at: string
          host: string
          id: string
          nombre: string
          nombre_bd: string
          password_bd: string | null
          puerto: string
          tipo_bd: string
          ultima_sincronizacion: string | null
          updated_at: string
          user_id: string
          usuario_bd: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          host: string
          id?: string
          nombre?: string
          nombre_bd: string
          password_bd?: string | null
          puerto?: string
          tipo_bd?: string
          ultima_sincronizacion?: string | null
          updated_at?: string
          user_id: string
          usuario_bd: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          host?: string
          id?: string
          nombre?: string
          nombre_bd?: string
          password_bd?: string | null
          puerto?: string
          tipo_bd?: string
          ultima_sincronizacion?: string | null
          updated_at?: string
          user_id?: string
          usuario_bd?: string
        }
        Relationships: []
      }
      empresa_perfil: {
        Row: {
          ciudad: string | null
          codigo_postal: string | null
          created_at: string
          direccion: string | null
          id: string
          nif: string
          provincia: string | null
          razon_social: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nif?: string
          provincia?: string | null
          razon_social?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nif?: string
          provincia?: string | null
          razon_social?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      factura_estados_log: {
        Row: {
          created_at: string
          estado_anterior: string
          estado_nuevo: string
          factura_id: string
          id: string
          nota: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estado_anterior: string
          estado_nuevo: string
          factura_id: string
          id?: string
          nota?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          estado_anterior?: string
          estado_nuevo?: string
          factura_id?: string
          id?: string
          nota?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factura_estados_log_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["id"]
          },
        ]
      }
      facturas: {
        Row: {
          base_imponible: number
          cliente_direccion: string | null
          cliente_nif: string
          cliente_nombre: string
          created_at: string
          estado: string
          huella_hash: string | null
          id: string
          lineas: Json
          numero_factura: string
          observaciones: string | null
          origen: string
          pdf_path: string | null
          qr_url: string | null
          regimen_iva: string
          tipo: string
          total: number
          total_irpf: number
          total_iva: number
          total_recargo: number
          user_id: string
          verifactu_url: string | null
        }
        Insert: {
          base_imponible?: number
          cliente_direccion?: string | null
          cliente_nif: string
          cliente_nombre: string
          created_at?: string
          estado?: string
          huella_hash?: string | null
          id?: string
          lineas?: Json
          numero_factura: string
          observaciones?: string | null
          origen?: string
          pdf_path?: string | null
          qr_url?: string | null
          regimen_iva?: string
          tipo?: string
          total?: number
          total_irpf?: number
          total_iva?: number
          total_recargo?: number
          user_id: string
          verifactu_url?: string | null
        }
        Update: {
          base_imponible?: number
          cliente_direccion?: string | null
          cliente_nif?: string
          cliente_nombre?: string
          created_at?: string
          estado?: string
          huella_hash?: string | null
          id?: string
          lineas?: Json
          numero_factura?: string
          observaciones?: string | null
          origen?: string
          pdf_path?: string | null
          qr_url?: string | null
          regimen_iva?: string
          tipo?: string
          total?: number
          total_irpf?: number
          total_iva?: number
          total_recargo?: number
          user_id?: string
          verifactu_url?: string | null
        }
        Relationships: []
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
