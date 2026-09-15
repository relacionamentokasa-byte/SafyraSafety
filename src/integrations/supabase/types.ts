export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      access_audit_log: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          id: string;
          performed_by: string | null;
          target_user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      client_contacts: {
        Row: {
          client_id: string;
          created_at: string | null;
          email: string | null;
          id: string;
          is_main: boolean | null;
          name: string;
          notes: string | null;
          phone: string | null;
          role: string | null;
          updated_at: string | null;
          whatsapp: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          is_main?: boolean | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          is_main?: boolean | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      client_transfer_history: {
        Row: {
          client_id: string;
          created_at: string | null;
          id: string;
          new_representative_id: string | null;
          previous_representative_id: string | null;
          reason: string | null;
          transferred_by: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string | null;
          id?: string;
          new_representative_id?: string | null;
          previous_representative_id?: string | null;
          reason?: string | null;
          transferred_by?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string | null;
          id?: string;
          new_representative_id?: string | null;
          previous_representative_id?: string | null;
          reason?: string | null;
          transferred_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_transfer_history_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_transfer_history_new_representative_id_fkey";
            columns: ["new_representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_transfer_history_previous_representative_id_fkey";
            columns: ["previous_representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          address_complement: string | null;
          address_number: string | null;
          city: string | null;
          client_type: string | null;
          cnpj: string | null;
          contact_name: string | null;
          contact_role: string | null;
          created_at: string | null;
          created_by: string | null;
          email: string | null;
          id: string;
          last_order_at: string | null;
          latitude: number | null;
          legal_name: string | null;
          longitude: number | null;
          name: string;
          neighborhood: string | null;
          notes: string | null;
          phone: string | null;
          price_table_id: string | null;
          purchase_potential: string | null;
          region_id: string | null;
          representative_id: string | null;
          segment: string | null;
          state: string | null;
          state_registration: string | null;
          status: string;
          trade_name: string | null;
          updated_at: string | null;
          updated_by: string | null;
          whatsapp: string | null;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          city?: string | null;
          client_type?: string | null;
          cnpj?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          last_order_at?: string | null;
          latitude?: number | null;
          legal_name?: string | null;
          longitude?: number | null;
          name: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          price_table_id?: string | null;
          purchase_potential?: string | null;
          region_id?: string | null;
          representative_id?: string | null;
          segment?: string | null;
          state?: string | null;
          state_registration?: string | null;
          status?: string;
          trade_name?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          city?: string | null;
          client_type?: string | null;
          cnpj?: string | null;
          contact_name?: string | null;
          contact_role?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          last_order_at?: string | null;
          latitude?: number | null;
          legal_name?: string | null;
          longitude?: number | null;
          name?: string;
          neighborhood?: string | null;
          notes?: string | null;
          phone?: string | null;
          price_table_id?: string | null;
          purchase_potential?: string | null;
          region_id?: string | null;
          representative_id?: string | null;
          segment?: string | null;
          state?: string | null;
          state_registration?: string | null;
          status?: string;
          trade_name?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clients_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      commercial_materials: {
        Row: {
          category: Database["public"]["Enums"]["material_category"];
          cover_image_url: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          file_size: number | null;
          file_type: string | null;
          file_url: string;
          id: string;
          name: string;
          observations: string | null;
          product_category_id: string | null;
          product_id: string | null;
          share_count: number | null;
          status: Database["public"]["Enums"]["material_status"];
          updated_at: string | null;
          updated_by: string | null;
          usage_count: number | null;
        };
        Insert: {
          category: Database["public"]["Enums"]["material_category"];
          cover_image_url?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          file_url: string;
          id?: string;
          name: string;
          observations?: string | null;
          product_category_id?: string | null;
          product_id?: string | null;
          share_count?: number | null;
          status?: Database["public"]["Enums"]["material_status"];
          updated_at?: string | null;
          updated_by?: string | null;
          usage_count?: number | null;
        };
        Update: {
          category?: Database["public"]["Enums"]["material_category"];
          cover_image_url?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          file_size?: number | null;
          file_type?: string | null;
          file_url?: string;
          id?: string;
          name?: string;
          observations?: string | null;
          product_category_id?: string | null;
          product_id?: string | null;
          share_count?: number | null;
          status?: Database["public"]["Enums"]["material_status"];
          updated_at?: string | null;
          updated_by?: string | null;
          usage_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_materials_product_category_id_fkey";
            columns: ["product_category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_materials_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_logs: {
        Row: {
          action: string;
          commission_id: string | null;
          created_at: string | null;
          details: Json | null;
          id: string;
          performed_by: string | null;
        };
        Insert: {
          action: string;
          commission_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
        };
        Update: {
          action?: string;
          commission_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          performed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commission_logs_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_rules: {
        Row: {
          category_id: string | null;
          commission_rate: number;
          created_at: string | null;
          created_by: string | null;
          id: string;
          manufacturer_id: string | null;
          name: string;
          observations: string | null;
          product_id: string | null;
          representative_id: string | null;
          status: string;
          updated_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          category_id?: string | null;
          commission_rate: number;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          name: string;
          observations?: string | null;
          product_id?: string | null;
          representative_id?: string | null;
          status?: string;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          category_id?: string | null;
          commission_rate?: number;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          name?: string;
          observations?: string | null;
          product_id?: string | null;
          representative_id?: string | null;
          status?: string;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      commissions: {
        Row: {
          base_value: number | null;
          commission_rate: number | null;
          commission_value: number | null;
          created_at: string | null;
          id: string;
          manufacturer_id: string | null;
          order_id: string | null;
          order_payment_id: string | null;
          payment_date: string | null;
          payment_method: string | null;
          payment_notes: string | null;
          payment_value: number | null;
          representative_id: string | null;
          rule_id: string | null;
          settlement_key: string | null;
          status: Database["public"]["Enums"]["commission_status"];
          updated_at: string | null;
          value: number | null;
          paid: boolean | null;
          paid_at: string | null;
        };
        Insert: {
          base_value?: number | null;
          commission_rate?: number | null;
          commission_value?: number | null;
          created_at?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          order_id?: string | null;
          order_payment_id?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_notes?: string | null;
          payment_value?: number | null;
          representative_id?: string | null;
          rule_id?: string | null;
          settlement_key?: string | null;
          status?: Database["public"]["Enums"]["commission_status"];
          updated_at?: string | null;
          value?: number | null;
          paid?: boolean | null;
          paid_at?: string | null;
        };
        Update: {
          base_value?: number | null;
          commission_rate?: number | null;
          commission_value?: number | null;
          created_at?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          order_id?: string | null;
          order_payment_id?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          payment_notes?: string | null;
          payment_value?: number | null;
          representative_id?: string | null;
          rule_id?: string | null;
          settlement_key?: string | null;
          status?: Database["public"]["Enums"]["commission_status"];
          value?: number | null;
          paid?: boolean | null;
          paid_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_order_payment_id_fkey";
            columns: ["order_payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "commission_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      commissions_history: {
        Row: {
          action: string;
          commission_id: string | null;
          created_at: string | null;
          details: Json | null;
          goal_id: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          commission_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          goal_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          commission_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          goal_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_history_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_history_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      company_settings: {
        Row: {
          address: string | null;
          address_complement: string | null;
          address_number: string | null;
          city: string | null;
          cnpj: string | null;
          company_name: string;
          email: string | null;
          favicon_url: string | null;
          google_maps_api_key: string | null;
          id: string;
          legal_name: string | null;
          logo_docs_url: string | null;
          logo_url: string | null;
          neighborhood: string | null;
          phone: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          state: string | null;
          state_registration: string | null;
          trade_name: string | null;
          updated_at: string | null;
          updated_by: string | null;
          website: string | null;
          whatsapp: string | null;
          zip_code: string | null;
        };
        Insert: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          city?: string | null;
          cnpj?: string | null;
          company_name: string;
          email?: string | null;
          favicon_url?: string | null;
          google_maps_api_key?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_docs_url?: string | null;
          logo_url?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Update: {
          address?: string | null;
          address_complement?: string | null;
          address_number?: string | null;
          city?: string | null;
          cnpj?: string | null;
          company_name?: string;
          email?: string | null;
          favicon_url?: string | null;
          google_maps_api_key?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_docs_url?: string | null;
          logo_url?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          state?: string | null;
          state_registration?: string | null;
          trade_name?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          zip_code?: string | null;
        };
        Relationships: [];
      };
      crm_stages: {
        Row: {
          color: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      data_imports: {
        Row: {
          created_at: string;
          data_type: string;
          errors_log: Json | null;
          file_name: string;
          file_size: number | null;
          id: string;
          mapping: Json | null;
          status: Database["public"]["Enums"]["import_status"];
          summary: Json | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data_type: string;
          errors_log?: Json | null;
          file_name: string;
          file_size?: number | null;
          id?: string;
          mapping?: Json | null;
          status?: Database["public"]["Enums"]["import_status"];
          summary?: Json | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data_type?: string;
          errors_log?: Json | null;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          mapping?: Json | null;
          status?: Database["public"]["Enums"]["import_status"];
          summary?: Json | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      follow_ups: {
        Row: {
          client_id: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          opportunity_id: string | null;
          representative_id: string | null;
          scheduled_at: string | null;
          status: string | null;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          opportunity_id?: string | null;
          representative_id?: string | null;
          scheduled_at?: string | null;
          status?: string | null;
        };
        Update: {
          client_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          opportunity_id?: string | null;
          representative_id?: string | null;
          scheduled_at?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "follow_ups_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follow_ups_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follow_ups_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          achieved_value: number | null;
          created_at: string | null;
          id: string;
          month: number;
          representative_id: string | null;
          target_value: number | null;
          year: number;
        };
        Insert: {
          achieved_value?: number | null;
          created_at?: string | null;
          id?: string;
          month: number;
          representative_id?: string | null;
          target_value?: number | null;
          year: number;
        };
        Update: {
          achieved_value?: number | null;
          created_at?: string | null;
          id?: string;
          month?: number;
          representative_id?: string | null;
          target_value?: number | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "goals_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      import_templates: {
        Row: {
          created_at: string;
          created_by: string;
          data_type: string;
          id: string;
          mapping: Json;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          data_type: string;
          id?: string;
          mapping: Json;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          data_type?: string;
          id?: string;
          mapping?: Json;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      manufacturers: {
        Row: {
          cnpj: string | null;
          contact_info: Json | null;
          created_at: string | null;
          default_commission_rate: number | null;
          email: string | null;
          id: string;
          legal_name: string | null;
          logo_path: string | null;
          name: string;
          observations: string | null;
          phone: string | null;
          responsible_name: string | null;
          status: string | null;
          trade_name: string | null;
          updated_at: string | null;
        };
        Insert: {
          cnpj?: string | null;
          contact_info?: Json | null;
          created_at?: string | null;
          default_commission_rate?: number | null;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name: string;
          observations?: string | null;
          phone?: string | null;
          responsible_name?: string | null;
          status?: string | null;
          trade_name?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cnpj?: string | null;
          contact_info?: Json | null;
          created_at?: string | null;
          default_commission_rate?: number | null;
          email?: string | null;
          id?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          name?: string;
          observations?: string | null;
          phone?: string | null;
          responsible_name?: string | null;
          status?: string | null;
          trade_name?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      material_history: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          id: string;
          material_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          material_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          material_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "material_history_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "commercial_materials";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string | null;
          id: string;
          is_read: boolean | null;
          message: string;
          priority: Database["public"]["Enums"]["notification_priority"] | null;
          read_at: string | null;
          related_record_id: string | null;
          related_record_type: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message: string;
          priority?: Database["public"]["Enums"]["notification_priority"] | null;
          read_at?: string | null;
          related_record_id?: string | null;
          related_record_type?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          message?: string;
          priority?: Database["public"]["Enums"]["notification_priority"] | null;
          read_at?: string | null;
          related_record_id?: string | null;
          related_record_type?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          actual_closing_date: string | null;
          client_id: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          estimated_value: number | null;
          expected_closing_date: string | null;
          id: string;
          loss_notes: string | null;
          loss_reason: string | null;
          next_action_date: string | null;
          next_action_description: string | null;
          origin: string | null;
          probability: number | null;
          representative_id: string | null;
          stage_id: string;
          status: string | null;
          title: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          actual_closing_date?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          estimated_value?: number | null;
          expected_closing_date?: string | null;
          id?: string;
          loss_notes?: string | null;
          loss_reason?: string | null;
          next_action_date?: string | null;
          next_action_description?: string | null;
          origin?: string | null;
          probability?: number | null;
          representative_id?: string | null;
          stage_id: string;
          status?: string | null;
          title: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          actual_closing_date?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          estimated_value?: number | null;
          expected_closing_date?: string | null;
          id?: string;
          loss_notes?: string | null;
          loss_reason?: string | null;
          next_action_date?: string | null;
          next_action_description?: string | null;
          origin?: string | null;
          probability?: number | null;
          representative_id?: string | null;
          stage_id?: string;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "crm_stages";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_activities: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          description: string;
          id: string;
          opportunity_id: string;
          representative_id: string;
          scheduled_at: string;
          status: string;
          type: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          description: string;
          id?: string;
          opportunity_id: string;
          representative_id: string;
          scheduled_at: string;
          status?: string;
          type: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          description?: string;
          id?: string;
          opportunity_id?: string;
          representative_id?: string;
          scheduled_at?: string;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_activities_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_history: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          id: string;
          new_stage_id: string | null;
          new_value: number | null;
          opportunity_id: string;
          previous_stage_id: string | null;
          previous_value: number | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          new_stage_id?: string | null;
          new_value?: number | null;
          opportunity_id: string;
          previous_stage_id?: string | null;
          previous_value?: number | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          new_stage_id?: string | null;
          new_value?: number | null;
          opportunity_id?: string;
          previous_stage_id?: string | null;
          previous_value?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_history_new_stage_id_fkey";
            columns: ["new_stage_id"];
            isOneToOne: false;
            referencedRelation: "crm_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_history_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_history_previous_stage_id_fkey";
            columns: ["previous_stage_id"];
            isOneToOne: false;
            referencedRelation: "crm_stages";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_items: {
        Row: {
          created_at: string | null;
          discount_percent: number | null;
          estimated_price: number;
          id: string;
          opportunity_id: string;
          product_id: string;
          quantity: number;
          total_value: number;
        };
        Insert: {
          created_at?: string | null;
          discount_percent?: number | null;
          estimated_price?: number;
          id?: string;
          opportunity_id: string;
          product_id: string;
          quantity?: number;
          total_value?: number;
        };
        Update: {
          created_at?: string | null;
          discount_percent?: number | null;
          estimated_price?: number;
          id?: string;
          opportunity_id?: string;
          product_id?: string;
          quantity?: number;
          total_value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_items_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunity_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_requests: {
        Row: {
          actor_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          order_id: string | null;
          request_hash: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          order_id?: string | null;
          request_hash: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          order_id?: string | null;
          request_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_value_pricing_rules: {
        Row: {
          adjustment_type: string;
          adjustment_value: number;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          manufacturer_id: string | null;
          max_discount_percent: number | null;
          max_order_value: number | null;
          min_order_value: number;
          price_table_id: string | null;
          priority: number;
          product_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          adjustment_type: string;
          adjustment_value: number;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          max_discount_percent?: number | null;
          max_order_value?: number | null;
          min_order_value?: number;
          price_table_id?: string | null;
          priority?: number;
          product_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          adjustment_type?: string;
          adjustment_value?: number;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          manufacturer_id?: string | null;
          max_discount_percent?: number | null;
          max_order_value?: number | null;
          min_order_value?: number;
          price_table_id?: string | null;
          priority?: number;
          product_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_value_pricing_rules_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_value_pricing_rules_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_value_pricing_rules_price_table_id_fkey";
            columns: ["price_table_id"];
            isOneToOne: false;
            referencedRelation: "price_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_value_pricing_rules_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      payment_plan_installments: {
        Row: {
          created_at: string;
          days_after_order: number;
          id: string;
          installment_number: number;
          payment_plan_id: string;
          percentage: number;
        };
        Insert: {
          created_at?: string;
          days_after_order?: number;
          id?: string;
          installment_number: number;
          payment_plan_id: string;
          percentage: number;
        };
        Update: {
          created_at?: string;
          days_after_order?: number;
          id?: string;
          installment_number?: number;
          payment_plan_id?: string;
          percentage?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_payment_plan_id_fkey";
            columns: ["payment_plan_id"];
            isOneToOne: false;
            referencedRelation: "payment_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_plans: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          payment_method_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          payment_method_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          payment_method_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payment_plans_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      price_table_items: {
        Row: {
          commission_rate: number | null;
          created_at: string | null;
          id: string;
          max_discount_percent: number | null;
          min_price: number | null;
          price_table_id: string;
          product_id: string;
          unit_price: number;
          updated_at: string | null;
        };
        Insert: {
          commission_rate?: number | null;
          created_at?: string | null;
          id?: string;
          max_discount_percent?: number | null;
          min_price?: number | null;
          price_table_id: string;
          product_id: string;
          unit_price?: number;
          updated_at?: string | null;
        };
        Update: {
          commission_rate?: number | null;
          created_at?: string | null;
          id?: string;
          max_discount_percent?: number | null;
          min_price?: number | null;
          price_table_id?: string;
          product_id?: string;
          unit_price?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_table_items_price_table_id_fkey";
            columns: ["price_table_id"];
            isOneToOne: false;
            referencedRelation: "price_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_table_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      price_tables: {
        Row: {
          code: string | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_default: boolean | null;
          manufacturer_id: string | null;
          name: string;
          priority: number;
          region_id: string | null;
          status: string;
          target_audience: string;
          updated_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean | null;
          manufacturer_id?: string | null;
          name: string;
          priority?: number;
          region_id?: string | null;
          status?: string;
          target_audience?: string;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean | null;
          manufacturer_id?: string | null;
          name?: string;
          priority?: number;
          region_id?: string | null;
          status?: string;
          target_audience?: string;
          updated_at?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "price_tables_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tables_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_product_prices: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          max_discount_percent: number;
          min_price: number | null;
          priority: number;
          product_id: string;
          reason: string | null;
          status: string;
          unit_price: number;
          updated_at: string;
          updated_by: string | null;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          max_discount_percent?: number;
          min_price?: number | null;
          priority?: number;
          product_id: string;
          reason?: string | null;
          status?: string;
          unit_price: number;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          max_discount_percent?: number;
          min_price?: number | null;
          priority?: number;
          product_id?: string;
          reason?: string | null;
          status?: string;
          unit_price?: number;
          updated_at?: string;
          updated_by?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_history: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          id: string;
          new_status: Database["public"]["Enums"]["order_status"] | null;
          order_id: string;
          previous_status: Database["public"]["Enums"]["order_status"] | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          new_status?: Database["public"]["Enums"]["order_status"] | null;
          order_id: string;
          previous_status?: Database["public"]["Enums"]["order_status"] | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          new_status?: Database["public"]["Enums"]["order_status"] | null;
          order_id?: string;
          previous_status?: Database["public"]["Enums"]["order_status"] | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string | null;
          discount_amount: number;
          id: string;
          list_unit_price: number | null;
          max_discount_percent: number | null;
          min_unit_price: number | null;
          negotiated_price_id: string | null;
          order_id: string;
          price_table_id: string | null;
          price_table_item_id: string | null;
          pricing_rule_id: string | null;
          pricing_snapshot: Json | null;
          pricing_source: string | null;
          product_code_snapshot: string | null;
          product_id: string;
          product_name_snapshot: string | null;
          product_sku_snapshot: string | null;
          quantity: number;
          resolved_unit_price: number | null;
          subtotal: number;
          unit_price: number;
          unit_snapshot: string | null;
        };
        Insert: {
          created_at?: string | null;
          discount_amount?: number;
          id?: string;
          list_unit_price?: number | null;
          max_discount_percent?: number | null;
          min_unit_price?: number | null;
          negotiated_price_id?: string | null;
          order_id: string;
          price_table_id?: string | null;
          price_table_item_id?: string | null;
          pricing_rule_id?: string | null;
          pricing_snapshot?: Json | null;
          pricing_source?: string | null;
          product_code_snapshot?: string | null;
          product_id: string;
          product_name_snapshot?: string | null;
          product_sku_snapshot?: string | null;
          quantity?: number;
          resolved_unit_price?: number | null;
          subtotal?: number;
          unit_price?: number;
          unit_snapshot?: string | null;
        };
        Update: {
          created_at?: string | null;
          discount_amount?: number;
          id?: string;
          list_unit_price?: number | null;
          max_discount_percent?: number | null;
          min_unit_price?: number | null;
          negotiated_price_id?: string | null;
          order_id?: string;
          price_table_id?: string | null;
          price_table_item_id?: string | null;
          pricing_rule_id?: string | null;
          pricing_snapshot?: Json | null;
          pricing_source?: string | null;
          product_code_snapshot?: string | null;
          product_id?: string;
          product_name_snapshot?: string | null;
          product_sku_snapshot?: string | null;
          quantity?: number;
          resolved_unit_price?: number | null;
          subtotal?: number;
          unit_price?: number;
          unit_snapshot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_price_table_item_id_fkey";
            columns: ["price_table_item_id"];
            isOneToOne: false;
            referencedRelation: "price_table_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_payments: {
        Row: {
          created_at: string | null;
          due_date: string;
          id: string;
          installment_number: number;
          order_id: string;
          payment_plan_id: string | null;
          payment_plan_installment_id: string | null;
          percentage: number | null;
          received_at: string | null;
          received_value: number | null;
          status: string;
          term_snapshot: Json | null;
          updated_at: string | null;
          value: number;
        };
        Insert: {
          created_at?: string | null;
          due_date: string;
          id?: string;
          installment_number: number;
          order_id: string;
          payment_plan_id?: string | null;
          payment_plan_installment_id?: string | null;
          percentage?: number | null;
          received_at?: string | null;
          received_value?: number | null;
          status?: string;
          term_snapshot?: Json | null;
          updated_at?: string | null;
          value: number;
        };
        Update: {
          created_at?: string | null;
          due_date?: string;
          id?: string;
          installment_number?: number;
          order_id?: string;
          payment_plan_id?: string | null;
          payment_plan_installment_id?: string | null;
          percentage?: number | null;
          received_at?: string | null;
          received_value?: number | null;
          status?: string;
          term_snapshot?: Json | null;
          updated_at?: string | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          billing_notes: string | null;
          cancellation_reason: string | null;
          client_id: string;
          commercial_notes: string | null;
          created_at: string | null;
          created_by: string | null;
          discount_amount: number;
          expected_delivery_date: string | null;
          id: string;
          internal_notes: string | null;
          opportunity_id: string | null;
          order_number: string | null;
          origin: string | null;
          payment_condition: string | null;
          payment_method: string | null;
          payment_term: string | null;
          rejection_reason: string | null;
          representative_id: string;
          status: Database["public"]["Enums"]["order_status"];
          subtotal_amount: number;
          total_amount: number;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          billing_notes?: string | null;
          cancellation_reason?: string | null;
          client_id: string;
          commercial_notes?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          discount_amount?: number;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          opportunity_id?: string | null;
          order_number?: string | null;
          origin?: string | null;
          payment_condition?: string | null;
          payment_method?: string | null;
          payment_term?: string | null;
          rejection_reason?: string | null;
          representative_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount?: number;
          total_amount?: number;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          billing_notes?: string | null;
          cancellation_reason?: string | null;
          client_id?: string;
          commercial_notes?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          discount_amount?: number;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          opportunity_id?: string | null;
          order_number?: string | null;
          origin?: string | null;
          payment_condition?: string | null;
          payment_method?: string | null;
          payment_term?: string | null;
          rejection_reason?: string | null;
          representative_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_amount?: number;
          total_amount?: number;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
      permission_matrix: {
        Row: {
          can_approve: boolean | null;
          can_create: boolean | null;
          can_delete: boolean | null;
          can_edit: boolean | null;
          can_export: boolean | null;
          can_view: boolean | null;
          id: string;
          module: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          can_approve?: boolean | null;
          can_create?: boolean | null;
          can_delete?: boolean | null;
          can_edit?: boolean | null;
          can_export?: boolean | null;
          can_view?: boolean | null;
          id?: string;
          module: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          can_approve?: boolean | null;
          can_create?: boolean | null;
          can_delete?: boolean | null;
          can_edit?: boolean | null;
          can_export?: boolean | null;
          can_view?: boolean | null;
          id?: string;
          module?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      product_history: {
        Row: {
          action: string;
          changes: Json | null;
          created_at: string | null;
          id: string;
          product_id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          changes?: Json | null;
          created_at?: string | null;
          id?: string;
          product_id: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          changes?: Json | null;
          created_at?: string | null;
          id?: string;
          product_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_materials: {
        Row: {
          created_at: string | null;
          file_type: string | null;
          file_url: string;
          id: string;
          name: string;
          product_id: string;
        };
        Insert: {
          created_at?: string | null;
          file_type?: string | null;
          file_url: string;
          id?: string;
          name: string;
          product_id: string;
        };
        Update: {
          created_at?: string | null;
          file_type?: string | null;
          file_url?: string;
          id?: string;
          name?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_materials_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          applications: string | null;
          brand: string | null;
          category_id: string | null;
          code: string | null;
          commercial_notes: string | null;
          commission_rate: number | null;
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          main_image_url: string | null;
          manufacturer_id: string | null;
          min_price: number | null;
          name: string;
          price: number;
          sku: string | null;
          status: string | null;
          subcategory: string | null;
          technical_specifications: Json | null;
          trade_name: string | null;
          unit: string | null;
          updated_at: string | null;
        };
        Insert: {
          applications?: string | null;
          brand?: string | null;
          category_id?: string | null;
          code?: string | null;
          commercial_notes?: string | null;
          commission_rate?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          main_image_url?: string | null;
          manufacturer_id?: string | null;
          min_price?: number | null;
          name: string;
          price: number;
          sku?: string | null;
          status?: string | null;
          subcategory?: string | null;
          technical_specifications?: Json | null;
          trade_name?: string | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Update: {
          applications?: string | null;
          brand?: string | null;
          category_id?: string | null;
          code?: string | null;
          commercial_notes?: string | null;
          commission_rate?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          main_image_url?: string | null;
          manufacturer_id?: string | null;
          min_price?: number | null;
          name?: string;
          price?: number;
          sku?: string | null;
          status?: string | null;
          subcategory?: string | null;
          technical_specifications?: Json | null;
          trade_name?: string | null;
          unit?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_manufacturer_id_fkey";
            columns: ["manufacturer_id"];
            isOneToOne: false;
            referencedRelation: "manufacturers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          created_at: string | null;
          first_login_done: boolean | null;
          force_password_change: boolean | null;
          full_name: string | null;
          id: string;
          last_access: string | null;
          last_login: string | null;
          phone: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          first_login_done?: boolean | null;
          force_password_change?: boolean | null;
          full_name?: string | null;
          id: string;
          last_access?: string | null;
          last_login?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          first_login_done?: boolean | null;
          force_password_change?: boolean | null;
          full_name?: string | null;
          id?: string;
          last_access?: string | null;
          last_login?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          cities: string[] | null;
          created_at: string | null;
          id: string;
          name: string;
          state: string;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          cities?: string[] | null;
          created_at?: string | null;
          id?: string;
          name: string;
          state: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cities?: string[] | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          state?: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      representatives: {
        Row: {
          address: string | null;
          birth_date: string | null;
          cep: string | null;
          city: string | null;
          code: string | null;
          commission_rate: number | null;
          complement: string | null;
          cpf: string | null;
          created_at: string | null;
          created_by: string | null;
          email: string | null;
          id: string;
          monthly_goal: number | null;
          name: string | null;
          neighborhood: string | null;
          number: string | null;
          phone: string | null;
          photo_url: string | null;
          region_id: string | null;
          start_date: string | null;
          state: string | null;
          status: string | null;
          updated_at: string | null;
          updated_by: string | null;
          user_id: string;
          whatsapp: string | null;
        };
        Insert: {
          address?: string | null;
          birth_date?: string | null;
          cep?: string | null;
          city?: string | null;
          code?: string | null;
          commission_rate?: number | null;
          complement?: string | null;
          cpf?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          monthly_goal?: number | null;
          name?: string | null;
          neighborhood?: string | null;
          number?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          region_id?: string | null;
          start_date?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          user_id: string;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          birth_date?: string | null;
          cep?: string | null;
          city?: string | null;
          code?: string | null;
          commission_rate?: number | null;
          complement?: string | null;
          cpf?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          monthly_goal?: number | null;
          name?: string | null;
          neighborhood?: string | null;
          number?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          region_id?: string | null;
          start_date?: string | null;
          state?: string | null;
          status?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          user_id?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "representatives_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      route_stops: {
        Row: {
          client_id: string | null;
          created_at: string;
          distance_from_previous_km: number | null;
          duration_from_previous_min: number | null;
          estimated_duration_min: number | null;
          id: string;
          label: string | null;
          latitude: number;
          longitude: number;
          route_id: string;
          scheduled_time: string | null;
          sequence_order: number;
          status: Database["public"]["Enums"]["route_stop_status"];
          updated_at: string;
          visit_id: string | null;
        };
        Insert: {
          client_id?: string | null;
          created_at?: string;
          distance_from_previous_km?: number | null;
          duration_from_previous_min?: number | null;
          estimated_duration_min?: number | null;
          id?: string;
          label?: string | null;
          latitude: number;
          longitude: number;
          route_id: string;
          scheduled_time?: string | null;
          sequence_order: number;
          status?: Database["public"]["Enums"]["route_stop_status"];
          updated_at?: string;
          visit_id?: string | null;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          distance_from_previous_km?: number | null;
          duration_from_previous_min?: number | null;
          estimated_duration_min?: number | null;
          id?: string;
          label?: string | null;
          latitude?: number;
          longitude?: number;
          route_id?: string;
          scheduled_time?: string | null;
          sequence_order?: number;
          status?: Database["public"]["Enums"]["route_stop_status"];
          updated_at?: string;
          visit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "route_stops_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_stops_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "route_stops_visit_id_fkey";
            columns: ["visit_id"];
            isOneToOne: false;
            referencedRelation: "visits";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          created_at: string;
          date: string;
          destination_address: string | null;
          destination_lat: number | null;
          destination_lng: number | null;
          destination_type: string | null;
          id: string;
          name: string;
          origin_address: string | null;
          origin_lat: number | null;
          origin_lng: number | null;
          origin_type: string | null;
          representative_id: string;
          status: Database["public"]["Enums"]["route_status"];
          total_distance_km: number | null;
          total_duration_min: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          destination_address?: string | null;
          destination_lat?: number | null;
          destination_lng?: number | null;
          destination_type?: string | null;
          id?: string;
          name: string;
          origin_address?: string | null;
          origin_lat?: number | null;
          origin_lng?: number | null;
          origin_type?: string | null;
          representative_id: string;
          status?: Database["public"]["Enums"]["route_status"];
          total_distance_km?: number | null;
          total_duration_min?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          destination_address?: string | null;
          destination_lat?: number | null;
          destination_lng?: number | null;
          destination_type?: string | null;
          id?: string;
          name?: string;
          origin_address?: string | null;
          origin_lat?: number | null;
          origin_lng?: number | null;
          origin_type?: string | null;
          representative_id?: string;
          status?: Database["public"]["Enums"]["route_status"];
          total_distance_km?: number | null;
          total_duration_min?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_preferences: {
        Row: {
          currency: string | null;
          date_format: string | null;
          id: string;
          items_per_page: number | null;
          language: string | null;
          timezone: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          currency?: string | null;
          date_format?: string | null;
          id?: string;
          items_per_page?: number | null;
          language?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          currency?: string | null;
          date_format?: string | null;
          id?: string;
          items_per_page?: number | null;
          language?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_notification_settings: {
        Row: {
          category: Database["public"]["Enums"]["notification_type"];
          enabled: boolean | null;
          id: string;
          is_mandatory: boolean | null;
          user_id: string;
        };
        Insert: {
          category: Database["public"]["Enums"]["notification_type"];
          enabled?: boolean | null;
          id?: string;
          is_mandatory?: boolean | null;
          user_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["notification_type"];
          enabled?: boolean | null;
          id?: string;
          is_mandatory?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      visits: {
        Row: {
          agreements: string | null;
          client_id: string | null;
          created_at: string | null;
          id: string;
          meeting_summary: string | null;
          notes: string | null;
          representative_id: string | null;
          scheduled_at: string;
          status: string | null;
        };
        Insert: {
          agreements?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          id?: string;
          meeting_summary?: string | null;
          notes?: string | null;
          representative_id?: string | null;
          scheduled_at: string;
          status?: string | null;
        };
        Update: {
          agreements?: string | null;
          client_id?: string | null;
          created_at?: string | null;
          id?: string;
          meeting_summary?: string | null;
          notes?: string | null;
          representative_id?: string | null;
          scheduled_at?: string;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_representative_id_fkey";
            columns: ["representative_id"];
            isOneToOne: false;
            referencedRelation: "representatives";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_user_active: { Args: never; Returns: boolean };
      create_order: { Args: { p_payload: Json }; Returns: Json };
      get_dashboard_stats: { Args: { _user_id?: string }; Returns: Json };
      settle_order_payment_and_commissions: {
        Args: {
          p_payment_id: string;
          p_received_value?: number | null;
        };
        Returns: Json;
      };
      transition_order: {
        Args: {
          p_order_id: string;
          p_reason?: string | null;
          p_to_status: Database["public"]["Enums"]["order_status"];
        };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      access_status: "pendente" | "ativo" | "bloqueado" | "inativo";
      app_role: "admin" | "gestor_comercial" | "supervisor" | "representante";
      commission_status: "pending" | "approved" | "scheduled" | "paid" | "cancelled";
      goal_status: "active" | "closed" | "cancelled";
      goal_type: "monthly" | "quarterly" | "semiannual" | "annual";
      import_status: "pending" | "processing" | "completed" | "completed_with_errors" | "cancelled";
      material_category:
        | "Catálogos"
        | "Fichas técnicas"
        | "Apresentações"
        | "Tabelas comerciais"
        | "Imagens"
        | "Vídeos"
        | "Campanhas"
        | "Materiais de treinamento"
        | "Outros";
      material_status: "active" | "inactive";
      notification_priority: "informativa" | "atencao" | "importante" | "urgente";
      notification_type:
        | "visita"
        | "follow_up"
        | "oportunidade"
        | "pedido"
        | "meta"
        | "comissao"
        | "cliente"
        | "sistema";
      order_status:
        "draft" | "sent" | "analysis" | "approved" | "invoiced" | "delivered" | "cancelled";
      route_status: "planejada" | "em_andamento" | "concluida" | "cancelada";
      route_stop_status:
        "pendente" | "em_deslocamento" | "em_visita" | "concluida" | "pulada" | "cancelada";
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
    Enums: {
      access_status: ["pendente", "ativo", "bloqueado", "inativo"],
      app_role: ["admin", "gestor_comercial", "supervisor", "representante"],
      commission_status: ["pending", "approved", "scheduled", "paid", "cancelled"],
      goal_status: ["active", "closed", "cancelled"],
      goal_type: ["monthly", "quarterly", "semiannual", "annual"],
      import_status: ["pending", "processing", "completed", "completed_with_errors", "cancelled"],
      material_category: [
        "Catálogos",
        "Fichas técnicas",
        "Apresentações",
        "Tabelas comerciais",
        "Imagens",
        "Vídeos",
        "Campanhas",
        "Materiais de treinamento",
        "Outros",
      ],
      material_status: ["active", "inactive"],
      notification_priority: ["informativa", "atencao", "importante", "urgente"],
      notification_type: [
        "visita",
        "follow_up",
        "oportunidade",
        "pedido",
        "meta",
        "comissao",
        "cliente",
        "sistema",
      ],
      order_status: ["draft", "sent", "analysis", "approved", "invoiced", "delivered", "cancelled"],
      route_status: ["planejada", "em_andamento", "concluida", "cancelada"],
      route_stop_status: [
        "pendente",
        "em_deslocamento",
        "em_visita",
        "concluida",
        "pulada",
        "cancelada",
      ],
    },
  },
} as const;
