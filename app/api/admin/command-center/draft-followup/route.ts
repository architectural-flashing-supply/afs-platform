import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { buildFollowupDraft, summariseItemsForDraft } from '@/lib/data/followup-draft';
import { waitingPhrase } from '@/lib/utils/waiting-time';

/**
 * Drafts (and stores) a follow-up message for a quote the customer has not
 * answered. DRAFTS — it does not send.
 *
 * Why it does not send: quote mail is specified to go out through Microsoft
 * Graph AS Steve, so the copy lands in his own Sent Items and stays in the
 * customer's thread (docs/COMMAND_CENTER_V2_SPEC.md §2.4). None of that exists
 * yet — the spec's own audit records "Microsoft Graph / Outlook: NOTHING" — and
 * pushing this text out through Resend instead would put it outside his mailbox
 * and outside the thread, which is the one outcome the spec rules out. So this
 * writes the words, stores them on the job so they survive a reload, and the
 * screen says plainly that sending is not connected yet.
 *
 * An admin can edit the stored draft; PUTting `draft` here saves their version
 * rather than regenerating over it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    const me = adminProfile as { role?: string; full_name?: string | null } | null;
    if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const quoteRequestId = body.quoteRequestId;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: found } = await admin
      .from('quote_requests')
      .select('id, request_number, user_id, guest_email, line_items, quoted_at, stage_changed_at, job_stage')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (!found) return NextResponse.json({ error: 'That job could not be found.' }, { status: 404 });
    const qr = found as {
      request_number: string;
      user_id: string | null;
      guest_email: string | null;
      line_items: { profileType?: string | null; quantity?: number | null }[] | null;
      quoted_at: string | null;
      stage_changed_at: string | null;
      job_stage: string | null;
    };

    // An admin-supplied edit is saved verbatim. Only a missing/blank `draft`
    // asks this route to write one.
    const supplied = typeof body.draft === 'string' ? body.draft : null;

    let draft: string;
    if (supplied !== null && supplied.trim() !== '') {
      draft = supplied;
    } else {
      let contactFirstName = (qr.guest_email ?? 'there').split('@')[0];
      if (qr.user_id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('full_name')
          .eq('id', qr.user_id)
          .maybeSingle();
        const full = ((profile as { full_name?: string | null } | null)?.full_name ?? '').trim();
        if (full) contactFirstName = full.split(/\s+/)[0];
      }
      draft = buildFollowupDraft({
        contactFirstName,
        itemSummary: summariseItemsForDraft(
          (qr.line_items ?? []).map((i) => ({
            profileType: (i.profileType ?? '').trim() || 'custom profile',
            quantity: Number(i.quantity) > 0 ? Math.round(Number(i.quantity)) : 0,
          }))
        ),
        quotedPhrase: waitingPhrase(qr.quoted_at ?? qr.stage_changed_at, new Date()),
        requestNumber: qr.request_number,
        fromFirstName: (me?.full_name ?? 'AFS').trim().split(/\s+/)[0] || 'AFS',
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('quote_requests')
      .update({ followup_draft: draft, followup_drafted_at: now })
      .eq('id', quoteRequestId);
    if (updateError) {
      console.error('[Draft Followup Error]', updateError);
      return NextResponse.json({ error: 'Could not save the draft. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: supplied ? 'edit_followup_draft' : 'draft_followup',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      afterValue: { characters: draft.length, sent: false },
    });

    return NextResponse.json({
      ok: true,
      draft,
      message:
        'Draft saved. Sending from Outlook is not connected yet — copy this into your email for now.',
    });
  } catch (error) {
    console.error('[Draft Followup Error]', error);
    return NextResponse.json({ error: 'Could not write the draft. Please try again.' }, { status: 500 });
  }
}
