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

export interface GraphSlot { start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }

export interface FindMeetingTimesResult {
  emptySuggestionsReason?: string;
  meetingTimeSuggestions: { confidence: number; meetingTimeSlot: GraphSlot; organizerAvailability: string }[];
}
