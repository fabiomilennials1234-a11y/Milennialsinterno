import { z } from 'zod';

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(300),
  done: z.boolean(),
});

export const taskFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  type: z.enum(['BUG', 'FEATURE', 'HOTFIX', 'CHORE']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  sprint_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  estimated_hours: z.number().positive().nullable().optional(),
  acceptance_criteria: z.string().nullable().optional(),
  technical_context: z.string().nullable().optional(),
  git_branch: z.string().nullable().optional(),
  checklist: z.array(checklistItemSchema).default([]),
});

export const sprintFormSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().nullable().optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
}).refine(v => new Date(v.end_date) > new Date(v.start_date), {
  message: 'end_date must be after start_date',
  path: ['end_date'],
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
export type SprintFormValues = z.infer<typeof sprintFormSchema>;
