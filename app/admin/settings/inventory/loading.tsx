import LightWorkingArea from '@/components/admin/LightWorkingArea';

/**
 * The loading state for `/admin/settings/inventory`.
 *
 * The page is `force-dynamic` and reads two tables plus two joins on every
 * visit, so there is a real wait to show something during. Rendered inside the
 * same `LightWorkingArea` as the page itself, so the working area does not
 * flash gunmetal and then go light.
 *
 * It says what is being read rather than animating a shape, because on a screen
 * about quantities the useful thing to know during the wait is that nothing has
 * been assumed yet.
 */
export default function Loading() {
  return (
    <LightWorkingArea>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">Shop material inventory</h1>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">Reading what is on the floor…</p>
        </div>
        <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-8">
          <p className="font-body text-[15px] text-afs-ink-700">
            Nothing is assumed while this loads — no quantity is shown until the real one has been read.
          </p>
        </div>
      </div>
    </LightWorkingArea>
  );
}
