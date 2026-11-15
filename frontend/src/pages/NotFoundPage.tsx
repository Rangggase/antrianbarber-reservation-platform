import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
export default function NotFoundPage() {
  return <section className="section-light notfound-page"><div className="container-shell">
    <div className="eyebrow"><span className="line"/> PAGE NOT FOUND</div>
    <h1>404 <em>Halaman tidak ditemukan.</em></h1>
    <p>Alamat yang kamu buka belum tersedia di Antrian Barber.</p>
    <Link to="/" className="button button-dark">Kembali ke Beranda <ArrowUpRight size={18}/></Link>
  </div></section>;
}
