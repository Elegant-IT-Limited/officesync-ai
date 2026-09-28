import { z } from 'zod';

// Every decision and action item must carry the exact words it came from. The quote is
// what the service checks against the transcript; without it, nothing can be verified.
export const MeetingNotes = z.object({
  summary: z.string().max(700),
  decisions: z.array(z.object({ text: z.string().max(200), quote: z.string().min(8) })).max(8),
  action_items: z.array(z.object({
    title: z.string().min(3).max(90), owner_name: z.string().nullable(), due_text: z.string().nullable(), quote: z.string().min(8),
  })).max(12),
});

export const MEETING_PROMPT = `You are given a meeting transcript as numbered speaker turns.
summary: what the meeting covered and where it landed, in plain sentences, under 700 characters.
decisions: things the group agreed, each with the exact words from the transcript that show it.
action_items: work someone took on or was given, with the owner's name as spoken, the deadline as spoken, and the exact words.`;
