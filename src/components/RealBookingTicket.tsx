import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ClipboardCopy, X } from 'lucide-react';
import { bookingDateWib, type StoredApiTicket } from '../api/bookings';
import { slotLabel } from '../api/availability';
import { formatDate } from '../lib/bookings';
import '../styles/booking-real.css';

export function RealBookingTicket({ ticket, onClose }: { ticket: StoredApiTicket; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handle = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key !== 'Tab' || !boxRef.current) return;
      const buttons = [...boxRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      if (!buttons.length) return;
      if (ev.shiftKey && document.activeElement === buttons[0]) { ev.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === buttons[buttons.length - 1]) { ev.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', handle);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handle); document.body.style.overflow = old; before?.focus(); };
  }, [onClose]);
  const day = bookingDateWib(ticket.starts_at);
  async function copy() {
    try { await navigator.clipboard.writeText(`ANTRIAN BARBER · DEMO API LOKAL\nKode tiket: ${ticket.reference_code}\nTanggal: ${day}\nJam: ${slotLabel(ticket.starts_at)} WIB\nStatus: ${ticket.status}`); setCopied(true); }
    catch { setCopied(false); }
  }
  return <div className="dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={boxRef} className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="real-ticket-title" aria-describedby="real-ticket-description">
      <button ref={closeRef} type="button" className="dialog-close" aria-label="Tutup tiket" onClick={onClose}><X size={20}/></button>
      <span className="dialog-success"><Check size={29}/></span><p className="eyebrow justify-center">POSTGRESQL BOOKING CREATED</p>
      <h3 id="real-ticket-title">Tiket tersimpan.</h3><p id="real-ticket-description" className="ticket-muted">Reservasi demo berhasil dicatat pada PostgreSQL lokal; bukan antrean barbershop sungguhan.</p>
      <div className="ticket-paper"><div className="flex justify-between text-xs font-bold tracking-[.14em]"><span>ANTRIAN BARBER</span><span>API LOKAL</span></div>
        <strong className="ticket-number">{ticket.reference_code}</strong>
        <div className="ticket-detail"><span>Barber</span><b>#{ticket.barber_id}</b></div>
        <div className="ticket-detail"><span>Layanan</span><b>#{ticket.service_id}</b></div>
        <div className="ticket-detail"><span>Waktu</span><b>{formatDate(day)} · {slotLabel(ticket.starts_at)} WIB</b></div>
        <div className="ticket-detail"><span>Status server</span><b>{ticket.status}</b></div>
      </div>
      <p className="real-ticket-security">Token akses disimpan sementara pada sesi tab browser untuk pemeriksaan atau pembatalan. Token tidak disalin ke clipboard. Jika tab ditutup, akses dari browser ini mungkin hilang.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className="button button-outline-dark flex-1" onClick={copy}><ClipboardCopy size={17}/>{copied?'Kode disalin':'Salin kode tiket'}</button><button type="button" className="button button-dark flex-1" onClick={()=>{onClose();document.getElementById('riwayat')?.scrollIntoView({behavior:'smooth'});}}>Antreanku <ArrowRight size={17}/></button></div>
    </div>
  </div>;
}
