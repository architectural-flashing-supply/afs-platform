import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      className="relative overflow-hidden"
      style={{ height: '100vh', backgroundColor: '#1a1c22' }}
    >
      <Image
        src="/home_page_images/2.jpg"
        alt="Shop floor with workers and fabricated flashing"
        fill
        priority
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: 'center center' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(10,12,18,0.70) 0%, rgba(10,12,18,0.45) 50%, rgba(10,12,18,0.63) 100%)',
        }}
      />

      {/* Rooftop triangle — pre-composited PNG with the diagonal cut baked into its alpha channel */}
      <img
        src="/home_page_images/rooftop-triangle.png"
        alt=""
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '55%',
          height: '70%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      <div
        className="absolute z-10"
        style={{ left: '7%', top: '50%', transform: 'translateY(-50%)' }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-bebas)',
            fontSize: 'clamp(3rem, 5vw, 5.5rem)',
            lineHeight: 1.0,
            color: '#FFFFFF',
          }}
        >
          TEXAS CRAFTED.<br />
          NATIONALLY DELIVERED.
        </h1>

        <div
          style={{
            height: '3px',
            width: '80px',
            background: '#C0001A',
            boxShadow: '0 0 12px rgba(192,0,26,0.7)',
            margin: '18px 0',
          }}
        />

        <p
          style={{
            fontFamily: 'var(--font-barlow-condensed)',
            fontSize: 'clamp(1rem, 1.8vw, 1.35rem)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: '#FFFFFF',
          }}
        >
          Precision Metal Flashing Fabrication
        </p>

        <div style={{ marginTop: '36px', display: 'flex', gap: '16px' }}>
          <Link
            href="/upload"
            style={{
              background: '#C0001A',
              color: '#FFFFFF',
              fontFamily: 'var(--font-barlow)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '14px 36px',
              borderRadius: '4px',
              border: 'none',
              letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            Submit a Drawing
          </Link>
          <Link
            href="/quote"
            style={{
              background: 'transparent',
              color: '#FFFFFF',
              fontFamily: 'var(--font-barlow)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '14px 36px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.45)',
              letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            Request a Quote
          </Link>
        </div>
      </div>
    </main>
  );
}
