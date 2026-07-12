import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      className="relative overflow-hidden bg-afs-bg-dim"
      style={{ height: '100vh' }}
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
      <div className="absolute inset-0 bg-gradient-to-br from-afs-bg-dim/70 via-afs-bg-dim/45 to-afs-bg-dim/60" />

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
          className="font-display text-afs-chrome-high"
          style={{
            fontSize: 'clamp(3rem, 5vw, 5.5rem)',
            lineHeight: 1.0,
          }}
        >
          TEXAS CRAFTED.<br />
          NATIONALLY DELIVERED.
        </h1>

        <div className="my-[18px] h-[3px] w-[80px] bg-afs-crimson shadow-crimson" />

        <p
          className="font-heading font-medium tracking-[0.08em] text-afs-chrome-high"
          style={{ fontSize: 'clamp(1rem, 1.8vw, 1.35rem)' }}
        >
          Precision Metal Flashing Fabrication
        </p>

        <div className="mt-9 flex gap-4">
          <Link
            href="/upload"
            className="rounded border border-transparent bg-afs-crimson px-9 py-3.5 font-label text-sm font-semibold tracking-[1px] text-afs-chrome-high cursor-pointer"
          >
            Submit a Drawing
          </Link>
          <Link
            href="/quote"
            className="rounded border border-afs-chrome-high/45 bg-transparent px-9 py-3.5 font-label text-sm font-semibold tracking-[1px] text-afs-chrome-high cursor-pointer"
          >
            Request a Quote
          </Link>
        </div>
      </div>
    </main>
  );
}
