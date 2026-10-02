import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import V7FilterBar from '@/components/admin/v7/V7FilterBar';
import type { V7CustomersView } from '@/lib/data/v7-view/customers';

/**
 * CUSTOMERS — a transliteration of v7's `pageCustomers()` (prototype line 1519).
 *
 * `.cgrid`: a `.clist` of `.ci` buttons on the left, a `.pv` detail pane on the
 * right with the contact line, a jobs table and a `.grid2` of saved-profile
 * thumbnails. The previous build rendered a flat filtered table instead, which
 * is a different screen — the whole-screen diff reported 20 landmarks missing
 * and 15 extra, which is what "a different screen" looks like in numbers.
 *
 * THE DIRECTORY'S REAL FEATURES SURVIVED THE CHANGE. Role and tier filtering
 * and CSV export have no counterpart in v7 and are not dropped; they sit in
 * v7's own `.bar` and `.greet` (see lib/data/v7-view/customers.ts). That is
 * rule #33's split: v7 wins the layout, existing code wins where it supplies
 * real behaviour.
 */
export default function V7Customers({
  view,
  exportButton,
}: {
  view: V7CustomersView;
  /** The live CSV export control. v7 has no equivalent; omitted in fixture mode. */
  exportButton?: React.ReactNode;
}) {
  return (
    <>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">Customers</h1>
      </div>

      {view.filters.length > 0 && <V7FilterBar filters={view.filters} />}
      {view.showExport && exportButton && <div style={{ marginBottom: '12px' }}>{exportButton}</div>}

      <div className="cgrid">
        <div className="clist" aria-label="Customers">
          {view.list.map((c) => (
            <Link key={c.key} href={c.href} className={c.selected ? 'ci on' : 'ci'}>
              <div>
                <b>{c.company}</b>
                <span className="pn">{c.person}</span>
              </div>
              <span className="oj" title="Open jobs">
                {c.openJobs}
              </span>
            </Link>
          ))}
        </div>

        {view.detail && (
          <section className="pv">
            <h2>{view.detail.name}</h2>
            {view.detail.editing ? (
              /* v7's inline editor: two `.edit-in` fields and Save/Cancel in the
                 contact line's place. Fixture only — see V7CustomerDetail. */
              <div className="acts" style={{ margin: '10px 0 4px' }}>
                <input className="edit-in" defaultValue={view.detail.person} aria-label="Contact person" readOnly />
                <input className="edit-in" defaultValue={view.detail.email} aria-label="Email" readOnly />
                <Link href={view.detail.doneEditHref} className="btn red sm">
                  Save
                </Link>
                <Link href={view.detail.doneEditHref} className="btn line sm">
                  Cancel
                </Link>
              </div>
            ) : (
              <>
                <p className="sub">
                  {view.detail.person} · {view.detail.email}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <Link href={view.detail.editHref} className="btn slate">
                    {view.detail.recordHref ? 'Open the full record' : 'Edit contact'}
                  </Link>
                </div>
              </>
            )}

            <h3 className="s">Jobs</h3>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Item</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {view.detail.jobs.length ? (
                    view.detail.jobs.map((j) => (
                      <tr key={j.key}>
                        <td>
                          <Link href={j.href} className="linkcell">
                            {j.jobId}
                          </Link>
                        </td>
                        <td>{j.item}</td>
                        <td>
                          <StageChip stage={j.stageKey} label={j.stageLabel} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>{view.detail.jobsEmpty}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="s">Saved profiles</h3>
            <div className="grid2">
              {view.detail.profiles === null ? (
                <span className="hint">{view.detail.profilesNote}</span>
              ) : view.detail.profiles.length ? (
                view.detail.profiles.map((p) => (
                  <Link key={p.key} href={p.href} className="thumb lg" aria-label={p.label}>
                    <span className="pl">
                      <V7Drawing kind={p.drawing.kind} d={p.drawing.d} options={{ w: 100, h: 100, pad: 11, sw: 4.6 }} />
                    </span>
                  </Link>
                ))
              ) : (
                <span className="hint">{view.detail.profilesNote}</span>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * v7's `.st.<lane>` chip. Spelled out rather than interpolated: the contrast
 * gate expands class maps but counts a runtime template as `unresolved`, and
 * CLAUDE.md rule #28 treats a rising unresolved count as the gate going blind.
 */
const STAGE_CLASS: Record<string, string> = {
  new: 'st new',
  quoted: 'st quoted',
  approved: 'st approved',
  shop: 'st shop',
  done: 'st done',
};

function StageChip({ stage, label }: { stage: string; label: string }) {
  return <span className={STAGE_CLASS[stage] ?? 'st'}>{label}</span>;
}
