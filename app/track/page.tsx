import DeliveryTrackingMap from '@/components/track/DeliveryTrackingMap';
import BackButton from '@/components/ui/BackButton';

// Root /track landing page — public, no auth, no order token.
//
// DEMO MODE: hardcoded out-for-delivery order with a truck on TX-71 between
// Austin and Spicewood so the pulsating live driver dot is visible for
// presentation purposes without a real dispatched order.
// app/track/[orderId]/page.tsx is untouched and still renders only real
// order data — this demo mode is scoped to this page alone.
export default function TrackDeliveryLandingPage() {
  return (
    <main className="fixed inset-0">
      <BackButton className="fixed left-4 top-[4.25rem] z-[2000]" />
      <DeliveryTrackingMap
        orderId="DEMO-001"
        isOutForDelivery={true}
        deliveryAddress={{ line1: '1234 Demo St', city: 'Austin', state: 'TX', zip: '78701' }}
        initialDriverLocation={{ lat: 30.3280, lng: -97.9444, recordedAt: null }}
      />
    </main>
  );
}
