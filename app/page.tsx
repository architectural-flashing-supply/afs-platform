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

      {/* Real AFS shop-floor photo (Reid-supplied, public/images/shop1.png)
          -- a visual break right after the hero's own video, ahead of the
          long run of UI-mockup/gunmetal sections below. Not a HomeSection
          (no anchor/nav target of its own -- it's a breather, not a
          destination). */}
      <SectionImageBreak
        src="/images/shop1.png"
        alt="The full Thalmann bending line on the AFS shop floor, coil stock racked behind it and a technician handling formed metal"
        caption="AFS Shop Floor — Burnet, Texas"
        objectPosition="center 35%"
      />

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

      {/* Real, on-site AFS field photo (Reid-supplied,
          public/images/rf2.jpeg) -- second visual break, roughly the
          midpoint of the page, breaking up the long stretch of
          text/UI-heavy feature sections either side of it. */}
      <SectionImageBreak
        src="/images/rf2.jpeg"
        alt="A completed standing-seam metal roof installation on a residential job site, roll-forming equipment and coil stock in the foreground"
        caption="Standing Seam, Formed and Installed On-Site"
        objectPosition="center 42%"
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

      {/* DATA BLOCKER: no real hail-strike footage exists yet (CLAUDE.md
          Data Blockers table). videoUrl is left unset rather than pointed
          at a file that doesn't exist -- a guaranteed-404 src would fire a
          real console/network error on every page load. HailViewSection
          renders its placeholder panel until a real path (e.g.
          "/videos/hail-strikes.mp4", once that file exists, or an env var)
          is passed here. */}
      <HomeSection slug="hail-view">
        <HailViewSection />
      </HomeSection>

      {/* Real AFS shop-floor photo (Reid-supplied, public/images/shop-pic.png)
          -- third visual break, closing the loop back to the shop floor
          right before the trusted-by carousel and footer. */}
      <SectionImageBreak
        src="/images/shop-pic.png"
        alt="Coil stock racked above the Thalmann bending machine on the AFS shop floor, ready for fabrication"
        caption="Coil Stock, Ready for the Brake"
        objectPosition="center 40%"
      />

      {/* Moved to the very bottom of the page, ahead of the footer -- was
          previously section #2 (right after hero), where its bg-white
          broke the page's otherwise-consistent dark gunmetal theme just
          three sections in. As the last section it instead closes the page
          on a clean, bright trust band right before the footer. */}
      <HomeSection slug="client-carousel">
        <ClientCarousel />
      </HomeSection>
    </main>
  );
}
