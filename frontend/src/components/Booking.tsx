import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCopy, Clock3, Scissors, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { services, findService, formatRupiah, type ServiceId } from '../data/services';
import { useApiCatalog } from '../api/catalog';
import { useLiveAvailability, useAvailability, slotLabel } from '../api/availability';
import { useRealBooking, createApiBooking, getApiBooking, cancelApiBooking, readApiTickets, saveApiTickets, describeApiError, bookingDateWib, type StoredApiTicket } from '../api/bookings';
import { RealBookingTicket } from './RealBookingTicket';
import '../styles/booking-availability.css';
import '../styles/booking-real.css';
import { barbers, findBarber, barberLabel, type BarberChoice } from '../data/barbers';
import { activeBookings, addDays, availableTimes, createBooking, formatDate, localDate, normalizePhone, readBookings, saveBookings, validDate, type Booking as BookingRecord } from '../lib/bookings';

type Draft = { name: string; phone: string; service: string; barber: BarberChoice; date: string; time: string; notes: string; consent: boolean };
type Stage = 1 | 2 | 3 | 4;
type ErrorField = 'name' | 'phone' | 'service' | 'barber' | 'date' | 'time' | 'consent';
const freshDraft = (): Draft => ({name:'', phone:'', service:'', barber:'any', date: localDate(availableTimes(localDate()).length ? new Date() : addDays(new Date(),1)),time:'',notes:'',consent:false});
const steps = [ ['01','Layanan'],['02','Barber & waktu'],['03','Data kamu'],['04','Konfirmasi'] ] as const;
const FieldError = ({message,id}: {message?:string,id:string}) => message ? <small id={id} className="form-error" role="alert">{message}</small> : null;

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
  const detail=`ANTRIAN BARBER · TIKET DEMO\nNomor: ${ticket.ticket}\nNama: ${ticket.name ?? '—'}\nLayanan: ${findService(ticket.service ?? '')?.name ?? '—'}\nBarber: ${barberLabel(ticket.barber)}\nTanggal: ${formatDate(ticket.date)}\nJam preferensi: ${ticket.time ?? '—'}\nSimulasi lokal, bukan pemesanan nyata.`;
  const copy=async()=>{try{await navigator.clipboard.writeText(detail);setCopied(true);}catch{setCopied(false);}};
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div ref={boxRef} className="ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-title" aria-describedby="ticket-detail-subtitle">
      <button ref={closeRef} type="button" className="dialog-close" aria-label="Tutup tiket" onClick={onClose}><X size={20}/></button>
      <span className="dialog-success"><Check size={29}/></span><p className="eyebrow justify-center">DEMO BOOKING CREATED</p>
      <h3 id="ticket-title">You're on the list.</h3><p id="ticket-detail-subtitle" className="ticket-muted">Nomor antrean simulasi berhasil dibuat. Tidak ada reservasi yang dikirim ke bisnis nyata.</p>
      <div className="ticket-paper"><div className="flex justify-between text-xs font-bold tracking-[.14em]"><span>ANTRIAN BARBER</span><span>DEMO ONLY</span></div>
        <strong className="ticket-number">{ticket.ticket}</strong>
        <div className="ticket-detail"><span>Nama</span><b>{ticket.name}</b></div>
        <div className="ticket-detail"><span>Layanan</span><b>{findService(ticket.service ?? '')?.name ?? '—'}</b></div>
        <div className="ticket-detail"><span>Barber</span><b>{barberLabel(ticket.barber)}</b></div>
        <div className="ticket-detail"><span>Jadwal preferensi</span><b>{formatDate(ticket.date)} · {ticket.time}</b></div>
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" className="button button-outline-dark flex-1" onClick={copy}><ClipboardCopy size={17}/>{copied?'Tiket disalin':'Salin tiket'}</button><button type="button" className="button button-dark flex-1" onClick={()=>{onClose();document.getElementById('riwayat')?.scrollIntoView({behavior:'smooth'});}}>Lihat Antreanku <ArrowRight size={17}/></button></div>
    </div>
  </div>;
}
function SummaryRow({label,children}:{label:string,children:ReactNode}){return <div className="wizard-summary-row"><span>{label}</span><strong>{children}</strong></div>;}

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
  const panelRef=useRef<HTMLDivElement>(null);
  const nameRef=useRef<HTMLInputElement>(null);
  const phoneRef=useRef<HTMLInputElement>(null);
  const consentRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(preselect.service || preselect.barber){setDraft(p=>({...p, ...(preselect.service?{service:preselect.service}:{}), ...(preselect.barber?{barber:preselect.barber}:{})}));}},[preselect.service,preselect.barber]);
  const active=activeBookings(bookings);
  const activeRemote=apiTickets.filter(t=>['pending','confirmed'].includes(t.status) && Date.parse(t.starts_at)>Date.now());
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
        e.service = useLiveAvailability && servicesApi.status !== 'ready' ? 'Tunggu layanan dari API tersedia.' : 'Silakan pilih layanan terlebih dahulu.';
    }
    if(part===2){
      if (useLiveAvailability) {
        if (draft.barber === 'any' || !liveBarber || barbersApi.status !== 'ready')
          e.barber = 'Pilih satu barber agar ketersediaan API dapat dihitung.';
        if (!validDate(draft.date)) e.date = 'Tanggal hanya boleh dari hari ini sampai 30 hari ke depan.';
        if (!liveReady || !times.includes(draft.time))
          e.time = availability.status === 'loading' ? 'Tunggu data slot selesai dimuat.'
            : availability.status === 'error' ? 'API jadwal belum dapat diakses. Coba lagi.'
            : 'Pilih jam yang tersedia dari API.';
      } else {
        if(draft.barber!=='any'&&!findBarber(draft.barber))e.barber='Pilih barber yang tersedia pada demo.';
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
  const moveNext=()=>{
    const nextErrors=validate(stage);setErrors(nextErrors);
    if(Object.keys(nextErrors).length){
      if(nextErrors.name)nameRef.current?.focus();else if(nextErrors.phone)phoneRef.current?.focus();else if(nextErrors.consent)consentRef.current?.focus();
      return;
    }
    if(stage<4){setStage((stage+1) as Stage);scrollFocus();}
  };
  const goBack=()=>{if(stage>1){setErrors({});setStage((stage-1) as Stage);scrollFocus();}};
  const submit=async()=>{
    if(stage!==4 || busyLock.current)return;
    const checks={...validate(1),...validate(2),...validate(3)};
    if(Object.keys(checks).length){setErrors(checks);setStage(checks.service?1:checks.barber||checks.date||checks.time?2:3);scrollFocus();return;}
    if(useRealBooking){
      if(!liveService || !liveBarber || !liveReady){setNotice('Data API belum lengkap. Periksa pilihan layanan, barber, dan jadwal.');return;}
      const slot=availability.slots.find(s=>s.label===draft.time);
      if(!slot){setNotice('Slot berubah. Pilih ulang jam reservasi.');setStage(2);availability.retry();return;}
      busyLock.current=true;setApiBusy(true);setNotice('');
      try {
        const created=await createApiBooking({full_name:draft.name.trim().replace(/\s+/g,' '),phone:normalizePhone(draft.phone),barber_id:liveBarber.id,service_id:liveService.id,starts_at:slot.iso});
        const saved=storeRemote([created, ...apiTickets.filter(t=>t.reference_code!==created.reference_code)].slice(0,10));
        setApiTicket(created);setDraft(freshDraft());setStage(1);setErrors({});
        availability.retry();
        if(!saved)setNotice('Tiket tercatat di PostgreSQL, tetapi browser menolak penyimpanan sesi. Akses tiket mungkin hilang ketika tab ditutup.');
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
      setNotice('Status tiket berhasil diperbarui dari PostgreSQL.');
    }catch(err:unknown){setNotice(describeApiError(err));}
    finally{setApiBusyTicket(null);}
  };
  const cancelRemote=async(ticket:StoredApiTicket)=>{
    if(apiBusyTicket||!window.confirm(`Batalkan tiket PostgreSQL ${ticket.reference_code}?`))return;
    setApiBusyTicket(ticket.reference_code);setNotice('');
    try{
      const updated=await cancelApiBooking(ticket);
      storeRemote(apiTickets.map(t=>t.reference_code===ticket.reference_code?{...t,...updated}:t));
      setNotice('Tiket dibatalkan di PostgreSQL. Slot dapat tersedia kembali.');
      availability.retry();
    }catch(err:unknown){setNotice(describeApiError(err));}
    finally{setApiBusyTicket(null);}
  };
  const forgetRemote=(code:string)=>{
    if(!window.confirm('Lupakan tiket dari sesi browser? Ini TIDAK membatalkan tiket di PostgreSQL.'))return;
    storeRemote(apiTickets.filter(t=>t.reference_code!==code));
    setNotice('Catatan tiket lokal dihapus. Status PostgreSQL tidak berubah.');
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
      if(!apiTickets.length||!window.confirm('Lupakan seluruh tiket dari sesi browser? Ini TIDAK membatalkan reservasi PostgreSQL.'))return;
      storeRemote([]);setNotice('Catatan sesi browser dihapus, tetapi data server tetap ada.');return;
    }
    if(!bookings.length)return;
    if(!window.confirm('Hapus seluruh data antrean demo dari browser ini?'))return;
    if(!saveBookings([])){setNotice('Gagal menghapus data dari browser.');return;}
    setBookings([]);setNotice('Seluruh data antrean demo berhasil dihapus.');
  };
  const currentService=findService(draft.service);
  const displayPrice = useLiveAvailability && liveService ? liveService.price_idr : currentService?.price;
  return <section className="section-light booking-wizard-section" aria-labelledby="reservation-title"><div className="container-shell">
    <div className="booking-intro"><div className="eyebrow"><span className="line"/> DIGITAL BOOKING EXPERIENCE</div><h2 id="reservation-title">Your seat.<br/><em>Your moment.</em></h2><p>Empat langkah sederhana untuk mencoba {useRealBooking?'reservasi tersimpan di PostgreSQL lokal':'simulasi reservasi Antrian Barber'}.</p></div>
    <div className="booking-demo-disclaimer"><ShieldCheck size={20}/><span><strong>Demo portofolio, bukan reservasi asli.</strong> {useRealBooking ? 'Mode API lokal aktif: reservasi DEMO benar-benar disimpan di PostgreSQL. Gunakan data fiktif, bukan untuk pelanggan nyata.' : useLiveAvailability ? 'Layanan, barber, dan slot tersedia diambil dari FastAPI lokal. Namun tiket yang dibuat masih disimpan hanya pada browser ini dan TIDAK memblokir slot PostgreSQL.' : 'Harga, profil barber, dan waktu bersifat ilustratif. Data disimpan hanya di browser ini, tanpa sinkronisasi.'}</span></div>
    <div className="wizard-layout">
      <aside className="wizard-aside" aria-label="Informasi alur booking"><div className="booking-count"><div className="eyebrow eyebrow-inverse"><span className="status-dot"/> {useRealBooking?'ANTREAN API LOKAL':'ANTREAN LOKAL'}</div><strong>{useRealBooking?activeRemote.length:active.length}</strong><p>{useRealBooking?'tiket demo tercatat pada sesi browser':'tiket demo aktif di browser ini'}</p><hr/><small>{useRealBooking?'Status server bisa diperiksa di Antreanku':'Hanya simulasi · belum terhubung database'}</small></div>
        <div className="wizard-aside-notes"><Clock3 size={20}/><p><b>Rencanakan dengan mudah.</b><span>Pilih layanan, barber, dan jam preferensi tanpa akun atau pembayaran.</span></p></div>
        <div className="wizard-aside-notes"><ShieldCheck size={20}/><p><b>Privasi data demo.</b><span>{useRealBooking?'Gunakan nama dan nomor fiktif; lupakan tiket dari sesi tanpa membatalkan data server.':'Gunakan data contoh; hapus tiket lokal kapan pun lewat Antreanku.'}</span></p></div>
      </aside>
      <div className="wizard-panel" ref={panelRef} tabIndex={-1}>
        <nav className="wizard-progress" aria-label="Langkah reservasi">{steps.map(([num,label],i)=>{
          const n=(i+1) as Stage; return <div key={num} className={`wizard-progress-item ${stage===n?'is-current':''} ${stage>n?'is-done':''}`} aria-current={stage===n?'step':undefined}>
            <span>{stage>n?<Check size={17}/>:num}</span><small>{label}</small>
          </div>;
        })}</nav>
        <form onSubmit={event=>event.preventDefault()} noValidate>
          {stage===1&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 01 / CHOOSE A TREATMENT</span><h3>Mulai dari gayamu.</h3><p>Pilih satu layanan yang sesuai dengan kebutuhanmu.</p></div>
            {useLiveAvailability && <div className="wizard-api-state" role="status">{useRealBooking?'Layanan FastAPI lokal · Tiket akan disimpan di PostgreSQL.':'Layanan dari FastAPI lokal · Tiket akhir tetap demo browser.'}</div>}
            {useLiveAvailability && servicesApi.status === 'loading' && <p className="wizard-api-state" role="status">Memuat layanan API…</p>}
            {useLiveAvailability && servicesApi.status === 'error' && <div className="wizard-api-error" role="alert">Layanan gagal dimuat: {servicesApi.error} <button type="button" onClick={servicesApi.retry}>Coba lagi layanan</button></div>}
            <div className="wizard-service-grid" role="group" aria-label="Pilih layanan">{(useLiveAvailability && servicesApi.status !== 'ready' ? [] : liveServices).map(s=>{
              const remote = useLiveAvailability ? servicesApi.items.find(item => item.code === s.id) : undefined;
              return <button key={s.id} type="button" aria-pressed={draft.service===s.id} className={`wizard-service-choice ${draft.service===s.id?'is-selected':''}`} onClick={()=>update('service',s.id)}><span className="wizard-service-tag">{s.category}</span><strong>{remote?.name ?? s.name}</strong><span className="wizard-service-description">{remote?.description ?? s.description}</span><span className="wizard-choice-meta"><b>{formatRupiah(remote?.price_idr ?? s.price)}</b><small>±{remote?.duration_minutes ?? s.duration} menit</small></span><span className="wizard-select-indicator" aria-hidden="true">{draft.service===s.id?<Check size={17}/>:<Scissors size={17}/>}</span></button>;
            })}</div>
            {useLiveAvailability && servicesApi.status === 'ready' && liveServices.length === 0 && <p className="wizard-api-state" role="status">Tidak ada layanan API yang kompatibel dengan demo saat ini.</p>}
            <FieldError id="service-error" message={errors.service}/><p className="disclaimer">*{useLiveAvailability ? useRealBooking?'Harga dan durasi diperoleh dari API dan diverifikasi saat pemesanan.':'Harga dan durasi di atas diambil dari API; tiket demo tetap lokal.' : 'Harga dan durasi hanya untuk keperluan demo portofolio.'}</p></div>}
          {stage===2&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 02 / YOUR PREFERRED TIME</span><h3>Pilih barber & jadwal.</h3><p>{useLiveAvailability?'Slot berasal dari jadwal PostgreSQL lokal dan dapat berubah sampai tiket berhasil dibuat.':'Semua pilihan masih bersifat ilustrasi, bukan ketersediaan sungguhan.'}</p></div>
            <h4 className="wizard-mini-heading">Siapa yang akan memotong rambutmu?</h4>
            {useLiveAvailability && barbersApi.status === 'loading' && <p className="wizard-api-state" role="status">Memuat profil barber dari API…</p>}
            {useLiveAvailability && barbersApi.status === 'error' && <div className="wizard-api-error" role="alert">Profil barber gagal dimuat: {barbersApi.error} <button type="button" onClick={barbersApi.retry}>Coba lagi barber</button></div>}
            <div className="wizard-barber-grid" role="group" aria-label="Pilih barber">
              {!useLiveAvailability && <button type="button" aria-pressed={draft.barber==='any'} className={`wizard-barber-choice ${draft.barber==='any'?'is-selected':''}`} onClick={()=>update('barber','any')}><span className="wizard-barber-initial">★</span><b>Siapa saja</b><small>Barber tersedia (demo)</small></button>}
              {(useLiveAvailability && barbersApi.status !== 'ready' ? [] : liveBarbers).map(b=>{
                const remote = useLiveAvailability ? barbersApi.items.find(item => item.code === b.id) : undefined;
                return <button type="button" aria-pressed={draft.barber===b.id} key={b.id} className={`wizard-barber-choice ${draft.barber===b.id?'is-selected':''}`} onClick={()=>update('barber',b.id)}><span className="wizard-barber-initial">{b.initials}</span><b>{remote?.full_name ?? b.name}</b><small>{remote?.specialty ?? b.role}</small></button>;
              })}
            </div><FieldError id="barber-error" message={errors.barber}/>
            <div className="wizard-time-controls"><div className="field"><label htmlFor="wizard-date">Tanggal preferensi <span>*</span></label><input type="date" id="wizard-date" min={localDate()} max={localDate(addDays(new Date(),30))} value={draft.date} onChange={e=>update('date',e.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date?'date-error':undefined}/><FieldError id="date-error" message={errors.date}/></div><div className="wizard-time-hint"><CalendarDays size={21}/><span>{useLiveAvailability ? 'Jam mengikuti jadwal barber dari PostgreSQL (Asia/Jakarta). Maksimal 30 hari ke depan.' : 'Perkiraan jam layanan: 09.00–19.00 (waktu browser). Maksimal 30 hari ke depan.'}</span></div></div>
            <h4 className="wizard-mini-heading">Pilih jam preferensi</h4>
            {useLiveAvailability && availability.status === 'idle' && <p className="wizard-api-state" role="status">Pilih layanan dan barber untuk melihat slot dari API.</p>}
            {useLiveAvailability && availability.status === 'loading' && <p className="wizard-api-state" role="status">Memeriksa slot tersedia di PostgreSQL…</p>}
            {useLiveAvailability && availability.status === 'error' && <div className="wizard-api-error" role="alert">Slot API gagal dimuat: {availability.error} <button type="button" onClick={availability.retry}>Coba lagi slot</button></div>}
            {(!useLiveAvailability || availability.status === 'ready') && <div className="wizard-slot-grid" role="group" aria-label="Jam preferensi">{times.length?times.map(time=>{
              const occupied=!useRealBooking&&draft.barber!=='any'&&active.some(b=>b.date===draft.date&&b.time===time&&b.barber===draft.barber);
              return <button key={time} type="button" aria-pressed={draft.time===time} disabled={occupied} title={occupied?'Sudah dipakai pada tiket demo di browser ini':useLiveAvailability?'Slot tersedia saat dimuat dari API':'Jam preferensi demo'} className={`wizard-slot ${draft.time===time?'is-selected':''}`} onClick={()=>update('time',time)}>{time}</button>;
            }):<p className="wizard-no-slots">{useLiveAvailability ? 'Tidak ada slot API untuk pilihan ini. Coba barber atau tanggal lain.' : 'Tidak ada jam demo yang tersedia pada tanggal tersebut. Coba tanggal berikutnya.'}</p>}</div>}
            <FieldError id="time-error" message={errors.time}/><p className="disclaimer">{useRealBooking?'Slot hanya dipastikan saat POST reservasi. Jika diambil pengguna lain, FastAPI akan menolak dengan HTTP 409.':useLiveAvailability ? 'Ketersediaan berasal dari API pada saat halaman dimuat. Memilih slot dan membuat tiket DEMO tidak memesan slot di PostgreSQL.' : 'Slot bertanda tidak tersedia hanya dihitung berdasarkan browser ini, bukan seluruh pelanggan.'}</p></div>}
          {stage===3&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 03 / YOUR DETAILS</span><h3>Lengkapi data demo.</h3><p>{useRealBooking?'Nama dan nomor fiktif dikirim ke PostgreSQL lokal. Jangan masukkan data pelanggan nyata.':'Gunakan data fiktif saat mencoba proyek portofolio.'}</p></div>
            <div className="form-grid"><div className="field"><label htmlFor="wizard-name">Nama lengkap <span>*</span></label><input ref={nameRef} id="wizard-name" autoComplete="off" maxLength={70} placeholder="Mis. Pelanggan Demo" value={draft.name} onChange={e=>update('name',e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name?'name-error':undefined}/><FieldError id="name-error" message={errors.name}/></div>
            <div className="field"><label htmlFor="wizard-phone">Nomor HP demo <span>*</span></label><input ref={phoneRef} type="tel" inputMode="tel" autoComplete="off" id="wizard-phone" maxLength={16} placeholder="081234567890" value={draft.phone} onChange={e=>update('phone',e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone?'phone-error':undefined}/><FieldError id="phone-error" message={errors.phone}/></div>
            {!useRealBooking&&<div className="field field-wide"><label htmlFor="wizard-notes">Catatan gaya (opsional)</label><textarea id="wizard-notes" rows={4} maxLength={180} placeholder="Misalnya: fade rendah, bagian atas tetap panjang..." value={draft.notes} onChange={e=>update('notes',e.target.value)} /><small className="wizard-character-count">{draft.notes.length}/180 karakter</small></div>}</div>
            <label className="consent wizard-consent"><input ref={consentRef} type="checkbox" checked={draft.consent} onChange={e=>update('consent',e.target.checked)} aria-describedby={errors.consent?'consent-error':undefined}/><span>Saya paham ini adalah <b>demo portofolio</b>. {useRealBooking?'Nama dan nomor fiktif akan dicatat di PostgreSQL lokal; melupakan tiket di browser tidak menghapus data server.':'Data yang saya masukkan hanya disimpan di browser ini dan dapat saya hapus.'}</span></label><FieldError id="consent-error" message={errors.consent}/>
            </div>}
          {stage===4&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 04 / ONE LAST LOOK</span><h3>Periksa reservasi demo.</h3><p>{useRealBooking?'Periksa kembali sebelum mengirim transaksi ke FastAPI lokal.':'Pastikan pilihan kamu sudah sesuai sebelum membuat tiket lokal.'}</p></div>
            <div className="wizard-summary"><SummaryRow label="Layanan">{currentService?.name ?? '—'}</SummaryRow><SummaryRow label={useLiveAvailability?'Harga katalog API':'Harga ilustratif'}>{typeof displayPrice === 'number' ? formatRupiah(displayPrice) : '—'}</SummaryRow><SummaryRow label="Barber">{barberLabel(draft.barber)}</SummaryRow><SummaryRow label="Tanggal">{formatDate(draft.date)}</SummaryRow><SummaryRow label="Jam preferensi">{draft.time} ({useLiveAvailability?'WIB · diperiksa via API':'waktu browser'})</SummaryRow><SummaryRow label="Nama">{draft.name.trim()}</SummaryRow><SummaryRow label="Nomor demo">{normalizePhone(draft.phone)}</SummaryRow>{!useRealBooking&&draft.notes.trim()&&<SummaryRow label="Catatan">{draft.notes.trim()}</SummaryRow>}</div>
            <div className="wizard-confirm-note"><ShieldCheck size={21}/><p>{useRealBooking?'Transaksi akan menulis data demo ke PostgreSQL lokal. Slot baru dipesan bila FastAPI membalas HTTP 201. Bukan bukti reservasi pada barbershop sungguhan.':`Tiket yang diterbitkan hanya berlaku untuk demo pada browser ini. ${useLiveAvailability ? 'Slot API belum dipesan; konfirmasi ke PostgreSQL baru tersedia pada v2.3c.' : 'Ini bukan bukti antrean di barbershop yang sebenarnya.'}`}</p></div></div>}
          {notice&&<p className="notice" role="alert">{notice}</p>}
          <div className="wizard-actions"><button type="button" onClick={goBack} className="button button-outline-dark" disabled={stage===1}><ArrowLeft size={17}/> Kembali</button>{stage!==4?<button type="button" onClick={moveNext} className="button button-gold">Lanjutkan <ArrowRight size={17}/></button>:<button type="button" onClick={submit} disabled={apiBusy} className="button button-gold">{useRealBooking?(apiBusy?'Mengirim reservasi…':'Buat Tiket PostgreSQL'):'Buat Tiket Demo'} <CheckCircle2 size={18}/></button>}</div>
        </form>
      </div>
    </div>
    {useRealBooking ? <section className="booking-history" id="riwayat" aria-labelledby="my-bookings-title">
      <div className="history-head"><div><div className="eyebrow"><span className="line"/> FASTAPI · POSTGRESQL LOCAL</div><h3 id="my-bookings-title">Antreanku</h3></div><button type="button" className="delete-all" onClick={clear} disabled={!apiTickets.length}><Trash2 size={16}/> Lupakan seluruh tiket sesi</button></div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      <p className="real-history-caption">Catatan dan token disimpan sementara di sesi tab browser. Status terakhir bukan data real-time sampai kamu menekan Periksa status. Lupakan tiket tidak membatalkannya di PostgreSQL.</p>
      {apiTickets.length ? <div className="bookings-list">{apiTickets.map(t=>{
        const dateLocal=bookingDateWib(t.starts_at);
        const remoteService=servicesApi.items.find(s=>s.id===t.service_id);
        const remoteBarber=barbersApi.items.find(b=>b.id===t.barber_id);
        return <article key={t.reference_code} className="booking-item real-booking-item">
          <div><div className="flex items-center gap-3"><strong className="booking-ticket">{t.reference_code}</strong><span className="booking-pill">{t.status.toUpperCase()}</span></div>
            <p>{remoteService?.name ?? `Layanan #${t.service_id}`} · {remoteBarber?.full_name ?? `Barber #${t.barber_id}`}</p>
            <small><CalendarDays size={14}/> {formatDate(dateLocal)} · {slotLabel(t.starts_at)} WIB</small>
          </div>
          <div className="real-booking-actions"><button type="button" className="cancel-ticket" disabled={!!apiBusyTicket} onClick={()=>refreshRemote(t)}>Periksa status</button>
            {['pending','confirmed'].includes(t.status)&&<button type="button" className="cancel-ticket" disabled={!!apiBusyTicket} onClick={()=>cancelRemote(t)}>Batalkan di API</button>}
            <button type="button" className="cancel-ticket" disabled={!!apiBusyTicket} onClick={()=>forgetRemote(t.reference_code)}>Lupakan lokal</button></div>
        </article>;
      })}</div> : <div className="empty-booking"><Scissors size={28}/><p>Belum ada tiket API dalam sesi ini.</p><small>Pesan tiket demo lokal untuk melihatnya di sini.</small></div>}
    </section> : <section className="booking-history" id="riwayat" aria-labelledby="my-bookings-title"><div className="history-head"><div><div className="eyebrow"><span className="line"/> SAVED IN YOUR BROWSER</div><h3 id="my-bookings-title">Antreanku</h3></div><button type="button" className="delete-all" onClick={clear} disabled={bookings.length===0}><Trash2 size={16}/> Hapus semua data demo</button></div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      {active.length?<div className="bookings-list">{active.map(b=><article key={b.id} className="booking-item"><div><div className="flex items-center gap-3"><strong className="booking-ticket">{b.ticket}</strong><span className="booking-pill">DEMO AKTIF</span></div><p>{b.name} · {findService(b.service??'')?.name}</p><small><UserRound size={14}/> {barberLabel(b.barber)}</small><small><CalendarDays size={14}/> {formatDate(b.date)} · {b.time} (preferensi)</small></div><button type="button" className="cancel-ticket" onClick={()=>cancel(b.id)}>Batalkan tiket</button></article>)}</div>
      :<div className="empty-booking"><Scissors size={28}/><p>Belum ada tiket demo aktif.</p><small>Lengkapi langkah reservasi di atas untuk mencoba.</small></div>}
    </section>}
  </div>{!useRealBooking&&ticket&&<TicketDialog ticket={ticket} onClose={()=>setTicket(null)}/>}
    {useRealBooking&&apiTicket&&<RealBookingTicket ticket={apiTicket} onClose={()=>setApiTicket(null)}/>}</section>;
}
