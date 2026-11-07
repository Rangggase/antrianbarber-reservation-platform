import { useNavigate } from 'react-router';
import Services from '../components/Services';
import type { ServiceId } from '../data/services';

export default function ServicesPage() {
  const navigate = useNavigate();
  const chooseService = (service: ServiceId) => navigate(`/reservasi?layanan=${encodeURIComponent(service)}`);
  return <Services onSelect={chooseService} />;
}
