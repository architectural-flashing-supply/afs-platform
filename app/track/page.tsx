import DeliveryTrackingMap from '@/components/track/DeliveryTrackingMap';

// Root /track landing page — public, no auth, no order token.
//
// DEMO MODE: hardcoded out-for-delivery order with a truck at Austin, TX
// (visually on the road between Austin and Burnet) so the pulsating live
// driver dot is visible for presentation purposes without a real dispatched
// order. app/track/[orderId]/page.tsx is untouched and still renders only
// real order data — this demo mode is scoped to this page alone.
export default function TrackDeliveryLandingPage() {
  return (
    <main className="fixed inset-0">
      <DeliveryTrackingMap
        orderId="DEMO-001"
        isOutForDelivery={true}
        deliveryAddress={{ line1: '1234 Demo St', city: 'Austin', state: 'TX', zip: '78701' }}
        initialDriverLocation={{ lat: 30.2672, lng: -97.7431, recordedAt: null }}
      />
    </main>
  );
}
