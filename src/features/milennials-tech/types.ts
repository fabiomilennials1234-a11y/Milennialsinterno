import type { Database } from '@/integrations/supabase/types';

export type TechTask = Database['public']['Tables']['tech_tasks']['Row'];
export type TechTaskInsert = Database['public']['Tables']['tech_tasks']['Insert'];
export type TechTaskUpdate = Database['public']['Tables']['tech_tasks']['Update'];
export type TechSprint = Database['public']['Tables']['tech_sprints']['Row'];
export type TechTimeEntry = Database['public']['Tables']['tech_time_entries']['Row'];
export type TechTaskActivity = Database['public']['Tables']['tech_task_activities']['Row'];

export type TechTaskStatus = Database['public']['Enums']['tech_task_status'];
export type TechTaskType = Database['public']['Enums']['tech_task_type'];
export type TechTaskPriority = Database['public']['Enums']['tech_task_priority'];
export type TechSprintStatus = Database['public']['Enums']['tech_sprint_status'];

export type ChecklistItem = { id: string; text: string; done: boolean };
