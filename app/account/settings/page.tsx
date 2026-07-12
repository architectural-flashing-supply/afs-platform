import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileSettingsForm from '@/components/account/ProfileSettingsForm';
import NotificationSettingsForm from '@/components/account/NotificationSettingsForm';

interface ProfileRow {
  full_name: string;
  company: string | null;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
}

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('full_name, company, phone, email_opt_in, sms_opt_in')
    .eq('id', user.id)
    .single();
  const profile = profileRaw as ProfileRow;

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Settings</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">Manage your profile and notification preferences.</p>
      </div>

      <section className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-6">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Profile</h2>
        <ProfileSettingsForm
          email={user.email ?? ''}
          initialFullName={profile?.full_name ?? ''}
          initialCompany={profile?.company ?? ''}
          initialPhone={profile?.phone ?? ''}
        />
      </section>

      <section className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-6">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Notification Preferences</h2>
        <NotificationSettingsForm
          initialEmailOptIn={profile?.email_opt_in ?? true}
          initialSmsOptIn={profile?.sms_opt_in ?? false}
        />
      </section>

      <section className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 flex items-center justify-between gap-6 flex-wrap">
        <div>
          <h2 className="font-heading text-lg text-afs-chrome-high mb-1">Password</h2>
          <p className="font-body text-sm text-afs-chrome-mid">Send yourself a password reset link by email.</p>
        </div>
        <Link
          href="/forgot-password"
          className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors whitespace-nowrap"
        >
          Change Password
        </Link>
      </section>
    </div>
  );
}
