import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEmployeeOrderQueue } from '@/lib/data/orders';
import EmployeeOrdersList from '@/components/employee/EmployeeOrdersList';

export default async function EmployeeOrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already redirects away any request without a valid operator
  // session before this ever renders — user is guaranteed non-null here.
  const admin = createAdminClient();
  const orders = await getEmployeeOrderQueue(admin, user!.id);

  return (
    <div className="px-4 pt-6">
      <h1 className="font-heading text-2xl text-afs-chrome-high mb-4">Orders</h1>
      <EmployeeOrdersList orders={orders} />
    </div>
  );
}
