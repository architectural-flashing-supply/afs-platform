import type { Metadata } from 'next';
import FlashChatOpenButton from '@/components/flashchat/FlashChatOpenButton';

export const metadata: Metadata = {
  title: 'FlashChat — Architectural Sheet Metal AI Assistant | AFS',
  description:
    'FlashChat by Architectural Flashing Supply is an AI assistant trained on Division 7 standards, SMACNA specifications, material science, and 30+ years of Texas sheet metal fabrication expertise. Ask anything about flashing, profiles, materials, and installation.',
  keywords:
    'architectural flashing AI, Division 7 chatbot, sheet metal specifications, SMACNA standards, coping cap specifications, flashing material selection, architectural sheet metal expert',
};

const flashChatJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FlashChat',
  description:
    'AI assistant trained on Division 7 standards, SMACNA specifications, and architectural sheet metal expertise',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  provider: {
    '@type': 'LocalBusiness',
    name: 'Architectural Flashing Supply',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '209 Sure Cast Drive',
      addressLocality: 'Burnet',
      addressRegion: 'TX',
      postalCode: '78611',
    },
  },
};

interface KnowledgeDomain {
  title: string;
  icon: React.ReactNode;
  body: string;
}

const ICON_CLASS = 'w-8 h-8 text-afs-crimson shrink-0';

const KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  {
    title: 'Division 7 Standards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 2.5h7l4 4V21a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2.5V7h4" />
        <path strokeLinecap="round" d="M8.5 12h7M8.5 15h7M8.5 18h4.5" />
      </svg>
    ),
    body: 'Complete coverage of CSI MasterFormat Division 07 — Thermal and Moisture Protection. Sections 07 60 00 through 07 90 00 including Sheet Metal Flashing (07 62 00), Roof Specialties (07 71 00), and Joint Protection (07 90 00).',
  },
  {
    title: 'SMACNA Specifications',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3.5 20.5 17-17a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-17 17a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0Z"
        />
        <path strokeLinecap="round" d="m14.5 5.5 2 2M11 9l2 2M7.5 12.5l2 2M4 16l2 2" />
      </svg>
    ),
    body: 'Fabrication standards, seam types, expansion provisions, installation requirements, and material specifications from the SMACNA Architectural Sheet Metal Manual — the industry reference standard.',
  },
  {
    title: 'Material Science',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 9 5 9-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m3 16 9 5 9-5" />
      </svg>
    ),
    body: 'Copper (16oz-24oz), aluminum (.032-.063"), galvanized steel (G-90), stainless steel (304/316), lead-coated copper, and zinc. Service life, thermal expansion, galvanic compatibility, and application guidance.',
  },
  {
    title: 'Profile Knowledge',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 13h6v6h-6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11v4a2 2 0 0 0 2 2h5" />
      </svg>
    ),
    body: 'Every AFS profile: coping caps, base flashing, counter flashing, gravel stops, drip edge, gutters, scuppers, reglets, Z-bars, hip/ridge caps, inside/outside corners, expansion joints, and custom profiles.',
  },
  {
    title: 'Installation Standards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.5 3.5a4 4 0 0 0-5.4 4.9L3 14.5l2.5 2.5 6.1-6.1a4 4 0 0 0 4.9-5.4l-2.6 2.6-2-2 2.6-2.6Z"
        />
      </svg>
    ),
    body: 'End lap requirements, thermal expansion allowances, dissimilar metal isolation, sealant compatibility, wind uplift design, fastening patterns, slope requirements, and common failure mode diagnosis.',
  },
  {
    title: 'Texas Expertise',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={ICON_CLASS}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21s7-7.2 7-12.5A7 7 0 0 0 5 8.5C5 13.8 12 21 12 21Z"
        />
        <circle cx={12} cy={8.5} r={2.5} />
      </svg>
    ),
    body: 'Regional guidance for Central Texas climate — heat expansion in Hill Country summers, coastal considerations for Gulf Coast projects, windstorm compliance for TDI-regulated construction, and local material availability.',
  },
];

