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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approver_id: string | null
          approver_role: Database["public"]["Enums"]["user_role"]
          card_id: string
          created_at: string
          feedback: string | null
          id: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          approver_id?: string | null
          approver_role: Database["public"]["Enums"]["user_role"]
          card_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          approver_id?: string | null
          approver_role?: Database["public"]["Enums"]["user_role"]
          card_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      captacoes: {
        Row: {
          card_id: string
          created_at: string
          id: string
          location: string | null
          notes: string | null
          reschedule_count: number
          scheduled_at: string
          status: Database["public"]["Enums"]["captacao_status"]
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          reschedule_count?: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["captacao_status"]
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          reschedule_count?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["captacao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacoes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          monthly_value: number
          name: string
          onboarding_doc_url: string | null
          onboarding_meeting_done: boolean
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          monthly_value?: number
          name: string
          onboarding_doc_url?: string | null
          onboarding_meeting_done?: boolean
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          monthly_value?: number
          name?: string
          onboarding_doc_url?: string | null
          onboarding_meeting_done?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      delay_justifications: {
        Row: {
          card_id: string
          created_at: string
          id: string
          justification: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          justification: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          justification?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_justifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_justifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_predefined: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_predefined?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_predefined?: boolean
          name?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          audio_url: string | null
          client_id: string
          created_at: string
          id: string
          project_id: string
          rating: number
          text: string | null
        }
        Insert: {
          audio_url?: string | null
          client_id: string
          created_at?: string
          id?: string
          project_id: string
          rating: number
          text?: string | null
        }
        Update: {
          audio_url?: string | null
          client_id?: string
          created_at?: string
          id?: string
          project_id?: string
          rating?: number
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_records: {
        Row: {
          base_value: number
          bonuses: Json
          created_at: string
          id: string
          month: string
          net_total: number
          payment_date: string | null
          penalties: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          base_value: number
          bonuses?: Json
          created_at?: string
          id?: string
          month: string
          net_total?: number
          payment_date?: string | null
          penalties?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          base_value?: number
          bonuses?: Json
          created_at?: string
          id?: string
          month?: string
          net_total?: number
          payment_date?: string | null
          penalties?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          value: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          value: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          assignee_id: string | null
          block_reason: string | null
          completed_at: string | null
          created_at: string
          id: string
          is_blocked: boolean
          pipeline_type: Database["public"]["Enums"]["pipeline_type"]
          position: number
          project_id: string
          sla_deadline: string | null
          sla_status: Database["public"]["Enums"]["card_sla_status"]
          stage: string
          stage_entered_at: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          block_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          pipeline_type: Database["public"]["Enums"]["pipeline_type"]
          position?: number
          project_id: string
          sla_deadline?: string | null
          sla_status?: Database["public"]["Enums"]["card_sla_status"]
          stage?: string
          stage_entered_at?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          block_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          is_blocked?: boolean
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"]
          position?: number
          project_id?: string
          sla_deadline?: string | null
          sla_status?: Database["public"]["Enums"]["card_sla_status"]
          stage?: string
          stage_entered_at?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          body: string
          createdAt: string
          id: string
          read: boolean
          taskId: string | null
          title: string
          type: string
          userId: string
        }
        Insert: {
          body: string
          createdAt?: string
          id?: string
          read?: boolean
          taskId?: string | null
          title: string
          type: string
          userId: string
        }
        Update: {
          body?: string
          createdAt?: string
          id?: string
          read?: boolean
          taskId?: string | null
          title?: string
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notification_taskId_fkey"
            columns: ["taskId"]
            isOneToOne: false
            referencedRelation: "Task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pontual_entries: {
        Row: {
          category_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          type: Database["public"]["Enums"]["entry_type"]
          value: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          date: string
          description: string
          id?: string
          type: Database["public"]["Enums"]["entry_type"]
          value: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: Database["public"]["Enums"]["entry_type"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pontual_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          current_assignee_role: Database["public"]["Enums"]["user_role"]
          current_stage: string
          cycle_number: number
          id: string
          sla_deadline: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          current_assignee_role?: Database["public"]["Enums"]["user_role"]
          current_stage?: string
          cycle_number?: number
          id?: string
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          current_assignee_role?: Database["public"]["Enums"]["user_role"]
          current_stage?: string
          cycle_number?: number
          id?: string
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_overrides: {
        Row: {
          client_id: string
          created_at: string
          id: string
          month: string
          notes: string | null
          override_value: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          override_value: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          override_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_overrides_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      Sprint: {
        Row: {
          createdAt: string
          endDate: string
          goal: string | null
          id: string
          name: string
          startDate: string
          status: Database["public"]["Enums"]["SprintStatus"]
        }
        Insert: {
          createdAt?: string
          endDate: string
          goal?: string | null
          id?: string
          name: string
          startDate: string
          status?: Database["public"]["Enums"]["SprintStatus"]
        }
        Update: {
          createdAt?: string
          endDate?: string
          goal?: string | null
          id?: string
          name?: string
          startDate?: string
          status?: Database["public"]["Enums"]["SprintStatus"]
        }
        Relationships: []
      }
      Task: {
        Row: {
          acceptanceCriteria: string | null
          assigneeId: string | null
          blockerReason: string | null
          checklist: Json
          createdAt: string
          createdById: string
          deadline: string | null
          description: string | null
          estimatedHours: number | null
          gitBranch: string | null
          id: string
          isBlocked: boolean
          priority: Database["public"]["Enums"]["Priority"]
          sprintId: string | null
          status: Database["public"]["Enums"]["TaskStatus"]
          technicalContext: string | null
          title: string
          type: Database["public"]["Enums"]["TaskType"]
          updatedAt: string
        }
        Insert: {
          acceptanceCriteria?: string | null
          assigneeId?: string | null
          blockerReason?: string | null
          checklist?: Json
          createdAt?: string
          createdById: string
          deadline?: string | null
          description?: string | null
          estimatedHours?: number | null
          gitBranch?: string | null
          id?: string
          isBlocked?: boolean
          priority: Database["public"]["Enums"]["Priority"]
          sprintId?: string | null
          status?: Database["public"]["Enums"]["TaskStatus"]
          technicalContext?: string | null
          title: string
          type: Database["public"]["Enums"]["TaskType"]
          updatedAt?: string
        }
        Update: {
          acceptanceCriteria?: string | null
          assigneeId?: string | null
          blockerReason?: string | null
          checklist?: Json
          createdAt?: string
          createdById?: string
          deadline?: string | null
          description?: string | null
          estimatedHours?: number | null
          gitBranch?: string | null
          id?: string
          isBlocked?: boolean
          priority?: Database["public"]["Enums"]["Priority"]
          sprintId?: string | null
          status?: Database["public"]["Enums"]["TaskStatus"]
          technicalContext?: string | null
          title?: string
          type?: Database["public"]["Enums"]["TaskType"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Task_assigneeId_fkey"
            columns: ["assigneeId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Task_createdById_fkey"
            columns: ["createdById"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Task_sprintId_fkey"
            columns: ["sprintId"]
            isOneToOne: false
            referencedRelation: "Sprint"
            referencedColumns: ["id"]
          },
        ]
      }
      TaskActivity: {
        Row: {
          createdAt: string
          data: Json
          id: string
          taskId: string
          type: string
          userId: string
        }
        Insert: {
          createdAt?: string
          data: Json
          id?: string
          taskId: string
          type: string
          userId: string
        }
        Update: {
          createdAt?: string
          data?: Json
          id?: string
          taskId?: string
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TaskActivity_taskId_fkey"
            columns: ["taskId"]
            isOneToOne: false
            referencedRelation: "Task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TaskActivity_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      TaskCollaborator: {
        Row: {
          taskId: string
          userId: string
        }
        Insert: {
          taskId: string
          userId: string
        }
        Update: {
          taskId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TaskCollaborator_taskId_fkey"
            columns: ["taskId"]
            isOneToOne: false
            referencedRelation: "Task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TaskCollaborator_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      TeamSettings: {
        Row: {
          hotfixReceiverIds: Json
          hotfixRouting: string
          id: string
          updatedAt: string
        }
        Insert: {
          hotfixReceiverIds?: Json
          hotfixRouting?: string
          id?: string
          updatedAt?: string
        }
        Update: {
          hotfixReceiverIds?: Json
          hotfixRouting?: string
          id?: string
          updatedAt?: string
        }
        Relationships: []
      }
      TimeEntry: {
        Row: {
          createdAt: string
          id: string
          taskId: string
          type: Database["public"]["Enums"]["TimeEntryType"]
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          taskId: string
          type: Database["public"]["Enums"]["TimeEntryType"]
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          taskId?: string
          type?: Database["public"]["Enums"]["TimeEntryType"]
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "TimeEntry_taskId_fkey"
            columns: ["taskId"]
            isOneToOne: false
            referencedRelation: "Task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TimeEntry_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          avatarColor: string
          createdAt: string
          email: string
          id: string
          isHotfixReceiver: boolean
          name: string
          passwordHash: string
          role: Database["public"]["Enums"]["Role"]
          seniority: Database["public"]["Enums"]["Seniority"]
        }
        Insert: {
          avatarColor?: string
          createdAt?: string
          email: string
          id?: string
          isHotfixReceiver?: boolean
          name: string
          passwordHash: string
          role?: Database["public"]["Enums"]["Role"]
          seniority?: Database["public"]["Enums"]["Seniority"]
        }
        Update: {
          avatarColor?: string
          createdAt?: string
          email?: string
          id?: string
          isHotfixReceiver?: boolean
          name?: string
          passwordHash?: string
          role?: Database["public"]["Enums"]["Role"]
          seniority?: Database["public"]["Enums"]["Seniority"]
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          issued_by: string
          justification: string
          level: Database["public"]["Enums"]["warning_level"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by: string
          justification: string
          level: Database["public"]["Enums"]["warning_level"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string
          justification?: string
          level?: Database["public"]["Enums"]["warning_level"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warnings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      stage_display_label: { Args: { p_stage: string }; Returns: string }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      captacao_status: "confirmed" | "rescheduled" | "cancelled"
      card_sla_status: "ok" | "at_risk" | "overdue"
      entry_type: "income" | "expense"
      pipeline_type: "redator" | "filmmaker" | "editor"
      Priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      project_status: "active" | "completed" | "cancelled"
      Role: "CTO" | "DEV"
      Seniority: "JUNIOR" | "PLENO" | "SENIOR"
      SprintStatus: "PLANNING" | "ACTIVE" | "COMPLETED"
      TaskStatus: "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"
      TaskType: "BUG" | "FEATURE" | "HOTFIX" | "CHORE"
      TimeEntryType: "START" | "PAUSE" | "RESUME" | "STOP"
      user_role:
        | "admin"
        | "cto"
        | "redator"
        | "filmmaker"
        | "editor"
        | "cliente"
      warning_level: "first" | "second" | "third"
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
      approval_status: ["pending", "approved", "rejected"],
      captacao_status: ["confirmed", "rescheduled", "cancelled"],
      card_sla_status: ["ok", "at_risk", "overdue"],
      entry_type: ["income", "expense"],
      pipeline_type: ["redator", "filmmaker", "editor"],
      Priority: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      project_status: ["active", "completed", "cancelled"],
      Role: ["CTO", "DEV"],
      Seniority: ["JUNIOR", "PLENO", "SENIOR"],
      SprintStatus: ["PLANNING", "ACTIVE", "COMPLETED"],
      TaskStatus: ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"],
      TaskType: ["BUG", "FEATURE", "HOTFIX", "CHORE"],
      TimeEntryType: ["START", "PAUSE", "RESUME", "STOP"],
      user_role: ["admin", "cto", "redator", "filmmaker", "editor", "cliente"],
      warning_level: ["first", "second", "third"],
    },
  },
} as const
