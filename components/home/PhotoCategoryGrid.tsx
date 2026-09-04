import Image from 'next/image';
import { PORTFOLIO_CATEGORIES, PORTFOLIO_PHOTOS } from '@/lib/home/portfolio-photos';

// afs-fl-034 — real, individually-viewed AFS project photography grouped
// into categories (lib/home/portfolio-photos.ts). No pricing, no CTAs to
// buy — this is browse-only, consistent with the RFQ business model.
export default function PhotoCategoryGrid() {
  return (
    <section className="bg-afs-bg-base px-[7%] py-20">
      <h2
        className="font-display text-afs-chrome-high"
        style={{ fontSize: 'clamp(2rem, 3.2vw, 3rem)', lineHeight: 1.05 }}
      >
        Fabrication Categories
      </h2>
      <div className="my-[18px] h-[3px] w-[80px] bg-afs-crimson shadow-crimson" />
      <p className="max-w-2xl font-body text-afs-chrome-mid">
        Real work from AFS shop floors and job sites, grouped by what it is.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PORTFOLIO_CATEGORIES.map((category) => {
          const photo = PORTFOLIO_PHOTOS[category.representativeId];
          return (
            <div
              key={category.key}
              className="group relative overflow-hidden rounded-lg border border-afs-border bg-afs-bg-raised shadow-card"
            >
              <div className="relative h-56 w-full overflow-hidden">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-afs-bg-dim/85 via-afs-bg-dim/10 to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="font-heading font-semibold tracking-[0.04em] text-afs-chrome-high">
                  {category.label}
                </h3>
                <p className="mt-1 font-body text-sm text-afs-chrome-mid">
                  {category.description}
                </p>
                <p className="mt-3 font-label text-xs uppercase tracking-[0.08em] text-afs-copper">
                  {category.photoIds.length} photos
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
