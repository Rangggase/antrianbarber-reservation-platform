import { useNavigate } from 'react-router';
import Services from '../components/Services';
import type { ServiceId } from '../data/services';

export default function ServicesPage() {
  const navigate = useNavigate();
  const chooseService = (service: ServiceId) => navigate(`/reservasi?layanan=${encodeURIComponent(service)}`);
  // sr-only h1 bridges to Sprint 5e, when the section heading itself becomes the page's h1.
  return <>
    <h1 className="sr-only">Layanan dan harga</h1>
    <Services onSelect={chooseService} />
  </>;
}
