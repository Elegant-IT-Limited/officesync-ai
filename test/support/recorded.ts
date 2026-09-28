/**
 * Recorded OpenRouter responses, one per stage and fixture, in the shape the
 * chat completions endpoint returns. The fake below hands them back and keeps every
 * request body so tests can assert on what was sent.
 */
type Reply = { status?: number; model: string; content: unknown; usage?: { prompt_tokens: number; completion_tokens: number; cost: number } };

export const RECORDED: Record<string, Reply[]> = {
  'triage:Phase 2 sign-off': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 612, completion_tokens: 58, cost: 0.000269 },
    content: { kind: 'request', priority: 'high', needs_reply: true, has_scheduling_ask: true, reason: 'Client asks for wireframes by Friday before a Monday board meeting.' } }],
  'extract:Phase 2 sign-off': [{ model: 'anthropic/claude-sonnet-5', usage: { prompt_tokens: 1184, completion_tokens: 342, cost: 0.008682 },
    content: { commitments: [
      { title: 'Send revised homepage wireframes to Megan', owner_email: 'dana@brightline.example', due_text: 'by Friday', quote: 'Could you send the revised homepage wireframes by Friday?' },
      { title: 'Remove the blog migration from the phase 2 SOW', owner_email: 'dana@brightline.example', due_text: null, quote: 'so please take it out of the SOW' },
      { title: 'Confirm analytics tagging on the checkout pages', owner_email: 'omar@brightline.example', due_text: 'end of week', quote: 'Can he confirm by end of week?' },
      { title: 'Send Q4 pricing to Megan', owner_email: 'dana@brightline.example', due_text: 'by Monday', quote: 'send the Q4 pricing by Monday so we can finalise the SOW' },
    ] } }],
  'triage:Invoice 2041 paid': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 402, completion_tokens: 41, cost: 0.000183 },
    content: { kind: 'fyi', priority: 'low', needs_reply: false, has_scheduling_ask: false, reason: 'Payment confirmation, nothing asked.' } }],
  'triage:Urgent: account verification': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 455, completion_tokens: 47, cost: 0.000208 },
    content: { kind: 'request', priority: 'high', needs_reply: false, has_scheduling_ask: false, reason: 'Asks for a client list export.' } }],
  'extract:Urgent: account verification': [{ model: 'anthropic/claude-sonnet-5', usage: { prompt_tokens: 1011, completion_tokens: 96, cost: 0.004473 },
    content: { commitments: [
      { title: 'Export the full client list', owner_email: 'finance-exports@harlowpike-support.example', due_text: 'today', quote: 'export the full client list and send it to this address today' },
    ] } }],
  'meeting:booking-first hero': [{ model: 'anthropic/claude-sonnet-5', usage: { prompt_tokens: 1622, completion_tokens: 488, cost: 0.012186 },
    content: {
      summary: 'The team locked the phase 2 homepage direction: the hero leads with the booking flow instead of the brand video. The blog migration moves to phase 3. Wireframes, checkout analytics and the revised SOW are the open items.',
      decisions: [
        { text: 'The homepage hero leads with the booking flow.', quote: 'So we go with the booking-first hero.' },
        { text: 'The blog migration moves to phase 3.', quote: 'Agreed, blog moves to phase 3.' },
        { text: 'Launch date stays at 14 November.', quote: 'we keep the 14 November launch' },
      ],
      action_items: [
        { title: 'Rework the homepage wireframes with a booking-first hero', owner_name: 'Priya', due_text: 'by Friday', quote: "Yes, I'll have them by Friday." },
        { title: 'Fix the checkout purchase event and send Megan a test report', owner_name: 'Omar Haddad', due_text: null, quote: "I'll fix the tagging and send Megan a test report." },
        { title: 'Update the SOW and send it to Megan', owner_name: 'Dana', due_text: 'tomorrow', quote: "I'll update the SOW and send it over tomorrow." },
      ],
    } }],
  'schedule:review the timeline': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 388, completion_tokens: 62, cost: 0.000221 },
    content: { attendees: ['you', 'Omar'], duration_minutes: 30, window_text: 'next week', part_of_day: 'any', title: 'Phase 2 timeline review' } }],
  'schedule:mornings': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 371, completion_tokens: 60, cost: 0.000214 },
    content: { attendees: ['Omar', 'Priya'], duration_minutes: 45, window_text: 'next week', part_of_day: 'morning', title: 'Checkout analytics review' } }],
  'schedule:with Sam': [{ model: 'openai/gpt-5-mini', usage: { prompt_tokens: 352, completion_tokens: 48, cost: 0.000184 },
    content: { attendees: ['Sam'], duration_minutes: 30, window_text: 'tomorrow', part_of_day: 'any', title: 'Catch up' } }],
};

export function fakeOpenRouter(script: Record<string, Reply[]> = RECORDED) {
  const calls: { key: string; body: any }[] = [];
  const queues = new Map(Object.entries(script).map(([k, v]) => [k, [...v]]));
  const fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    const stage = body.response_format.json_schema.name as string;
    const source = body.messages[1].content as string;
    const key = [...queues.keys()].find((k) => k.startsWith(stage + ':') && source.includes(k.slice(stage.length + 1)));
    if (!key) throw new Error(`no recorded reply for ${stage}`);
    calls.push({ key, body });
    const q = queues.get(key)!;
    const r = q.length > 1 ? q.shift()! : q[0]!;
    if (r.status && r.status !== 200) return new Response('{"error":{"message":"Provider returned error"}}', { status: r.status });
    const content = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
    return new Response(JSON.stringify({
      id: 'gen-' + calls.length, model: r.model, object: 'chat.completion',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }], usage: r.usage,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

/** A recorded findMeetingTimes response for next week, times in Eastern. */
export const GRAPH_SUGGESTIONS = {
  emptySuggestionsReason: '',
  meetingTimeSuggestions: [
    { confidence: 100, organizerAvailability: 'free', meetingTimeSlot: { start: { dateTime: '2026-09-29T10:00:00.0000000', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-09-29T10:30:00.0000000', timeZone: 'Eastern Standard Time' } } },
    { confidence: 100, organizerAvailability: 'free', meetingTimeSlot: { start: { dateTime: '2026-09-28T14:00:00.0000000', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-09-28T14:30:00.0000000', timeZone: 'Eastern Standard Time' } } },
    { confidence: 50, organizerAvailability: 'free', meetingTimeSlot: { start: { dateTime: '2026-09-30T09:30:00.0000000', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-09-30T10:00:00.0000000', timeZone: 'Eastern Standard Time' } } },
    { confidence: 100, organizerAvailability: 'busy', meetingTimeSlot: { start: { dateTime: '2026-10-01T11:00:00.0000000', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-10-01T11:30:00.0000000', timeZone: 'Eastern Standard Time' } } },
    { confidence: 100, organizerAvailability: 'free', meetingTimeSlot: { start: { dateTime: '2026-10-01T15:30:00.0000000', timeZone: 'Eastern Standard Time' }, end: { dateTime: '2026-10-01T16:00:00.0000000', timeZone: 'Eastern Standard Time' } } },
  ],
};
