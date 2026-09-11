import type { Metadata } from 'next';
import DesignStudioHub from '@/app/components/home/DesignStudioHub';

export const metadata: Metadata = {
  title: 'Design Studio | AFS Architectural Flashing Supply',
  description:
    'Four ways to start your flashing quote: scan plans, snap a photo from the field, draw in FlashDraft, or build a quick quote.',
};

export default function DesignStudioPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <DesignStudioHub />
    </main>
  );
}
