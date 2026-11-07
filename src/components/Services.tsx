import { ArrowUpRight, Droplets, Scissors, Sparkles, ShieldCheck } from 'lucide-react';
import { services, formatRupiah, type ServiceId } from '../data/services';
const icons = { scissors: Scissors, sparkles: Sparkles, droplets: Droplets, badge: ShieldCheck };
export default function Services({onSelect}: {onSelect: (service: ServiceId) => void}) {
  return <section className="section-light" id="layanan" aria-labelledby="service-heading"><div className="container-shell">
    <div className="section-head"><div><div className="eyebrow"><span className="line"/> OUR SERVICES</div><h2 id="service-heading">Gaya yang tepat.<br/><em>Layanan yang pas.</em></h2></div><p>Klasik atau kontemporer, setiap detail dirancang agar kamu keluar dengan rasa percaya diri yang baru.</p></div>
    <div className="services-grid">{services.map(s => {
      const Icon = icons[s.icon]; return <article key={s.id} className={`service-card ${s.id === 'fade' ? 'service-featured' : ''}`}>
        <div className="flex items-center justify-between"><span className="service-small">{s.no} / {s.category}</span><Icon size={28} strokeWidth={1.5}/></div>
        <div className="mt-16"><h3>{s.name}</h3><p>{s.description}</p></div>
        <div className="service-bottom"><div><strong>{formatRupiah(s.price)}</strong><span>± {s.duration} menit</span></div><button type="button" onClick={() => onSelect(s.id)} aria-label={`Pilih layanan ${s.name}`} className="service-action"><ArrowUpRight size={19}/></button></div>
      </article>;
    })}</div>
    <p className="disclaimer mt-6">*Harga dan durasi adalah contoh untuk portofolio, bukan penawaran dari barbershop aktif.</p>
  </div></section>;
}
