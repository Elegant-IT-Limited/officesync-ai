import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { TENANT_DIRECTORY, type TenantDirectory } from '../core/tenancy';
import type { GraphMessage } from '../integrations/microsoft-graph/graph.types';
import { MailService } from '../modules/mail/mail.service';

export const MAIL_QUEUE = 'mail-notifications';

export interface MailJob { tenantId: string; message: GraphMessage }

/**
 * One job per Graph change notification. Kept thin on purpose: load the tenant,
 * hand over to the mail service. A RetryableError (every model on the route is
 * down) fails the job, and BullMQ retries it with the queue's backoff.
 */
@Processor(MAIL_QUEUE, { concurrency: 4 })
export class MailNotificationProcessor extends WorkerHost {
  constructor(@Inject(MailService) private readonly mail: MailService, @Inject(TENANT_DIRECTORY) private readonly tenants: TenantDirectory) {
    super();
  }

  async process(job: Job<MailJob>) {
    const ctx = await this.tenants.load(job.data.tenantId);
    return this.mail.processEmail(ctx, job.data.message);
  }
}
