import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import EmptyState from '@/components/ui/EmptyState';
import AIInstallationAdvisor from '@/components/ai/AIInstallationAdvisor';
import { getCategory } from '@/lib/data/catalog';

interface GuidePageProps {
  params: { profileSlug: string };
}

export function generateMetadata({ params }: GuidePageProps): Metadata {
  const category = getCategory(params.profileSlug);
  const name = category?.name ?? params.profileSlug;
  return {
    title: `${name} Installation Guide | AFS Architectural Flashing Supply`,
    description: `Field installation guidance for ${name} — AFS Architectural Flashing Supply.`,
  };
}

const TOOLS = ['Sheet metal brake', 'Tin snips', 'Aviation snips', 'Sealant gun', 'Rivet gun', 'Chalk line'];

export default function FieldInstallationGuidePage({ params }: GuidePageProps) {
  const category = getCategory(params.profileSlug);
  if (!category) notFound();

  return (
    <ArchitectShell>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <ArchitectEyebrow>Field Installation Guide</ArchitectEyebrow>
        <h1 className="font-display text-6xl text-afs-ink-900 leading-none mb-2">{category.name.toUpperCase()}</h1>
        <p className="font-body text-afs-ink-700 text-sm mb-8">Guide content last updated — pending publication</p>

        <div className="flex gap-2 flex-wrap mb-12">
          {TOOLS.map((tool) => (
            <span
              key={tool}
              className="font-label text-xs px-3 py-1.5 rounded border border-afs-chrome-dim text-afs-ink-700"
            >
              {tool}
            </span>
          ))}
        </div>

        <EmptyState
          title="Installation Guide Coming Soon"
          description={`Step-by-step field installation guidance for ${category.name} is being prepared by our technical team. Ask the AI advisor below in the meantime, or request a consultation.`}
          actionLabel="Request a Consultation"
          actionHref="/architects/consultation"
          accent="copper"
        />

        <div className="mt-8 text-center">
          <Link href="/architects/guides" className="font-body text-sm text-afs-ink-700 hover:text-afs-copper transition-colors">
            ← Back to Resource Center
          </Link>
        </div>
      </div>

      <div className="border-t border-afs-border">
        <AIInstallationAdvisor profileSlug={category.slug} profileName={category.name} />
      </div>
    </ArchitectShell>
  );
}
