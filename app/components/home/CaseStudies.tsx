import Image from 'next/image';
import { PORTFOLIO_PHOTOS } from '@/lib/home/portfolio-photos';
import RevealOnScroll from './RevealOnScroll';

// Photo selection resolved against lib/home/portfolio-photos.ts -- the
// already-verified catalog of the 46 real AFS legacy photos (afs-fl-034),
// not a fresh read of the raw manifest. Each photo was individually viewed
// and described there before this prompt existed, so reusing those entries
// (src + alt) keeps one source of truth instead of a second, divergent
// description of the same files.
//
// Mapped from the prompt's candidate pool -- "the first four below-the-fold
// legacy photos" is PORTFOLIO_GALLERY_IDS' first four entries [22, 9, 34,
// 19] (ProjectGallery.tsx, the below-the-fold gallery section); "the
// entryway-with-tree-trunks photo" is #19 itself ("Standing-seam copper
// pavilion roof over a wood-beamed porch, oak trees framing the view" --
// already the 4th item, so no separate photo is needed for it); "the stove
// vent-a-hood photo" (#30, a range hood) was in the candidate pool but
// doesn't depict any of the three required subjects, so it isn't used here.
// All three picks below are direct, high-confidence matches to their card's
// subject, not closest-available substitutes:
//   Copper Dome          -> #22 "fabricated copper dome roof"
//   Arched-Window Flashing -> #34 "copper arched window head flashing"
//   Standing-Seam Detail -> #19 "Standing-seam copper pavilion roof ... oak
//                            trees framing the view"
//
// Dimensions verified directly from the files (System.Drawing.Image), not
// assumed -- all three are 600x450.
const PHOTO_WIDTH = 600;
const PHOTO_HEIGHT = 450;

interface PhotoCaseStudy {
  key: string;
  photoId: number;
  title: string;
  materialFinish: string;
  outcome: string;
}

const PHOTO_CASE_STUDIES: PhotoCaseStudy[] = [
  {
    key: 'copper-dome',
    photoId: 22,
    title: 'Copper Dome',
    materialFinish: 'Fabricated Copper · Dome Roof',
    outcome:
      'A fully custom, hand-formed copper dome closing out a curved roofline with a clean, leak-tight seam.',
  },
  {
    key: 'arched-window-flashing',
    photoId: 34,
    title: 'Arched-Window Flashing',
    materialFinish: 'Copper · Arched Head Flashing',
    outcome:
      'Copper head flashing formed to the exact radius of each arched opening for a precise, weathertight fit.',
  },
  {
    key: 'standing-seam-detail',
    photoId: 19,
    title: 'Standing-Seam Detail',
    materialFinish: 'Standing-Seam Copper · Pavilion Roof',
    outcome:
      'A standing-seam copper roof panelized to hold a clean line across the ridge and porch transition.',
  },
];

export default function CaseStudies() {
  return (
    <section className="bg-afs-bg-light py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
          Real AFS Fabrication
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl md:text-6xl">
          Built to Spec. Delivered on Site.
        </h2>

        <RevealOnScroll className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {PHOTO_CASE_STUDIES.map((study) => {
            const photo = PORTFOLIO_PHOTOS[study.photoId];
            return (
              <div
                key={study.key}
                id={`case-study-${study.key}`}
                className="flex flex-col overflow-hidden rounded border border-afs-border-light bg-afs-bg-light-raised metal-edge"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={PHOTO_WIDTH}
                    height={PHOTO_HEIGHT}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-heading text-xl font-semibold text-afs-ink-900">
                    {study.title}
                  </h3>
                  <p className="mt-1 font-label text-xs uppercase tracking-wider text-afs-ink-700">
                    {study.materialFinish}
                  </p>
                  <p className="mt-3 font-body text-sm text-afs-ink-700">{study.outcome}</p>
                </div>
              </div>
            );
          })}

          {/* NASA credential card -- Reid supplied
              public/images/NASA_Johnson_Space_Center.png (the NASA insignia
              + "Trusted by NASA Johnson Space Center" lockup over a Space
              Center Houston exterior), so the typographic badge that used to
              stand in for it is gone. object-top crops out the lower part of
              the image, which has generation artifacts (mirrored signage). */}
          <div
            id="case-study-nasa-jsc"
            className="flex flex-col overflow-hidden rounded border border-afs-border-light bg-afs-bg-light-raised metal-edge"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src="/images/NASA_Johnson_Space_Center.png"
                alt="Trusted by NASA Johnson Space Center"
                fill
                className="object-cover object-top"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading text-xl font-semibold text-afs-ink-900">
                  Mission-Critical Precision
                </h3>
                <span className="flex-none rounded bg-afs-crimson px-2.5 py-1 font-label text-xs font-bold uppercase tracking-wider text-white">
                  Zero-Defect Delivery
                </span>
              </div>
              <p className="mt-3 font-body text-sm text-afs-ink-700">
                Custom architectural metal fabricated to Johnson Space Center&rsquo;s exact
                specifications. Zero tolerance for deviation. Delivered on schedule.
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
