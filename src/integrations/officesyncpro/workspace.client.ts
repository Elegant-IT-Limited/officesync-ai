import type { TenantCtx, TenantDirectory } from '../../core/tenancy';

/** Reads the workspace's members and time zone from the OfficeSyncPro internal API. */
export class HttpTenantDirectory implements TenantDirectory {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetch: typeof globalThis.fetch = globalThis.fetch) {}

  async load(tenantId: string): Promise<TenantCtx> {
    const res = await this.fetch(`${this.baseUrl}/internal/tenants/${tenantId}/workspace`, { headers: { authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`officesyncpro workspace: HTTP ${res.status}`);
    const w = (await res.json()) as { timeZone: string; members: { id: string; name: string; email: string }[] };
    return { tenantId, timeZone: w.timeZone, members: w.members, now: new Date() };
  }
}
