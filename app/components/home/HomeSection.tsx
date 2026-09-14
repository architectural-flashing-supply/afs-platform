import type { ReactNode } from 'react';

interface HomeSectionProps {
  slug: string;
  /**
   * DesignStudioHub, ProfilePassportExplainer, and NationwideMap already
   * set this same id on their own root element (matching in-page anchors --
   * #design-studio, #profile-passport, #nationwide -- that predate this
   * wrapper and are also used by CredibilityStrip/HeroSection/FinalCTA
   * links). Pass false for those so the id isn't duplicated in the DOM;
   * data-section is still stamped either way for the assembly checkpoint.
   */
  withId?: boolean;
  children: ReactNode;
}

export default function HomeSection({ slug, withId = true, children }: HomeSectionProps) {
  return (
    <div data-section={slug} id={withId ? slug : undefined}>
      {children}
    </div>
  );
}
