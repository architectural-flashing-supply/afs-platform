import Link from 'next/link';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import { V7Btn, V7ColorLine, V7Legend, V7Plate, V7Spec } from '@/components/admin/v7/V7Primitives';
import type { V7CheckRow, V7JobStagePane, V7JobView } from '@/lib/data/v7-view/job';

/**
 * THE JOB SCREEN — a transliteration of v7's `pageJob()` (prototype line 1420),
 * `requestPane()` (1319), `profilePane()` (1426) and the five `stagePane()`
 * branches (1357).
 *
 * THREE COLUMNS, and the third is a different pane per stage. Eight of the
 * manifest's screens are this one page: New with a change asked for, New with
 * no saved profile, New from a field-app photo, Quoted, Approved, bending,
 * finished and Delivered.
 *
 * FIXTURE ONLY, and the reason is the strongest in this whole port. The live
 * Job screen keeps `JobActionPanel`, which really sends a quote, really records
 * a phone approval and really opens THE ONE DOOR to the machine — CLAUDE.md
 * rule #14, where a verified admin approval is the only thing that reaches
 * catalog 20115 and a physical Thalmann collects whatever lands there. v7's
 * equivalent pane has a button reading "Pretend Mike clicked Approve". Those
 * two cannot be the same component, and the live one is not the one to replace.
 *
 * So this renders v7's layout with v7's job in it, which is what lets the gate
 * measure the three-column grid, the stage strip, the parser-reading rows, the
 * profile plate and table, and each of the five panes.
 */
