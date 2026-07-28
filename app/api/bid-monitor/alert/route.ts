import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendBidAlertEmails, type BidAlertProject } from '@/lib/bid-monitor/alerts';

interface RawAlertProject {
  id?: unknown;
  title?: unknown;
  sourceName?: unknown;
  locationCity?: unknown;
  locationState?: unknown;
  bidDueDate?: unknown;
  estimatedValue?: unknown;
  keywordsMatched?: unknown;
  sourceUrl?: unknown;
}

function normalizeProject(raw: RawAlertProject): BidAlertProject | null {
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.sourceName !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    title: raw.title,
    sourceName: raw.sourceName,
    locationCity: typeof raw.locationCity === 'string' ? raw.locationCity : null,
    locationState: typeof raw.locationState === 'string' ? raw.locationState : null,
    bidDueDate: typeof raw.bidDueDate === 'string' ? raw.bidDueDate : null,
    estimatedValue: typeof raw.estimatedValue === 'number' ? raw.estimatedValue : null,
    keywordsMatched: Array.isArray(raw.keywordsMatched)
      ? raw.keywordsMatched.filter((k): k is string => typeof k === 'string')
      : [],
    sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : null,
  };
}

/**
 * Sends the "New Opportunities Found" email to the Bid Monitor recipients
 * (lib/bid-monitor/alerts.ts's getAlertRecipients) for a caller-supplied set
 * of Division 7-relevant projects. Called by app/api/bid-monitor/fetch/
 * route.ts right after a fetch upserts new matches, and usable standalone
 * (e.g. a future "resend alert" admin action) since it does its own admin
 * auth rather than trusting the caller.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).projects)) {
      return NextResponse.json({ error: 'Invalid request body — expected { projects: [...] }.' }, { status: 400 });
    }

    const projects = ((raw as { projects: unknown[] }).projects as RawAlertProject[])
      .map(normalizeProject)
      .filter((p): p is BidAlertProject => p !== null);

    if (projects.length === 0) {
      return NextResponse.json({ error: 'No valid projects provided.' }, { status: 400 });
    }

    const result = await sendBidAlertEmails(supabase, projects);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Bid Monitor Alert Error]', error);
    return NextResponse.json({ error: 'Could not send bid alert email. Please try again.' }, { status: 500 });
  }
}
