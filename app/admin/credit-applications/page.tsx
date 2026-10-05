import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCreditApplications } from '@/lib/data/credit';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import CreditApplicationRowActions from '@/components/admin/CreditApplicationRowActions';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
};

/**
 * v7's own pill modifiers, as a map to the WHOLE className — the contrast gate
 * expands class maps but counts a runtime template as `unresolved`
 * (CLAUDE.md rule #28).
 */
const STATUS_PILL: Record<string, string> = {
  submitted: 'pill a',
  under_review: 'pill b',
  approved: 'pill g',
  denied: 'pill r',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminCreditApplicationsPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getCreditApplications(supabase);

  return (
    // STAGE G — Credit Applications lives under "More" and takes the same v7
    // shell and look as the top-level screens: `.greet`, a `.panel`, and the
    // bare <table> v7 styles itself. v7 has no equivalent screen, so there is
    // nothing to port markup from — what it inherits is the shell and the
    // component vocabulary, which is what "the same look" means here.
    <LightWorkingArea>
      <div className="greet">
        <div>
          <h1 className="t">Credit Applications</h1>
          <p className="sub">Net-terms applications submitted by customers.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="none">No applications yet. Submitted credit applications will appear here.</div>
      ) : (
        <section className="panel">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="n">Requested</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.companyName}</td>
                    <td className="n">
                      {row.requestedLimit != null ? `$${row.requestedLimit.toLocaleString()}` : '—'}
                      {row.requestedTerms != null ? ` @ Net ${row.requestedTerms}` : ''}
                    </td>
                    <td>
                      <span className={STATUS_PILL[row.status] ?? 'pill'}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td>{formatDate(row.submittedAt)}</td>
                    <td>
                      <CreditApplicationRowActions application={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </LightWorkingArea>
  );
}
