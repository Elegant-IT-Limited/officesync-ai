import { z } from 'zod';

/** What the model is allowed to return for an email. Sent as a strict JSON schema. */
export const Extraction = z.object({
  commitments: z.array(z.object({
    title: z.string().min(3).max(90),
    owner_email: z.string().nullable(),
    due_text: z.string().nullable(),
    quote: z.string().min(8),
  })).max(6),
});
export type Extraction = z.infer<typeof Extraction>;

export const EXTRACTION_PROMPT = `List the concrete commitments in this email: things a named person is asked to do or agrees to do.
title: an imperative task title under 90 characters.
owner_email: the address of the person who should do it, only if the email makes that clear, else null.
due_text: the deadline exactly as written ("by Friday", "end of week"), else null. Do not convert it to a date.
quote: the exact sentence from the email that states the commitment, copied verbatim.
Ignore pleasantries, history and anything already done.`;
