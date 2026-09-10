import type { Metadata } from 'next';
import DesignStudioHub from '@/app/components/home/DesignStudioHub';

export const metadata: Metadata = {
  title: 'Design Studio | AFS Architectural Flashing Supply',
  description:
    'Five ways to start your flashing quote: scan plans, snap a photo from the field, draw in FlashDraft, use the configurator, or build a quick quote.',
};

export default function DesignStudioPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <DesignStudioHub />
    </main>
  );
}
