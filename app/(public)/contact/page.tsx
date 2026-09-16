import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact | Architectural Flashing Supply — Burnet TX Sheet Metal Fabrication',
  description:
    'Contact Architectural Flashing Supply in Burnet, Texas. Custom sheet metal fabrication and architectural flashing. Call (512) 372-4900.',
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Architectural Flashing Supply',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '209 Sure Cast Drive',
    addressLocality: 'Burnet',
    addressRegion: 'TX',
    postalCode: '78611',
    addressCountry: 'US',
  },
  telephone: '+1-512-372-4900',
  email: 'trica@architecturalflashingsupply.com',
  description:
    'Precision sheet metal fabrication shop specializing in architectural flashing, coping caps, gutters, and custom sheet metal profiles. Serving Texas and North America from Burnet, TX.',
};

interface ContactCard {
  label: string;
  value: string;
  href: string;
  note?: string;
}

const CONTACT_CARDS: ContactCard[] = [
  {
    label: 'Phone',
    value: '(512) 372-4900',
    href: 'tel:+15123724900',
    note: 'Call during business hours',
  },
  {
    label: 'General',
    value: 'trica@architecturalflashingsupply.com',
    href: 'mailto:trica@architecturalflashingsupply.com',
  },
  {
    label: 'President',
    value: 'steve@architecturalflashingsupply.com',
    href: 'mailto:steve@architecturalflashingsupply.com',
    note: 'Steve Harycki',
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />

      <section className="metal-edge metal-edge-red px-6 pt-20 pb-12 text-center border-b border-afs-border">
        <h1 className="font-heading text-afs-crimson text-5xl md:text-6xl font-bold leading-none mb-4">
          CONTACT AFS
        </h1>
        <p className="font-body text-afs-chrome-mid text-lg max-w-xl mx-auto">
          Texas-made precision sheet metal. Let&rsquo;s talk about your project.
        </p>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {CONTACT_CARDS.map((card) => (
            <a
              key={card.label}
              href={card.href}
              className="metal-edge bg-afs-bg-raised border border-afs-border rounded p-6 text-center hover:bg-afs-bg-surface transition-colors"
            >
              <p className="eyebrow-label text-xs tracking-widest mb-2">{card.label}</p>
              <p className="font-body text-sm text-afs-chrome-high break-all mb-1">{card.value}</p>
              {card.note && <p className="font-body text-xs text-afs-chrome-dim">{card.note}</p>}
            </a>
          ))}
        </div>

        <div className="mb-16">
          <ContactForm />
        </div>

        <div className="bg-afs-bg-raised border border-afs-border rounded p-8 text-center mb-12">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Visit or Ship To</h2>
          <p className="font-body text-sm text-afs-chrome-mid mb-4">
            209 Sure Cast Drive, Burnet, TX 78611
          </p>
          <a
            href="https://maps.google.com/?q=209+Sure+Cast+Drive+Burnet+TX+78611"
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors"
          >
            Get Directions →
          </a>
        </div>

        <div className="text-center">
          <Link
            href="/studio"
            className="font-label text-base font-semibold text-afs-chrome-high hover:text-afs-crimson transition-colors"
          >
            Ready to get a quote? Start in Design Studio →
          </Link>
        </div>
      </div>
    </main>
  );
}
