import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, CircleAlert, ClipboardCopy, CalendarDays, Scissors, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { services, findService, formatRupiah, type ServiceId } from '../data/services';
import { useApiCatalog } from '../api/catalog';
import { useLiveAvailability, useAvailability, slotLabel } from '../api/availability';
import { useRealBooking, createApiBooking, getApiBooking, cancelApiBooking, readApiTickets, saveApiTickets, describeApiError, bookingDateWib, type StoredApiTicket } from '../api/bookings';
import { RealBookingTicket } from './RealBookingTicket';
import { Button, Notice, TextField } from '../ui';
import { DayStrip } from './booking/DayStrip';
import { SlotPicker } from './booking/SlotPicker';
import { BarberCard, ServiceCard } from './booking/ChoiceCards';
import { KarcisPanel } from './booking/KarcisPanel';
import { shortDate } from './booking/dates';
import '../styles/booking-availability.css';
import '../styles/booking-real.css';
import './booking/booking.css';
import { barbers, findBarber, barberLabel, type BarberChoice } from '../data/barbers';
import { activeBookings, addDays, availableTimes, createBooking, formatDate, localDate, normalizePhone, readBookings, saveBookings, validDate, type Booking as BookingRecord } from '../lib/bookings';

type Draft = { name: string; phone: string; service: string; barber: BarberChoice; date: string; time: string; notes: string; consent: boolean };
type Stage = 1 | 2 | 3;
type ErrorField = 'service' | 'barber' | 'date' | 'time' | 'name' | 'phone' | 'consent';

const freshDraft = (): Draft => ({name:'', phone:'', service:'', barber:'any', date: localDate(availableTimes(localDate()).length ? new Date() : addDays(new Date(),1)),time:'',notes:'',consent:false});
/** Three steps (design-system/MASTER.md, decision 2): service and barber, time, then details and the ticket. */
const steps = [ ['01','Layanan & barber'],['02','Waktu'],['03','Data & karcis'] ] as const;
/** Order in which errors are listed and focused. */
const ERROR_ORDER: ErrorField[] = ['service', 'barber', 'date', 'time', 'name', 'phone', 'consent'];
const FIELD_LABEL: Record<ErrorField, string> = { service: 'Layanan', barber: 'Barber', date: 'Tanggal', time: 'Jam', name: 'Nama', phone: 'Nomor HP', consent: 'Persetujuan' };
/** Element that receives focus for each error (a group is focusable with tabIndex -1). */
const FIELD_TARGET: Record<ErrorField, string> = { service: 'bk-service', barber: 'bk-barber', date: 'wizard-date', time: 'bk-slots', name: 'wizard-name', phone: 'wizard-phone', consent: 'wizard-consent' };

const focusField = (field: ErrorField) => document.getElementById(FIELD_TARGET[field])?.focus();

const FieldError = ({message,id}: {message?:string,id:string}) => message ? <p id={id} className="ds-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{message}</span></p> : null;

