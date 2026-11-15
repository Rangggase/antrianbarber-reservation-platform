import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import Booking from '../components/Booking';
import { findService, type ServiceId } from '../data/services';
import { findBarber, type BarberId } from '../data/barbers';

export default function BookingPage() {
  const [params] = useSearchParams();
  const service = params.get('layanan') || '';
  const barber = params.get('barber') || '';
  const selected = useMemo(() => ({
    service: findService(service) ? service as ServiceId : undefined,
    barber: findBarber(barber) ? barber as BarberId : undefined,
  }), [service, barber]);
  return <Booking preselect={selected} />;
}
