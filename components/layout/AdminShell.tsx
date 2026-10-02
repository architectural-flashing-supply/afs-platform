import AdminTopBar from '@/components/layout/AdminTopBar';

/**
 * The Command Center shell: v7's dark header above its light working area.
 *
 * `.cc-v7` IS THE SCOPE. Every rule in the ported prototype stylesheet
 * (app/styles/command-center-v7.generated.css, produced by
 * scripts/design/scope-v7-css.mjs) is prefixed with this class, and v7's custom
 * properties — `--bg`, `--ink`, `--red`, `--display`, `--body` — are declared on
 * it. So this one element is what makes the port take effect, and it is also
 * what keeps the port off the public marketing site: without `.cc-v7` on an
 * ancestor, none of those selectors match and none of those variables resolve.
 *
 * Two consequences worth knowing before editing this file:
 *
 *   - Nothing inside may set `transform`, `filter`, `perspective` or
 *     `contain` on this wrapper. Those establish a containing block, and v7's
 *     `position:fixed` overlays (`#gpeek`, `#toast`) would then be positioned
 *     against the wrapper instead of the viewport.
 *   - `<main class="wrap">` supplies v7's own page padding and 1900px measure.
 *     The old shell used Tailwind's `pt-16 px-6 lg:px-8 pb-16` plus a fixed
 *     header; v7's header is `position:sticky`, so no top padding is needed and
 *     adding any would push every screen down by a header's height.
 *
 * WHY THE GROUND IS STILL GUNMETAL HERE, ON A LIGHT DESIGN.
 *
 * `.cc-v7` deliberately does NOT paint v7's light ground — the transform routes
 * that onto an opt-in `.cc-v7-ground` class instead. CLAUDE.md rule #18 is the
 * reason: the Command Center converts to the light working area one screen at a
 * time, the PAGE opts in, and twenty admin screens still set their text in the
 * light-on-dark `afs-chrome-*` tokens. Painting the ground here put white text
 * on a near-white page and turned the contrast gate red with 46 real failures
 * (1.09:1 to 1.69:1) across every unconverted screen.
 *
 * So the ground stays `bg-afs-bg-base` until a screen is rebuilt, and each
 * converted screen supplies its own light working area. The HEADER is fully v7
 * regardless, because it paints its own `#14181E` — which is why the one dark
 * anchor in v7's design is also the one part that was safe to convert first.
 *
 * Still a server component: the only interactive part is AdminTopBar, which is
 * its own client component.
 */
export default function AdminShell({
  adminName,
  pendingMachineJobs = 0,
  children,
}: {
  adminName: string;
  pendingMachineJobs?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-v7 min-h-screen bg-afs-bg-base">
      <AdminTopBar adminName={adminName} pendingCount={pendingMachineJobs} />
      <main className="wrap">{children}</main>
    </div>
  );
}
