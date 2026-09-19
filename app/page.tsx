import dynamic from 'next/dynamic';
import HomeSection from '@/app/components/home/HomeSection';
import HeroSection from '@/app/components/hero/HeroSection';
import ClientCarousel from '@/components/home/ClientCarousel';
import CredibilityStrip from '@/app/components/home/CredibilityStrip';
import FieldAppStory from '@/app/components/home/FieldAppStory';
import DesignStudioHub from '@/app/components/home/DesignStudioHub';
import DesignToDelivery from '@/app/components/home/DesignToDelivery';
import CustomerPathways from '@/app/components/home/CustomerPathways';
import ProfilePassportExplainer from '@/app/components/home/ProfilePassportExplainer';
import CaseStudies from '@/app/components/home/CaseStudies';
import ShopFloorProof from '@/app/components/home/ShopFloorProof';
import FinalCTA from '@/app/components/home/FinalCTA';
import HailViewSection from '@/app/components/home/HailViewSection';
import SectionImageBreak from '@/app/components/home/SectionImageBreak';

// NationwideMap (Leaflet map) is the heaviest section below the fold.
// `ssr: false` isn't legal here -- this file has no 'use client', and Next
// disallows `dynamic(..., { ssr: false })` in Server Components -- so this
// is a plain code-split (ssr stays on). It defers its own genuinely
// client-only piece internally via its own `dynamic(..., { ssr: false })`
// inside a 'use client' module: NationwideMapLeaflet inside NationwideMap.
const NationwideMap = dynamic(() => import('@/app/components/home/NationwideMap'));

export default function HomePage() {
  return (
    <main>
      {/* Hoisted into <head> by Next.js (Server Component <link> tags are
          moved there automatically) so the hero poster — the LCP element —
          starts downloading immediately instead of waiting on the video
          element to be discovered during hydration. */}
      <link rel="preload" as="image" href="/images/hero-poster.jpg" fetchPriority="high" />

      <HomeSection slug="hero">
        <HeroSection />
      </HomeSection>

      {/* Moved back directly below the hero (2026-09-19 revision pass) --
          was at the very bottom of the page; restyled as a thinner banner
          in ClientCarousel.tsx itself. */}
      <HomeSection slug="client-carousel">
        <ClientCarousel />
      </HomeSection>

      <HomeSection slug="field-app">
        <FieldAppStory />
      </HomeSection>

      <HomeSection slug="credibility">
        <CredibilityStrip />
      </HomeSection>

      {/* DesignStudioHub already sets id="design-studio" on its own root
          section -- the same anchor also reachable at the standalone
          /design-studio route -- so withId is off here to avoid a
          duplicate id in the DOM. */}
      <HomeSection slug="design-studio" withId={false}>
        <DesignStudioHub />
      </HomeSection>

      <HomeSection slug="design-to-delivery">
        <DesignToDelivery />
      </HomeSection>

      {/* Real AFS shop-floor photo (Reid-supplied, public/images/shop1.png)
          -- moved here from directly under the hero (2026-09-19 revision
          pass #2, item 2), second visual break, roughly the midpoint of
          the page, breaking up the long stretch of text/UI-heavy feature
          sections either side of it. */}
      <SectionImageBreak
        src="/images/shop1.png"
        alt="The full Thalmann bending line on the AFS shop floor, coil stock racked behind it and a technician handling formed metal"
        caption="AFS Shop Floor — Burnet, Texas"
        objectPosition="center 35%"
      />

      <HomeSection slug="pathways">
        <CustomerPathways />
      </HomeSection>

      <HomeSection slug="profile-passport" withId={false}>
        <ProfilePassportExplainer />
      </HomeSection>

      <HomeSection slug="case-studies">
        <CaseStudies />
      </HomeSection>

      <HomeSection slug="shop-floor">
        <ShopFloorProof />
      </HomeSection>

      <HomeSection slug="nationwide" withId={false}>
        <NationwideMap />
      </HomeSection>

      <HomeSection slug="final-cta">
        <FinalCTA />
      </HomeSection>

      {/* Real hail-strike footage (2026-09-19 revision pass) -- the
          DATA BLOCKER is resolved; Reid supplied real portrait (490x940)
          video + webm + poster, pre-rendered to their display aspect. */}
      <HomeSection slug="hail-view">
        <HailViewSection
          videoUrl="/videos/hail-strikes.mp4"
          webmUrl="/videos/hail-strikes.webm"
          posterUrl="/images/hail-strikes-poster.jpg"
        />
      </HomeSection>
    </main>
  );
}
