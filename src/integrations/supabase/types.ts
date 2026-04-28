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
      ads_daily_documentation: {
        Row: {
          actions_done: string | null
          ads_manager_id: string
          client_budget: string | null
          client_id: string | null
          created_at: string
          documentation_date: string
          id: string
          metrics: string | null
          updated_at: string
        }
        Insert: {
          actions_done?: string | null
          ads_manager_id: string
          client_budget?: string | null
          client_id?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          metrics?: string | null
          updated_at?: string
        }
        Update: {
          actions_done?: string | null
          ads_manager_id?: string
          client_budget?: string | null
          client_id?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          metrics?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_daily_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_justifications: {
        Row: {
          ads_manager_id: string
          client_id: string
          created_at: string
          id: string
          justification_type: string | null
          reason: string
          resolved: boolean | null
          resolved_at: string | null
        }
        Insert: {
          ads_manager_id: string
          client_id: string
          created_at?: string
          id?: string
          justification_type?: string | null
          reason: string
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Update: {
          ads_manager_id?: string
          client_id?: string
          created_at?: string
          id?: string
          justification_type?: string | null
          reason?: string
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_justifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_meetings: {
        Row: {
          ads_manager_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          meeting_date: string | null
          title: string
        }
        Insert: {
          ads_manager_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          meeting_date?: string | null
          title: string
        }
        Update: {
          ads_manager_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          meeting_date?: string | null
          title?: string
        }
        Relationships: []
      }
      ads_new_client_notifications: {
        Row: {
          ads_manager_id: string
          client_id: string
          client_name: string
          created_at: string
          created_by: string
          created_by_name: string
          id: string
          read: boolean
          read_at: string | null
        }
        Insert: {
          ads_manager_id: string
          client_id: string
          client_name: string
          created_at?: string
          created_by: string
          created_by_name: string
          id?: string
          read?: boolean
          read_at?: string | null
        }
        Update: {
          ads_manager_id?: string
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          id?: string
          read?: boolean
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_new_client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_note_notifications: {
        Row: {
          ads_manager_id: string
          client_id: string
          client_name: string
          created_at: string
          created_by: string
          created_by_name: string
          id: string
          note_content: string
          note_id: string
          read: boolean
          read_at: string | null
        }
        Insert: {
          ads_manager_id: string
          client_id: string
          client_name: string
          created_at?: string
          created_by: string
          created_by_name: string
          id?: string
          note_content: string
          note_id: string
          read?: boolean
          read_at?: string | null
        }
        Update: {
          ads_manager_id?: string
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          id?: string
          note_content?: string
          note_id?: string
          read?: boolean
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_note_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_note_notifications_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "client_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_task_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ads_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_task_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          justification?: string
          notification_id?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_task_delay_justifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "ads_task_delay_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_task_delay_notifications: {
        Row: {
          ads_manager_id: string
          ads_manager_name: string
          ads_task_id: string
          created_at: string
          id: string
          task_due_date: string
          task_title: string
        }
        Insert: {
          ads_manager_id: string
          ads_manager_name: string
          ads_task_id: string
          created_at?: string
          id?: string
          task_due_date: string
          task_title: string
        }
        Update: {
          ads_manager_id?: string
          ads_manager_name?: string
          ads_task_id?: string
          created_at?: string
          id?: string
          task_due_date?: string
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_task_delay_notifications_ads_task_id_fkey"
            columns: ["ads_task_id"]
            isOneToOne: true
            referencedRelation: "ads_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_tasks: {
        Row: {
          ads_manager_id: string
          archived: boolean | null
          archived_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          justification: string | null
          justification_at: string | null
          priority: string | null
          status: string | null
          tags: string[] | null
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ads_manager_id: string
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ads_manager_id?: string
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          name: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          name: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          name?: string
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          action: string
          api_key_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          method: string
          request_body: Json | null
          response_body: Json | null
          status_code: number
        }
        Insert: {
          action: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          method: string
          request_body?: Json | null
          response_body?: Json | null
          status_code: number
        }
        Update: {
          action?: string
          api_key_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          request_body?: Json | null
          response_body?: Json | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_pages: {
        Row: {
          category: string
          created_at: string
          is_active: boolean
          label: string
          route: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string
          is_active?: boolean
          label: string
          route: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string
          is_active?: boolean
          label?: string
          route?: string
          slug?: string
        }
        Relationships: []
      }
      atrizes_briefings: {
        Row: {
          card_id: string
          client_instagram: string | null
          created_at: string
          created_by: string | null
          drive_upload_url: string | null
          id: string
          script_url: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          drive_upload_url?: string | null
          id?: string
          script_url?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          drive_upload_url?: string | null
          id?: string
          script_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atrizes_briefings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      atrizes_completion_notifications: {
        Row: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          requester_id: string
          requester_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id: string
          requester_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          completed_by?: string
          completed_by_name?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id?: string
          requester_name?: string
        }
        Relationships: []
      }
      card_activities: {
        Row: {
          action: string
          card_id: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          card_id: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          card_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_activities_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_attachments: {
        Row: {
          card_id: string
          created_at: string
          created_by: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          math_answer: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          math_answer: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          math_answer?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "churn_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_notifications: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          id: string
          notification_date: string
        }
        Insert: {
          client_id: string
          client_name: string
          created_at?: string
          id?: string
          notification_date?: string
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          id?: string
          notification_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_call_forms: {
        Row: {
          acoes_pontuais: string | null
          apresentacao: string | null
          client_id: string
          cliente_ideal: string | null
          comercial_existente: string | null
          created_at: string
          dor_desejo: string | null
          expectativas_1a: string | null
          expectativas_30d: string | null
          expectativas_3m: string | null
          expectativas_6m: string | null
          historia_empresa: string | null
          historico_marketing: string | null
          id: string
          investimento: string | null
          lista_produtos: string | null
          localizacao: string | null
          motivo_call: string | null
          produto_servico: string | null
          proposito: string | null
          referencias: string | null
          site: string | null
          strategy_link: string | null
          updated_at: string
        }
        Insert: {
          acoes_pontuais?: string | null
          apresentacao?: string | null
          client_id: string
          cliente_ideal?: string | null
          comercial_existente?: string | null
          created_at?: string
          dor_desejo?: string | null
          expectativas_1a?: string | null
          expectativas_30d?: string | null
          expectativas_3m?: string | null
          expectativas_6m?: string | null
          historia_empresa?: string | null
          historico_marketing?: string | null
          id?: string
          investimento?: string | null
          lista_produtos?: string | null
          localizacao?: string | null
          motivo_call?: string | null
          produto_servico?: string | null
          proposito?: string | null
          referencias?: string | null
          site?: string | null
          strategy_link?: string | null
          updated_at?: string
        }
        Update: {
          acoes_pontuais?: string | null
          apresentacao?: string | null
          client_id?: string
          cliente_ideal?: string | null
          comercial_existente?: string | null
          created_at?: string
          dor_desejo?: string | null
          expectativas_1a?: string | null
          expectativas_30d?: string | null
          expectativas_3m?: string | null
          expectativas_6m?: string | null
          historia_empresa?: string | null
          historico_marketing?: string | null
          id?: string
          investimento?: string | null
          lista_produtos?: string | null
          localizacao?: string | null
          motivo_call?: string | null
          produto_servico?: string | null
          proposito?: string | null
          referencias?: string | null
          site?: string | null
          strategy_link?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_call_forms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_daily_tracking: {
        Row: {
          ads_manager_id: string
          client_id: string
          created_at: string
          current_day: string | null
          id: string
          is_delayed: boolean | null
          last_moved_at: string | null
          updated_at: string
        }
        Insert: {
          ads_manager_id: string
          client_id: string
          created_at?: string
          current_day?: string | null
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string | null
          updated_at?: string
        }
        Update: {
          ads_manager_id?: string
          client_id?: string
          created_at?: string
          current_day?: string | null
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_daily_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_idempotency_keys: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          key: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          key: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_idempotency_keys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          invoice_month: string
          invoice_number: string | null
          invoice_value: number
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          invoice_month: string
          invoice_number?: string | null
          invoice_value: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          invoice_month?: string
          invoice_number?: string | null
          invoice_value?: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          note_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          note_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          note_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          current_milestone: number | null
          current_step: string | null
          id: string
          milestone_1_started_at: string | null
          milestone_2_started_at: string | null
          milestone_3_started_at: string | null
          milestone_4_started_at: string | null
          milestone_5_started_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          current_milestone?: number | null
          current_step?: string | null
          id?: string
          milestone_1_started_at?: string | null
          milestone_2_started_at?: string | null
          milestone_3_started_at?: string | null
          milestone_4_started_at?: string | null
          milestone_5_started_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          current_milestone?: number | null
          current_step?: string | null
          id?: string
          milestone_1_started_at?: string | null
          milestone_2_started_at?: string | null
          milestone_3_started_at?: string | null
          milestone_4_started_at?: string | null
          milestone_5_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_churns: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          client_id: string
          created_at: string
          distrato_entered_at: string
          distrato_step: string
          exit_reason: string | null
          exit_satisfaction_score: number | null
          had_valid_contract: boolean | null
          id: string
          initiated_by: string | null
          initiated_by_name: string | null
          monthly_value: number | null
          product_name: string
          product_slug: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id: string
          created_at?: string
          distrato_entered_at?: string
          distrato_step?: string
          exit_reason?: string | null
          exit_satisfaction_score?: number | null
          had_valid_contract?: boolean | null
          id?: string
          initiated_by?: string | null
          initiated_by_name?: string | null
          monthly_value?: number | null
          product_name: string
          product_slug: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          client_id?: string
          created_at?: string
          distrato_entered_at?: string
          distrato_step?: string
          exit_reason?: string | null
          exit_satisfaction_score?: number | null
          had_valid_contract?: boolean | null
          id?: string
          initiated_by?: string | null
          initiated_by_name?: string | null
          monthly_value?: number | null
          product_name?: string
          product_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_churns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_values: {
        Row: {
          client_id: string
          created_at: string
          id: string
          monthly_value: number
          product_name: string
          product_slug: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          monthly_value?: number
          product_name: string
          product_slug: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          monthly_value?: number
          product_name?: string
          product_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_values_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_results_reports: {
        Row: {
          achievements: string | null
          actions_last_30_days: string | null
          client_id: string
          client_logo_url: string | null
          created_at: string
          created_by: string
          custom_content: Json | null
          cycle_end_date: string
          cycle_start_date: string
          id: string
          improvement_points: string | null
          is_published: boolean | null
          key_metrics: string | null
          next_30_days: string | null
          next_steps: string | null
          pdf_url: string | null
          public_token: string | null
          section_images: Json | null
          top_campaign: string | null
          traffic_results: string | null
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          actions_last_30_days?: string | null
          client_id: string
          client_logo_url?: string | null
          created_at?: string
          created_by: string
          custom_content?: Json | null
          cycle_end_date: string
          cycle_start_date: string
          id?: string
          improvement_points?: string | null
          is_published?: boolean | null
          key_metrics?: string | null
          next_30_days?: string | null
          next_steps?: string | null
          pdf_url?: string | null
          public_token?: string | null
          section_images?: Json | null
          top_campaign?: string | null
          traffic_results?: string | null
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          actions_last_30_days?: string | null
          client_id?: string
          client_logo_url?: string | null
          created_at?: string
          created_by?: string
          custom_content?: Json | null
          cycle_end_date?: string
          cycle_start_date?: string
          id?: string
          improvement_points?: string | null
          is_published?: boolean | null
          key_metrics?: string | null
          next_30_days?: string | null
          next_steps?: string | null
          pdf_url?: string | null
          public_token?: string | null
          section_images?: Json | null
          top_campaign?: string | null
          traffic_results?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_results_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sales: {
        Row: {
          client_id: string
          created_at: string
          id: string
          registered_by: string
          sale_date: string
          sale_value: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          registered_by: string
          sale_date?: string
          sale_value: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          registered_by?: string
          sale_date?: string
          sale_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_strategies: {
        Row: {
          ad_location: string | null
          client_id: string
          client_material_details: string | null
          created_at: string
          created_by: string
          custom_funnels: Json | null
          google_display: Json | null
          google_enabled: boolean | null
          google_pesquisa: Json | null
          google_pmax: Json | null
          id: string
          is_published: boolean | null
          linkedin_cadastro: Json | null
          linkedin_enabled: boolean | null
          linkedin_vagas: Json | null
          meta_aumento_base: Json | null
          meta_captacao_representantes: Json | null
          meta_captacao_sdr: Json | null
          meta_disparo_email: Json | null
          meta_enabled: boolean | null
          meta_grupo_vip: Json | null
          meta_millennials_cadastro: Json | null
          meta_millennials_call: Json | null
          meta_millennials_mensagem: Json | null
          minimum_investment: number | null
          profile_bio: Json | null
          profile_destaques: Json | null
          profile_lp_site: Json | null
          profile_posts: Json | null
          public_token: string | null
          recommended_investment: number | null
          updated_at: string
          use_client_material: boolean | null
        }
        Insert: {
          ad_location?: string | null
          client_id: string
          client_material_details?: string | null
          created_at?: string
          created_by: string
          custom_funnels?: Json | null
          google_display?: Json | null
          google_enabled?: boolean | null
          google_pesquisa?: Json | null
          google_pmax?: Json | null
          id?: string
          is_published?: boolean | null
          linkedin_cadastro?: Json | null
          linkedin_enabled?: boolean | null
          linkedin_vagas?: Json | null
          meta_aumento_base?: Json | null
          meta_captacao_representantes?: Json | null
          meta_captacao_sdr?: Json | null
          meta_disparo_email?: Json | null
          meta_enabled?: boolean | null
          meta_grupo_vip?: Json | null
          meta_millennials_cadastro?: Json | null
          meta_millennials_call?: Json | null
          meta_millennials_mensagem?: Json | null
          minimum_investment?: number | null
          profile_bio?: Json | null
          profile_destaques?: Json | null
          profile_lp_site?: Json | null
          profile_posts?: Json | null
          public_token?: string | null
          recommended_investment?: number | null
          updated_at?: string
          use_client_material?: boolean | null
        }
        Update: {
          ad_location?: string | null
          client_id?: string
          client_material_details?: string | null
          created_at?: string
          created_by?: string
          custom_funnels?: Json | null
          google_display?: Json | null
          google_enabled?: boolean | null
          google_pesquisa?: Json | null
          google_pmax?: Json | null
          id?: string
          is_published?: boolean | null
          linkedin_cadastro?: Json | null
          linkedin_enabled?: boolean | null
          linkedin_vagas?: Json | null
          meta_aumento_base?: Json | null
          meta_captacao_representantes?: Json | null
          meta_captacao_sdr?: Json | null
          meta_disparo_email?: Json | null
          meta_enabled?: boolean | null
          meta_grupo_vip?: Json | null
          meta_millennials_cadastro?: Json | null
          meta_millennials_call?: Json | null
          meta_millennials_mensagem?: Json | null
          minimum_investment?: number | null
          profile_bio?: Json | null
          profile_destaques?: Json | null
          profile_lp_site?: Json | null
          profile_posts?: Json | null
          public_token?: string | null
          recommended_investment?: number | null
          updated_at?: string
          use_client_material?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "client_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived: boolean
          archived_at: string | null
          assigned_ads_manager: string | null
          assigned_comercial: string | null
          assigned_crm: string | null
          assigned_mktplace: string | null
          assigned_outbound_manager: string | null
          assigned_rh: string | null
          assigned_sucesso_cliente: string | null
          campaign_published_at: string | null
          client_label: string | null
          cnpj: string | null
          comercial_entered_at: string | null
          comercial_onboarding_started_at: string | null
          comercial_status: string | null
          contract_duration_months: number | null
          contracted_products: string[] | null
          cpf: string | null
          created_at: string
          created_by: string | null
          crm_entered_at: string | null
          crm_status: string | null
          cs_classification: string | null
          cs_classification_reason: string | null
          cx_validated_at: string | null
          cx_validated_by: string | null
          cx_validation_notes: string | null
          cx_validation_status: string | null
          distrato_entered_at: string | null
          distrato_step: string | null
          entry_date: string | null
          expected_investment: number | null
          finance_display_name: string | null
          general_info: string | null
          group_id: string | null
          id: string
          last_cs_contact_at: string | null
          mktplace_entered_at: string | null
          mktplace_status: string | null
          monthly_value: number | null
          name: string
          niche: string | null
          onboarding_started_at: string | null
          paddock_diagnostico_link: string | null
          paddock_diagnostico_submitted_at: string | null
          paddock_onboarding_step: string | null
          payment_due_day: number | null
          phone: string | null
          razao_social: string | null
          sales_percentage: number
          squad_id: string | null
          status: string | null
          torque_crm_products: string[]
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_ads_manager?: string | null
          assigned_comercial?: string | null
          assigned_crm?: string | null
          assigned_mktplace?: string | null
          assigned_outbound_manager?: string | null
          assigned_rh?: string | null
          assigned_sucesso_cliente?: string | null
          campaign_published_at?: string | null
          client_label?: string | null
          cnpj?: string | null
          comercial_entered_at?: string | null
          comercial_onboarding_started_at?: string | null
          comercial_status?: string | null
          contract_duration_months?: number | null
          contracted_products?: string[] | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          crm_entered_at?: string | null
          crm_status?: string | null
          cs_classification?: string | null
          cs_classification_reason?: string | null
          cx_validated_at?: string | null
          cx_validated_by?: string | null
          cx_validation_notes?: string | null
          cx_validation_status?: string | null
          distrato_entered_at?: string | null
          distrato_step?: string | null
          entry_date?: string | null
          expected_investment?: number | null
          finance_display_name?: string | null
          general_info?: string | null
          group_id?: string | null
          id?: string
          last_cs_contact_at?: string | null
          mktplace_entered_at?: string | null
          mktplace_status?: string | null
          monthly_value?: number | null
          name: string
          niche?: string | null
          onboarding_started_at?: string | null
          paddock_diagnostico_link?: string | null
          paddock_diagnostico_submitted_at?: string | null
          paddock_onboarding_step?: string | null
          payment_due_day?: number | null
          phone?: string | null
          razao_social?: string | null
          sales_percentage?: number
          squad_id?: string | null
          status?: string | null
          torque_crm_products?: string[]
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_ads_manager?: string | null
          assigned_comercial?: string | null
          assigned_crm?: string | null
          assigned_mktplace?: string | null
          assigned_outbound_manager?: string | null
          assigned_rh?: string | null
          assigned_sucesso_cliente?: string | null
          campaign_published_at?: string | null
          client_label?: string | null
          cnpj?: string | null
          comercial_entered_at?: string | null
          comercial_onboarding_started_at?: string | null
          comercial_status?: string | null
          contract_duration_months?: number | null
          contracted_products?: string[] | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          crm_entered_at?: string | null
          crm_status?: string | null
          cs_classification?: string | null
          cs_classification_reason?: string | null
          cx_validated_at?: string | null
          cx_validated_by?: string | null
          cx_validation_notes?: string | null
          cx_validation_status?: string | null
          distrato_entered_at?: string | null
          distrato_step?: string | null
          entry_date?: string | null
          expected_investment?: number | null
          finance_display_name?: string | null
          general_info?: string | null
          group_id?: string | null
          id?: string
          last_cs_contact_at?: string | null
          mktplace_entered_at?: string | null
          mktplace_status?: string | null
          monthly_value?: number | null
          name?: string
          niche?: string | null
          onboarding_started_at?: string | null
          paddock_diagnostico_link?: string | null
          paddock_diagnostico_submitted_at?: string | null
          paddock_onboarding_step?: string | null
          payment_due_day?: number | null
          phone?: string | null
          razao_social?: string | null
          sales_percentage?: number
          squad_id?: string | null
          status?: string | null
          torque_crm_products?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_client_documentation: {
        Row: {
          client_id: string | null
          combinado_deadline: string | null
          combinado_description: string | null
          comercial_user_id: string
          created_at: string
          documentation_date: string
          has_combinado: boolean
          help_description: string
          helped_client: boolean
          id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          combinado_deadline?: string | null
          combinado_description?: string | null
          comercial_user_id: string
          created_at?: string
          documentation_date?: string
          has_combinado?: boolean
          help_description: string
          helped_client?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          combinado_deadline?: string | null
          combinado_description?: string | null
          comercial_user_id?: string
          created_at?: string
          documentation_date?: string
          has_combinado?: boolean
          help_description?: string
          helped_client?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_client_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_daily_documentation: {
        Row: {
          actions_done: string | null
          client_id: string | null
          content: string | null
          created_at: string
          documentation_date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actions_done?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actions_done?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_daily_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_delay_justifications: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          client_name: string | null
          created_at: string
          id: string
          justification: string
          notification_id: string
          notification_type: string
          user_id: string
          user_name: string
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          justification: string
          notification_id: string
          notification_type: string
          user_id: string
          user_name: string
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          justification?: string
          notification_id?: string
          notification_type?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_delay_justifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "comercial_delay_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_delay_notifications: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          due_date: string | null
          id: string
          notification_type: string
          task_id: string | null
          task_title: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notification_type: string
          task_id?: string | null
          task_title?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notification_type?: string
          task_id?: string | null
          task_title?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_delay_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comercial_delay_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "comercial_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_tasks: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          auto_task_type: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_auto_generated: boolean | null
          justification: string | null
          justification_at: string | null
          priority: string | null
          related_client_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          auto_task_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          related_client_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          auto_task_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_auto_generated?: boolean | null
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          related_client_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_tasks_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_tracking: {
        Row: {
          client_id: string
          comercial_user_id: string
          created_at: string
          current_day: string | null
          id: string
          is_delayed: boolean | null
          last_moved_at: string | null
          manager_id: string
          manager_name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          comercial_user_id: string
          created_at?: string
          current_day?: string | null
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string | null
          manager_id: string
          manager_name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          comercial_user_id?: string
          created_at?: string
          current_day?: string | null
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string | null
          manager_id?: string
          manager_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_records: {
        Row: {
          client_id: string
          commission_value: number
          created_at: string
          id: string
          sale_id: string
          user_id: string
          user_role: string
        }
        Insert: {
          client_id: string
          commission_value: number
          created_at?: string
          id?: string
          sale_id: string
          user_id: string
          user_role: string
        }
        Update: {
          client_id?: string
          commission_value?: number
          created_at?: string
          id?: string
          sale_id?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_records_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "client_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      company_content: {
        Row: {
          content: string | null
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contas_receber_value_adjustments: {
        Row: {
          contas_receber_id: string
          created_at: string
          id: string
          justification: string
          new_value: number
          original_value: number
          scope: string
          user_id: string
        }
        Insert: {
          contas_receber_id: string
          created_at?: string
          id?: string
          justification: string
          new_value: number
          original_value: number
          scope: string
          user_id: string
        }
        Update: {
          contas_receber_id?: string
          created_at?: string
          id?: string
          justification?: string
          new_value?: number
          original_value?: number
          scope?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_value_adjustments_contas_receber_id_fkey"
            columns: ["contas_receber_id"]
            isOneToOne: false
            referencedRelation: "financeiro_contas_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_configuracoes: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          current_step: string
          finalizado_at: string | null
          form_data: Json
          gestor_id: string
          id: string
          is_finalizado: boolean
          produto: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          current_step?: string
          finalizado_at?: string | null
          form_data?: Json
          gestor_id: string
          id?: string
          is_finalizado?: boolean
          produto: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_step?: string
          finalizado_at?: string | null
          form_data?: Json
          gestor_id?: string
          id?: string
          is_finalizado?: boolean
          produto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_configuracoes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_daily_documentation: {
        Row: {
          client_id: string | null
          combinado: string | null
          combinado_descricao: string | null
          combinado_justificativa: string | null
          combinado_prazo: string | null
          created_at: string
          documentation_date: string
          falou_com_cliente: string | null
          falou_justificativa: string | null
          fez_algo_descricao: string | null
          fez_algo_justificativa: string | null
          fez_algo_novo: string | null
          gestor_id: string
          id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          combinado?: string | null
          combinado_descricao?: string | null
          combinado_justificativa?: string | null
          combinado_prazo?: string | null
          created_at?: string
          documentation_date?: string
          falou_com_cliente?: string | null
          falou_justificativa?: string | null
          fez_algo_descricao?: string | null
          fez_algo_justificativa?: string | null
          fez_algo_novo?: string | null
          gestor_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          combinado?: string | null
          combinado_descricao?: string | null
          combinado_justificativa?: string | null
          combinado_prazo?: string | null
          created_at?: string
          documentation_date?: string
          falou_com_cliente?: string | null
          falou_justificativa?: string | null
          fez_algo_descricao?: string | null
          fez_algo_justificativa?: string | null
          fez_algo_novo?: string | null
          gestor_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_daily_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_daily_tracking: {
        Row: {
          client_id: string
          created_at: string
          current_day: string
          gestor_id: string
          id: string
          is_delayed: boolean | null
          last_moved_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          current_day?: string
          gestor_id: string
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          current_day?: string
          gestor_id?: string
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_daily_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_delay_justification_pending: {
        Row: {
          client_id: string
          config_id: string
          detected_at: string
          dismissed_at: string | null
          dismissed_reason: string | null
          id: string
          justification_id: string | null
          justified_at: string | null
          notification_id: string | null
          user_id: string
          user_role: string
        }
        Insert: {
          client_id: string
          config_id: string
          detected_at?: string
          dismissed_at?: string | null
          dismissed_reason?: string | null
          id?: string
          justification_id?: string | null
          justified_at?: string | null
          notification_id?: string | null
          user_id: string
          user_role: string
        }
        Update: {
          client_id?: string
          config_id?: string
          detected_at?: string
          dismissed_at?: string | null
          dismissed_reason?: string | null
          id?: string
          justification_id?: string | null
          justified_at?: string | null
          notification_id?: string | null
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_delay_justification_pending_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_delay_justification_pending_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "crm_configuracoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_delay_justification_pending_justification_id_fkey"
            columns: ["justification_id"]
            isOneToOne: false
            referencedRelation: "task_delay_justifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_delay_justification_pending_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "task_delay_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_action_manuals: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_action_plan_tasks: {
        Row: {
          action_plan_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          position: number | null
          task_type: string
          title: string
        }
        Insert: {
          action_plan_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          task_type: string
          title: string
        }
        Update: {
          action_plan_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          position?: number | null
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_action_plan_tasks_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "cs_action_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_action_plans: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          due_date: string
          id: string
          indicators: string[] | null
          notes: string | null
          problem_type: string
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          indicators?: string[] | null
          notes?: string | null
          problem_type: string
          severity: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          indicators?: string[] | null
          notes?: string | null
          problem_type?: string
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_action_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_contact_history: {
        Row: {
          client_id: string
          contact_type: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          contact_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          contact_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_contact_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_exit_reasons: {
        Row: {
          additional_feedback: string | null
          client_id: string
          client_name: string
          created_at: string
          created_by: string | null
          id: string
          is_submitted: boolean | null
          main_reason: string | null
          public_token: string | null
          satisfaction_score: number | null
          submitted_at: string | null
          what_could_improve: string | null
          would_recommend: boolean | null
        }
        Insert: {
          additional_feedback?: string | null
          client_id: string
          client_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_submitted?: boolean | null
          main_reason?: string | null
          public_token?: string | null
          satisfaction_score?: number | null
          submitted_at?: string | null
          what_could_improve?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          additional_feedback?: string | null
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_submitted?: boolean | null
          main_reason?: string | null
          public_token?: string | null
          satisfaction_score?: number | null
          submitted_at?: string | null
          what_could_improve?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_exit_reasons_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_insights: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          allowed_pages: string[] | null
          created_at: string | null
          created_by: string
          display_name: string
          id: string
          is_viewer: boolean | null
          name: string
          squad_id: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_pages?: string[] | null
          created_at?: string | null
          created_by: string
          display_name: string
          id?: string
          is_viewer?: boolean | null
          name: string
          squad_id?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_pages?: string[] | null
          created_at?: string | null
          created_by?: string
          display_name?: string
          id?: string
          is_viewer?: boolean | null
          name?: string
          squad_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      department_tasks: {
        Row: {
          archived: boolean
          archived_at: string | null
          created_at: string
          department: string
          description: string | null
          due_date: string | null
          id: string
          justification: string | null
          justification_at: string | null
          priority: string | null
          related_client_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          department: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          related_client_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          department?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          priority?: string | null
          related_client_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_tasks_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      design_briefings: {
        Row: {
          card_id: string
          client_instagram: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          identity_url: string | null
          references_url: string | null
          script_url: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identity_url?: string | null
          references_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          identity_url?: string | null
          references_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_briefings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      design_completion_notifications: {
        Row: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          requester_id: string
          requester_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id: string
          requester_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          completed_by?: string
          completed_by_name?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id?: string
          requester_name?: string
        }
        Relationships: []
      }
      design_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          card_id: string
          created_at: string
          designer_id: string
          designer_name: string
          id: string
          justification: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id: string
          created_at?: string
          designer_id: string
          designer_name: string
          id?: string
          justification: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id?: string
          created_at?: string
          designer_id?: string
          designer_name?: string
          id?: string
          justification?: string
        }
        Relationships: []
      }
      design_delay_notifications: {
        Row: {
          card_id: string
          card_title: string
          created_at: string
          designer_id: string
          designer_name: string
          due_date: string
          id: string
        }
        Insert: {
          card_id: string
          card_title: string
          created_at?: string
          designer_id: string
          designer_name: string
          due_date: string
          id?: string
        }
        Update: {
          card_id?: string
          card_title?: string
          created_at?: string
          designer_id?: string
          designer_name?: string
          due_date?: string
          id?: string
        }
        Relationships: []
      }
      design_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dev_briefings: {
        Row: {
          card_id: string
          created_at: string
          created_by: string | null
          id: string
          identity_url: string | null
          materials_url: string | null
          observations: string | null
          reference_video_url: string | null
          script_url: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_url?: string | null
          materials_url?: string | null
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_url?: string | null
          materials_url?: string | null
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_briefings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_completion_notifications: {
        Row: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          requester_id: string
          requester_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id: string
          requester_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          completed_by?: string
          completed_by_name?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id?: string
          requester_name?: string
        }
        Relationships: []
      }
      dev_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          card_id: string
          created_at: string
          dev_id: string
          dev_name: string
          id: string
          justification: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id: string
          created_at?: string
          dev_id: string
          dev_name: string
          id?: string
          justification: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id?: string
          created_at?: string
          dev_id?: string
          dev_name?: string
          id?: string
          justification?: string
        }
        Relationships: []
      }
      dev_delay_notifications: {
        Row: {
          card_id: string
          card_title: string
          created_at: string
          dev_id: string
          dev_name: string
          due_date: string
          id: string
        }
        Insert: {
          card_id: string
          card_title: string
          created_at?: string
          dev_id: string
          dev_name: string
          due_date: string
          id?: string
        }
        Update: {
          card_id?: string
          card_title?: string
          created_at?: string
          dev_id?: string
          dev_name?: string
          due_date?: string
          id?: string
        }
        Relationships: []
      }
      dev_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          allowed_users: string[]
          description: string | null
          enabled: boolean
          key: string
          rollout_percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_users?: string[]
          description?: string | null
          enabled?: boolean
          key: string
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_users?: string[]
          description?: string | null
          enabled?: boolean
          key?: string
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      financeiro_active_clients: {
        Row: {
          activated_at: string
          client_id: string
          contract_expires_at: string | null
          created_at: string
          id: string
          invoice_status: string
          monthly_value: number
          product_name: string
          product_slug: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          client_id: string
          contract_expires_at?: string | null
          created_at?: string
          id?: string
          invoice_status?: string
          monthly_value?: number
          product_name: string
          product_slug: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          client_id?: string
          contract_expires_at?: string | null
          created_at?: string
          id?: string
          invoice_status?: string
          monthly_value?: number
          product_name?: string
          product_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_active_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_client_onboarding: {
        Row: {
          client_id: string
          contract_expiration_date: string | null
          created_at: string
          current_step: string
          id: string
          product_name: string
          product_slug: string
          step_cadastro_asaas_at: string | null
          step_contrato_assinado_at: string | null
          step_contrato_enviado_at: string | null
          step_contrato_juridico_at: string | null
          step_esperando_assinatura_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_expiration_date?: string | null
          created_at?: string
          current_step?: string
          id?: string
          product_name: string
          product_slug: string
          step_cadastro_asaas_at?: string | null
          step_contrato_assinado_at?: string | null
          step_contrato_enviado_at?: string | null
          step_contrato_juridico_at?: string | null
          step_esperando_assinatura_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_expiration_date?: string | null
          created_at?: string
          current_step?: string
          id?: string
          product_name?: string
          product_slug?: string
          step_cadastro_asaas_at?: string | null
          step_contrato_assinado_at?: string | null
          step_contrato_enviado_at?: string | null
          step_contrato_juridico_at?: string | null
          step_esperando_assinatura_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_client_onboarding_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_contas_pagar: {
        Row: {
          area: string | null
          categoria: string
          created_at: string
          fornecedor: string
          id: string
          mes_referencia: string
          produtos_vinculados: string[] | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          area?: string | null
          categoria: string
          created_at?: string
          fornecedor: string
          id?: string
          mes_referencia: string
          produtos_vinculados?: string[] | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          area?: string | null
          categoria?: string
          created_at?: string
          fornecedor?: string
          id?: string
          mes_referencia?: string
          produtos_vinculados?: string[] | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      financeiro_contas_receber: {
        Row: {
          area: string | null
          client_id: string | null
          created_at: string
          id: string
          inadimplencia_count: number
          is_recurring: boolean
          mes_referencia: string
          produto_slug: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          area?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          inadimplencia_count?: number
          is_recurring?: boolean
          mes_referencia: string
          produto_slug?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          area?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          inadimplencia_count?: number
          is_recurring?: boolean
          mes_referencia?: string
          produto_slug?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_contas_receber_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_custos_produto: {
        Row: {
          created_at: string
          created_by: string
          custo_ferramentas: number | null
          custo_marketing: number | null
          custo_pessoal: number | null
          custo_terceiros: number | null
          departamento_id: string | null
          descricao_outros: string | null
          id: string
          mes_referencia: string
          notas: string | null
          outros_custos: number | null
          produto_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          custo_ferramentas?: number | null
          custo_marketing?: number | null
          custo_pessoal?: number | null
          custo_terceiros?: number | null
          departamento_id?: string | null
          descricao_outros?: string | null
          id?: string
          mes_referencia: string
          notas?: string | null
          outros_custos?: number | null
          produto_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          custo_ferramentas?: number | null
          custo_marketing?: number | null
          custo_pessoal?: number | null
          custo_terceiros?: number | null
          departamento_id?: string | null
          descricao_outros?: string | null
          id?: string
          mes_referencia?: string
          notas?: string | null
          outros_custos?: number | null
          produto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_custos_produto_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_produto_departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_custos_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "financeiro_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_dre: {
        Row: {
          cmv_produtos: number | null
          cmv_servicos: number | null
          created_at: string
          created_by: string
          deducoes_descontos: number | null
          deducoes_impostos: number | null
          despesas_administrativas: number | null
          despesas_comerciais: number | null
          despesas_financeiras: number | null
          despesas_marketing: number | null
          despesas_ocupacao: number | null
          despesas_pessoal: number | null
          despesas_ti: number | null
          id: string
          impostos_lucro: number | null
          mes_referencia: string
          notas: string | null
          outras_deducoes: number | null
          outras_despesas: number | null
          outras_despesas_operacionais: number | null
          outras_receitas: number | null
          outros_cmv: number | null
          receita_bruta: number | null
          receitas_financeiras: number | null
          updated_at: string
        }
        Insert: {
          cmv_produtos?: number | null
          cmv_servicos?: number | null
          created_at?: string
          created_by: string
          deducoes_descontos?: number | null
          deducoes_impostos?: number | null
          despesas_administrativas?: number | null
          despesas_comerciais?: number | null
          despesas_financeiras?: number | null
          despesas_marketing?: number | null
          despesas_ocupacao?: number | null
          despesas_pessoal?: number | null
          despesas_ti?: number | null
          id?: string
          impostos_lucro?: number | null
          mes_referencia: string
          notas?: string | null
          outras_deducoes?: number | null
          outras_despesas?: number | null
          outras_despesas_operacionais?: number | null
          outras_receitas?: number | null
          outros_cmv?: number | null
          receita_bruta?: number | null
          receitas_financeiras?: number | null
          updated_at?: string
        }
        Update: {
          cmv_produtos?: number | null
          cmv_servicos?: number | null
          created_at?: string
          created_by?: string
          deducoes_descontos?: number | null
          deducoes_impostos?: number | null
          despesas_administrativas?: number | null
          despesas_comerciais?: number | null
          despesas_financeiras?: number | null
          despesas_marketing?: number | null
          despesas_ocupacao?: number | null
          despesas_pessoal?: number | null
          despesas_ti?: number | null
          id?: string
          impostos_lucro?: number | null
          mes_referencia?: string
          notas?: string | null
          outras_deducoes?: number | null
          outras_despesas?: number | null
          outras_despesas_operacionais?: number | null
          outras_receitas?: number | null
          outros_cmv?: number | null
          receita_bruta?: number | null
          receitas_financeiras?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_kanban_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_produto_departamentos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          position: number | null
          produto_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          position?: number | null
          produto_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          position?: number | null
          produto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_produto_departamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "financeiro_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_produtos: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          position: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          position?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          position?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_receita_produto: {
        Row: {
          clientes_ativos: number | null
          created_at: string
          created_by: string
          id: string
          mes_referencia: string
          notas: string | null
          outras_receitas: number | null
          produto_id: string
          receita_avulsa: number | null
          receita_recorrente: number | null
          updated_at: string
        }
        Insert: {
          clientes_ativos?: number | null
          created_at?: string
          created_by: string
          id?: string
          mes_referencia: string
          notas?: string | null
          outras_receitas?: number | null
          produto_id: string
          receita_avulsa?: number | null
          receita_recorrente?: number | null
          updated_at?: string
        }
        Update: {
          clientes_ativos?: number | null
          created_at?: string
          created_by?: string
          id?: string
          mes_referencia?: string
          notas?: string | null
          outras_receitas?: number | null
          produto_id?: string
          receita_avulsa?: number | null
          receita_recorrente?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_receita_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "financeiro_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_tasks: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          product_name: string
          product_slug: string
          status: string
          title: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          product_name: string
          product_slug: string
          status?: string
          title: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          product_name?: string
          product_slug?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      group_role_limits: {
        Row: {
          created_at: string
          group_id: string
          id: string
          max_count: number
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          max_count?: number
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          max_count?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_role_limits_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      independent_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      kanban_boards: {
        Row: {
          allowed_roles: string[]
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          group_id: string | null
          id: string
          name: string
          owner_user_id: string | null
          page_slug: string | null
          product_category_id: string | null
          slug: string
          squad_id: string | null
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          page_slug?: string | null
          product_category_id?: string | null
          slug: string
          squad_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          page_slug?: string | null
          product_category_id?: string | null
          slug?: string
          squad_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_boards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "independent_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_boards_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_boards_page_slug_fkey"
            columns: ["page_slug"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "kanban_boards_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_boards_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          archived: boolean
          archived_at: string | null
          assigned_to: string | null
          board_id: string
          card_type: string | null
          client_id: string | null
          column_id: string
          created_at: string
          created_by: string | null
          creatives_quantity: number | null
          description: string | null
          due_date: string | null
          id: string
          justification: string | null
          justification_at: string | null
          position: number
          priority: string | null
          progress: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          board_id: string
          card_type?: string | null
          client_id?: string | null
          column_id: string
          created_at?: string
          created_by?: string | null
          creatives_quantity?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          position?: number
          priority?: string | null
          progress?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          board_id?: string
          card_type?: string | null
          client_id?: string | null
          column_id?: string
          created_at?: string
          created_by?: string | null
          creatives_quantity?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          position?: number
          priority?: string | null
          progress?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          board_id: string
          color: string | null
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_folders: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meetings_one_on_one: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          cases_da_semana: string[]
          correct_client_movement: boolean | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          delay_automation: boolean | null
          delay_crm: boolean | null
          delay_design: boolean | null
          delay_site: boolean | null
          delay_video: boolean | null
          documentation_up_to_date: boolean | null
          evaluated_manager_id: string
          evaluated_manager_name: string
          general_observations: string | null
          id: string
          main_challenges: string[] | null
          meeting_date: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          cases_da_semana?: string[]
          correct_client_movement?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          delay_automation?: boolean | null
          delay_crm?: boolean | null
          delay_design?: boolean | null
          delay_site?: boolean | null
          delay_video?: boolean | null
          documentation_up_to_date?: boolean | null
          evaluated_manager_id: string
          evaluated_manager_name: string
          general_observations?: string | null
          id?: string
          main_challenges?: string[] | null
          meeting_date?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          cases_da_semana?: string[]
          correct_client_movement?: boolean | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          delay_automation?: boolean | null
          delay_crm?: boolean | null
          delay_design?: boolean | null
          delay_site?: boolean | null
          delay_video?: boolean | null
          documentation_up_to_date?: boolean | null
          evaluated_manager_id?: string
          evaluated_manager_name?: string
          general_observations?: string | null
          id?: string
          main_challenges?: string[] | null
          meeting_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mktplace_daily_documentation: {
        Row: {
          client_id: string | null
          combinado: string | null
          combinado_descricao: string | null
          combinado_justificativa: string | null
          combinado_prazo: string | null
          consultor_id: string
          created_at: string
          documentation_date: string
          falou_com_cliente: string | null
          falou_justificativa: string | null
          fez_algo_descricao: string | null
          fez_algo_justificativa: string | null
          fez_algo_novo: string | null
          id: string
          tracking_type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          combinado?: string | null
          combinado_descricao?: string | null
          combinado_justificativa?: string | null
          combinado_prazo?: string | null
          consultor_id: string
          created_at?: string
          documentation_date?: string
          falou_com_cliente?: string | null
          falou_justificativa?: string | null
          fez_algo_descricao?: string | null
          fez_algo_justificativa?: string | null
          fez_algo_novo?: string | null
          id?: string
          tracking_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          combinado?: string | null
          combinado_descricao?: string | null
          combinado_justificativa?: string | null
          combinado_prazo?: string | null
          consultor_id?: string
          created_at?: string
          documentation_date?: string
          falou_com_cliente?: string | null
          falou_justificativa?: string | null
          fez_algo_descricao?: string | null
          fez_algo_justificativa?: string | null
          fez_algo_novo?: string | null
          id?: string
          tracking_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mktplace_daily_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mktplace_daily_tracking: {
        Row: {
          client_id: string
          consultor_id: string
          created_at: string
          current_day: string
          id: string
          is_delayed: boolean | null
          last_moved_at: string
          tracking_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          consultor_id: string
          created_at?: string
          current_day?: string
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string
          tracking_type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          consultor_id?: string
          created_at?: string
          current_day?: string
          id?: string
          is_delayed?: boolean | null
          last_moved_at?: string
          tracking_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mktplace_daily_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mktplace_diagnosticos: {
        Row: {
          acompanha_concorrentes: string | null
          acompanha_metricas_conv: string | null
          atendimento_bom: string | null
          cadastro_fraco: string | null
          cancelamentos_falha: string | null
          categoria_principal: string | null
          client_id: string
          cliente_nome: string | null
          consultor_id: string
          conversao_saudavel: string | null
          corrigir_imediatamente: string | null
          created_at: string
          data_consultoria: string | null
          depende_uma_pessoa: string | null
          descricoes_boas: string | null
          diferenciais_claros: string | null
          entende_margem: string | null
          estoque_sincronizado: string | null
          estrategia_crescimento: string | null
          estrategia_precificacao: string | null
          faturamento_atual: number | null
          ficha_tecnica_completa: string | null
          frete_impacta: string | null
          gerar_faturamento_rapido: string | null
          id: string
          imagens_profissionais: string | null
          is_published: boolean | null
          logistica_prejudica: string | null
          marketplace_principal: string | null
          melhorar_medio_prazo: string | null
          meta_faturamento: number | null
          midia_estrategica: string | null
          muitas_reclamacoes: string | null
          obs_anuncios: string | null
          obs_conversao: string | null
          obs_crescimento: string | null
          obs_estoque: string | null
          obs_estrutura: string | null
          obs_preco: string | null
          obs_reputacao: string | null
          observacoes_finais: string | null
          observacoes_gerais: string | null
          operacao_organizada: string | null
          otimizacao_continua: string | null
          outros_marketplaces: string | null
          padronizacao_visual: string | null
          plano_escalar: string | null
          potencial_mal_aproveitado: string | null
          prazo_envio_bom: string | null
          precos_competitivos: string | null
          principais_gargalos: string | null
          principais_oportunidades: string | null
          priorizacao_potencial: string | null
          processo_claro: string | null
          produtos_visita_convertem: string | null
          public_token: string | null
          quantidade_skus: number | null
          reputacao_saudavel: string | null
          responde_rapido: string | null
          responsavel_diagnostico: string | null
          responsavel_interno: string | null
          rotina_metricas: string | null
          ruptura_frequente: string | null
          tempo_resposta_adequado: string | null
          ticket_medio: number | null
          titulos_bons: string | null
          updated_at: string
          usa_midia_paga: string | null
        }
        Insert: {
          acompanha_concorrentes?: string | null
          acompanha_metricas_conv?: string | null
          atendimento_bom?: string | null
          cadastro_fraco?: string | null
          cancelamentos_falha?: string | null
          categoria_principal?: string | null
          client_id: string
          cliente_nome?: string | null
          consultor_id: string
          conversao_saudavel?: string | null
          corrigir_imediatamente?: string | null
          created_at?: string
          data_consultoria?: string | null
          depende_uma_pessoa?: string | null
          descricoes_boas?: string | null
          diferenciais_claros?: string | null
          entende_margem?: string | null
          estoque_sincronizado?: string | null
          estrategia_crescimento?: string | null
          estrategia_precificacao?: string | null
          faturamento_atual?: number | null
          ficha_tecnica_completa?: string | null
          frete_impacta?: string | null
          gerar_faturamento_rapido?: string | null
          id?: string
          imagens_profissionais?: string | null
          is_published?: boolean | null
          logistica_prejudica?: string | null
          marketplace_principal?: string | null
          melhorar_medio_prazo?: string | null
          meta_faturamento?: number | null
          midia_estrategica?: string | null
          muitas_reclamacoes?: string | null
          obs_anuncios?: string | null
          obs_conversao?: string | null
          obs_crescimento?: string | null
          obs_estoque?: string | null
          obs_estrutura?: string | null
          obs_preco?: string | null
          obs_reputacao?: string | null
          observacoes_finais?: string | null
          observacoes_gerais?: string | null
          operacao_organizada?: string | null
          otimizacao_continua?: string | null
          outros_marketplaces?: string | null
          padronizacao_visual?: string | null
          plano_escalar?: string | null
          potencial_mal_aproveitado?: string | null
          prazo_envio_bom?: string | null
          precos_competitivos?: string | null
          principais_gargalos?: string | null
          principais_oportunidades?: string | null
          priorizacao_potencial?: string | null
          processo_claro?: string | null
          produtos_visita_convertem?: string | null
          public_token?: string | null
          quantidade_skus?: number | null
          reputacao_saudavel?: string | null
          responde_rapido?: string | null
          responsavel_diagnostico?: string | null
          responsavel_interno?: string | null
          rotina_metricas?: string | null
          ruptura_frequente?: string | null
          tempo_resposta_adequado?: string | null
          ticket_medio?: number | null
          titulos_bons?: string | null
          updated_at?: string
          usa_midia_paga?: string | null
        }
        Update: {
          acompanha_concorrentes?: string | null
          acompanha_metricas_conv?: string | null
          atendimento_bom?: string | null
          cadastro_fraco?: string | null
          cancelamentos_falha?: string | null
          categoria_principal?: string | null
          client_id?: string
          cliente_nome?: string | null
          consultor_id?: string
          conversao_saudavel?: string | null
          corrigir_imediatamente?: string | null
          created_at?: string
          data_consultoria?: string | null
          depende_uma_pessoa?: string | null
          descricoes_boas?: string | null
          diferenciais_claros?: string | null
          entende_margem?: string | null
          estoque_sincronizado?: string | null
          estrategia_crescimento?: string | null
          estrategia_precificacao?: string | null
          faturamento_atual?: number | null
          ficha_tecnica_completa?: string | null
          frete_impacta?: string | null
          gerar_faturamento_rapido?: string | null
          id?: string
          imagens_profissionais?: string | null
          is_published?: boolean | null
          logistica_prejudica?: string | null
          marketplace_principal?: string | null
          melhorar_medio_prazo?: string | null
          meta_faturamento?: number | null
          midia_estrategica?: string | null
          muitas_reclamacoes?: string | null
          obs_anuncios?: string | null
          obs_conversao?: string | null
          obs_crescimento?: string | null
          obs_estoque?: string | null
          obs_estrutura?: string | null
          obs_preco?: string | null
          obs_reputacao?: string | null
          observacoes_finais?: string | null
          observacoes_gerais?: string | null
          operacao_organizada?: string | null
          otimizacao_continua?: string | null
          outros_marketplaces?: string | null
          padronizacao_visual?: string | null
          plano_escalar?: string | null
          potencial_mal_aproveitado?: string | null
          prazo_envio_bom?: string | null
          precos_competitivos?: string | null
          principais_gargalos?: string | null
          principais_oportunidades?: string | null
          priorizacao_potencial?: string | null
          processo_claro?: string | null
          produtos_visita_convertem?: string | null
          public_token?: string | null
          quantidade_skus?: number | null
          reputacao_saudavel?: string | null
          responde_rapido?: string | null
          responsavel_diagnostico?: string | null
          responsavel_interno?: string | null
          rotina_metricas?: string | null
          ruptura_frequente?: string | null
          tempo_resposta_adequado?: string | null
          ticket_medio?: number | null
          titulos_bons?: string | null
          updated_at?: string
          usa_midia_paga?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mktplace_diagnosticos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mktplace_relatorios: {
        Row: {
          acoes_realizadas: string | null
          client_id: string
          consultor_id: string
          created_at: string
          cycle_end_date: string
          cycle_start_date: string
          id: string
          is_published: boolean | null
          metricas_chave: string | null
          observacoes: string | null
          pontos_melhoria: string | null
          proximos_passos: string | null
          public_token: string | null
          resultados: string | null
          resumo: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          acoes_realizadas?: string | null
          client_id: string
          consultor_id: string
          created_at?: string
          cycle_end_date?: string
          cycle_start_date?: string
          id?: string
          is_published?: boolean | null
          metricas_chave?: string | null
          observacoes?: string | null
          pontos_melhoria?: string | null
          proximos_passos?: string | null
          public_token?: string | null
          resultados?: string | null
          resumo?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          acoes_realizadas?: string | null
          client_id?: string
          consultor_id?: string
          created_at?: string
          cycle_end_date?: string
          cycle_start_date?: string
          id?: string
          is_published?: boolean | null
          metricas_chave?: string | null
          observacoes?: string | null
          pontos_melhoria?: string | null
          proximos_passos?: string | null
          public_token?: string | null
          resultados?: string | null
          resumo?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mktplace_relatorios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mrr_changes: {
        Row: {
          change_type: string
          change_value: number
          changed_by: string | null
          client_id: string
          created_at: string
          effective_date: string
          id: string
          new_value: number
          previous_value: number
          product_name: string
          product_slug: string
          source: string
        }
        Insert: {
          change_type: string
          change_value?: number
          changed_by?: string | null
          client_id: string
          created_at?: string
          effective_date?: string
          id?: string
          new_value?: number
          previous_value?: number
          product_name: string
          product_slug: string
          source?: string
        }
        Update: {
          change_type?: string
          change_value?: number
          changed_by?: string | null
          client_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          new_value?: number
          previous_value?: number
          product_name?: string
          product_slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "mrr_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          communication_other: string | null
          communication_rating: string
          company_name: string
          creatives_rating: string
          creatives_represent_brand: string
          id: string
          improvement_suggestions: string
          nps_score: number
          score_reason: string
          strategies_aligned: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          communication_other?: string | null
          communication_rating: string
          company_name: string
          creatives_rating: string
          creatives_represent_brand: string
          id?: string
          improvement_suggestions: string
          nps_score: number
          score_reason: string
          strategies_aligned: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          communication_other?: string | null
          communication_rating?: string
          company_name?: string
          creatives_rating?: string
          creatives_represent_brand?: string
          id?: string
          improvement_suggestions?: string
          nps_score?: number
          score_reason?: string
          strategies_aligned?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          public_token: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          public_token?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          public_token?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      okrs: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_value: number | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: string | null
          target_value: number | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          target_value?: number | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      onboarding_checklists: {
        Row: {
          client_id: string
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          item: string
          milestone: number
          step: string
        }
        Insert: {
          client_id: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          item: string
          milestone: number
          step: string
        }
        Update: {
          client_id?: string
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          item?: string
          milestone?: number
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          archived: boolean
          archived_at: string | null
          assigned_to: string
          client_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          justification: string | null
          justification_at: string | null
          milestone: number
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_to: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          milestone?: number
          status?: string
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          milestone?: number
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          product_category_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          product_category_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          product_category_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_groups_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_daily_documentation: {
        Row: {
          actions_done: string | null
          client_budget: string | null
          client_id: string | null
          created_at: string
          documentation_date: string
          id: string
          metrics: string | null
          outbound_manager_id: string
          updated_at: string
        }
        Insert: {
          actions_done?: string | null
          client_budget?: string | null
          client_id?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          metrics?: string | null
          outbound_manager_id: string
          updated_at?: string
        }
        Update: {
          actions_done?: string | null
          client_budget?: string | null
          client_id?: string | null
          created_at?: string
          documentation_date?: string
          id?: string
          metrics?: string | null
          outbound_manager_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_daily_documentation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_justifications: {
        Row: {
          client_id: string
          created_at: string
          id: string
          justification_type: string | null
          outbound_manager_id: string
          reason: string
          resolved: boolean | null
          resolved_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          justification_type?: string | null
          outbound_manager_id: string
          reason: string
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          justification_type?: string | null
          outbound_manager_id?: string
          reason?: string
          resolved?: boolean | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_justifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          meeting_date: string | null
          outbound_manager_id: string
          title: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          meeting_date?: string | null
          outbound_manager_id: string
          title: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          meeting_date?: string | null
          outbound_manager_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_new_client_notifications: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          created_by: string
          created_by_name: string
          id: string
          outbound_manager_id: string
          read: boolean
          read_at: string | null
        }
        Insert: {
          client_id: string
          client_name: string
          created_at?: string
          created_by: string
          created_by_name: string
          id?: string
          outbound_manager_id: string
          read?: boolean
          read_at?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          id?: string
          outbound_manager_id?: string
          read?: boolean
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_new_client_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_strategies: {
        Row: {
          ambos_combined_notes: string | null
          ambos_enabled: boolean | null
          client_base_details: string | null
          client_id: string
          created_at: string
          created_by: string
          id: string
          is_published: boolean | null
          monthly_budget: number | null
          pa_cold_calling: Json | null
          pa_cold_email: Json | null
          pa_linkedin_prospecting: Json | null
          pa_whatsapp_outreach: Json | null
          prospeccao_ativa_enabled: boolean | null
          public_token: string | null
          rb_email_reactivation: Json | null
          rb_upsell_crosssell: Json | null
          rb_whatsapp_nurturing: Json | null
          remarketing_base_enabled: boolean | null
          target_icp: string | null
          target_region: string | null
          tools_used: string | null
          updated_at: string
          use_client_base: boolean | null
        }
        Insert: {
          ambos_combined_notes?: string | null
          ambos_enabled?: boolean | null
          client_base_details?: string | null
          client_id: string
          created_at?: string
          created_by: string
          id?: string
          is_published?: boolean | null
          monthly_budget?: number | null
          pa_cold_calling?: Json | null
          pa_cold_email?: Json | null
          pa_linkedin_prospecting?: Json | null
          pa_whatsapp_outreach?: Json | null
          prospeccao_ativa_enabled?: boolean | null
          public_token?: string | null
          rb_email_reactivation?: Json | null
          rb_upsell_crosssell?: Json | null
          rb_whatsapp_nurturing?: Json | null
          remarketing_base_enabled?: boolean | null
          target_icp?: string | null
          target_region?: string | null
          tools_used?: string | null
          updated_at?: string
          use_client_base?: boolean | null
        }
        Update: {
          ambos_combined_notes?: string | null
          ambos_enabled?: boolean | null
          client_base_details?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_published?: boolean | null
          monthly_budget?: number | null
          pa_cold_calling?: Json | null
          pa_cold_email?: Json | null
          pa_linkedin_prospecting?: Json | null
          pa_whatsapp_outreach?: Json | null
          prospeccao_ativa_enabled?: boolean | null
          public_token?: string | null
          rb_email_reactivation?: Json | null
          rb_upsell_crosssell?: Json | null
          rb_whatsapp_nurturing?: Json | null
          remarketing_base_enabled?: boolean | null
          target_icp?: string | null
          target_region?: string | null
          tools_used?: string | null
          updated_at?: string
          use_client_base?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_strategies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_task_comments: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          author_name: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "outbound_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_task_delay_justifications: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string
          id: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          id?: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          id?: string
          justification?: string
          notification_id?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_task_delay_justifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "outbound_task_delay_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_task_delay_notifications: {
        Row: {
          created_at: string
          id: string
          outbound_manager_id: string
          outbound_manager_name: string
          outbound_task_id: string
          task_due_date: string
          task_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          outbound_manager_id: string
          outbound_manager_name: string
          outbound_task_id: string
          task_due_date: string
          task_title: string
        }
        Update: {
          created_at?: string
          id?: string
          outbound_manager_id?: string
          outbound_manager_name?: string
          outbound_task_id?: string
          task_due_date?: string
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_task_delay_notifications_outbound_task_id_fkey"
            columns: ["outbound_task_id"]
            isOneToOne: true
            referencedRelation: "outbound_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_tasks: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          justification: string | null
          justification_at: string | null
          outbound_manager_id: string
          priority: string | null
          status: string | null
          tags: string[] | null
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          outbound_manager_id: string
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          justification?: string | null
          justification_at?: string | null
          outbound_manager_id?: string
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      paddock_diagnosticos: {
        Row: {
          abord_abertura_estruturada: string | null
          abord_comeca_whatsapp: string | null
          abord_erro_ligacoes: string | null
          abord_fala_mais_que_escuta: string | null
          abord_faz_perguntas: string | null
          abord_liga_imediatamente: string | null
          abord_ligacoes_frequentes: string | null
          abord_seguranca_falar: string | null
          abord_tempo_resposta_5min: string | null
          client_id: string
          consultor_id: string
          conv_agenda_reunioes: string | null
          conv_conduz_conversa: string | null
          conv_erro_conversao: string | null
          conv_inicio_ou_fechamento: string | null
          conv_leads_somem: string | null
          conv_objecao_recorrente: string | null
          conv_quebra_expectativa: string | null
          conv_reunioes_qualificadas: string | null
          conv_valor_ou_preco: string | null
          created_at: string
          crm_erros_status: string | null
          crm_funil_realidade: string | null
          crm_gestor_confia: string | null
          crm_historico_completo: string | null
          crm_leads_parados: string | null
          crm_movimentacao_correta: string | null
          crm_principal_erro: string | null
          crm_registra_interacoes: string | null
          crm_whatsapp_fora: string | null
          disc_cobranca_gestor: string | null
          disc_consistencia: string | null
          disc_executa_sem_motivacao: string | null
          disc_falta_rotina: string | null
          disc_mede_desempenho: string | null
          disc_metas_individuais: string | null
          disc_organizacao: string | null
          disc_rotina_clara: string | null
          disc_sabe_o_que_fazer: string | null
          erro_aceita_nao: string | null
          erro_comeca_whatsapp: string | null
          erro_fala_mais: string | null
          erro_liga_pouco: string | null
          erro_mais_prejudica: string | null
          erro_nao_agenda: string | null
          erro_nao_investiga: string | null
          erro_nao_registra: string | null
          erro_nao_segue: string | null
          evol_aplicou: string | null
          evol_aumento_reunioes: string | null
          evol_crm_limpo: string | null
          evol_gestor_percebe: string | null
          evol_mais_organizado: string | null
          evol_melhorou: string | null
          evol_o_que_melhorou: string | null
          evol_o_que_nao_melhorou: string | null
          evol_processo_claro: string | null
          evol_qualidade_leads: string | null
          evol_top3_acoes: string | null
          evol_top3_gargalos: string | null
          exec_alguem_nao_performa: string | null
          exec_batendo_50: string | null
          exec_blocos_ligacao: string | null
          exec_comeca_pelo_crm: string | null
          exec_consistencia_diaria: string | null
          exec_followup_diario: string | null
          exec_leads_sem_atividade: string | null
          exec_volume_caiu: string | null
          follow_5_tentativas: string | null
          follow_desiste_rapido: string | null
          follow_disciplina: string | null
          follow_erro_followup: string | null
          follow_multicanal: string | null
          follow_padrao_dias: string | null
          follow_personalizado: string | null
          follow_registra_crm: string | null
          follow_revisita_antigos: string | null
          id: string
          is_published: boolean | null
          public_token: string | null
          qual_descobre_orcamento: string | null
          qual_diferencia_status: string | null
          qual_dor_real: string | null
          qual_entende_prazo: string | null
          qual_erro_qualificacao: string | null
          qual_fala_decisor: string | null
          qual_perde_tempo_ruins: string | null
          qual_perguntas_cenario: string | null
          qual_qualifica_ou_empurra: string | null
          updated_at: string
        }
        Insert: {
          abord_abertura_estruturada?: string | null
          abord_comeca_whatsapp?: string | null
          abord_erro_ligacoes?: string | null
          abord_fala_mais_que_escuta?: string | null
          abord_faz_perguntas?: string | null
          abord_liga_imediatamente?: string | null
          abord_ligacoes_frequentes?: string | null
          abord_seguranca_falar?: string | null
          abord_tempo_resposta_5min?: string | null
          client_id: string
          consultor_id: string
          conv_agenda_reunioes?: string | null
          conv_conduz_conversa?: string | null
          conv_erro_conversao?: string | null
          conv_inicio_ou_fechamento?: string | null
          conv_leads_somem?: string | null
          conv_objecao_recorrente?: string | null
          conv_quebra_expectativa?: string | null
          conv_reunioes_qualificadas?: string | null
          conv_valor_ou_preco?: string | null
          created_at?: string
          crm_erros_status?: string | null
          crm_funil_realidade?: string | null
          crm_gestor_confia?: string | null
          crm_historico_completo?: string | null
          crm_leads_parados?: string | null
          crm_movimentacao_correta?: string | null
          crm_principal_erro?: string | null
          crm_registra_interacoes?: string | null
          crm_whatsapp_fora?: string | null
          disc_cobranca_gestor?: string | null
          disc_consistencia?: string | null
          disc_executa_sem_motivacao?: string | null
          disc_falta_rotina?: string | null
          disc_mede_desempenho?: string | null
          disc_metas_individuais?: string | null
          disc_organizacao?: string | null
          disc_rotina_clara?: string | null
          disc_sabe_o_que_fazer?: string | null
          erro_aceita_nao?: string | null
          erro_comeca_whatsapp?: string | null
          erro_fala_mais?: string | null
          erro_liga_pouco?: string | null
          erro_mais_prejudica?: string | null
          erro_nao_agenda?: string | null
          erro_nao_investiga?: string | null
          erro_nao_registra?: string | null
          erro_nao_segue?: string | null
          evol_aplicou?: string | null
          evol_aumento_reunioes?: string | null
          evol_crm_limpo?: string | null
          evol_gestor_percebe?: string | null
          evol_mais_organizado?: string | null
          evol_melhorou?: string | null
          evol_o_que_melhorou?: string | null
          evol_o_que_nao_melhorou?: string | null
          evol_processo_claro?: string | null
          evol_qualidade_leads?: string | null
          evol_top3_acoes?: string | null
          evol_top3_gargalos?: string | null
          exec_alguem_nao_performa?: string | null
          exec_batendo_50?: string | null
          exec_blocos_ligacao?: string | null
          exec_comeca_pelo_crm?: string | null
          exec_consistencia_diaria?: string | null
          exec_followup_diario?: string | null
          exec_leads_sem_atividade?: string | null
          exec_volume_caiu?: string | null
          follow_5_tentativas?: string | null
          follow_desiste_rapido?: string | null
          follow_disciplina?: string | null
          follow_erro_followup?: string | null
          follow_multicanal?: string | null
          follow_padrao_dias?: string | null
          follow_personalizado?: string | null
          follow_registra_crm?: string | null
          follow_revisita_antigos?: string | null
          id?: string
          is_published?: boolean | null
          public_token?: string | null
          qual_descobre_orcamento?: string | null
          qual_diferencia_status?: string | null
          qual_dor_real?: string | null
          qual_entende_prazo?: string | null
          qual_erro_qualificacao?: string | null
          qual_fala_decisor?: string | null
          qual_perde_tempo_ruins?: string | null
          qual_perguntas_cenario?: string | null
          qual_qualifica_ou_empurra?: string | null
          updated_at?: string
        }
        Update: {
          abord_abertura_estruturada?: string | null
          abord_comeca_whatsapp?: string | null
          abord_erro_ligacoes?: string | null
          abord_fala_mais_que_escuta?: string | null
          abord_faz_perguntas?: string | null
          abord_liga_imediatamente?: string | null
          abord_ligacoes_frequentes?: string | null
          abord_seguranca_falar?: string | null
          abord_tempo_resposta_5min?: string | null
          client_id?: string
          consultor_id?: string
          conv_agenda_reunioes?: string | null
          conv_conduz_conversa?: string | null
          conv_erro_conversao?: string | null
          conv_inicio_ou_fechamento?: string | null
          conv_leads_somem?: string | null
          conv_objecao_recorrente?: string | null
          conv_quebra_expectativa?: string | null
          conv_reunioes_qualificadas?: string | null
          conv_valor_ou_preco?: string | null
          created_at?: string
          crm_erros_status?: string | null
          crm_funil_realidade?: string | null
          crm_gestor_confia?: string | null
          crm_historico_completo?: string | null
          crm_leads_parados?: string | null
          crm_movimentacao_correta?: string | null
          crm_principal_erro?: string | null
          crm_registra_interacoes?: string | null
          crm_whatsapp_fora?: string | null
          disc_cobranca_gestor?: string | null
          disc_consistencia?: string | null
          disc_executa_sem_motivacao?: string | null
          disc_falta_rotina?: string | null
          disc_mede_desempenho?: string | null
          disc_metas_individuais?: string | null
          disc_organizacao?: string | null
          disc_rotina_clara?: string | null
          disc_sabe_o_que_fazer?: string | null
          erro_aceita_nao?: string | null
          erro_comeca_whatsapp?: string | null
          erro_fala_mais?: string | null
          erro_liga_pouco?: string | null
          erro_mais_prejudica?: string | null
          erro_nao_agenda?: string | null
          erro_nao_investiga?: string | null
          erro_nao_registra?: string | null
          erro_nao_segue?: string | null
          evol_aplicou?: string | null
          evol_aumento_reunioes?: string | null
          evol_crm_limpo?: string | null
          evol_gestor_percebe?: string | null
          evol_mais_organizado?: string | null
          evol_melhorou?: string | null
          evol_o_que_melhorou?: string | null
          evol_o_que_nao_melhorou?: string | null
          evol_processo_claro?: string | null
          evol_qualidade_leads?: string | null
          evol_top3_acoes?: string | null
          evol_top3_gargalos?: string | null
          exec_alguem_nao_performa?: string | null
          exec_batendo_50?: string | null
          exec_blocos_ligacao?: string | null
          exec_comeca_pelo_crm?: string | null
          exec_consistencia_diaria?: string | null
          exec_followup_diario?: string | null
          exec_leads_sem_atividade?: string | null
          exec_volume_caiu?: string | null
          follow_5_tentativas?: string | null
          follow_desiste_rapido?: string | null
          follow_disciplina?: string | null
          follow_erro_followup?: string | null
          follow_multicanal?: string | null
          follow_padrao_dias?: string | null
          follow_personalizado?: string | null
          follow_registra_crm?: string | null
          follow_revisita_antigos?: string | null
          id?: string
          is_published?: boolean | null
          public_token?: string | null
          qual_descobre_orcamento?: string | null
          qual_diferencia_status?: string | null
          qual_dor_real?: string | null
          qual_entende_prazo?: string | null
          qual_erro_qualificacao?: string | null
          qual_fala_decisor?: string | null
          qual_perde_tempo_ruins?: string | null
          qual_perguntas_cenario?: string | null
          qual_qualifica_ou_empurra?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paddock_diagnosticos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      predefined_challenges: {
        Row: {
          challenge_text: string
          created_at: string | null
          id: string
          is_active: boolean | null
          usage_count: number | null
        }
        Insert: {
          challenge_text: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          usage_count?: number | null
        }
        Update: {
          challenge_text?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          usage_count?: number | null
        }
        Relationships: []
      }
      pro_tools: {
        Row: {
          content: string | null
          created_at: string
          icon: string | null
          id: string
          link: string | null
          position: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          link?: string | null
          position?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          link?: string | null
          position?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_category_id: string | null
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_category_id?: string | null
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_category_id?: string | null
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      produtora_briefings: {
        Row: {
          card_id: string
          created_at: string
          created_by: string | null
          id: string
          observations: string | null
          reference_video_url: string | null
          script_url: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtora_briefings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      produtora_completion_notifications: {
        Row: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          requester_id: string
          requester_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id: string
          requester_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          completed_by?: string
          completed_by_name?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id?: string
          requester_name?: string
        }
        Relationships: []
      }
      produtora_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          card_id: string
          created_at: string
          id: string
          justification: string
          produtora_id: string
          produtora_name: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id: string
          created_at?: string
          id?: string
          justification: string
          produtora_id: string
          produtora_name: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id?: string
          created_at?: string
          id?: string
          justification?: string
          produtora_id?: string
          produtora_name?: string
        }
        Relationships: []
      }
      produtora_delay_notifications: {
        Row: {
          card_id: string
          card_title: string
          created_at: string
          due_date: string
          id: string
          produtora_id: string
          produtora_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          created_at?: string
          due_date: string
          id?: string
          produtora_id: string
          produtora_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          created_at?: string
          due_date?: string
          id?: string
          produtora_id?: string
          produtora_name?: string
        }
        Relationships: []
      }
      produtora_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          additional_pages: string[] | null
          avatar: string | null
          can_access_mtech: boolean
          category_id: string | null
          created_at: string
          email: string
          group_id: string | null
          id: string
          is_coringa: boolean
          last_sign_in_at: string | null
          name: string
          squad_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_pages?: string[] | null
          avatar?: string | null
          can_access_mtech?: boolean
          category_id?: string | null
          created_at?: string
          email: string
          group_id?: string | null
          id?: string
          is_coringa?: boolean
          last_sign_in_at?: string | null
          name: string
          squad_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_pages?: string[] | null
          avatar?: string | null
          can_access_mtech?: boolean
          category_id?: string | null
          created_at?: string
          email?: string
          group_id?: string | null
          id?: string
          is_coringa?: boolean
          last_sign_in_at?: string | null
          name?: string
          squad_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "independent_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_social_metrics: {
        Row: {
          created_at: string | null
          id: string
          prova_social_id: string
          type_id: string
          type_name: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          prova_social_id: string
          type_id: string
          type_name: string
          value?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          prova_social_id?: string
          type_id?: string
          type_name?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "prova_social_metrics_prova_social_id_fkey"
            columns: ["prova_social_id"]
            isOneToOne: false
            referencedRelation: "provas_sociais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_social_metrics_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "prova_social_types"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_social_types: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      provas_sociais: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          client_logo_url: string | null
          client_name: string
          created_at: string | null
          created_by: string | null
          id: string
          project_duration: string
          strategy_description: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          client_logo_url?: string | null
          client_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_duration: string
          strategy_description?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          client_logo_url?: string | null
          client_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_duration?: string
          strategy_description?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      recorded_meetings: {
        Row: {
          ata: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          folder_id: string
          id: string
          is_whole_team: boolean | null
          meeting_date: string
          participants: string[] | null
          summary: string | null
          updated_at: string | null
          video_filename: string | null
          video_url: string
        }
        Insert: {
          ata?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          folder_id: string
          id?: string
          is_whole_team?: boolean | null
          meeting_date?: string
          participants?: string[] | null
          summary?: string | null
          updated_at?: string | null
          video_filename?: string | null
          video_url: string
        }
        Update: {
          ata?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          folder_id?: string
          id?: string
          is_whole_team?: boolean | null
          meeting_date?: string
          participants?: string[] | null
          summary?: string | null
          updated_at?: string | null
          video_filename?: string | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "recorded_meetings_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "meeting_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_atividades: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
          user_name: string | null
          vaga_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_atividades_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_candidatos: {
        Row: {
          avaliacao: number | null
          created_at: string
          curriculo_url: string | null
          email: string | null
          etapa_entrevista: number | null
          id: string
          linkedin: string | null
          nome: string
          notas: string | null
          position: number | null
          status: string
          telefone: string | null
          updated_at: string
          vaga_id: string | null
        }
        Insert: {
          avaliacao?: number | null
          created_at?: string
          curriculo_url?: string | null
          email?: string | null
          etapa_entrevista?: number | null
          id?: string
          linkedin?: string | null
          nome: string
          notas?: string | null
          position?: number | null
          status?: string
          telefone?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Update: {
          avaliacao?: number | null
          created_at?: string
          curriculo_url?: string | null
          email?: string | null
          etapa_entrevista?: number | null
          id?: string
          linkedin?: string | null
          nome?: string
          notas?: string | null
          position?: number | null
          status?: string
          telefone?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_candidatos_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_comentarios: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string | null
          user_name: string | null
          vaga_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_comentarios_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_justificativas: {
        Row: {
          created_at: string
          id: string
          motivo: string
          nova_data: string | null
          user_id: string | null
          user_name: string | null
          vaga_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          nova_data?: string | null
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          nova_data?: string | null
          user_id?: string | null
          user_name?: string | null
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_justificativas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_tarefas: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          data_limite: string | null
          descricao: string | null
          id: string
          position: number | null
          prioridade: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          tipo: string | null
          titulo: string
          updated_at: string
          vaga_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          position?: number | null
          prioridade?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          tipo?: string | null
          titulo: string
          updated_at?: string
          vaga_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          data_limite?: string | null
          descricao?: string | null
          id?: string
          position?: number | null
          prioridade?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_tarefas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_vaga_briefings: {
        Row: {
          area_squad: string | null
          cidade_uf: string | null
          created_at: string
          data_limite: string
          faixa_salarial: string | null
          ferramentas_obrigatorias: string | null
          id: string
          modelo: string | null
          nivel: string | null
          nome_vaga: string
          objetivo_vaga: string | null
          observacoes: string | null
          principais_responsabilidades: string | null
          quantidade_vagas: number
          regime: string | null
          requisitos_desejaveis: string | null
          requisitos_obrigatorios: string | null
          solicitado_por: string | null
          updated_at: string
          vaga_id: string | null
        }
        Insert: {
          area_squad?: string | null
          cidade_uf?: string | null
          created_at?: string
          data_limite: string
          faixa_salarial?: string | null
          ferramentas_obrigatorias?: string | null
          id?: string
          modelo?: string | null
          nivel?: string | null
          nome_vaga: string
          objetivo_vaga?: string | null
          observacoes?: string | null
          principais_responsabilidades?: string | null
          quantidade_vagas?: number
          regime?: string | null
          requisitos_desejaveis?: string | null
          requisitos_obrigatorios?: string | null
          solicitado_por?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Update: {
          area_squad?: string | null
          cidade_uf?: string | null
          created_at?: string
          data_limite?: string
          faixa_salarial?: string | null
          ferramentas_obrigatorias?: string | null
          id?: string
          modelo?: string | null
          nivel?: string | null
          nome_vaga?: string
          objetivo_vaga?: string | null
          observacoes?: string | null
          principais_responsabilidades?: string | null
          quantidade_vagas?: number
          regime?: string | null
          requisitos_desejaveis?: string | null
          requisitos_obrigatorios?: string | null
          solicitado_por?: string | null
          updated_at?: string
          vaga_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_vaga_briefings_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_vaga_plataformas: {
        Row: {
          budget: number | null
          created_at: string
          descricao: string | null
          expectativa_curriculos: number | null
          id: string
          observacoes: string | null
          plataforma: string
          updated_at: string
          vaga_id: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          descricao?: string | null
          expectativa_curriculos?: number | null
          id?: string
          observacoes?: string | null
          plataforma: string
          updated_at?: string
          vaga_id: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          descricao?: string | null
          expectativa_curriculos?: number | null
          id?: string
          observacoes?: string | null
          plataforma?: string
          updated_at?: string
          vaga_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_vaga_plataformas_vaga_id_fkey"
            columns: ["vaga_id"]
            isOneToOne: false
            referencedRelation: "rh_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_vagas: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          column_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          position: number | null
          priority: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          column_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          column_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_vagas_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "organization_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_funnel_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          how_it_works: string[] | null
          icon_color: string
          id: string
          name: string
          platform: string
          visible_fields: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          how_it_works?: string[] | null
          icon_color?: string
          id?: string
          name: string
          platform: string
          visible_fields?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          how_it_works?: string[] | null
          icon_color?: string
          id?: string
          name?: string
          platform?: string
          visible_fields?: string[] | null
        }
        Relationships: []
      }
      strategy_requests: {
        Row: {
          client_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          kanban_card_id: string | null
          requested_at: string
          requested_by: string
        }
        Insert: {
          client_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          kanban_card_id?: string | null
          requested_at?: string
          requested_by: string
        }
        Update: {
          client_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          kanban_card_id?: string | null
          requested_at?: string
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_requests_kanban_card_id_fkey"
            columns: ["kanban_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      system_notifications: {
        Row: {
          card_id: string | null
          client_id: string | null
          created_at: string
          dismissed: boolean | null
          dismissed_at: string | null
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          nps_id: string | null
          okr_id: string | null
          priority: string | null
          read: boolean | null
          read_at: string | null
          recipient_id: string
          recipient_role: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          card_id?: string | null
          client_id?: string | null
          created_at?: string
          dismissed?: boolean | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          nps_id?: string | null
          okr_id?: string | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          recipient_id: string
          recipient_role?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          card_id?: string | null
          client_id?: string | null
          created_at?: string
          dismissed?: boolean | null
          dismissed_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          nps_id?: string | null
          okr_id?: string | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          recipient_role?: string | null
          task_id?: string | null
          title?: string
        }
        Relationships: []
      }
      task_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          justification: string
          notification_id: string
          user_id: string
          user_role: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          justification?: string
          notification_id?: string
          user_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_delay_justifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "task_delay_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      task_delay_notifications: {
        Row: {
          created_at: string
          id: string
          task_due_date: string
          task_id: string
          task_owner_id: string
          task_owner_name: string
          task_owner_role: string
          task_table: string
          task_title: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_due_date: string
          task_id: string
          task_owner_id: string
          task_owner_name: string
          task_owner_role: string
          task_table: string
          task_title: string
        }
        Update: {
          created_at?: string
          id?: string
          task_due_date?: string
          task_id?: string
          task_owner_id?: string
          task_owner_name?: string
          task_owner_role?: string
          task_table?: string
          task_title?: string
        }
        Relationships: []
      }
      tech_sprints: {
        Row: {
          created_at: string
          end_date: string
          goal: string | null
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["tech_sprint_status"]
        }
        Insert: {
          created_at?: string
          end_date: string
          goal?: string | null
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["tech_sprint_status"]
        }
        Update: {
          created_at?: string
          end_date?: string
          goal?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["tech_sprint_status"]
        }
        Relationships: []
      }
      tech_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tech_task_activities: {
        Row: {
          created_at: string
          data: Json
          id: string
          task_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          task_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          task_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_task_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_task_collaborators: {
        Row: {
          added_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_task_collaborators_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tech_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_tasks: {
        Row: {
          acceptance_criteria: string | null
          assignee_id: string | null
          blocker_reason: string | null
          checklist: Json
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          estimated_hours: number | null
          git_branch: string | null
          id: string
          is_blocked: boolean
          priority: Database["public"]["Enums"]["tech_task_priority"]
          sprint_id: string | null
          status: Database["public"]["Enums"]["tech_task_status"]
          technical_context: string | null
          title: string
          type: Database["public"]["Enums"]["tech_task_type"]
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string | null
          assignee_id?: string | null
          blocker_reason?: string | null
          checklist?: Json
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          git_branch?: string | null
          id?: string
          is_blocked?: boolean
          priority: Database["public"]["Enums"]["tech_task_priority"]
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["tech_task_status"]
          technical_context?: string | null
          title: string
          type: Database["public"]["Enums"]["tech_task_type"]
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string | null
          assignee_id?: string | null
          blocker_reason?: string | null
          checklist?: Json
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          estimated_hours?: number | null
          git_branch?: string | null
          id?: string
          is_blocked?: boolean
          priority?: Database["public"]["Enums"]["tech_task_priority"]
          sprint_id?: string | null
          status?: Database["public"]["Enums"]["tech_task_status"]
          technical_context?: string | null
          title?: string
          type?: Database["public"]["Enums"]["tech_task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_tasks_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "tech_sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_time_entries: {
        Row: {
          created_at: string
          id: string
          seq: number
          task_id: string
          type: Database["public"]["Enums"]["tech_time_entry_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seq?: never
          task_id: string
          type: Database["public"]["Enums"]["tech_time_entry_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seq?: never
          task_id?: string
          type?: Database["public"]["Enums"]["tech_time_entry_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_type: string
          credential_value: string
          id: string
          is_active: boolean
          label: string | null
          rotated_at: string | null
          tool_name: string
          updated_at: string
          visible_to_roles: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_type: string
          credential_value: string
          id?: string
          is_active?: boolean
          label?: string | null
          rotated_at?: string | null
          tool_name: string
          updated_at?: string
          visible_to_roles?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_type?: string
          credential_value?: string
          id?: string
          is_active?: boolean
          label?: string | null
          rotated_at?: string | null
          tool_name?: string
          updated_at?: string
          visible_to_roles?: string[]
        }
        Relationships: []
      }
      training_lessons: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          lesson_url: string
          order_index: number | null
          title: string
          training_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lesson_url?: string
          order_index?: number | null
          title: string
          training_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          lesson_url?: string
          order_index?: number | null
          title?: string
          training_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_lessons_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          allowed_roles: string[] | null
          archived: boolean | null
          archived_at: string | null
          class_date: string | null
          class_links: string[] | null
          class_time: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_recurring: boolean | null
          recurrence_days: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[] | null
          archived?: boolean | null
          archived_at?: string | null
          class_date?: string | null
          class_links?: string[] | null
          class_time?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_days?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[] | null
          archived?: boolean | null
          archived_at?: string | null
          class_date?: string | null
          class_links?: string[] | null
          class_time?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          recurrence_days?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      upsell_commissions: {
        Row: {
          commission_percentage: number
          commission_value: number
          created_at: string
          id: string
          paid_at: string | null
          status: string
          upsell_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          commission_percentage?: number
          commission_value: number
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          upsell_id: string
          user_id: string
          user_name: string
        }
        Update: {
          commission_percentage?: number
          commission_value?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          upsell_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_commissions_upsell_id_fkey"
            columns: ["upsell_id"]
            isOneToOne: false
            referencedRelation: "upsells"
            referencedColumns: ["id"]
          },
        ]
      }
      upsells: {
        Row: {
          client_id: string
          created_at: string
          id: string
          monthly_value: number
          product_name: string
          product_slug: string
          sold_by: string
          sold_by_name: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          monthly_value?: number
          product_name: string
          product_slug: string
          sold_by: string
          sold_by_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          monthly_value?: number
          product_name?: string
          product_slug?: string
          sold_by?: string
          sold_by_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsells_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          page_slug: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          page_slug: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          page_slug?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_grants_page_slug_fkey"
            columns: ["page_slug"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_briefings: {
        Row: {
          card_id: string
          created_at: string
          created_by: string | null
          id: string
          identity_url: string | null
          materials_url: string | null
          observations: string | null
          reference_video_url: string | null
          script_url: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_url?: string | null
          materials_url?: string | null
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          identity_url?: string | null
          materials_url?: string | null
          observations?: string | null
          reference_video_url?: string | null
          script_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_briefings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      video_completion_notifications: {
        Row: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at: string
          id: string
          read: boolean
          read_at: string | null
          requester_id: string
          requester_name: string
        }
        Insert: {
          card_id: string
          card_title: string
          completed_by: string
          completed_by_name: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id: string
          requester_name: string
        }
        Update: {
          card_id?: string
          card_title?: string
          completed_by?: string
          completed_by_name?: string
          created_at?: string
          id?: string
          read?: boolean
          read_at?: string | null
          requester_id?: string
          requester_name?: string
        }
        Relationships: []
      }
      video_delay_justifications: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          card_id: string
          created_at: string
          editor_id: string
          editor_name: string
          id: string
          justification: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id: string
          created_at?: string
          editor_id: string
          editor_name: string
          id?: string
          justification: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          card_id?: string
          created_at?: string
          editor_id?: string
          editor_name?: string
          id?: string
          justification?: string
        }
        Relationships: []
      }
      video_delay_notifications: {
        Row: {
          card_id: string
          card_title: string
          created_at: string
          due_date: string
          editor_id: string
          editor_name: string
          id: string
        }
        Insert: {
          card_id: string
          card_title: string
          created_at?: string
          due_date: string
          editor_id: string
          editor_name: string
          id?: string
        }
        Update: {
          card_id?: string
          card_title?: string
          created_at?: string
          due_date?: string
          editor_id?: string
          editor_name?: string
          id?: string
        }
        Relationships: []
      }
      video_notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_problems: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          created_at: string | null
          id: string
          manager_id: string | null
          manager_name: string | null
          problem_text: string
          problem_type: string | null
          source_meeting_id: string | null
          week_start: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          manager_name?: string | null
          problem_text: string
          problem_type?: string | null
          source_meeting_id?: string | null
          week_start?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          created_at?: string | null
          id?: string
          manager_id?: string | null
          manager_name?: string | null
          problem_text?: string
          problem_type?: string | null
          source_meeting_id?: string | null
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_problems_source_meeting_id_fkey"
            columns: ["source_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings_one_on_one"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_summaries: {
        Row: {
          archived: boolean | null
          created_at: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          main_challenges: string[] | null
          main_delays: string[] | null
          recommendations: string[] | null
          summary_text: string
          week_start: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          main_challenges?: string[] | null
          main_delays?: string[] | null
          recommendations?: string[] | null
          summary_text: string
          week_start: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          main_challenges?: string[] | null
          main_delays?: string[] | null
          recommendations?: string[] | null
          summary_text?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      tech_task_time_totals: {
        Row: {
          task_id: string | null
          total_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tech_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tech_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_see_tech: { Args: { _user_id: string }; Returns: boolean }
      can_view_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_card: {
        Args: { _card_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_user: {
        Args: { _target_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      check_action_plan_deadlines: { Args: never; Returns: undefined }
      check_ads_client_no_movement_7d: { Args: never; Returns: undefined }
      check_ads_client_stalled_14d: { Args: never; Returns: undefined }
      check_comercial_acompanhamento_stalled: {
        Args: never
        Returns: undefined
      }
      check_comercial_consultoria_stalled: { Args: never; Returns: undefined }
      check_contract_expired_alert: { Args: never; Returns: undefined }
      check_contract_no_renewal_plan: { Args: never; Returns: undefined }
      check_contract_renewals: { Args: never; Returns: undefined }
      check_creative_awaiting_approval: { Args: never; Returns: undefined }
      check_crm_configs_delayed: { Args: never; Returns: undefined }
      check_department_tasks_stalled: { Args: never; Returns: undefined }
      check_financeiro_clients_stalled: { Args: never; Returns: undefined }
      check_no_clients_moved_today: { Args: never; Returns: undefined }
      check_onboarding_tasks_stuck: { Args: never; Returns: undefined }
      check_overdue_deliveries: { Args: never; Returns: undefined }
      check_pending_ads_documentation: { Args: never; Returns: undefined }
      check_pending_approvals: { Args: never; Returns: undefined }
      check_pending_comercial_documentation: { Args: never; Returns: undefined }
      check_stalled_onboarding: { Args: never; Returns: undefined }
      check_training_notifications: { Args: never; Returns: undefined }
      check_user_inactive: { Args: never; Returns: undefined }
      cleanup_user_references: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      create_client_with_automations: {
        Args: { p_idempotency_key?: string; p_payload: Json }
        Returns: Json
      }
      create_weekly_gestor_tasks: { Args: never; Returns: undefined }
      ensure_onboarding_columns: {
        Args: { p_board_slug: string }
        Returns: undefined
      }
      generate_monthly_receivables: { Args: never; Returns: undefined }
      get_crm_config_collective_justifications: {
        Args: { p_config_id: string }
        Returns: {
          detected_at: string
          is_pending: boolean
          justification: string
          justified_at: string
          pending_id: string
          user_id: string
          user_name: string
          user_role: string
        }[]
      }
      get_day_of_week_portuguese: { Args: never; Returns: string }
      get_my_page_access: { Args: never; Returns: string[] }
      get_pending_crm_justifications_for_user: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          config_id: string
          detected_at: string
          notification_id: string
          pending_id: string
          produto: string
          task_due_date: string
          task_table: string
          task_title: string
          user_role: string
        }[]
      }
      get_user_group_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_squad_id: { Args: { _user_id: string }; Returns: string }
      grant_pages: {
        Args: {
          _expires_at?: string
          _page_slugs: string[]
          _reason?: string
          _source?: string
          _source_ref?: string
          _user_id: string
        }
        Returns: number
      }
      has_page_access: {
        Args: { _page: string; _user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      is_feature_enabled: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      list_active_clients_minimal: {
        Args: never
        Returns: {
          id: string
          name: string
          razao_social: string
        }[]
      }
      revoke_page: {
        Args: { _page_slug: string; _reason?: string; _user_id: string }
        Returns: boolean
      }
      set_mtech_access: {
        Args: { _user_id: string; _value: boolean }
        Returns: undefined
      }
      tech_add_comment: {
        Args: { _task_id: string; _text: string }
        Returns: undefined
      }
      tech_approve_task: { Args: { _task_id: string }; Returns: undefined }
      tech_block_task: {
        Args: { _reason: string; _task_id: string }
        Returns: undefined
      }
      tech_can_edit_task: { Args: { _task_id: string }; Returns: boolean }
      tech_end_sprint: { Args: { _sprint_id: string }; Returns: undefined }
      tech_get_time_totals: {
        Args: never
        Returns: {
          task_id: string
          total_seconds: number
        }[]
      }
      tech_pause_timer: { Args: { _task_id: string }; Returns: undefined }
      tech_reject_task: { Args: { _task_id: string }; Returns: undefined }
      tech_resume_timer: { Args: { _task_id: string }; Returns: undefined }
      tech_send_to_review: { Args: { _task_id: string }; Returns: undefined }
      tech_start_sprint: { Args: { _sprint_id: string }; Returns: undefined }
      tech_start_timer: { Args: { _task_id: string }; Returns: undefined }
      tech_stop_timer: { Args: { _task_id: string }; Returns: undefined }
      tech_submit_attachment: {
        Args: {
          _content_type: string
          _file_name: string
          _file_path: string
          _file_size: number
          _task_id: string
        }
        Returns: string
      }
      tech_submit_task: {
        Args: {
          _acceptance_criteria: string
          _assignee_id?: string
          _deadline?: string
          _description: string
          _priority: Database["public"]["Enums"]["tech_task_priority"]
          _technical_context?: string
          _title: string
          _type: Database["public"]["Enums"]["tech_task_type"]
        }
        Returns: string
      }
      tech_timer_is_active: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      tech_unblock_task: { Args: { _task_id: string }; Returns: undefined }
    }
    Enums: {
      tech_sprint_status: "PLANNING" | "ACTIVE" | "COMPLETED"
      tech_task_priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      tech_task_status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"
      tech_task_type: "BUG" | "FEATURE" | "HOTFIX" | "CHORE"
      tech_time_entry_type: "START" | "PAUSE" | "RESUME" | "STOP"
      user_role:
        | "ceo"
        | "cto"
        | "gestor_projetos"
        | "gestor_ads"
        | "sucesso_cliente"
        | "design"
        | "editor_video"
        | "devs"
        | "atrizes_gravacao"
        | "produtora"
        | "gestor_crm"
        | "consultor_comercial"
        | "financeiro"
        | "rh"
        | "outbound"
        | "consultor_mktplace"
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
      tech_sprint_status: ["PLANNING", "ACTIVE", "COMPLETED"],
      tech_task_priority: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      tech_task_status: ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"],
      tech_task_type: ["BUG", "FEATURE", "HOTFIX", "CHORE"],
      tech_time_entry_type: ["START", "PAUSE", "RESUME", "STOP"],
      user_role: [
        "ceo",
        "cto",
        "gestor_projetos",
        "gestor_ads",
        "sucesso_cliente",
        "design",
        "editor_video",
        "devs",
        "atrizes_gravacao",
        "produtora",
        "gestor_crm",
        "consultor_comercial",
        "financeiro",
        "rh",
        "outbound",
        "consultor_mktplace",
      ],
    },
  },
} as const
