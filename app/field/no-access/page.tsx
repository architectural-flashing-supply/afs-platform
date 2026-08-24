/**
 * Landing spot for anyone requireFieldRole() (lib/field/auth.ts) and
 * middleware.ts both reject from /field/contractor or /field/shop —
 * signed-out visitors and every role except 'contractor'/'admin'.
 */
export default function FieldNoAccessPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-afs-chrome-high">
        Access Restricted
      </h1>
      <p className="font-body text-base text-afs-chrome-mid">
        Contact your administrator for field access.
      </p>
    </main>
  );
}
