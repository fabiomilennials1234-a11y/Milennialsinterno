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
          archived: boolean | null
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
          archived?: boolean | null
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
          archived?: boolean | null
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
          client_name: string | null
          created_at: string
          created_by: string
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
          public_token: string | null
          recommended_investment: number | null
          updated_at: string
          use_client_material: boolean | null
        }
        Insert: {
          ad_location?: string | null
          client_id: string
          client_material_details?: string | null
          client_name?: string | null
          created_at?: string
          created_by: string
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
          public_token?: string | null
          recommended_investment?: number | null
          updated_at?: string
          use_client_material?: boolean | null
        }
        Update: {
          ad_location?: string | null
          client_id?: string
          client_material_details?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string
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
          campaign_published_at: string | null
          client_label: string | null
          cnpj: string | null
          comercial_entered_at: string | null
          comercial_onboarding_started_at: string | null
          comercial_status: string | null
          contracted_products: string[] | null
          cpf: string | null
          created_at: string
          created_by: string | null
          cs_classification: string | null
          cs_classification_reason: string | null
          distrato_entered_at: string | null
          distrato_step: string | null
          entry_date: string | null
          expected_investment: number | null
          general_info: string | null
          group_id: string | null
          id: string
          last_cs_contact_at: string | null
          monthly_value: number | null
          name: string
          niche: string | null
          onboarding_started_at: string | null
          razao_social: string | null
          sales_percentage: number
          squad_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_ads_manager?: string | null
          assigned_comercial?: string | null
          campaign_published_at?: string | null
          client_label?: string | null
          cnpj?: string | null
          comercial_entered_at?: string | null
          comercial_onboarding_started_at?: string | null
          comercial_status?: string | null
          contracted_products?: string[] | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          cs_classification?: string | null
          cs_classification_reason?: string | null
          distrato_entered_at?: string | null
          distrato_step?: string | null
          entry_date?: string | null
          expected_investment?: number | null
          general_info?: string | null
          group_id?: string | null
          id?: string
          last_cs_contact_at?: string | null
          monthly_value?: number | null
          name: string
          niche?: string | null
          onboarding_started_at?: string | null
          razao_social?: string | null
          sales_percentage?: number
          squad_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_ads_manager?: string | null
          assigned_comercial?: string | null
          campaign_published_at?: string | null
          client_label?: string | null
          cnpj?: string | null
          comercial_entered_at?: string | null
          comercial_onboarding_started_at?: string | null
          comercial_status?: string | null
          contracted_products?: string[] | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          cs_classification?: string | null
          cs_classification_reason?: string | null
          distrato_entered_at?: string | null
          distrato_step?: string | null
          entry_date?: string | null
          expected_investment?: number | null
          general_info?: string | null
          group_id?: string | null
          id?: string
          last_cs_contact_at?: string | null
          monthly_value?: number | null
          name?: string
          niche?: string | null
          onboarding_started_at?: string | null
          razao_social?: string | null
          sales_percentage?: number
          squad_id?: string | null
          status?: string | null
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
          name: string
          updated_at: string | null
        }
        Insert: {
          allowed_pages?: string[] | null
          created_at?: string | null
          created_by: string
          display_name: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          allowed_pages?: string[] | null
          created_at?: string | null
          created_by?: string
          display_name?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      design_demands: {
        Row: {
          client_instagram: string | null
          created_at: string
          created_by: string | null
          description: string | null
          designer_user_id: string
          due_date: string | null
          id: string
          identity_url: string | null
          priority: string | null
          references_url: string | null
          script_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designer_user_id: string
          due_date?: string | null
          id?: string
          identity_url?: string | null
          priority?: string | null
          references_url?: string | null
          script_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_instagram?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          designer_user_id?: string
          due_date?: string | null
          id?: string
          identity_url?: string | null
          priority?: string | null
          references_url?: string | null
          script_url?: string | null
          status?: string
          title?: string
          updated_at?: string
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
      financeiro_active_clients: {
        Row: {
          activated_at: string
          client_id: string
          contract_expires_at: string | null
          created_at: string
          id: string
          invoice_status: string
          monthly_value: number
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_active_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
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
            isOneToOne: true
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
          mes_referencia: string
          produto_slug: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          area?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          mes_referencia: string
          produto_slug?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          area?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          mes_referencia?: string
          produto_slug?: string | null
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
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          group_id: string | null
          id: string
          name: string
          owner_user_id: string | null
          product_category_id: string | null
          slug: string
          squad_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          product_category_id?: string | null
          slug: string
          squad_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_id?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
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
      meetings_one_on_one: {
        Row: {
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
          avatar: string | null
          avatar_url: string | null
          category_id: string | null
          created_at: string
          email: string
          group_id: string | null
          id: string
          is_coringa: boolean
          name: string
          squad_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar?: string | null
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          email: string
          group_id?: string | null
          id?: string
          is_coringa?: boolean
          name: string
          squad_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar?: string | null
          avatar_url?: string | null
          category_id?: string | null
          created_at?: string
          email?: string
          group_id?: string | null
          id?: string
          is_coringa?: boolean
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
        Relationships: [
          {
            foreignKeyName: "system_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          lesson_url: string
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
      [_ in never]: never
    }
    Functions: {
      can_view_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_user: {
        Args: { _target_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      check_action_plan_deadlines: { Args: never; Returns: undefined }
      check_clients_without_contact: { Args: never; Returns: undefined }
      check_contract_renewals: { Args: never; Returns: undefined }
      check_creative_awaiting_approval: { Args: never; Returns: undefined }
      check_expiring_contracts: { Args: never; Returns: undefined }
      check_no_clients_moved_today: { Args: never; Returns: undefined }
      check_okr_deadlines: { Args: never; Returns: undefined }
      check_overdue_deliveries: { Args: never; Returns: undefined }
      check_pending_ads_documentation: { Args: never; Returns: undefined }
      check_pending_approvals: { Args: never; Returns: undefined }
      check_pending_comercial_documentation: { Args: never; Returns: undefined }
      check_stalled_cards: { Args: never; Returns: undefined }
      check_stalled_onboarding: { Args: never; Returns: undefined }
      check_training_notifications: { Args: never; Returns: undefined }
      ensure_onboarding_columns: {
        Args: { p_board_slug: string }
        Returns: undefined
      }
      get_day_of_week_portuguese: { Args: never; Returns: string }
      get_user_group_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_squad_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      user_role:
        | "ceo"
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
      user_role: [
        "ceo",
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
      ],
    },
  },
} as const
