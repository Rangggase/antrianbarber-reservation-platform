import { ArrowUpRight, Droplets, Scissors, Sparkles, ShieldCheck } from 'lucide-react';
import { services, formatRupiah, type ServiceId } from '../data/services';
import { useApiCatalog, useLiveCatalog } from '../api/catalog';
import '../styles/api-catalog.css';

const icons = { scissors: Scissors, sparkles: Sparkles, droplets: Droplets, badge: ShieldCheck };
type IconName = keyof typeof icons;

export default function Services({ onSelect }: { onSelect: (service: ServiceId) => void }) {
  const catalog = useApiCatalog('services');
  const items = useLiveCatalog
    ? catalog.items.map((remote, index) => {
        const local = services.find(s => s.id === remote.code);
        return {
          id: remote.code,
          no: String(index + 1).padStart(2, '0'),
          category: local?.category ?? 'NEW SERVICE',
          name: remote.name,
          description: remote.description,
          price: remote.price_idr,
          duration: remote.duration_minutes,
          icon: local?.icon ?? 'scissors',
          selectId: local?.id,
        };
      })
    : services.map(item => ({ ...item, selectId: item.id as ServiceId }));

  return <section className="section-light" id="layanan" aria-labelledby="service-heading"><div className="container-shell">
    <div className="section-head"><div><div className="eyebrow"><span className="line"/> OUR SERVICES</div><h2 id="service-heading">Gaya yang tepat.<br/><em>Layanan yang pas.</em></h2></div><p>Klasik atau kontemporer, setiap detail dirancang agar kamu keluar dengan rasa percaya diri yang baru.</p></div>
    {useLiveCatalog && <p className="catalog-source" role="status">Katalog langsung dari FastAPI lokal · Booking Wizard masih simulasi browser.</p>}
    {useLiveCatalog && catalog.status === 'loading' && <div className="catalog-feedback" role="status">Memuat layanan dari PostgreSQL melalui FastAPI…</div>}
    {useLiveCatalog && catalog.status === 'error' && <div className="catalog-feedback catalog-error" role="alert"><p>Data layanan belum dapat dimuat: {catalog.error}</p><button type="button" onClick={catalog.retry}>Coba lagi</button></div>}
    {useLiveCatalog && catalog.status === 'ready' && items.length === 0 && <div className="catalog-feedback" role="status">Belum ada layanan di katalog database.</div>}
    {(!useLiveCatalog || catalog.status === 'ready') && items.length > 0 && <div className="services-grid">{items.map(s => {
      const Icon = icons[s.icon as IconName] ?? Scissors;
      return <article key={s.id} className={`service-card ${s.id === 'fade' ? 'service-featured' : ''}`}>
        <div className="flex items-center justify-between"><span className="service-small">{s.no} / {s.category}</span><Icon size={28} strokeWidth={1.5}/></div>
        <div className="mt-16"><h3>{s.name}</h3><p>{s.description}</p></div>
        <div className="service-bottom"><div><strong>{formatRupiah(s.price)}</strong><span>± {s.duration} menit</span></div>
          {s.selectId ? <button type="button" onClick={() => onSelect(s.selectId as ServiceId)} aria-label={`Pilih layanan ${s.name} (booking demo)`} className="service-action"><ArrowUpRight size={19}/></button>
            : <span className="catalog-unavailable" title="Belum tersedia pada Booking Wizard demo">Demo belum mendukung</span>}
        </div>
      </article>;
    })}</div>}
    <p className="disclaimer mt-6">*{useLiveCatalog ? 'Data katalog berasal dari API lokal. Pemilihan layanan pada Booking Wizard masih demo lokal (harga di wizard belum tersinkron).' : 'Harga dan durasi adalah contoh untuk portofolio, bukan penawaran dari barbershop aktif.'}</p>
  </div></section>;
}
