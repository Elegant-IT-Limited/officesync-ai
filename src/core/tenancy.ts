export interface Member { id: string; name: string; email: string }

/**
 * Everything a stage needs to know about the workspace it runs for. Every service
 * method takes one, so the tenant a call acts for is always visible in its signature
 * and never read from a global or a request-scoped singleton.
 */
export interface TenantCtx {
  tenantId: string;
  timeZone: string; // IANA zone of the workspace, used for every date the pipeline resolves
  members: Member[];
  now: Date;
}

/** Loads a TenantCtx for a tenant id. Bound to the OfficeSyncPro workspace API in production. */
export interface TenantDirectory {
  load(tenantId: string): Promise<TenantCtx>;
}
export const TENANT_DIRECTORY = Symbol('TENANT_DIRECTORY');
