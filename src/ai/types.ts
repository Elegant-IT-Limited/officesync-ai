export interface Address { name: string; address: string }

/** The subset of a Microsoft Graph message resource the pipeline reads. */
export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: { emailAddress: Address };
  toRecipients: { emailAddress: Address }[];
  ccRecipients: { emailAddress: Address }[];
  sentDateTime: string;
  body: { contentType: 'html' | 'text'; content: string };
  internetMessageHeaders?: { name: string; value: string }[];
}

export interface Member { id: string; name: string; email: string }

/** Everything a stage needs to know about the workspace it is running for. */
export interface Ctx {
  tenantId: string;
  timeZone: string;
  members: Member[];
  now: Date;
}
