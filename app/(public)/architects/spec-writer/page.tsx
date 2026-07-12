import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import SpecWriterWizard from '@/components/architects/SpecWriterWizard';

export default async function SpecWriterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/architects/spec-writer');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const allowed = profile?.role === 'architect' || profile?.role === 'admin';

  if (!allowed) {
    return (
      <ArchitectShell>
        <div className="max-w-lg mx-auto py-24 px-6 text-center">
          <ArchitectEyebrow>AI Spec Writer</ArchitectEyebrow>
          <h1 className="font-heading text-3xl text-afs-ink-900 mb-4">Access Restricted</h1>
          <p className="font-body text-sm text-afs-ink-700 mb-8">
            This feature requires an architect account. Contact us to request access, or continue with our
            standard quote tools.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/architects/consultation"
              className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              Request Architect Access
            </a>
            <a
              href="/quote"
              className="border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              Request a Quote
            </a>
          </div>
        </div>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell>
      <SpecWriterWizard />
    </ArchitectShell>
  );
}
