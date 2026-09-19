import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPassportAccountInfo, getPassportProfiles, getPassportUserContext } from '@/lib/data/profile-passport';
import ProfilesTab from '@/components/profile-passport/ProfilesTab';
import AccountTab from '@/components/profile-passport/AccountTab';
import SettingsTab from '@/components/profile-passport/SettingsTab';

type PassportTab = 'profiles' | 'account' | 'settings';

const TABS: { value: PassportTab; label: string }[] = [
  { value: 'profiles', label: 'Profiles' },
  { value: 'account', label: 'Account' },
  { value: 'settings', label: 'Settings' },
];

function isPassportTab(value: string | undefined): value is PassportTab {
  return TABS.some((tab) => tab.value === value);
}

export default async function ProfilePassportPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) redirect('/login?redirect=/app/profile-passport');

  const activeTab: PassportTab = isPassportTab(searchParams.tab) ? searchParams.tab : 'profiles';

  const profiles = activeTab === 'profiles' ? await getPassportProfiles(supabase) : null;
  const account = activeTab === 'account' ? await getPassportAccountInfo(supabase, context.userId) : null;

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-afs-border mb-8 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <Link
              key={tab.value}
              href={tab.value === 'profiles' ? '/app/profile-passport' : `/app/profile-passport?tab=${tab.value}`}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                active ? 'border-afs-crimson text-afs-chrome-high' : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {activeTab === 'profiles' && profiles && (
        <ProfilesTab initialProfiles={profiles} role={context.role} isCompanyAccount={!!context.companyId} />
      )}

      {activeTab === 'account' &&
        (account ? (
          <AccountTab
            companyName={account.companyName}
            contactEmail={account.contactEmail}
            role={account.role}
            teamMembers={account.teamMembers}
          />
        ) : (
          <p className="font-body text-sm text-afs-chrome-mid">Could not load account info.</p>
        ))}

      {activeTab === 'settings' && <SettingsTab role={context.role} />}
    </div>
  );
}
