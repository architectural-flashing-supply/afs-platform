import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSamGovOpportunities } from '@/lib/bid-monitor/sources/sam-gov';
import { fetchUSASpendingOpportunities } from '@/lib/bid-monitor/sources/usaspending';
import { fetchTexasESBD } from '@/lib/bid-monitor/sources/texas-esbd';
import { fetchTexasCityPortals } from '@/lib/bid-monitor/sources/texas-cities';
import { fetchTxDOT } from '@/lib/bid-monitor/sources/txdot';
import { sendBidAlertEmails, type BidAlertProject } from '@/lib/bid-monitor/alerts';
import type { BidProject } from '@/lib/bid-monitor/types';

const SOURCE_NAMES = [
  'SAM.gov',
  'USASpending.gov',
  'Texas ESBD',
  'TxDOT Letting Calendar',
  'City of Austin Purchasing',
  'City of San Antonio Purchasing',
  'City of Houston Purchasing',
  'City of Dallas Purchasing',
  'City of Fort Worth Purchasing',
  'City of Arlington Purchasing',
  'City of Lubbock Purchasing',
  'City of Amarillo Purchasing',
  'City of Waco Purchasing',
  'City of Midland Purchasing',
  'City of Odessa Purchasing',
];

export async function POST(): Promise<NextResponse> {
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

    const errors: string[] = [];
    const [samResult, usaResult, esbdResult, cityResult, txdotResult] = await Promise.allSettled([
      fetchSamGovOpportunities(),
      fetchUSASpendingOpportunities(),
      fetchTexasESBD(),
      fetchTexasCityPortals(),
      fetchTxDOT(),
    ]);

    const projects: BidProject[] = [];

    const collect = (label: string, result: PromiseSettledResult<BidProject[]>) => {
      if (result.status === 'fulfilled') {
        projects.push(...result.value);
      } else {
        errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    };

    collect('SAM.gov', samResult);
    collect('USASpending', usaResult);
    collect('Texas ESBD', esbdResult);
    collect('Texas City Portals', cityResult);
    collect('TxDOT', txdotResult);

    let newProjects = 0;
    let alertsSent = false;
    let division7Matches = 0;

    if (projects.length > 0) {
      const sourceIds = Array.from(new Set(projects.map((p) => p.sourceId)));
      const [{ data: existingRows, error: existingError }, { data: sourceRows, error: sourceNamesError }] = await Promise.all([
        supabase.from('bid_projects').select('source_id, external_id').in('source_id', sourceIds),
        supabase.from('bid_sources').select('id, name').in('id', sourceIds),
      ]);

      if (existingError) {
        errors.push(`Could not read existing bid_projects for dedupe: ${existingError.message}`);
      }
      if (sourceNamesError) {
        errors.push(`Could not read bid_sources names for alert email: ${sourceNamesError.message}`);
      }

      const existingKeys = new Set(
        (existingRows ?? []).map((row) => `${row.source_id as string}:${row.external_id as string}`)
      );
      const sourceNames = new Map((sourceRows ?? []).map((row) => [row.id as string, row.name as string]));

      const newProjectsList = projects.filter((p) => !existingKeys.has(`${p.sourceId}:${p.externalId}`));
      newProjects = newProjectsList.length;

      const rows = projects.map((p) => ({
        source_id: p.sourceId,
        external_id: p.externalId,
        title: p.title,
        description: p.description ?? null,
        agency: p.agency ?? null,
        location_city: p.locationCity ?? null,
        location_state: p.locationState ?? null,
        bid_due_date: p.bidDueDate ? p.bidDueDate.toISOString() : null,
        estimated_value: p.estimatedValue ?? null,
        source_url: p.sourceUrl ?? null,
        keywords_matched: p.keywordsMatched,
        division7_relevant: p.division7Relevant,
        raw_data: p.rawData,
      }));

      const { data: upsertedRows, error: upsertError } = await supabase
        .from('bid_projects')
        .upsert(rows, { onConflict: 'source_id,external_id' })
        .select('id, source_id, external_id');

      if (upsertError) {
        errors.push(`Could not save bid_projects: ${upsertError.message}`);
      }

      const upsertedIds = new Map(
        (upsertedRows ?? []).map((row) => [`${row.source_id as string}:${row.external_id as string}`, row.id as string])
      );

      const newDivision7Projects = newProjectsList.filter((p) => p.division7Relevant);
      division7Matches = newDivision7Projects.length;

      const alertProjects: BidAlertProject[] = newDivision7Projects
        .map((p) => {
          const id = upsertedIds.get(`${p.sourceId}:${p.externalId}`);
          if (!id) return null;
          return {
            id,
            title: p.title,
            sourceName: sourceNames.get(p.sourceId) ?? 'Unknown Source',
            locationCity: p.locationCity ?? null,
            locationState: p.locationState ?? null,
            bidDueDate: p.bidDueDate ? p.bidDueDate.toISOString() : null,
            estimatedValue: p.estimatedValue ?? null,
            keywordsMatched: p.keywordsMatched,
            sourceUrl: p.sourceUrl ?? null,
          };
        })
        .filter((p): p is BidAlertProject => p !== null);

      if (alertProjects.length > 0) {
        try {
          const alertResult = await sendBidAlertEmails(supabase, alertProjects);
          alertsSent = alertResult.sent;
          if (alertResult.errors.length > 0) {
            errors.push(...alertResult.errors.map((e) => `Alert email: ${e}`));
          }
        } catch (alertError) {
          errors.push(`Could not send bid alert email: ${alertError instanceof Error ? alertError.message : String(alertError)}`);
        }
      }
    }

    const now = new Date().toISOString();
    const { error: touchError } = await supabase
      .from('bid_sources')
      .update({ last_checked_at: now })
      .in('name', SOURCE_NAMES);
    if (touchError) {
      errors.push(`Could not update bid_sources.last_checked_at: ${touchError.message}`);
    }

    console.log(
      `[Bid Monitor Fetch] fetched=${projects.length} new=${newProjects} division7Matches=${division7Matches} alertsSent=${alertsSent} errors=${errors.length}`
    );
    if (errors.length > 0) {
      console.log('[Bid Monitor Fetch] errors:', errors);
    }

    return NextResponse.json({ fetched: projects.length, newProjects, division7Matches, alertsSent, errors });
  } catch (error) {
    console.error('[Bid Monitor Fetch Error]', error);
    return NextResponse.json({ error: 'Could not fetch bid opportunities. Please try again.' }, { status: 500 });
  }
}
