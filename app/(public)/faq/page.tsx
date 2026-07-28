import type { Metadata } from 'next';
import FaqAccordion from '@/components/faq/FaqAccordion';
import { FAQ_CATEGORIES } from '@/lib/data/faq';

export const metadata: Metadata = {
  title: 'FAQ | Architectural Flashing Supply — Sheet Metal Fabrication Burnet TX',
  description:
    'Frequently asked questions about architectural flashing, sheet metal profiles, materials, delivery, and custom fabrication from AFS in Burnet, Texas.',
};

// SEO: FAQPage structured data covers the top 15 Q&A pairs in display
// order (all of "Company & Contact" plus the front of "Products &
// Profiles") — a representative slice, not every question on the page,
// per the task's literal "top 15" scope.
const TOP_FAQ_ENTRIES = FAQ_CATEGORIES.flatMap((category) => category.questions).slice(0, 15);

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: TOP_FAQ_ENTRIES.map((entry) => ({
    '@type': 'Question',
    name: entry.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: entry.a,
    },
  })),
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="metal-edge metal-edge-red px-6 pt-20 pb-12 text-center border-b border-afs-border">
        <h1 className="font-heading text-afs-crimson text-5xl md:text-6xl font-bold leading-none mb-4">
          FREQUENTLY ASKED QUESTIONS
        </h1>
        <p className="font-body text-afs-chrome-mid text-lg max-w-2xl mx-auto">
          Everything you need to know about AFS and architectural sheet metal fabrication
        </p>
      </section>

      <div className="pt-12">
        <FaqAccordion categories={FAQ_CATEGORIES} />
      </div>
    </main>
  );
}
