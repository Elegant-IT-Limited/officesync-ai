import { resolveDue } from '../src/ai/due-date';

// Sent Wednesday 23 Sep 2026, 10:12 in New York.
const sent = new Date('2026-09-23T14:12:00Z');
const tz = 'America/New_York';

describe('resolving the deadline a person wrote', () => {
  it.each([
    ['today', '2026-09-23'],
    ['EOD', '2026-09-23'],
    ['tomorrow', '2026-09-24'],
    ['by Friday', '2026-09-25'],
    ['end of week', '2026-09-25'],
    ['Wednesday', '2026-09-30'],
    ['Tuesday next week', '2026-09-29'],
    ['next week', '2026-09-28'],
    ['end of month', '2026-09-30'],
    ['in 10 days', '2026-10-03'],
    ['Oct 3', '2026-10-03'],
    ['5 January', '2027-01-05'],
  ])('"%s" resolves to %s', (phrase, expected) => {
    expect(resolveDue(phrase, sent, tz)).toBe(expected);
  });

  it('uses the local day, so "tomorrow" at 22:30 in New York is not two days away', () => {
    expect(resolveDue('tomorrow', new Date('2026-09-24T02:30:00Z'), tz)).toBe('2026-09-24');
  });

  it('refuses to guess: "next Tuesday" and impossible dates stay unresolved', () => {
    expect(resolveDue('next Tuesday', sent, tz)).toBeNull();
    expect(resolveDue('Feb 30', sent, tz)).toBeNull();
    expect(resolveDue('soon', sent, tz)).toBeNull();
  });
});
