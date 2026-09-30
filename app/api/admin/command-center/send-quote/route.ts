import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isJobStage, planStageTransition, type JobStageValue } from '@/lib/data/job-stage';
import { issueQuoteForJob, resolveQuoteCustomer, type JobForQuote } from '@/lib/quotes/issue';

/**
 * SEND QUOTE — the one primary action on a New job.
 *
 * It prices the job from the price book, writes the quote, mints the signed
 * single-use Approve link, emails it, and moves the job to Quoted. Everything
 * that makes that safe lives in lib/quotes/issue.ts; this route is the
 * authorisation and the plain-English answer.
 *
 * IT SENDS NOTHING TO THE MACHINE. It does not import
 * lib/integrations/pathfinder-edge.ts, and a quote being sent is not an
 * approval — the customer has not said yes yet.
 *
 * A BLOCKED QUOTE IS A 409 WITH THE REASONS, NOT A 500. "Galvalume 24 GA is
 * missing Per bend in the price book" is something Steve can act on; "Internal
 * server error" is not.
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
      .select('role, email')
      .eq('id', user.id)
      .single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const quoteRequestId = body.quoteRequestId;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }
    const sendTo = typeof body.sendTo === 'string' && body.sendTo.trim() !== '' ? body.sendTo.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes : null;

    // The estimator's own per-line quantity from the editable quote table.
    // Validated here rather than trusted: a fractional or negative count would
    // otherwise reach the maths, which refuses it anyway but with a message
    // about the job rather than about the box that was typed in.
    let quantityOverrides: (number | null)[] | null = null;
    if (body.quantities !== undefined) {
      if (!Array.isArray(body.quantities)) {
        return NextResponse.json({ error: 'quantities must be a list, one per line item.' }, { status: 400 });
      }
      quantityOverrides = body.quantities.map((value) =>
        typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
      );
      if (body.quantities.some((v, i) => v !== null && v !== undefined && quantityOverrides?.[i] === null)) {
        return NextResponse.json(
          { error: 'Every quantity has to be a whole number of pieces, one or more.' },
          { status: 400 }
        );
      }
    }

    const admin = createAdminClient();
    const { data: found } = await admin
      .from('quote_requests')
      .select(
        'id, request_number, job_name, line_items, user_id, guest_email, is_rush, po_number, client_business_name, client_name, job_stage, quote_id'
      )
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (!found) {
      return NextResponse.json({ error: 'That job could not be found.' }, { status: 404 });
    }
    const job = found as JobForQuote;

    // A quote may be sent from New, and RE-sent from Quoted as a revision.
    // Anything further along has already been decided, and a new price then
    // would contradict what the customer approved.
    const from: JobStageValue = isJobStage(job.job_stage) ? job.job_stage : null;
    if (from !== 'new' && from !== 'quoted') {
      const transition = planStageTransition(from, 'quoted');
      return NextResponse.json(
        {
          error:
            transition.outcome === 'refused'
              ? transition.message
              : 'This job is past the quoting stage, so a new quote cannot be sent from here.',
        },
        { status: 409 }
      );
    }

    const { data: profile } = job.user_id
      ? await admin.from('profiles').select('full_name, email, company').eq('id', job.user_id).maybeSingle()
      : { data: null };
    const customer = resolveQuoteCustomer(
      job,
      profile as { full_name?: string | null; email?: string | null; company?: string | null } | null
    );

    const result = await issueQuoteForJob(admin, job, customer, {
      actor: { id: user.id, email: (adminProfile as { email?: string | null })?.email ?? user.email ?? null, role: 'admin' },
      sendTo,
      notes,
      quantityOverrides,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message, problems: result.problems }, { status: 409 });
    }

    await logAdminAction({
      adminId: user.id,
      action: result.revision > 1 ? 'send_quote_revision' : 'send_quote',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      beforeValue: { jobStage: job.job_stage },
      afterValue: {
        jobStage: 'quoted',
        quoteId: result.quoteId,
        quoteNumber: result.quoteNumber,
        revision: result.revision,
        totalCents: result.totalCents,
        emailStatus: result.emailStatus,
        pathfinderPushed: false,
      },
    });

    return NextResponse.json({
      ok: true,
      quoteId: result.quoteId,
      quoteNumber: result.quoteNumber,
      revision: result.revision,
      totalCents: result.totalCents,
      emailStatus: result.emailStatus,
      jobStage: 'quoted',
      message: result.message,
    });
  } catch (error) {
    console.error('[Send Quote Error]', error);
    return NextResponse.json({ error: 'Could not send that quote. Please try again.' }, { status: 500 });
  }
}