function TicketDialog({ ticket, onClose }: { ticket: BookingRecord, onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !boxRef.current) return;
      const controls = Array.from(boxRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!controls.length) return;
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length - 1].focus(); }
      if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) { e.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown',listener);
    const old = document.body.style.overflow;
    document.body.style.overflow='hidden';
    return () => {document.removeEventListener('keydown',listener);document.body.style.overflow=old;previous?.focus();};
  },[onClose]);
  const detail=`ANTRIAN BARBER · KARCIS DEMO\nNomor: ${ticket.ticket}\nNama: ${ticket.name ?? '—'}\nLayanan: ${findService(ticket.service ?? '')?.name ?? '—'}\nBarber: ${barberLabel(ticket.barber)}\nTanggal: ${formatDate(ticket.date)}\nJam preferensi: ${ticket.time ?? '—'}\nSimulasi lokal, bukan pemesanan nyata.`;
  const copy=async()=>{try{await navigator.clipboard.writeText(detail);setCopied(true);}catch{setCopied(false);}};
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div ref={boxRef} className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title" aria-describedby="ticket-detail-subtitle">
      <button ref={closeRef} type="button" className="dialog-close" aria-label="Tutup tiket" onClick={onClose}><X size={20}/></button>
      <span className="dialog-success"><Check size={29}/></span><p className="eyebrow justify-center">KARCIS DEMO TERBIT</p>
      <h3 id="ticket-title">Karcis Anda sudah terbit.</h3><p id="ticket-detail-subtitle" className="ticket-muted">Nomor antrean simulasi berhasil dibuat. Tidak ada reservasi yang dikirim ke bisnis nyata.</p>
      <div className="ticket-paper"><div className="flex justify-between text-xs font-bold tracking-[.14em]"><span>ANTRIAN BARBER</span><span>DEMO ONLY</span></div>
        <strong className="ticket-number">{ticket.ticket}</strong>
        <div className="ticket-detail"><span>Nama</span><b>{ticket.name}</b></div>
        <div className="ticket-detail"><span>Layanan</span><b>{findService(ticket.service ?? '')?.name ?? '—'}</b></div>
        <div className="ticket-detail"><span>Barber</span><b>{barberLabel(ticket.barber)}</b></div>
        <div className="ticket-detail"><span>Jadwal preferensi</span><b>{formatDate(ticket.date)} · {ticket.time}</b></div>
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" className="button button-outline-dark flex-1" onClick={copy}><ClipboardCopy size={17}/>{copied?'Karcis disalin':'Salin karcis'}</button><button type="button" className="button button-dark flex-1" onClick={()=>{onClose();document.getElementById('riwayat')?.scrollIntoView({behavior:'smooth'});}}>Lihat Antreanku <ArrowRight size={17}/></button></div>
    </div>
  </div>;
}

