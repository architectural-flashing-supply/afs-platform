import DeliveryTrackingMap from '@/components/track/DeliveryTrackingMap';

// Root /track landing page — public, no auth, no order token. Renders the
// same fallback service-area view app/track/[orderId]/page.tsx shows when
// no valid token is found, so the nav's "Track Delivery" link has
// somewhere to land instead of 404ing.
export default function TrackDeliveryLandingPage() {
  return (
    <main className="fixed inset-0">
      <DeliveryTrackingMap isOutForDelivery={false} />
    </main>
  );
}
