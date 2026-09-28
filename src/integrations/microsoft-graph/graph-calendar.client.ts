import type { FindMeetingTimesResult } from './graph.types';

/** The one calendar call the pipeline makes. An interface, so tests can hand back a recorded response. */
export interface GraphCalendar {
  findMeetingTimes(organizerEmail: string, body: unknown, timeZone: string): Promise<FindMeetingTimesResult>;
}
export const GRAPH_CALENDAR = Symbol('GRAPH_CALENDAR');

/**
 * Microsoft Graph POST /users/{organizer}/findMeetingTimes, with an app-only token.
 * The token provider is injected: OfficeSyncPro already holds the tenant consent and
 * refreshes tokens, so this service never sees a client secret.
 */
export class HttpGraphCalendar implements GraphCalendar {
  constructor(
    private readonly getToken: (tenantHint: string) => Promise<string>,
    private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async findMeetingTimes(organizerEmail: string, body: unknown, timeZone: string): Promise<FindMeetingTimesResult> {
    const res = await this.fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizerEmail)}/findMeetingTimes`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.getToken(organizerEmail)}`,
        'content-type': 'application/json',
        // makes Graph return slot times in the workspace zone instead of UTC
        prefer: `outlook.timezone="${timeZone}"`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`graph findMeetingTimes: HTTP ${res.status}`);
    return (await res.json()) as FindMeetingTimesResult;
  }
}
