import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CreditApplicationForm from '@/components/account/CreditApplicationForm';

export default async function CreditApplicationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  return (
    <div>
      <div className="mb-8 max-w-[720px] mx-auto">
        <h1 className="font-heading text-3xl text-afs-ink-900">Credit Application</h1>
        <p className="font-body text-sm text-afs-ink-700 mt-1">
          Apply for net terms on your account. Review typically takes 3–5 business days.
        </p>
      </div>
      <CreditApplicationForm defaultAuthorizedName={profile?.full_name ?? ''} />
    </div>
  );
}
