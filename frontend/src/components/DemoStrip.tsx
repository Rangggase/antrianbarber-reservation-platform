import { Info } from 'lucide-react';
import { useRealBooking } from '../api/bookings';
import '../ui';

/**
 * Slim, honest disclosure under the header (replaces the full-width banner above the booking form).
 * It says where the data really goes, so it differs between demo mode and server mode.
 */
export default function DemoStrip() {
  return <div className="ds-root ds-demo-strip" role="note">
    <Info size={16} aria-hidden="true" />
    <span>Demo portofolio. {useRealBooking ? 'Data tersimpan di server demo' : 'Data hanya tersimpan di browser ini'}; gunakan data fiktif.</span>
  </div>;
}
