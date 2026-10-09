import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import ProfileViewer from '@/components/admin/v8/ProfileViewer';
import { resolveSavedProfileSource } from '@/lib/data/v8-profile-source';

/**
 * Standalone debug view for the V8 ProfileViewer — reach it at
 * `/studio/v8-viewer-debug?ids=<uuid>,<uuid>`.
 *
 * SAME PATTERN AND SAME PURPOSE AS `/studio/hem-debug`, which exists so the hem
 * glyphs can be looked at at 15x through the EXACT function the real canvas
 * calls. This one renders the EXACT component the Command Center will mount,
 * from the EXACT saved geometry, with no reimplementation of anything.
 *
 * WHY IT EXISTS AT ALL. V8 phase 0 built `ProfileViewer`, proved its canvas call
 * stream identical to FlashDraft's renderer by unit test, and shipped it with
 * **no mount point anywhere** — so it had never been rendered in a browser and
 * nobody had looked at it. A component that typechecks and passes its tests and
 * has never been seen is not evidence of anything on a platform where the next
 * button along reaches a bending machine. Every later phase needs somewhere to
 * look at it before wiring it into a real screen, so the harness is committed
 * rather than rebuilt from scratch each time.
 *
 * IT IS NOT A COMMAND CENTER SCREEN, deliberately. It lives under `/studio`,
 * outside `app/admin/`, so it is outside the contrast gate's screen list
 * (CLAUDE.md rule #28) and outside the single-drawing-path scan (rule #37) —
 * it cannot make either gate pass or fail by accident. The CSS here is
 * utilitarian scaffolding for looking at a canvas, NOT a design, and nothing
 * in it should be copied into a real screen.
 *
 * IDS COME FROM THE QUERY STRING, never from source. A saved profile belongs to
 * a real customer; hardcoding one would put a live record in the repo and make
 * the page useless the day that row changed.
 *
 * ADMIN-GUARDED, because saved geometry is a customer's drawing.
 *
 * NAMED `v8-viewer-debug`, AND THAT IS NOT A STYLE CHOICE. One of the routes
 * deleted with the 911-profile machine library lived under `/studio/` and was
 * named for viewing a profile; `lib/data/removed-machine-library.test.ts` fails
 * on any source reference to it, including a longer path that merely starts
 * with it. The first version of this file was named that way and tripped the
 * gate — twice, because the second attempt still SPELLED the dead route in this
 * very comment while explaining itself.
 *
 * So it is described here rather than written out, which is the device that
 * test already uses on itself: CLAUDE.md records that it builds the forbidden
 * names from fragments precisely because it is the one file that must refer to
 * them. The rest of the precedent is the same one v2-01 set when the
 * library-removal gate flagged fifteen innocent files over a similar collision:
 * RENAME OUT OF THE COLLISION, never relax the test.
 */
export const dynamic = 'force-dynamic';

export default async function ProfileViewerDebugPage({
  searchParams,
}: {
  searchParams?: { ids?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const ids = (searchParams?.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  // Read server-side so BOTH of the viewer's input paths are exercised on one
  // page: the left column is handed `initialData`, the right column is given
  // only an id and fetches it itself through
  // /api/admin/v8/profile-geometry/[id]. If those two ever disagree, they
  // disagree here, side by side, rather than on a screen somebody is using.
  const loaded = await Promise.all(ids.map((id) => resolveSavedProfileSource(id)));

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', background: '#F4F5F7', minHeight: '100vh' }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>ProfileViewer — debug harness</h1>
      <p style={{ marginTop: 6, fontSize: 13, maxWidth: 760 }}>
        The real <code>components/admin/v8/ProfileViewer.tsx</code>, rendering real saved FlashDraft
        geometry through FlashDraft&rsquo;s own renderer. Single-click a thumbnail to enlarge;
        double-click for full size. Esc, the ✕ or the backdrop closes it. Not a Command Center
        screen — see this file&rsquo;s comment.
      </p>

      {ids.length === 0 && (
        <p style={{ marginTop: 20, fontSize: 14 }}>
          Pass ids: <code>?ids=&lt;saved_configurations.id&gt;,&lt;…&gt;</code>
        </p>
      )}

      {ids.map((id, i) => {
        const data = loaded[i];
        return (
          <section
            key={id}
            style={{ marginTop: 28, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #D7DBE2' }}
          >
            <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#444' }}>
              {id} · {data.kind === 'geometry'
                ? `${data.geometry.points.length} points · ${data.bendCount} bends · ${data.hemCount} hems · ${data.material || 'no material'} ${data.gauge || ''}`
                : data.kind === 'none'
                  ? `no drawing — ${data.reason}`
                  : data.kind}
            </div>

            <div style={{ display: 'flex', gap: 40, marginTop: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, marginBottom: 6, color: '#555' }}>
                  server-read, passed as <code>initialData</code> — 110px
                </div>
                <ProfileViewer
                  source={data}
                  label={`Profile ${i + 1}`}
                  thumbSize={110}
                  shopNotes={['Steve: paint outside face only']}
                  flashDraftHref="/studio/draft"
                />
              </div>

              <div>
                <div style={{ fontSize: 11, marginBottom: 6, color: '#555' }}>
                  id only, fetched by the component — 110px
                </div>
                <ProfileViewer
                  fetchFor={`profile:${id}`}
                  label={`Profile ${i + 1} (fetched)`}
                  thumbSize={110}
                  flashDraftHref="/studio/draft"
                />
              </div>

              <div>
                <div style={{ fontSize: 11, marginBottom: 6, color: '#555' }}>56px (the contract&rsquo;s small size)</div>
                <ProfileViewer source={data} label={`Profile ${i + 1} small`} thumbSize={56} flashDraftHref="/studio/draft" />
              </div>
            </div>
          </section>
        );
      })}

      {/* An id that cannot exist, so the explicit absence is visible beside the
          real ones rather than being something you have to trust. */}
      <section style={{ marginTop: 28, padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #D7DBE2' }}>
        <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#444' }}>
          the no-drawing state, from an id that does not exist
        </div>
        <div style={{ marginTop: 14 }}>
          <ProfileViewer
            fetchFor="profile:00000000-0000-4000-8000-000000000000"
            label="Nothing saved"
            thumbSize={110}
            flashDraftHref="/studio/draft"
          />
        </div>
      </section>
    </main>
  );
}