export default function V7Job({ view }: { view: V7JobView }) {
  return (
    <>
      <Link href="/admin/command-center?fixture=v7" className="crumb">
        ← Back to Workbench
      </Link>

      <div className="jh">
        <div>
          <h1 className="t">
            {view.customer}: {view.kindLower}
          </h1>
          <p className="sub" id="jsub">
            {view.sub}
          </p>
        </div>
        <div className="steps" role="list" aria-label="Job stage">
          {view.steps.map((s) => (
            <span key={s.label} role="listitem" className={s.state ? `step ${s.state}` : 'step'}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="cols">
        <RequestPane view={view} />
        <ProfilePane view={view} />
        <section className="pane" id="stagepane">
          <StagePane pane={view.stage} />
        </section>
      </div>
    </>
  );
}

function RequestPane({ view }: { view: V7JobView }) {
  const r = view.request;
  return (
    <section className="pane">
      <h2>
        The request <span className="tag">{r.tag}</span>
      </h2>
      <p className="from">
        From <b>{r.from}</b>, {r.company}
      </p>
      <div className="mail">{r.body}</div>
      {r.attachment && <div className="att">📎 {r.attachment} · 1 page</div>}
      {r.sourceHref && (
        <div style={{ marginTop: '12px' }}>
          <Link href={r.sourceHref} className="btn blue">
            View original email beside this reading
          </Link>
        </div>
      )}
      <div className="read">
        <h3>{r.readTitle}</h3>
        {r.rows.map((row) => (
          <div className={row.unsure ? 'row unsure' : 'row'} key={row.k}>
            <span className="k">{row.k}</span>
            <span className="v">{row.v}</span>
            {row.button ? (
              <V7Btn button={row.button} />
            ) : (
              <span className={row.sure ? 'sure' : undefined}>{row.sure}</span>
            )}
          </div>
        ))}
      </div>
      {r.note && <p className="note">{r.note}</p>}
    </section>
  );
}

function ProfilePane({ view }: { view: V7JobView }) {
  const p = view.profile;
  return (
    <section className="pane">
      <h2>
        The profile <span className="tag">{p.tag}</span>
      </h2>
      <V7Plate drawing={p.drawing} ang />
      <V7Legend />

      <div className={`pstrip ${p.strip.tone}`}>
        <div>
          <b>{p.strip.title}</b>
          {p.strip.body}
          {p.strip.emphasis && (
            <>
              <br />
              <b style={{ display: 'inline' }}>{p.strip.emphasis}</b>
            </>
          )}
          {p.strip.extra && (
            <>
              <br />
              {p.strip.extra}
            </>
          )}
          <br />
          <V7Btn button={p.strip.button} />
        </div>
      </div>

      <dl className="sp">
        {p.spec.map((s) => (
          <Fragmentish key={s.term}>
            <dt>{s.term}</dt>
            <dd>
              {s.colorNote !== undefined && s.chip ? (
                <V7ColorLine spec={s.chip} note={s.colorNote} />
              ) : s.chip ? (
                <V7Spec spec={s.chip} />
              ) : (
                s.value
              )}
            </dd>
          </Fragmentish>
        ))}
      </dl>

      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Length</th>
              <th>Angle</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row, i) => (
              <tr
                key={`${row.label}-${i}`}
                // v7 marks a changed row with an inline background and an inset
                // left bar rather than a class. Kept inline for that reason.
                style={row.changed ? { background: '#EAF0FD', boxShadow: 'inset 5px 0 0 #2B63D9' } : undefined}
              >
                <td>
                  {row.label}
                  {row.hem && <span className="tag red">hem</span>}
                </td>
                <td>
                  {row.length}
                  {row.changed && <span className="tag blue">changed</span>}
                </td>
                <td>{row.angle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="past">
        <h3>{p.pastTitle}</h3>
        <div className="pt">
          {p.past.length ? (
            p.past.map((x) => (
              <Link key={x.key} href={x.href} className="thumb" aria-label={x.label}>
                <span className="pl">
                  <V7Drawing kind={x.drawing.kind} d={x.drawing.d} options={{ w: 100, h: 100, pad: 11, sw: 4.6 }} />
                </span>
              </Link>
            ))
          ) : (
            <span className="hint">{p.pastEmpty}</span>
          )}
        </div>
      </div>
    </section>
  );
}

/** `<dl>` children must be dt/dd siblings, so the pair needs a keyed fragment. */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StagePane({ pane }: { pane: V7JobStagePane }) {
  if (pane.kind === 'quote') {
    return (
      <>
        <h2>
          {pane.heading} <span className="tag">{pane.tag}</span>
        </h2>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="n">Qty</th>
                <th className="n">Each</th>
                <th className="n">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>{pane.itemName}</b>
                  <br />
                  <span className="note">
                    <V7Spec spec={pane.spec} /> · 10 ft
                  </span>
                </td>
                <td className="n">
                  <input
                    className="f"
                    inputMode="numeric"
                    style={{ width: '70px', textAlign: 'right' }}
                    defaultValue={pane.qty}
                    aria-label="Quantity"
                    readOnly
                  />
                </td>
                <td className="n">
                  <input
                    className={pane.unit ? 'f' : 'f need'}
                    inputMode="decimal"
                    style={{ width: '96px', textAlign: 'right' }}
                    placeholder="$ price"
                    defaultValue={pane.unit}
                    aria-label="Price each"
                    readOnly
                  />
                </td>
                <td className="n">{pane.lineText}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="engbox">
          <div className="eng">
            <b>Pricing engine</b> is waiting for numbers: {pane.engine.missing.join(', ')}.
            <div className="docbar">
              {pane.engine.buttons.map((b) => (
                <V7Btn key={b.label} button={b} />
              ))}
            </div>
          </div>
        </div>

        <table className="tot" style={{ marginTop: '12px' }}>
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td className="n">{pane.totals.sub}</td>
            </tr>
            <tr>
              <td>Sales tax ({pane.totals.taxPct}%)</td>
              <td className="n">{pane.totals.tax}</td>
            </tr>
            <tr className="big">
              <td>Total</td>
              <td className="n">{pane.totals.tot}</td>
            </tr>
          </tbody>
        </table>

        <div className="mailp">
          <b>To:</b> {pane.mail.to}
          <br />
          <b>Subject:</b> <span id="mp-sub">{pane.mail.subject}</span>
          <div style={{ marginTop: '6px' }}>{pane.mail.greeting}</div>
          <span className="apv">Approve this quote</span>
        </div>

        <div className="actions">
          {pane.actions.map((b) => (
            <V7Btn key={b.label} button={b} />
          ))}
          <button type="button" className="linkbtn">
            Save as draft
          </button>
        </div>
        <p className="note">{pane.note}</p>
      </>
    );
  }

  return (
    <>
      <h2>
        {pane.heading}{' '}
        <span className={pane.tag.tone ? `tag ${pane.tag.tone}` : 'tag'}>{pane.tag.text}</span>
      </h2>

      {pane.lead && <Lead lead={pane.lead} />}

      {pane.checks.map((c) => (
        <Check key={c.text} row={c} />
      ))}

      {pane.recon && (
        <div className="recon">
          <h3>Sent to Tricia: final invoice with reconciliation</h3>
          <table>
            <tbody>
              <tr>
                <td>Estimate sent with the quote</td>
                <td className="n">{pane.recon.est}</td>
              </tr>
              <tr>
                <td>Final invoice</td>
                <td className="n">{pane.recon.final}</td>
              </tr>
              <tr className="big">
                <td>Difference</td>
                <td className="n">{pane.recon.diff}</td>
              </tr>
            </tbody>
          </table>
          {pane.recon.why && <p className="note">{pane.recon.why}</p>}
        </div>
      )}

      <div className="actions">
        {pane.actions.map((b) => (
          <V7Btn key={b.label} button={b} />
        ))}
      </div>

      {pane.note && <p className="note">{pane.note}</p>}

      {pane.demo && (
        <div className="demo">
          <b>For this review only.</b> {pane.demo.text.replace('For this review only. ', '')}
          <br />
          <V7Btn button={pane.demo.button} />
        </div>
      )}

      {pane.notes && (
        <div style={{ marginTop: '16px' }} className="sink">
          <div className="notebox">
            <div className="lab" style={{ margin: 0 }}>
              {pane.notesTitle}
            </div>
            {pane.notes.length ? (
              pane.notes.map((n) => (
                <div className="nt" key={n.t + n.txt}>
                  <small>
                    {n.who} · {n.t}
                  </small>
                  {n.txt}
                </div>
              ))
            ) : (
              <div className="hint">No notes yet.</div>
            )}
            <div className="noteadd">
              <input placeholder="Type a note for the shop" aria-label="Note for the operator" readOnly />
              <button type="button" className="btn amber sm">
                Send note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** v7's `.wait` / `.big-note` lead. The `|` splits the two lines v7 joins with `<br>`. */
function Lead({ lead }: { lead: { beacon: boolean; html: string } }) {
  const [head, tail] = lead.html.split('|');
  if (lead.beacon) {
    return (
      <div className="big-note">
        <span className="beacon" />
        {head}
      </div>
    );
  }
  return (
    <div className="wait">
      <b>{head}</b>
      {tail && (
        <>
          <br />
          {tail}
        </>
      )}
    </div>
  );
}

const MARK: Record<V7CheckRow['mark'], { cls: string; glyph: string }> = {
  tick: { cls: '', glyph: '✓' },
  wait: { cls: 'w', glyph: '•' },
  warn: { cls: 'w', glyph: '!' },
};

function Check({ row }: { row: V7CheckRow }) {
  const m = MARK[row.mark];
  return (
    <div className="chk">
      <i className={m.cls || undefined}>{m.glyph}</i>
      <div>
        {row.text}
        {row.small && <small>{row.small}</small>}
      </div>
    </div>
  );
}