const SAMPLE_QUESTIONS = [
  'What is the minimum slope for a metal coping cap?',
  'Should I use copper or aluminum for a coastal Texas project?',
  'What does CSI Section 07 62 00 cover?',
  'How do I prevent oil-canning in flat aluminum panels?',
  'What is the SMACNA standard for end laps on base flashing?',
  'What gauge galvanized steel for a commercial gravel stop?',
  'How much thermal expansion allowance for a 50-foot copper gutter run?',
  'What sealants are compatible with lead-coated copper?',
  'What is the difference between base flashing and counter flashing?',
];

export default function FlashChatPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(flashChatJsonLd) }}
      />

      {/* Hero */}
      <section className="metal-edge metal-edge-red px-6 pt-20 pb-16 text-center border-b border-afs-border">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-16 h-16 text-afs-crimson mx-auto mb-6"
          aria-hidden="true"
        >
          <path d="M12 2C8.5 2 5.7 4.1 4.5 7H4C2.9 7 2 7.9 2 9v1c0 .6.4 1 1 1h18c.6 0 1-.4 1-1V9c0-1.1-.9-2-2-2h-.5C18.3 4.1 15.5 2 12 2zm0 2c2.8 0 5.2 1.7 6.2 4H5.8C6.8 5.7 9.2 4 12 4zM2 12v1c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-1H2z" />
        </svg>

        <h1 className="font-heading text-5xl font-bold text-white mb-3">FlashChat</h1>
        <p className="eyebrow-label text-lg tracking-widest mb-6">
          Industry Intelligence
        </p>
        <p className="font-body text-afs-chrome-mid text-lg max-w-2xl mx-auto mb-8">
          The most knowledgeable architectural sheet metal AI assistant in the industry. Trained on
          Division 7 standards, SMACNA specifications, material science, and decades of Texas
          fabrication expertise.
        </p>

        <FlashChatOpenButton className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-lg px-8 py-4 rounded metal-edge-red shadow-crimson transition-colors inline-block">
          Ask FlashChat Now →
        </FlashChatOpenButton>

        <p className="font-body text-sm text-afs-chrome-dim mt-4">No account required. Ask anything.</p>
      </section>

      {/* Knowledge domains */}
      <section className="px-6 py-16 border-b border-afs-border">
        <h2 className="font-heading text-3xl font-bold text-white text-center mb-10">
          What FlashChat Knows
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {KNOWLEDGE_DOMAINS.map((domain) => (
            <div
              key={domain.title}
              className="bg-afs-bg-raised border border-[var(--afs-border)] metal-edge rounded p-6"
            >
              <div className="mb-4">{domain.icon}</div>
              <h3 className="font-heading text-xl font-semibold text-white mb-2">{domain.title}</h3>
              <p className="font-body text-sm text-afs-chrome-mid leading-relaxed">{domain.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample questions */}
      <section className="px-6 py-16 border-b border-afs-border bg-afs-bg-surface">
        <h2 className="font-heading text-3xl font-bold text-white text-center mb-2">
          Ask FlashChat Anything
        </h2>
        <p className="font-body text-afs-chrome-mid text-center mb-10">
          Real questions. Expert answers.
        </p>

        <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
          {SAMPLE_QUESTIONS.map((question) => (
            <FlashChatOpenButton
              key={question}
              question={question}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high font-body text-sm py-2 px-4 rounded-full hover:bg-afs-bg-raised hover:border-afs-crimson transition-colors"
            >
              {question}
            </FlashChatOpenButton>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-bold text-white mb-4">Built on Real Expertise</h2>
        <p className="font-body text-afs-chrome-mid max-w-2xl mx-auto mb-6">
          FlashChat is powered by Architectural Flashing Supply — a precision sheet metal fabrication
          shop in Burnet, Texas. Our knowledge base is built on SMACNA standards, NRCA guidelines,
          ASTM material specifications, and decades of hands-on fabrication experience.
        </p>
        <p className="font-data text-afs-chrome-high text-sm mb-2">
          (512) 372-4900 &nbsp;|&nbsp; trica@architecturalflashingsupply.com
        </p>
        <p className="font-body text-sm text-afs-chrome-dim">
          For formal quotes and engineering decisions, always consult AFS directly.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="px-6 pb-12 text-center">
        <p className="font-body text-xs text-afs-chrome-dim max-w-2xl mx-auto">
          FlashChat provides general industry knowledge for informational purposes. It does not
          constitute engineering advice. Always verify specifications with a licensed professional for
          your specific project conditions.
        </p>
      </section>
    </main>
  );
}
