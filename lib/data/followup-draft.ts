/**
 * The follow-up message drafted for a stale quote.
 *
 * DRAFTED, NOT SENT, and the screen says so. Outbound quote mail is meant to go
 * through Microsoft Graph as Steve so it lands in his own Sent Items and stays
 * in the thread — that is Phase 4 of docs/COMMAND_CENTER_V2_SPEC.md and it does
 * not exist yet (§2.4: "Microsoft Graph / Outlook: NOTHING"). Sending this text
 * through Resend instead would put it outside his mailbox and outside the
 * thread, which is the one thing the spec rules out. So the draft is written,
 * stored on the job and offered to be copied, and the UI states plainly that
 * sending is not connected yet. That is honest; a Send button that quietly used
 * the wrong channel would not be.
 *
 * TEMPLATE, NOT AI. There is no customer-specific judgement in a "did you get
 * our quote" note, and an AI call here would add a model dependency, a cost and
 * a failure mode to a four-sentence message. Every variable part comes from the
 * job record.
 *
 * Pure, so the wording is unit-tested rather than eyeballed.
 */

export interface FollowupDraftInput {
  contactFirstName: string;
  /** e.g. "7 pieces of drip edge". Already written as prose by the caller. */
  itemSummary: string;
  /** e.g. "4 days ago". Null when the quote has no recorded send date. */
  quotedPhrase: string | null;
  requestNumber: string;
  /** Who is signing it — the admin's own first name. */
  fromFirstName: string;
}

export function buildFollowupDraft(input: FollowupDraftInput): string {
  const when = input.quotedPhrase ? ` ${input.quotedPhrase}` : '';
  return [
    `Hi ${input.contactFirstName},`,
    '',
    `I sent over a quote${when} for ${input.itemSummary} (${input.requestNumber}) and wanted to make sure it reached you.`,
    '',
    'If it looks right, reply to this message or give me a call and we will get it into production. If anything needs changing — quantity, gauge, colour, length — tell me what to change and I will send a revised quote the same day.',
    '',
    'Thanks,',
    input.fromFirstName,
  ].join('\n');
}

/** "7 pieces of drip edge" / "3 items, 19 pieces in total" — prose for the draft. */
export function summariseItemsForDraft(
  items: { profileType: string; quantity: number }[]
): string {
  if (items.length === 0) return 'your recent request';
  if (items.length === 1) {
    const { profileType, quantity } = items[0];
    const name = profileType.toLowerCase();
    return quantity > 0 ? `${quantity} ${quantity === 1 ? 'piece' : 'pieces'} of ${name}` : name;
  }
  const total = items.reduce((sum, i) => sum + i.quantity, 0);
  return `${items.length} items${total > 0 ? `, ${total} pieces in total` : ''}`;
}
