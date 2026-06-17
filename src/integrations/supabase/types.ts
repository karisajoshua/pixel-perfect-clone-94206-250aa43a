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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_communications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          client_id: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["comm_direction"]
          id: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          client_id: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["comm_direction"]
          id?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["comm_channel"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["comm_direction"]
          id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          alt_phone: string | null
          assigned_agent: string | null
          branch_id: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_name: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          kra_pin: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          notes: string | null
          occupation: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          assigned_agent?: string | null
          branch_id?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          assigned_agent?: string | null
          branch_id?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          kra_pin?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          short_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          short_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          short_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          branch_id: string | null
          client_id: string
          commission: number | null
          cover_type: string
          created_at: string
          created_by: string | null
          document_url: string | null
          end_date: string
          id: string
          insurer_id: string | null
          notes: string | null
          payment_status: string
          policy_no: string
          premium_gross: number | null
          premium_net: number | null
          previous_policy_id: string | null
          product_class: string
          start_date: string
          status: string
          sum_insured: number | null
          taxes: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          client_id: string
          commission?: number | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date: string
          id?: string
          insurer_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_no: string
          premium_gross?: number | null
          premium_net?: number | null
          previous_policy_id?: string | null
          product_class?: string
          start_date: string
          status?: string
          sum_insured?: number | null
          taxes?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          client_id?: string
          commission?: number | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string
          id?: string
          insurer_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_no?: string
          premium_gross?: number | null
          premium_net?: number | null
          previous_policy_id?: string | null
          product_class?: string
          start_date?: string
          status?: string
          sum_insured?: number | null
          taxes?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_previous_policy_id_fkey"
            columns: ["previous_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          branch_id: string | null
          client_id: string
          converted_policy_id: string | null
          cover_type: string
          created_at: string
          created_by: string | null
          id: string
          insurer_id: string | null
          line_items: Json
          notes: string | null
          premium_gross: number | null
          premium_net: number | null
          product_class: string
          quote_no: string
          status: string
          sum_insured: number | null
          updated_at: string
          valid_until: string | null
          vehicle_id: string | null
        }
        Insert: {
          branch_id?: string | null
          client_id: string
          converted_policy_id?: string | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          line_items?: Json
          notes?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          product_class?: string
          quote_no: string
          status?: string
          sum_insured?: number | null
          updated_at?: string
          valid_until?: string | null
          vehicle_id?: string | null
        }
        Update: {
          branch_id?: string | null
          client_id?: string
          converted_policy_id?: string | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          line_items?: Json
          notes?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          product_class?: string
          quote_no?: string
          status?: string
          sum_insured?: number | null
          updated_at?: string
          valid_until?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_converted_policy_id_fkey"
            columns: ["converted_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          body_type: string | null
          branch_id: string | null
          chassis_no: string | null
          client_id: string
          color: string | null
          created_at: string
          created_by: string | null
          cubic_capacity: number | null
          engine_no: string | null
          estimated_value: number | null
          fuel_type: string | null
          id: string
          inspection_due: string | null
          logbook_url: string | null
          make: string | null
          model: string | null
          notes: string | null
          registration_no: string
          seating_capacity: number | null
          updated_at: string
          usage_type: string | null
          year: number | null
        }
        Insert: {
          active?: boolean
          body_type?: string | null
          branch_id?: string | null
          chassis_no?: string | null
          client_id: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          cubic_capacity?: number | null
          engine_no?: string | null
          estimated_value?: number | null
          fuel_type?: string | null
          id?: string
          inspection_due?: string | null
          logbook_url?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          registration_no: string
          seating_capacity?: number | null
          updated_at?: string
          usage_type?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean
          body_type?: string | null
          branch_id?: string | null
          chassis_no?: string | null
          client_id?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          cubic_capacity?: number | null
          engine_no?: string | null
          estimated_value?: number | null
          fuel_type?: string | null
          id?: string
          inspection_due?: string | null
          logbook_url?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          registration_no?: string
          seating_capacity?: number | null
          updated_at?: string
          usage_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      user_branch: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent" | "viewer" | "client"
      client_type: "individual" | "corporate"
      comm_channel: "call" | "email" | "sms" | "whatsapp" | "in_person" | "note"
      comm_direction: "inbound" | "outbound"
      kyc_status: "pending" | "verified" | "rejected" | "expired"
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
      app_role: ["admin", "manager", "agent", "viewer", "client"],
      client_type: ["individual", "corporate"],
      comm_channel: ["call", "email", "sms", "whatsapp", "in_person", "note"],
      comm_direction: ["inbound", "outbound"],
      kyc_status: ["pending", "verified", "rejected", "expired"],
    },
  },
} as const
