import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-afs-bg-base">

      {/* Right side: images 2 & 3, stacked, full-bleed layer behind the diagonal cut */}
      <div className="absolute inset-0 z-0 flex flex-col">
        <div className="relative h-1/2 w-full overflow-hidden">
          <Image
            src="/home_page_images/2.jpg"
            alt="Precision sheet metal fabrication in progress"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
        <div className="relative h-1/2 w-full overflow-hidden">
          <Image
            src="/home_page_images/3.jpg"
            alt="Finished architectural flashing installed on a commercial building"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </div>

      {/* Left side: image 1, full height, diagonal clip-path edge */}
      <div
        className="absolute inset-y-0 left-0 z-10 w-[40%]"
        style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 10vh) 100%, 0 100%)' }}
      >
        <Image
          src="/home_page_images/1.jpg"
          alt="Custom fabricated architectural flashing profiles"
          fill
          priority
          sizes="40vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Headline content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="max-w-5xl">
          <h1 className="hero-glow-red font-display text-[5rem] leading-none md:text-[7rem]">
            Texas Crafted. Nationally Delivered.
          </h1>
          <p className="hero-glow-chrome font-heading text-3xl font-semibold md:text-4xl mt-6">
            Precision Metal Flashing Fabrication
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/upload"
              className="rounded bg-[#C0001A] px-8 py-4 font-label text-sm font-semibold text-white transition-colors hover:bg-[#E8001F]"
            >
              Submit a Drawing
            </Link>
            <Link
              href="/quote"
              className="rounded border border-[#9AA8C0] px-8 py-4 font-label text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Request a Quote
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
