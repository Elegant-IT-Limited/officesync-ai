import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// .strict(): an unknown field (a tenantId, a userId) is a 400, never a silent override
export const AcceptBody = z.object({
  title: z.string().min(3).max(90).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: isoDate.nullable().optional(),
}).strict();
export type AcceptBody = z.infer<typeof AcceptBody>;
