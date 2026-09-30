import AdminTopBar from '@/components/layout/AdminTopBar';

/**
 * The Command Center shell: a gunmetal header and the working area. Nothing
 * else.
 *
 * Command Center V2 prompt v2-01 deleted the 240px sidebar. It was a SECOND
 * navigation level in all but name — six links duplicating the top bar's
 * tabs under different labels ("Production Queue" vs "Production", "Orders"
 * pointing at orders-crm) — and the prompt's instruction is to remove the
 * second level entirely. Brand, the signed-in admin's name and Log out all
 * moved into the header, which is where the approved prototype puts them.
 *
 * This is now a server component: with the nav gone there is no client state
 * left here, and the only interactive part (AdminTopBar) is already its own
 * client component.
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
    <div className="min-h-screen bg-afs-bg-base">
      <AdminTopBar adminName={adminName} pendingCount={pendingMachineJobs} />
      <main className="pt-16 px-6 lg:px-8 pb-16">{children}</main>
    </div>
  );
}
