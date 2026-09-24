import { prefilter } from '../src/ai/prefilter';
import { prepare } from '../src/ai/prepare';
import { clientThread, invoicePaid, newsletter } from './fixtures';

describe('preparing a message', () => {
  it('keeps the new reply and cuts the quoted Outlook history under it', () => {
    const { text } = prepare(clientThread);
    expect(text).toContain('Could you send the revised homepage wireframes by Friday?');
    expect(text).toContain("Omar mentioned he'd check the analytics tagging");
    expect(text).not.toContain('Q4 pricing');
    expect(text).not.toContain('Sent: Tuesday');
  });

  it('collects every participant on the thread, lower-cased and unique', () => {
    expect(prepare(clientThread).participants).toEqual(['megan@harlowpike.example', 'dana@brightline.example', 'omar@brightline.example']);
  });

  it('skips mailing lists and automated mail before any model sees them', () => {
    expect(prefilter(newsletter)).toBe('mailing_list');
    expect(prefilter({ ...invoicePaid, subject: 'Accepted: Phase 2 kickoff' })).toBe('calendar_response');
    expect(prefilter({ ...invoicePaid, from: { emailAddress: { name: 'Stripe', address: 'no-reply@stripe.example' } } })).toBe('automated_sender');
    expect(prefilter(clientThread)).toBeNull();
  });
});
