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
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          accident_statement: string | null
          assigned_to: string | null
          branch_id: string | null
          claim_amount: number | null
          claim_no: string
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incident_date: string | null
          incident_location: string | null
          ipen_claim_id: string | null
          notes: string | null
          policy_id: string | null
          settled_amount: number | null
          settled_date: string | null
          status: string
          tenant_id: string
          third_party_details: Json
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          accident_statement?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          claim_amount?: number | null
          claim_no: string
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date?: string | null
          incident_location?: string | null
          ipen_claim_id?: string | null
          notes?: string | null
          policy_id?: string | null
          settled_amount?: number | null
          settled_date?: string | null
          status?: string
          tenant_id: string
          third_party_details?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          accident_statement?: string | null
          assigned_to?: string | null
          branch_id?: string | null
          claim_amount?: number | null
          claim_no?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incident_date?: string | null
          incident_location?: string | null
          ipen_claim_id?: string | null
          notes?: string | null
          policy_id?: string | null
          settled_amount?: number | null
          settled_date?: string | null
          status?: string
          tenant_id?: string
          third_party_details?: Json
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_required_documents: {
        Row: {
          client_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["kyc_doc_type"]
          expires_at: string | null
          file_name: string | null
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["kyc_doc_status"]
          storage_path: string
          tenant_id: string
          updated_at: string
          vehicle_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["kyc_doc_type"]
          expires_at?: string | null
          file_name?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          storage_path: string
          tenant_id: string
          updated_at?: string
          vehicle_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["kyc_doc_type"]
          expires_at?: string | null
          file_name?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_doc_status"]
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          vehicle_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_required_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_required_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_required_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          alt_phone: string | null
          assigned_agent: string | null
          auth_user_id: string | null
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
          kra_id_type: string | null
          kra_pin: string | null
          kra_verification_status: string | null
          kra_verified_at: string | null
          kra_verified_name: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          notes: string | null
          occupation: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          alt_phone?: string | null
          assigned_agent?: string | null
          auth_user_id?: string | null
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
          kra_id_type?: string | null
          kra_pin?: string | null
          kra_verification_status?: string | null
          kra_verified_at?: string | null
          kra_verified_name?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          alt_phone?: string | null
          assigned_agent?: string | null
          auth_user_id?: string | null
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
          kra_id_type?: string | null
          kra_pin?: string | null
          kra_verification_status?: string | null
          kra_verified_at?: string | null
          kra_verified_name?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          notes?: string | null
          occupation?: string | null
          phone?: string | null
          tenant_id?: string
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
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      insurers: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
          name?: string
          notes?: string | null
          short_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          tenant_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          tenant_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          tenant_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          branch_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          invoice_no: string
          issue_date: string
          notes: string | null
          policy_id: string | null
          status: string
          subtotal: number
          tax: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          invoice_no: string
          issue_date?: string
          notes?: string | null
          policy_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          policy_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ipen_agency_credentials: {
        Row: {
          access_token: string | null
          connected_by: string | null
          created_at: string
          ipen_email: string
          last_login_at: string | null
          mfa_required: boolean
          mfa_token: string | null
          refresh_token: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          ipen_email: string
          last_login_at?: string | null
          mfa_required?: boolean
          mfa_token?: string | null
          refresh_token?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          ipen_email?: string
          last_login_at?: string | null
          mfa_required?: boolean
          mfa_token?: string | null
          refresh_token?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ipen_agency_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ipen_credentials: {
        Row: {
          access_token: string | null
          created_at: string
          ipen_email: string
          last_login_at: string | null
          mfa_required: boolean
          mfa_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          ipen_email: string
          last_login_at?: string | null
          mfa_required?: boolean
          mfa_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          ipen_email?: string
          last_login_at?: string | null
          mfa_required?: boolean
          mfa_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          client_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          kind: string
          payload: Json
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          ipen_checkout_request_id: string | null
          ipen_transaction_ref: string | null
          method: string | null
          notes: string | null
          paid_date: string
          recorded_by: string | null
          reference: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          ipen_checkout_request_id?: string | null
          ipen_transaction_ref?: string | null
          method?: string | null
          notes?: string | null
          paid_date?: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          ipen_checkout_request_id?: string | null
          ipen_transaction_ref?: string | null
          method?: string | null
          notes?: string | null
          paid_date?: string
          recorded_by?: string | null
          reference?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_notice_reads: {
        Row: {
          notice_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notice_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notice_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "platform_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_notices: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          severity: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          severity?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_notices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          balance_due: number | null
          branch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          certificate_no: string | null
          client_id: string
          commission: number | null
          cover_type: string
          created_at: string
          created_by: string | null
          document_url: string | null
          end_date: string
          id: string
          insurer_id: string | null
          ipen_policy_id: string | null
          notes: string | null
          payment_status: string
          policy_no: string
          policy_term: string | null
          premium_gross: number | null
          premium_net: number | null
          previous_policy_id: string | null
          product_class: string
          start_date: string
          status: string
          sum_insured: number | null
          taxes: number | null
          tenant_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          balance_due?: number | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          certificate_no?: string | null
          client_id: string
          commission?: number | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date: string
          id?: string
          insurer_id?: string | null
          ipen_policy_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_no: string
          policy_term?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          previous_policy_id?: string | null
          product_class?: string
          start_date: string
          status?: string
          sum_insured?: number | null
          taxes?: number | null
          tenant_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          balance_due?: number | null
          branch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          certificate_no?: string | null
          client_id?: string
          commission?: number | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          end_date?: string
          id?: string
          insurer_id?: string | null
          ipen_policy_id?: string | null
          notes?: string | null
          payment_status?: string
          policy_no?: string
          policy_term?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          previous_policy_id?: string | null
          product_class?: string
          start_date?: string
          status?: string
          sum_insured?: number | null
          taxes?: number | null
          tenant_id?: string
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
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      policy_payment_extensions: {
        Row: {
          amount_due: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          paid_at: string | null
          policy_id: string
          reason: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_due: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          paid_at?: string | null
          policy_id: string
          reason?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_due?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          paid_at?: string | null
          policy_id?: string
          reason?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_payment_extensions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          client_id: string
          converted_policy_id: string | null
          cover_type: string
          created_at: string
          created_by: string | null
          id: string
          insurer_id: string | null
          ipen_proposal_id: string | null
          ipen_quote_payload: Json | null
          line_items: Json
          notes: string | null
          parent_quote_id: string | null
          policy_term: string | null
          premium_gross: number | null
          premium_net: number | null
          product_class: string
          quote_no: string
          rejection_reason: string | null
          revision: number
          status: string
          sum_insured: number | null
          tenant_id: string
          updated_at: string
          valid_until: string | null
          vehicle_id: string | null
        }
        Insert: {
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          client_id: string
          converted_policy_id?: string | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          ipen_proposal_id?: string | null
          ipen_quote_payload?: Json | null
          line_items?: Json
          notes?: string | null
          parent_quote_id?: string | null
          policy_term?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          product_class?: string
          quote_no: string
          rejection_reason?: string | null
          revision?: number
          status?: string
          sum_insured?: number | null
          tenant_id: string
          updated_at?: string
          valid_until?: string | null
          vehicle_id?: string | null
        }
        Update: {
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          client_id?: string
          converted_policy_id?: string | null
          cover_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          insurer_id?: string | null
          ipen_proposal_id?: string | null
          ipen_quote_payload?: Json | null
          line_items?: Json
          notes?: string | null
          parent_quote_id?: string | null
          policy_term?: string | null
          premium_gross?: number | null
          premium_net?: number | null
          product_class?: string
          quote_no?: string
          rejection_reason?: string | null
          revision?: number
          status?: string
          sum_insured?: number | null
          tenant_id?: string
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
            foreignKeyName: "quotations_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      service_requests: {
        Row: {
          branch_id: string | null
          client_id: string
          created_at: string
          id: string
          policy_id: string | null
          preferred_contact: string
          reason: string | null
          request_type: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          policy_id?: string | null
          preferred_contact?: string
          reason?: string | null
          request_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          policy_id?: string | null
          preferred_contact?: string
          reason?: string | null
          request_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tenant_insurers: {
        Row: {
          created_at: string
          enabled: boolean
          insurer_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          insurer_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          insurer_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_insurers_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_insurers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_no: string | null
          bank_branch: string | null
          bank_name: string | null
          brand_accent: string | null
          brand_primary: string | null
          brand_secondary: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          doc_footer_note: string | null
          id: string
          logo_url: string | null
          mpesa_paybill: string | null
          mpesa_till: string | null
          name: string
          onboarded_at: string | null
          paybill_account: string | null
          plan: string
          signatory_name: string | null
          signatory_title: string | null
          slug: string | null
          stamp_url: string | null
          status: string
          tagline: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_no?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          brand_accent?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          doc_footer_note?: string | null
          id?: string
          logo_url?: string | null
          mpesa_paybill?: string | null
          mpesa_till?: string | null
          name: string
          onboarded_at?: string | null
          paybill_account?: string | null
          plan?: string
          signatory_name?: string | null
          signatory_title?: string | null
          slug?: string | null
          stamp_url?: string | null
          status?: string
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_no?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          brand_accent?: string | null
          brand_primary?: string | null
          brand_secondary?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          doc_footer_note?: string | null
          id?: string
          logo_url?: string | null
          mpesa_paybill?: string | null
          mpesa_till?: string | null
          name?: string
          onboarded_at?: string | null
          paybill_account?: string | null
          plan?: string
          signatory_name?: string | null
          signatory_title?: string | null
          slug?: string | null
          stamp_url?: string | null
          status?: string
          tagline?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
      user_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          last_seen_at: string
          started_at: string
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          started_at?: string
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          started_at?: string
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tour_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          last_step: number
          status: string
          tour_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          last_step?: number
          status?: string
          tour_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          last_step?: number
          status?: string
          tour_id?: string
          updated_at?: string
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
          next_inspection_date: string | null
          notes: string | null
          registration_no: string
          seating_capacity: number | null
          tenant_id: string
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
          next_inspection_date?: string | null
          notes?: string | null
          registration_no: string
          seating_capacity?: number | null
          tenant_id: string
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
          next_inspection_date?: string | null
          notes?: string | null
          registration_no?: string
          seating_capacity?: number | null
          tenant_id?: string
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
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_client_id: { Args: never; Returns: string }
      current_client_tenant_id: { Args: never; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id?: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      user_branch: { Args: { _user_id: string }; Returns: string }
      verify_invoice: {
        Args: { _id: string }
        Returns: {
          agency_name: string
          amount_paid: number
          client_name: string
          due_date: string
          invoice_no: string
          issue_date: string
          status: string
          total: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "agent"
        | "viewer"
        | "client"
        | "super_admin"
      client_type: "individual" | "corporate"
      comm_channel: "call" | "email" | "sms" | "whatsapp" | "in_person" | "note"
      comm_direction: "inbound" | "outbound"
      kyc_doc_status: "pending" | "verified" | "rejected"
      kyc_doc_type:
        | "id_front"
        | "id_back"
        | "kra_pin"
        | "proof_of_address"
        | "passport_photo"
        | "cert_incorporation"
        | "cr12"
        | "director_id"
        | "log_book"
        | "importation_doc"
        | "search_doc"
      kyc_status: "pending" | "in_review" | "verified" | "rejected" | "expired"
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
      app_role: [
        "admin",
        "manager",
        "agent",
        "viewer",
        "client",
        "super_admin",
      ],
      client_type: ["individual", "corporate"],
      comm_channel: ["call", "email", "sms", "whatsapp", "in_person", "note"],
      comm_direction: ["inbound", "outbound"],
      kyc_doc_status: ["pending", "verified", "rejected"],
      kyc_doc_type: [
        "id_front",
        "id_back",
        "kra_pin",
        "proof_of_address",
        "passport_photo",
        "cert_incorporation",
        "cr12",
        "director_id",
        "log_book",
        "importation_doc",
        "search_doc",
      ],
      kyc_status: ["pending", "in_review", "verified", "rejected", "expired"],
    },
  },
} as const
