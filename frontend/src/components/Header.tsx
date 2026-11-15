import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router';
import { ArrowUpRight, Menu, Scissors, X } from 'lucide-react';

const links = [
  { to: '/', label: 'Beranda' },
  { to: '/layanan', label: 'Layanan' },
  { to: '/barber', label: 'Barber' },
  { to: '/inspirasi', label: 'Inspirasi' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/faq', label: 'FAQ' },
];
export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const navStyle = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'nav-link-active' : ''}`;
  return <header className="site-header" id="top">
    <div className="container-shell flex h-20 items-center justify-between gap-5">
      <Link to="/" className="brand" aria-label="Antrian Barber — beranda" onClick={() => setOpen(false)}>
        <span className="brand-symbol"><Scissors size={22} strokeWidth={1.6}/></span>
        <span>ANTRIAN<span className="text-[#dcb57b]">BARBER.</span></span>
      </Link>
      <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigasi utama">
        {links.map(link => <NavLink key={link.to} to={link.to} end className={navStyle}>{link.label}</NavLink>)}
      </nav>
      <Link className="button button-gold hidden lg:inline-flex" to="/reservasi">Ambil Antrean <ArrowUpRight size={17}/></Link>
      <button type="button" className="mobile-menu-button lg:hidden" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(v => !v)}>{open ? <X size={25}/> : <Menu size={25}/>}</button>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Navigasi mobile" className="mobile-navigation lg:hidden">
      {links.map(link => <NavLink key={link.to} to={link.to} end className={navStyle} onClick={() => setOpen(false)}>{link.label}</NavLink>)}
      <Link to="/reservasi" onClick={() => setOpen(false)} className="button button-gold">Ambil Antrean <ArrowUpRight size={17}/></Link>
    </nav>}
  </header>;
}
