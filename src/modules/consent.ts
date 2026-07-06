/**
 * Rule 2 enforcement, in code: marketing messages go only to contacts who
 * opted in and never opted out. Pure function — every send path calls this,
 * and the unit tests in tests/consent.test.ts pin the behavior.
 *
 * Opt-out is permanent: optedOutAt set means NO, even if optedIn is still
 * true in the row.
 */

export interface ConsentFields {
  optedIn: boolean;
  optedOutAt: Date | null;
}

export function canSendMarketing(contact: ConsentFields): boolean {
  return contact.optedIn === true && contact.optedOutAt === null;
}
