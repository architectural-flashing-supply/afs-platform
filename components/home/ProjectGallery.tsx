import Image from 'next/image';
import { PORTFOLIO_GALLERY_IDS, PORTFOLIO_PHOTOS } from '@/lib/home/portfolio-photos';

// afs-fl-034 — curated 8-photo spread from the same verified photo set as
// PhotoCategoryGrid, chosen for varied subject matter rather than repeating
// one roof angle. See lib/home/portfolio-photos.ts PORTFOLIO_GALLERY_IDS.
export default function ProjectGallery() {
  const photos = PORTFOLIO_GALLERY_IDS.map((id) => PORTFOLIO_PHOTOS[id]);

  return (
    <section className="bg-afs-bg-dim px-[7%] py-20">
      <h2
        className="font-display text-afs-chrome-high"
        style={{ fontSize: 'clamp(2rem, 3.2vw, 3rem)', lineHeight: 1.05 }}
      >
        Project Gallery
      </h2>
      <div className="my-[18px] h-[3px] w-[80px] bg-afs-crimson shadow-crimson" />
      <p className="max-w-2xl font-body text-afs-chrome-mid">
        A closer look at fabrication and installs across roofing, wall flashing,
        and custom metalwork.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={`relative overflow-hidden rounded-lg border border-afs-border ${
              index === 0 ? 'col-span-2 row-span-2' : ''
            }`}
            style={{ aspectRatio: index === 0 ? '1 / 1' : '4 / 3' }}
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
