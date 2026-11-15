import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router';
import { Menu, Scissors, X } from 'lucide-react';
import { buttonClass } from '../ui';

const links = [
  { to: '/', label: 'Beranda' },
  { to: '/layanan', label: 'Layanan' },
  { to: '/barber', label: 'Barber' },
  { to: '/inspirasi', label: 'Inspirasi' },
  { to: '/tentang', label: 'Tentang' },
  { to: '/faq', label: 'FAQ' },
];

/** Site header (Sprint 5b): ink bar, desktop navigation from 960px, menu button below it. */
export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const close = () => setOpen(false);
  return <header className="ds-root ds-on-ink ds-header" id="top">
    <div className="ds-header__bar">
      <Link to="/" className="ds-header__brand ds-link" aria-label="Antrian Barber — beranda" onClick={close}>
        <Scissors size={22} strokeWidth={1.75} aria-hidden="true" />
        <span>Antrian Barber</span>
      </Link>
      <nav className="ds-header__nav" aria-label="Navigasi utama">
        {links.map(link => <NavLink key={link.to} to={link.to} end className="ds-header__link ds-link">{link.label}</NavLink>)}
      </nav>
      <Link className={buttonClass({ variant: 'primary', compact: true }, 'ds-header__cta ds-link')} to="/reservasi">Ambil antrean</Link>
      <button type="button" className="ds-header__menu ds-link" aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(v => !v)}>
        {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
      </button>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Navigasi mobile" className="ds-header__panel">
      {links.map(link => <NavLink key={link.to} to={link.to} end className="ds-header__link ds-link" onClick={close}>{link.label}</NavLink>)}
      <Link to="/reservasi" onClick={close} className={buttonClass({ variant: 'primary', full: true }, 'ds-link')}>Ambil antrean</Link>
    </nav>}
  </header>;
}
