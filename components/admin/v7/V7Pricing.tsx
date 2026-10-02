import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import type { V7PricingView } from '@/lib/data/v7-view/pricing';

/**
 * THE PRICING ENGINE — a transliteration of v7's `pagePricing()` (line 1545)
 * and `calcOut()` (line 1527).
 *
 * FIXTURE ONLY. lib/data/v7-view/pricing.ts explains at length why: v7's six
 * free-text rate boxes write to browser memory, and the live screen's numbers
 * go into a VERSIONED, APPEND-ONLY price book that Postgres refuses to update
 * in place (CLAUDE.md rules #19 and #20). Giving Steve v7's controls over that
 * data would be the wrong screen, however faithfully it was drawn.
 *
 * So every control here is RENDERED but inert — `readOnly`, with no handler —
 * because its only job is to be measured against the prototype. That is stated
 * on the screen itself in fixture mode rather than being left for someone to
 * discover by clicking.
 */
export default function V7Pricing({ view }: { view: V7PricingView }) {
  return (
    <>
      <div className="greet" style={{ display: 'block' }}>
        <h1 className="t">Pricing engine</h1>
        <p className="sub">
          Steve fills in the numbers once. Every quote reads from here. Change a number and every
          price updates instantly, and the change is logged.
        </p>
      </div>

      {view.fillHint && (
        <div className="fillhint">
          <b>Empty on purpose.</b> Nothing is priced until you enter your numbers.{' '}
          <Link href="/admin/pricing?example=1&fixture=v7" className="btn amber sm">
            Fill with example numbers (demo only)
          </Link>
        </div>
      )}

      <div className="pgx">
        <div>
          <section className="panel">
            <h2>
              Rates and rules{' '}
              <Link href="/admin/pricing?example=1&fixture=v7" className="btn slate sm">
                Fill example numbers
              </Link>
            </h2>
            <div className="rules">
              {view.fields.map((f) => (
                <label key={f.key}>
                  {f.label}
                  <span className={f.prefix ? 'prefix' : ''}>
                    {f.prefix && <span>{f.prefix}</span>}
                    <input
                      className="f"
                      inputMode="decimal"
                      defaultValue={f.value}
                      placeholder={f.placeholder}
                      aria-label={f.label}
                      readOnly
                    />
                  </span>
                </label>
              ))}
            </div>
            <p className="hint">
              Per-bend is charged for each piece. [Needs your confirmation: per piece or per sheet?]
            </p>
          </section>

          <section className="panel" style={{ marginTop: '16px' }}>
            <h2>
              Sheet costs <span className="tag">10 × 4 ft sheet</span>
            </h2>
            <div className="mrows">
              {view.materials.map((m) => (
                <div className="mr" key={m.id}>
                  <input className="f" defaultValue={m.name} aria-label="Material" readOnly />
                  <span className="prefix">
                    <span>$</span>
                    <input
                      className="f"
                      inputMode="decimal"
                      defaultValue={m.cost}
                      placeholder="sheet cost"
                      aria-label={`Sheet cost for ${m.name}`}
                      readOnly
                    />
                  </span>
                  <button type="button" className="xbtn" aria-label={`Remove ${m.name}`}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="acts">
              <button type="button" className="btn blue sm">
                + Add a material
              </button>
              <button type="button" className="btn line sm">
                Clear all numbers
              </button>
            </div>
          </section>

          <section className="panel" style={{ marginTop: '16px' }}>
            <h2>Pricing history</h2>
            <p className="hint" style={{ margin: '-6px 0 10px' }}>
              Every price, rate change, estimate, quote and supplier notice is recorded and never
              edited or deleted. This is the data behind dynamic pricing later.
            </p>
            {view.historyRows.length ? (
              <div className="tw hist">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>What</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.historyRows.map((h) => (
                      <tr key={h.when + h.what}>
                        <td style={{ whiteSpace: 'nowrap' }}>{h.when}</td>
                        <td>{h.who}</td>
                        <td>{h.what}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="hint">
                Nothing recorded yet. Change a number above or send a quote and it appears here.
              </div>
            )}
          </section>
        </div>

        <section className="panel sprev" style={{ position: 'sticky', top: '96px' }}>
          <h2>Live price check</h2>
          <div className="calc">
            <label style={{ gridColumn: '1/3' }}>
              Saved profile
              <select className="selx" defaultValue={view.selectedProfileId} disabled>
                {view.profileOptions.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select className="selx" defaultValue={view.selectedMaterial} disabled>
                {view.materialOptions.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input className="f" inputMode="numeric" defaultValue={view.quantity} readOnly />
            </label>
            <label
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: '8px',
                gridColumn: '1/3',
                textTransform: 'none',
                letterSpacing: 0,
                fontSize: '14px',
              }}
            >
              <input type="checkbox" defaultChecked={view.rush} disabled /> Rush order
            </label>
          </div>

          <div className="plate" style={{ margin: '12px auto 0', maxWidth: '430px' }}>
            {view.plate && (
              <V7Drawing kind={view.plate.kind} d={view.plate.d} options={{ w: 460, h: 290, dims: true }} />
            )}
          </div>

          <div id="calcout">
            <div className="calcout">
              <table>
                <tbody>
                  {view.calcRows.map((r) => (
                    <tr key={r.label} className={r.result ? 'res' : undefined}>
                      <td>{r.label}</td>
                      <td className="n">{r.missing ? <span className="miss">{r.value}</span> : r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {view.notPriced && (
                <p className="miss" style={{ marginTop: '8px' }}>
                  <b>Not priced yet.</b> {view.notPriced}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
