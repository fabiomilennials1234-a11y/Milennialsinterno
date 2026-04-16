import { z } from 'zod';

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(300),
  done: z.boolean(),
});

export const taskFormSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  what: z.string().min(1, 'Descreva o que precisa ser feito'),
  why: z.string().min(1, 'Explique por que isso é importante'),
  acceptance_criteria: z.string().min(1, 'Defina como saber que está pronto'),
  type: z.enum(['BUG', 'FEATURE', 'HOTFIX', 'CHORE']),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  assignee_id: z.string().uuid().nullable().optional(),
  deadline: z.string().nullable().optional(),
  technical_context: z.string().nullable().optional(),
  extra_notes: z.string().nullable().optional(),
});

/** Full schema used internally for updates (includes all DB fields) */
export const taskUpdateSchema = z.object({
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
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  goal: z.string().nullable().optional(),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  end_date: z.string().min(1, 'Data de fim é obrigatória'),
}).refine(v => new Date(v.end_date) > new Date(v.start_date), {
  message: 'Data de fim deve ser após o início',
  path: ['end_date'],
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
export type TaskUpdateValues = z.infer<typeof taskUpdateSchema>;
export type SprintFormValues = z.infer<typeof sprintFormSchema>;