export default function Booking({preselect}:{preselect:{service?:ServiceId;barber?:BarberChoice}}) {
  const [draft,setDraft]=useState<Draft>(freshDraft);
  const [stage,setStage]=useState<Stage>(1);
  const [errors,setErrors]=useState<Partial<Record<ErrorField,string>>>({});
  const [bookings,setBookings]=useState<BookingRecord[]>(readBookings);
  const [ticket,setTicket]=useState<BookingRecord|null>(null);
  const [apiTickets,setApiTickets]=useState<StoredApiTicket[]>(readApiTickets);
  const [apiTicket,setApiTicket]=useState<StoredApiTicket|null>(null);
  const [apiBusy,setApiBusy]=useState(false);
  const [apiBusyTicket,setApiBusyTicket]=useState<string|null>(null);
  const busyLock=useRef(false);
  const [notice,setNotice]=useState('');
  // Calendar values are computed once on mount, so rendering stays free of Date calls.
  const [calendar]=useState(()=>{const now=new Date();return {today:localDate(now), max:localDate(addDays(now,30)), days:Array.from({length:7},(_,i)=>localDate(addDays(now,i)))};});
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(preselect.service || preselect.barber){setDraft(p=>({...p, ...(preselect.service?{service:preselect.service}:{}), ...(preselect.barber?{barber:preselect.barber}:{})}));}},[preselect.service,preselect.barber]);
  const active=activeBookings(bookings);
  const storeRemote=(items:StoredApiTicket[])=>{setApiTickets(items);return saveApiTickets(items);};
  const servicesApi = useApiCatalog('services');
  const barbersApi = useApiCatalog('barbers');
  const liveService = useLiveAvailability ? servicesApi.items.find(item => item.code === draft.service) : undefined;
  const liveBarber = useLiveAvailability ? barbersApi.items.find(item => item.code === draft.barber) : undefined;
  const availability = useAvailability({
    enabled: useLiveAvailability && stage >= 2 && servicesApi.status === 'ready' && barbersApi.status === 'ready',
    barberId: liveBarber?.id ?? null,
    serviceId: liveService?.id ?? null,
    date: draft.date,
  });
  const liveServices = useLiveAvailability && servicesApi.status === 'ready'
    ? services.filter(item => servicesApi.items.some(remote => remote.code === item.id)) : services;
  const liveBarbers = useLiveAvailability && barbersApi.status === 'ready'
    ? barbers.filter(item => barbersApi.items.some(remote => remote.code === item.id)) : barbers;
  const times = useLiveAvailability ? availability.slots.map(slot => slot.label) : availableTimes(draft.date);
  const liveReady = useLiveAvailability && availability.status === 'ready';
  const update=<K extends keyof Draft>(field:K,value:Draft[K])=>{
    setDraft(p=>({...p,[field]:value,...((field==='date'||field==='barber'||field==='service')?{time:''}:{})}));
    setErrors(p=>({...p,[field as ErrorField]:undefined}));setNotice('');
  };
  const scrollFocus=()=>{requestAnimationFrame(()=>{panelRef.current?.scrollIntoView({behavior:'smooth',block:'start'});panelRef.current?.focus({preventScroll:true});});};
  const validate=(part:Stage): Partial<Record<ErrorField,string>>=>{
    const e:Partial<Record<ErrorField,string>>={};
    const name=draft.name.trim().replace(/\s+/g,' ');
    const phone=normalizePhone(draft.phone);
    if(part===1){
      if (!findService(draft.service) || (useLiveAvailability && (servicesApi.status !== 'ready' || !liveService)))
        e.service = useLiveAvailability && servicesApi.status !== 'ready' ? 'Tunggu daftar layanan selesai dimuat.' : 'Silakan pilih layanan terlebih dahulu.';
      if (useLiveAvailability) {
        if (draft.barber === 'any' || !liveBarber || barbersApi.status !== 'ready')
          e.barber = 'Pilih satu barber agar jam yang tersedia dapat ditampilkan.';
      } else if(draft.barber!=='any'&&!findBarber(draft.barber)) e.barber='Pilih barber yang tersedia pada demo.';
    }
    if(part===2){
      if (useLiveAvailability) {
        if (!validDate(draft.date)) e.date = 'Tanggal hanya boleh dari hari ini sampai 30 hari ke depan.';
        if (!liveReady || !times.includes(draft.time))
          e.time = availability.status === 'loading' ? 'Tunggu data slot selesai dimuat.'
            : availability.status === 'error' ? 'Jam belum dapat dimuat. Coba lagi.'
            : 'Pilih salah satu jam yang tersedia.';
      } else {
        if(!validDate(draft.date))e.date='Tanggal hanya boleh dari hari ini sampai 30 hari ke depan.';
        if(!availableTimes(draft.date).includes(draft.time))e.time='Pilih jam preferensi yang masih berlaku.';
        else if(draft.barber!=='any'&&readBookings().some(b=>b.status==='active'&&b.date===draft.date&&b.time===draft.time&&b.barber===draft.barber)) e.time='Slot barber ini sudah dipilih dalam browser ini.';
      }
    }
    if(part===3){
      if(name.length<2||name.length>70)e.name='Nama harus terdiri dari 2–70 karakter.';
      if(!/^08\d{8,11}$/.test(phone))e.phone='Gunakan nomor Indonesia, misalnya 081234567890.';
      if(!draft.consent)e.consent='Setujui ketentuan demo sebelum melanjutkan.';
      if(!useRealBooking){const saved=readBookings();
      if(!e.phone&&saved.some(b=>b.status==='active'&&b.date===draft.date&&b.phone===phone))e.phone='Nomor ini sudah memiliki reservasi aktif pada tanggal itu.';}
    }
    return e;
  };
  const firstError=(list:Partial<Record<ErrorField,string>>)=>ERROR_ORDER.find(field=>list[field]);
  const moveNext=()=>{
    const nextErrors=validate(stage);setErrors(nextErrors);
    const first=firstError(nextErrors);
    if(first){focusField(first);return;}
    if(stage<3){setStage((stage+1) as Stage);scrollFocus();}
  };
  const goBack=()=>{if(stage>1){setErrors({});setStage((stage-1) as Stage);scrollFocus();}};
  const submit=async()=>{
    if(stage!==3 || busyLock.current)return;
    const checks={...validate(1),...validate(2),...validate(3)};
    if(Object.keys(checks).length){setErrors(checks);setStage(checks.service||checks.barber?1:checks.date||checks.time?2:3);scrollFocus();return;}
    if(useRealBooking){
      if(!liveService || !liveBarber || !liveReady){setNotice('Data belum lengkap. Periksa pilihan layanan, barber, dan jadwal.');return;}
      const slot=availability.slots.find(s=>s.label===draft.time);
      if(!slot){setNotice('Slot berubah. Pilih ulang jam reservasi.');setStage(2);availability.retry();return;}
      busyLock.current=true;setApiBusy(true);setNotice('');
      try {
        const created=await createApiBooking({full_name:draft.name.trim().replace(/\s+/g,' '),phone:normalizePhone(draft.phone),barber_id:liveBarber.id,service_id:liveService.id,starts_at:slot.iso});
        const saved=storeRemote([created, ...apiTickets.filter(t=>t.reference_code!==created.reference_code)].slice(0,10));
        setApiTicket(created);setDraft(freshDraft());setStage(1);setErrors({});
        availability.retry();
        if(!saved)setNotice('Karcis tersimpan di server, tetapi browser menolak penyimpanan sesi. Akses karcis mungkin hilang ketika tab ditutup.');
      }catch(err:unknown){
        setNotice(describeApiError(err));
        if(err && typeof err==='object' && 'status' in err && err.status===409){setDraft(p=>({...p,time:''}));setStage(2);availability.retry();}
      }finally{setApiBusy(false);busyLock.current=false;}
      return;
    }
    const current=readBookings();
    const phone=normalizePhone(draft.phone);
    if(current.some(b=>b.status==='active'&&b.date===draft.date&&b.phone===phone)){
      setErrors({phone:'Sudah ada antrean aktif untuk nomor ini di tanggal tersebut.'});setStage(3);scrollFocus();return;
    }
    // Demo-only collision: this cannot guarantee that another browser has not chosen this slot.
    if(draft.barber!=='any'&&current.some(b=>b.status==='active'&&b.date===draft.date&&b.time===draft.time&&b.barber===draft.barber)){
      setErrors({time:'Slot barber ini sudah dipakai pada browser ini. Pilih waktu/barber lain.'});setStage(2);scrollFocus();return;
    }
    const created=createBooking(current,{name:draft.name.trim().replace(/\s+/g,' '),phone,service:draft.service as ServiceId,barber:draft.barber,date:draft.date,time:draft.time,notes:draft.notes.trim()});
    const next=[...current,created];
    if(!saveBookings(next)){setNotice('Penyimpanan lokal tidak tersedia. Coba browser lain atau periksa izin penyimpanan.');return;}
    setBookings(next);setTicket(created);setDraft(freshDraft());setStage(1);setErrors({});
  };
  const refreshRemote=async(ticket:StoredApiTicket)=>{
    if(apiBusyTicket)return;
    setApiBusyTicket(ticket.reference_code);setNotice('');
    try{
      const updated=await getApiBooking(ticket);
      storeRemote(apiTickets.map(t=>t.reference_code===ticket.reference_code?{...t,...updated}:t));
      setNotice('Status tiket berhasil diperbarui.');
    }catch(err:unknown){setNotice(describeApiError(err));}
    finally{setApiBusyTicket(null);}
  };
  const cancelRemote=async(ticket:StoredApiTicket)=>{
    if(apiBusyTicket||!window.confirm(`Batalkan tiket ${ticket.reference_code}?`))return;
    setApiBusyTicket(ticket.reference_code);setNotice('');
    try{
      const updated=await cancelApiBooking(ticket);
      storeRemote(apiTickets.map(t=>t.reference_code===ticket.reference_code?{...t,...updated}:t));
      setNotice('Tiket dibatalkan. Slot dapat dipesan kembali.');
      availability.retry();
    }catch(err:unknown){setNotice(describeApiError(err));}
    finally{setApiBusyTicket(null);}
  };
  const forgetRemote=(code:string)=>{
    if(!window.confirm('Lupakan tiket dari sesi browser? Ini TIDAK membatalkan tiket di server.'))return;
    storeRemote(apiTickets.filter(t=>t.reference_code!==code));
    setNotice('Catatan tiket lokal dihapus. Status di server tidak berubah.');
  };
  const cancel=(id:string)=>{
    const match=bookings.find(b=>b.id===id);
    if(!match||!window.confirm(`Batalkan tiket demo ${match.ticket}?`))return;
    const next=bookings.map(b=>b.id===id?{id:b.id,seq:b.seq,ticket:b.ticket,date:b.date,status:'cancelled' as const}:b);
    if(!saveBookings(next)){setNotice('Tidak dapat menyimpan pembatalan.');return;}
    setBookings(next);setNotice('Tiket simulasi dibatalkan.');
  };
  const clear=()=>{
    if(useRealBooking){
      if(!apiTickets.length||!window.confirm('Lupakan seluruh tiket dari sesi browser? Ini TIDAK membatalkan reservasi di server.'))return;
      storeRemote([]);setNotice('Catatan sesi browser dihapus, tetapi data server tetap ada.');return;
    }
    if(!bookings.length)return;
    if(!window.confirm('Hapus seluruh data antrean demo dari browser ini?'))return;
    if(!saveBookings([])){setNotice('Gagal menghapus data dari browser.');return;}
    setBookings([]);setNotice('Seluruh data antrean demo berhasil dihapus.');
  };
  const currentService=findService(draft.service);
  const displayPrice = useLiveAvailability && liveService ? liveService.price_idr : currentService?.price;
  const priceText = typeof displayPrice === 'number' ? formatRupiah(displayPrice) : '—';
  const errorFields = ERROR_ORDER.filter(field => errors[field]);
  const summaryLine = [currentService?.name ?? 'Belum memilih layanan', draft.time || 'Jam belum dipilih', priceText].join(' · ');
  const karcisNote: ReactNode = <><ShieldCheck size={18} aria-hidden="true" /><span><b>Demo portofolio, bukan reservasi asli.</b> {useRealBooking ? 'Reservasi demo ini disimpan di server demo. Gunakan data fiktif.' : useLiveAvailability ? 'Jam diambil dari server demo, tetapi karcis ini tidak memblokir slot di server.' : 'Harga, barber, dan jam bersifat ilustratif. Data hanya disimpan di browser ini.'}</span></>;
  return <section className="bk-section ds-root" aria-labelledby="reservation-title"><div className="bk-shell">
    <div className="bk-intro"><p className="bk-eyebrow">PEMESANAN DIGITAL</p><h1 id="reservation-title">Pesan karcis, datang tepat waktu.</h1><p>Tiga langkah singkat untuk mencoba {useRealBooking?'reservasi yang tersimpan di server demo':'simulasi reservasi Antrian Barber'}.</p></div>
    <div className="bk-layout">
      <div className="bk-main" ref={panelRef} tabIndex={-1}>
        <nav aria-label="Langkah reservasi"><ol className="bk-progress">{steps.map(([num,label],i)=>{
          const n=(i+1) as Stage; return <li key={num} className={`bk-progress__item ${stage===n?'is-current':''} ${stage>n?'is-done':''}`} aria-current={stage===n?'step':undefined}>
            <span className="bk-progress__num">{stage>n?'✓':num}</span><span>{label}</span>
          </li>;
        })}</ol></nav>
        <form onSubmit={event=>event.preventDefault()} noValidate>
          {errorFields.length>1 && <div className="bk-summary" role="region" aria-labelledby="bk-summary-title">
            <p id="bk-summary-title" className="bk-summary__title">Ada {errorFields.length} isian yang perlu diperbaiki:</p>
            <ul>{errorFields.map(field=><li key={field}><button type="button" className="bk-link" onClick={()=>focusField(field)}>{FIELD_LABEL[field]}: {errors[field]}</button></li>)}</ul>
          </div>}
          {stage===1&&<div className="bk-step"><h2>Mulai dari gayamu.</h2>
            <p className="bk-lead">Pilih satu layanan dan barber yang kamu inginkan.</p>
            {useLiveAvailability && <div className="wizard-api-state" role="status">{useRealBooking?'Layanan dari server demo. Karcis akan disimpan di server.':'Layanan dari server demo. Karcis akhir tetap demo di browser.'}</div>}
            {useLiveAvailability && servicesApi.status === 'loading' && <p className="bk-lead" role="status">Memuat layanan…</p>}
            {useLiveAvailability && servicesApi.status === 'error' && <Notice variant="danger" title="Daftar layanan belum bisa dimuat." action={<Button variant="secondary" onClick={servicesApi.retry}>Coba lagi</Button>}>{servicesApi.error}</Notice>}
            <h3 className="bk-sub">Layanan</h3>
            <div className="bk-grid" role="group" aria-label="Pilih layanan" id="bk-service" tabIndex={-1}>{(useLiveAvailability && servicesApi.status !== 'ready' ? [] : liveServices).map(s=>{
              const remote = useLiveAvailability ? servicesApi.items.find(item => item.code === s.id) : undefined;
              return <ServiceCard key={s.id} category={s.category} name={remote?.name ?? s.name} description={remote?.description ?? s.description} price={formatRupiah(remote?.price_idr ?? s.price)} duration={remote?.duration_minutes ?? s.duration} selected={draft.service===s.id} onSelect={()=>update('service',s.id)} />;
            })}</div>
            {useLiveAvailability && servicesApi.status === 'ready' && liveServices.length === 0 && <p className="bk-empty" role="status">Tidak ada layanan yang tersedia saat ini.</p>}
            <FieldError id="service-error" message={errors.service}/>
            <p className="bk-note">{useLiveAvailability ? useRealBooking?'Harga dan durasi diambil dari server dan diverifikasi saat pemesanan.':'Harga dan durasi di atas diambil dari server; karcis demo tetap lokal.' : 'Harga dan durasi hanya untuk keperluan demo portofolio.'}</p>
            <h3 className="bk-sub">Siapa yang akan memotong rambutmu?</h3>
            {useLiveAvailability && barbersApi.status === 'loading' && <p className="bk-lead" role="status">Memuat profil barber…</p>}
            {useLiveAvailability && barbersApi.status === 'error' && <Notice variant="danger" title="Daftar barber belum bisa dimuat." action={<Button variant="secondary" onClick={barbersApi.retry}>Coba lagi</Button>}>{barbersApi.error}</Notice>}
            <div className="bk-grid" role="group" aria-label="Pilih barber" id="bk-barber" tabIndex={-1}>
              {!useLiveAvailability && <BarberCard initial="★" name="Siapa saja" detail="Barber tersedia (demo)" selected={draft.barber==='any'} onSelect={()=>update('barber','any')} />}
              {(useLiveAvailability && barbersApi.status !== 'ready' ? [] : liveBarbers).map(b=>{
                const remote = useLiveAvailability ? barbersApi.items.find(item => item.code === b.id) : undefined;
                return <BarberCard key={b.id} initial={b.initials} name={remote?.full_name ?? b.name} detail={remote?.specialty ?? b.role} selected={draft.barber===b.id} onSelect={()=>update('barber',b.id)} />;
              })}
            </div>
            <FieldError id="barber-error" message={errors.barber}/>
            <p className="bk-note">Langkah berikutnya: pilih tanggal dan jam.</p>
          </div>}
          {stage===2&&<div className="bk-step"><h2>Pilih waktu.</h2>
            <p className="bk-lead">{useLiveAvailability?'Jam berasal dari jadwal barber dan dapat berubah sampai karcis berhasil dibuat.':'Semua pilihan masih bersifat ilustrasi, bukan ketersediaan sungguhan.'}</p>
            <h3 className="bk-sub">Pilih hari</h3>
            <DayStrip days={calendar.days} value={draft.date} onChange={iso=>update('date',iso)} />
            <div className="bk-date-other"><TextField id="wizard-date" type="date" label="Tanggal lain" min={calendar.today} max={calendar.max} value={draft.date} onChange={e=>update('date',e.target.value)} hint={useLiveAvailability ? 'Jam mengikuti jadwal barber (WIB). Maksimal 30 hari ke depan.' : 'Perkiraan jam layanan: 09.00–19.00. Maksimal 30 hari ke depan.'} error={errors.date} /></div>
            <h3 className="bk-sub">Pilih jam preferensi</h3>
            {useLiveAvailability && availability.status === 'idle' && <p className="bk-lead" role="status">Pilih layanan dan barber untuk melihat jam yang tersedia.</p>}
            {useLiveAvailability && availability.status === 'loading' && <p className="bk-lead" role="status">Memeriksa jam yang tersedia…</p>}
            {useLiveAvailability && availability.status === 'error' && <Notice variant="danger" title="Jam belum bisa dimuat." action={<Button variant="secondary" onClick={availability.retry}>Coba lagi</Button>}>{availability.error}</Notice>}
            {(!useLiveAvailability || availability.status === 'ready') && <SlotPicker
              times={times}
              value={draft.time}
              isOccupied={time=>!useRealBooking&&draft.barber!=='any'&&active.some(b=>b.date===draft.date&&b.time===time&&b.barber===draft.barber)}
              onSelect={time=>update('time',time)}
              emptyText={useLiveAvailability ? 'Tidak ada jam tersedia untuk pilihan ini. Coba barber atau tanggal lain.' : 'Tidak ada jam demo yang tersedia pada tanggal tersebut. Coba tanggal berikutnya.'}
            />}
            <FieldError id="time-error" message={errors.time}/>
            <p className="bk-note">{useRealBooking?'Slot baru dipastikan saat reservasi dikirim. Jika sudah diambil pengguna lain, kamu akan diminta memilih jam lain.':useLiveAvailability ? 'Ketersediaan diambil saat halaman dimuat. Memilih slot dan membuat karcis DEMO tidak memesan slot di server.' : 'Slot yang tidak tersedia hanya dihitung berdasarkan browser ini, bukan seluruh pelanggan.'}</p>
          </div>}
          {stage===3&&<div className="bk-step"><h2>Lengkapi data demo.</h2>
            <p className="bk-lead">{useRealBooking?'Nama dan nomor fiktif dikirim ke server demo. Jangan masukkan data pelanggan nyata.':'Gunakan data fiktif saat mencoba proyek portofolio.'}</p>
            <div className="bk-fields">
              <TextField id="wizard-name" label="Nama lengkap" required autoComplete="off" maxLength={70} placeholder="Mis. Pelanggan Demo" value={draft.name} onChange={e=>update('name',e.target.value)} error={errors.name} />
              <TextField id="wizard-phone" label="Nomor HP demo" required type="tel" inputMode="tel" autoComplete="off" maxLength={16} placeholder="081234567890" value={draft.phone} onChange={e=>update('phone',e.target.value)} error={errors.phone} />
              {!useRealBooking&&<div className="ds-field"><label className="ds-label" htmlFor="wizard-notes">Catatan gaya (opsional)</label><textarea className="bk-textarea" id="wizard-notes" rows={4} maxLength={180} placeholder="Misalnya: fade rendah, bagian atas tetap panjang..." value={draft.notes} onChange={e=>update('notes',e.target.value)} /><small className="bk-count">{draft.notes.length}/180 karakter</small></div>}
              <div><label className="bk-consent"><input id="wizard-consent" type="checkbox" checked={draft.consent} onChange={e=>update('consent',e.target.checked)} aria-describedby={errors.consent?'consent-error':undefined}/><span>Saya paham ini adalah <b>demo portofolio</b>. {useRealBooking?'Nama dan nomor fiktif akan dicatat di server demo; menghapus karcis dari browser tidak menghapus data di server.':'Data yang saya masukkan hanya disimpan di browser ini dan dapat saya hapus.'}</span></label><FieldError id="consent-error" message={errors.consent}/></div>
            </div>
          </div>}
          {notice&&<Notice variant="danger">{notice}</Notice>}
          <div className="bk-actions">
            <p className="bk-actions__summary">{summaryLine}</p>
            <div className="bk-actions__buttons">
              <Button variant="secondary" onClick={goBack} disabled={stage===1}>Kembali</Button>
              {stage!==3
                ? <Button variant="primary" onClick={moveNext}>Lanjutkan <ArrowRight size={17} aria-hidden="true" /></Button>
                : <Button variant="primary" onClick={submit} loading={apiBusy} loadingLabel="Mengirim…">Ambil karcis</Button>}
            </div>
          </div>
        </form>
      </div>
      <KarcisPanel dateLabel={shortDate(draft.date)} service={currentService?.name ?? 'Pilih layanan'} barber={barberLabel(draft.barber)} time={draft.time || '--.--'} price={priceText} note={karcisNote} />
    </div>
    {useRealBooking ? <section className="booking-history" id="riwayat" aria-labelledby="my-bookings-title">
      <div className="history-head"><div><div className="bk-eyebrow"><span className="line"/> TERSIMPAN DI SERVER DEMO</div><h2 id="my-bookings-title">Antreanku</h2></div><button type="button" className="bk-btn" onClick={clear} disabled={!apiTickets.length}><Trash2 size={16}/> Lupakan seluruh tiket sesi</button></div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      <p className="bk-note">Catatan dan token disimpan sementara di sesi tab browser. Status terakhir bukan data real-time sampai kamu menekan Periksa status. Lupakan tiket tidak membatalkannya di server.</p>
      {apiTickets.length ? <div className="bookings-list">{apiTickets.map(t=>{
        const dateLocal=bookingDateWib(t.starts_at);
        const remoteService=servicesApi.items.find(s=>s.id===t.service_id);
        const remoteBarber=barbersApi.items.find(b=>b.id===t.barber_id);
        return <article key={t.reference_code} className="booking-item real-booking-item">
          <div><div className="flex items-center gap-3"><strong className="booking-ticket">{t.reference_code}</strong><span className="booking-pill">{t.status.toUpperCase()}</span></div>
            <p>{remoteService?.name ?? `Layanan #${t.service_id}`} · {remoteBarber?.full_name ?? `Barber #${t.barber_id}`}</p>
            <small><CalendarDays size={14}/> {formatDate(dateLocal)} · {slotLabel(t.starts_at)} WIB</small>
            {typeof t.queue_number==='number'&&<small className="queue-info">Nomor antrean #{t.queue_number}</small>}
            {typeof t.ahead_count==='number'&&<small className="queue-info">{t.ahead_count} antrean di depan · estimasi tunggu ±{t.estimated_wait_minutes??0} menit</small>}
          </div>
          <div className="bk-actions-row"><button type="button" className="bk-btn" disabled={!!apiBusyTicket} onClick={()=>refreshRemote(t)}>Periksa status</button>
            {['pending','confirmed'].includes(t.status)&&<button type="button" className="bk-btn" disabled={!!apiBusyTicket} onClick={()=>cancelRemote(t)}>Batalkan reservasi</button>}
            <button type="button" className="bk-btn" disabled={!!apiBusyTicket} onClick={()=>forgetRemote(t.reference_code)}>Lupakan lokal</button></div>
        </article>;
      })}</div> : <div className="bk-empty-state"><Scissors size={28}/><p>Belum ada reservasi.</p><small>Pesan karcis untuk melihatnya di sini.</small></div>}
    </section> : <section className="booking-history" id="riwayat" aria-labelledby="my-bookings-title"><div className="history-head"><div><div className="bk-eyebrow"><span className="line"/> TERSIMPAN DI BROWSER ANDA</div><h2 id="my-bookings-title">Antreanku</h2></div><button type="button" className="bk-btn" onClick={clear} disabled={bookings.length===0}><Trash2 size={16}/> Hapus semua data demo</button></div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      {active.length?<div className="bookings-list">{active.map(b=><article key={b.id} className="booking-item"><div><div className="flex items-center gap-3"><strong className="booking-ticket">{b.ticket}</strong><span className="booking-pill">DEMO AKTIF</span></div><p>{b.name} · {findService(b.service??'')?.name}</p><small><UserRound size={14}/> {barberLabel(b.barber)}</small><small><CalendarDays size={14}/> {formatDate(b.date)} · {b.time} (preferensi)</small></div><button type="button" className="bk-btn" onClick={()=>cancel(b.id)}>Batalkan tiket</button></article>)}</div>
      :<div className="bk-empty-state"><Scissors size={28}/><p>Belum ada reservasi.</p><small>Pilih layanan untuk mulai.</small></div>}
    </section>}
  </div>{!useRealBooking&&ticket&&<TicketDialog ticket={ticket} onClose={()=>setTicket(null)}/>}
    {useRealBooking&&apiTicket&&<RealBookingTicket ticket={apiTicket} onClose={()=>setApiTicket(null)}/>}</section>;
}
