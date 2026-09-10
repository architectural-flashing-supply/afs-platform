import dynamic from 'next/dynamic';
import HomeSection from '@/app/components/home/HomeSection';
import HeroSection from '@/app/components/hero/HeroSection';
import CredibilityStrip from '@/app/components/home/CredibilityStrip';
import FieldAppStory from '@/app/components/home/FieldAppStory';
import DesignStudioHub from '@/app/components/home/DesignStudioHub';
import DesignToDelivery from '@/app/components/home/DesignToDelivery';
import CustomerPathways from '@/app/components/home/CustomerPathways';
import ProfilePassportExplainer from '@/app/components/home/ProfilePassportExplainer';
import CaseStudies from '@/app/components/home/CaseStudies';
import ShopFloorProof from '@/app/components/home/ShopFloorProof';
import FinalCTA from '@/app/components/home/FinalCTA';

// ProfileExplorer (Supabase-backed profile grid, optional inline 3D viewer)
// and NationwideMap (Leaflet map) are the two heaviest sections below the
// fold. `ssr: false` isn't legal here -- this file has no 'use client', and
// Next disallows `dynamic(..., { ssr: false })` in Server Components -- so
// this is a plain code-split (ssr stays on). Each component already
// defers its own genuinely client-only piece internally via its own
// `dynamic(..., { ssr: false })` inside a 'use client' module: ProfileRotation
// inside HeroSection, ProfileViewer3D inside ProfileLibraryBrowser (used by
// ProfileExplorer), and NationwideMapLeaflet inside NationwideMap.
const ProfileExplorer = dynamic(() => import('@/app/components/home/ProfileExplorer'));
const NationwideMap = dynamic(() => import('@/app/components/home/NationwideMap'));

export default function HomePage() {
  return (
    <main>
      <HomeSection slug="hero">
        <HeroSection />
      </HomeSection>

      <HomeSection slug="credibility">
        <CredibilityStrip />
      </HomeSection>

      <HomeSection slug="field-app">
        <FieldAppStory />
      </HomeSection>

      {/* DesignStudioHub already sets id="design-studio" on its own root
          section -- the same anchor also reachable at the standalone
          /design-studio route -- so withId is off here to avoid a
          duplicate id in the DOM. */}
      <HomeSection slug="design-studio" withId={false}>
        <DesignStudioHub />
      </HomeSection>

      <HomeSection slug="profile-explorer" withId={false}>
        <ProfileExplorer />
      </HomeSection>

      <HomeSection slug="design-to-delivery">
        <DesignToDelivery />
      </HomeSection>

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
    </main>
  );
}
