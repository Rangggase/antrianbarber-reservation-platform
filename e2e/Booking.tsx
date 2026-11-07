import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardCopy, Clock3, Scissors, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { services, findService, formatRupiah, type ServiceId } from '../data/services';
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
  const [notice,setNotice]=useState('');
  const panelRef=useRef<HTMLDivElement>(null);
  const nameRef=useRef<HTMLInputElement>(null);
  const phoneRef=useRef<HTMLInputElement>(null);
  const consentRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(preselect.service || preselect.barber){setDraft(p=>({...p, ...(preselect.service?{service:preselect.service}:{}), ...(preselect.barber?{barber:preselect.barber}:{})}));}},[preselect.service,preselect.barber]);
  const active=activeBookings(bookings);
  const times=availableTimes(draft.date);
  const update=<K extends keyof Draft>(field:K,value:Draft[K])=>{
    setDraft(p=>({...p,[field]:value,...((field==='date'||field==='barber')?{time:''}:{})}));
    setErrors(p=>({...p,[field as ErrorField]:undefined}));setNotice('');
  };
  const scrollFocus=()=>{requestAnimationFrame(()=>{panelRef.current?.scrollIntoView({behavior:'smooth',block:'start'});panelRef.current?.focus({preventScroll:true});});};
  const validate=(part:Stage): Partial<Record<ErrorField,string>>=>{
    const e:Partial<Record<ErrorField,string>>={};
    const name=draft.name.trim().replace(/\s+/g,' ');
    const phone=normalizePhone(draft.phone);
    if(part===1){if(!findService(draft.service))e.service='Silakan pilih layanan terlebih dahulu.';}
    if(part===2){
      if(draft.barber!=='any'&&!findBarber(draft.barber))e.barber='Pilih barber yang tersedia pada demo.';
      if(!validDate(draft.date))e.date='Tanggal hanya boleh dari hari ini sampai 30 hari ke depan.';
      if(!availableTimes(draft.date).includes(draft.time))e.time='Pilih jam preferensi yang masih berlaku.';
      else if(draft.barber!=='any'&&readBookings().some(b=>b.status==='active'&&b.date===draft.date&&b.time===draft.time&&b.barber===draft.barber)) e.time='Slot barber ini sudah dipilih dalam browser ini.';
    }
    if(part===3){
      if(name.length<2||name.length>70)e.name='Nama harus terdiri dari 2–70 karakter.';
      if(!/^08\d{8,11}$/.test(phone))e.phone='Gunakan nomor Indonesia, misalnya 081234567890.';
      if(!draft.consent)e.consent='Setujui ketentuan demo sebelum melanjutkan.';
      const saved=readBookings();
      if(!e.phone&&saved.some(b=>b.status==='active'&&b.date===draft.date&&b.phone===phone))e.phone='Nomor ini sudah memiliki reservasi aktif pada tanggal itu.';
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
  const submit=()=>{
    if(stage!==4)return;
    const checks={...validate(1),...validate(2),...validate(3)};
    if(Object.keys(checks).length){setErrors(checks);setStage(checks.service?1:checks.barber||checks.date||checks.time?2:3);scrollFocus();return;}
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
  const cancel=(id:string)=>{
    const match=bookings.find(b=>b.id===id);
    if(!match||!window.confirm(`Batalkan tiket demo ${match.ticket}?`))return;
    const next=bookings.map(b=>b.id===id?{id:b.id,seq:b.seq,ticket:b.ticket,date:b.date,status:'cancelled' as const}:b);
    if(!saveBookings(next)){setNotice('Tidak dapat menyimpan pembatalan.');return;}
    setBookings(next);setNotice('Tiket simulasi dibatalkan.');
  };
  const clear=()=>{
    if(!bookings.length)return;
    if(!window.confirm('Hapus seluruh data antrean demo dari browser ini?'))return;
    if(!saveBookings([])){setNotice('Gagal menghapus data dari browser.');return;}
    setBookings([]);setNotice('Seluruh data antrean demo berhasil dihapus.');
  };
  const currentService=findService(draft.service);
  return <section className="section-light booking-wizard-section" aria-labelledby="reservation-title"><div className="container-shell">
    <div className="booking-intro"><div className="eyebrow"><span className="line"/> DIGITAL BOOKING EXPERIENCE</div><h2 id="reservation-title">Your seat.<br/><em>Your moment.</em></h2><p>Empat langkah sederhana untuk mencoba simulasi reservasi Antrian Barber.</p></div>
    <div className="booking-demo-disclaimer"><ShieldCheck size={20}/><span><strong>Demo portofolio, bukan reservasi asli.</strong> Harga, profil barber, dan waktu bersifat ilustratif. Data disimpan hanya di browser ini, tanpa sinkronisasi.</span></div>
    <div className="wizard-layout">
      <aside className="wizard-aside" aria-label="Informasi alur booking"><div className="booking-count"><div className="eyebrow eyebrow-inverse"><span className="status-dot"/> ANTREAN LOKAL</div><strong>{active.length}</strong><p>tiket demo aktif di browser ini</p><hr/><small>Hanya simulasi · belum terhubung database</small></div>
        <div className="wizard-aside-notes"><Clock3 size={20}/><p><b>Rencanakan dengan mudah.</b><span>Pilih layanan, barber, dan jam preferensi tanpa akun atau pembayaran.</span></p></div>
        <div className="wizard-aside-notes"><ShieldCheck size={20}/><p><b>Privasi data demo.</b><span>Gunakan data contoh; hapus tiket lokal kapan pun lewat Antreanku.</span></p></div>
      </aside>
      <div className="wizard-panel" ref={panelRef} tabIndex={-1}>
        <nav className="wizard-progress" aria-label="Langkah reservasi">{steps.map(([num,label],i)=>{
          const n=(i+1) as Stage; return <div key={num} className={`wizard-progress-item ${stage===n?'is-current':''} ${stage>n?'is-done':''}`} aria-current={stage===n?'step':undefined}>
            <span>{stage>n?<Check size={17}/>:num}</span><small>{label}</small>
          </div>;
        })}</nav>
        <form onSubmit={event=>event.preventDefault()} noValidate>
          {stage===1&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 01 / CHOOSE A TREATMENT</span><h3>Mulai dari gayamu.</h3><p>Pilih satu layanan yang sesuai dengan kebutuhanmu.</p></div>
            <div className="wizard-service-grid" role="group" aria-label="Pilih layanan">{services.map(s=><button key={s.id} type="button" aria-pressed={draft.service===s.id} className={`wizard-service-choice ${draft.service===s.id?'is-selected':''}`} onClick={()=>update('service',s.id)}><span className="wizard-service-tag">{s.category}</span><strong>{s.name}</strong><span className="wizard-service-description">{s.description}</span><span className="wizard-choice-meta"><b>{formatRupiah(s.price)}</b><small>±{s.duration} menit</small></span><span className="wizard-select-indicator" aria-hidden="true">{draft.service===s.id?<Check size={17}/>:<Scissors size={17}/>}</span></button>)}</div>
            <FieldError id="service-error" message={errors.service}/><p className="disclaimer">*Harga dan durasi hanya untuk keperluan demo portofolio.</p></div>}
          {stage===2&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 02 / YOUR PREFERRED TIME</span><h3>Pilih barber & jadwal.</h3><p>Semua pilihan masih bersifat ilustrasi, bukan ketersediaan sungguhan.</p></div>
            <h4 className="wizard-mini-heading">Siapa yang akan memotong rambutmu?</h4>
            <div className="wizard-barber-grid" role="group" aria-label="Pilih barber">
              <button type="button" aria-pressed={draft.barber==='any'} className={`wizard-barber-choice ${draft.barber==='any'?'is-selected':''}`} onClick={()=>update('barber','any')}><span className="wizard-barber-initial">★</span><b>Siapa saja</b><small>Barber tersedia (demo)</small></button>
              {barbers.map(b=><button type="button" aria-pressed={draft.barber===b.id} key={b.id} className={`wizard-barber-choice ${draft.barber===b.id?'is-selected':''}`} onClick={()=>update('barber',b.id)}><span className="wizard-barber-initial">{b.initials}</span><b>{b.name}</b><small>{b.role}</small></button>)}
            </div><FieldError id="barber-error" message={errors.barber}/>
            <div className="wizard-time-controls"><div className="field"><label htmlFor="wizard-date">Tanggal preferensi <span>*</span></label><input type="date" id="wizard-date" min={localDate()} max={localDate(addDays(new Date(),30))} value={draft.date} onChange={e=>update('date',e.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date?'date-error':undefined}/><FieldError id="date-error" message={errors.date}/></div><div className="wizard-time-hint"><CalendarDays size={21}/><span>Perkiraan jam layanan: 09.00–19.00 (waktu browser). Maksimal 30 hari ke depan.</span></div></div>
            <h4 className="wizard-mini-heading">Pilih jam preferensi</h4>
            <div className="wizard-slot-grid" role="group" aria-label="Jam preferensi">{times.length?times.map(time=>{
              const occupied=draft.barber!=='any'&&active.some(b=>b.date===draft.date&&b.time===time&&b.barber===draft.barber);
              return <button key={time} type="button" aria-pressed={draft.time===time} disabled={occupied} title={occupied?'Digunakan dalam browser ini (demo)':'Jam preferensi demo'} className={`wizard-slot ${draft.time===time?'is-selected':''}`} onClick={()=>update('time',time)}>{time}</button>;
            }):<p className="wizard-no-slots">Tidak ada jam demo yang tersedia pada tanggal tersebut. Coba tanggal berikutnya.</p>}</div>
            <FieldError id="time-error" message={errors.time}/><p className="disclaimer">Slot bertanda tidak tersedia hanya dihitung berdasarkan browser ini, bukan seluruh pelanggan.</p></div>}
          {stage===3&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 03 / YOUR DETAILS</span><h3>Lengkapi data demo.</h3><p>Gunakan data fiktif saat mencoba proyek portofolio.</p></div>
            <div className="form-grid"><div className="field"><label htmlFor="wizard-name">Nama lengkap <span>*</span></label><input ref={nameRef} id="wizard-name" autoComplete="off" maxLength={70} placeholder="Mis. Pelanggan Demo" value={draft.name} onChange={e=>update('name',e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name?'name-error':undefined}/><FieldError id="name-error" message={errors.name}/></div>
            <div className="field"><label htmlFor="wizard-phone">Nomor HP demo <span>*</span></label><input ref={phoneRef} type="tel" inputMode="tel" autoComplete="off" id="wizard-phone" maxLength={16} placeholder="081234567890" value={draft.phone} onChange={e=>update('phone',e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone?'phone-error':undefined}/><FieldError id="phone-error" message={errors.phone}/></div>
            <div className="field field-wide"><label htmlFor="wizard-notes">Catatan gaya (opsional)</label><textarea id="wizard-notes" rows={4} maxLength={180} placeholder="Misalnya: fade rendah, bagian atas tetap panjang..." value={draft.notes} onChange={e=>update('notes',e.target.value)} /><small className="wizard-character-count">{draft.notes.length}/180 karakter</small></div></div>
            <label className="consent wizard-consent"><input ref={consentRef} type="checkbox" checked={draft.consent} onChange={e=>update('consent',e.target.checked)} aria-describedby={errors.consent?'consent-error':undefined}/><span>Saya paham ini adalah <b>simulasi portofolio</b>. Data yang saya masukkan hanya disimpan di browser ini dan dapat saya hapus.</span></label><FieldError id="consent-error" message={errors.consent}/>
            </div>}
          {stage===4&&<div className="wizard-step-content"><div className="wizard-step-heading"><span>STEP 04 / ONE LAST LOOK</span><h3>Periksa reservasi demo.</h3><p>Pastikan pilihan kamu sudah sesuai sebelum membuat tiket lokal.</p></div>
            <div className="wizard-summary"><SummaryRow label="Layanan">{currentService?.name ?? '—'}</SummaryRow><SummaryRow label="Harga ilustratif">{currentService?formatRupiah(currentService.price):'—'}</SummaryRow><SummaryRow label="Barber">{barberLabel(draft.barber)}</SummaryRow><SummaryRow label="Tanggal">{formatDate(draft.date)}</SummaryRow><SummaryRow label="Jam preferensi">{draft.time} (waktu browser)</SummaryRow><SummaryRow label="Nama">{draft.name.trim()}</SummaryRow><SummaryRow label="Nomor demo">{normalizePhone(draft.phone)}</SummaryRow>{draft.notes.trim()&&<SummaryRow label="Catatan">{draft.notes.trim()}</SummaryRow>}</div>
            <div className="wizard-confirm-note"><ShieldCheck size={21}/><p>Tiket yang diterbitkan hanya berlaku untuk demo pada browser ini, dan bukan bukti antrean di barbershop yang sebenarnya.</p></div></div>}
          {notice&&<p className="notice" role="alert">{notice}</p>}
          <div className="wizard-actions"><button type="button" onClick={goBack} className="button button-outline-dark" disabled={stage===1}><ArrowLeft size={17}/> Kembali</button>{stage!==4?<button type="button" onClick={moveNext} className="button button-gold">Lanjutkan <ArrowRight size={17}/></button>:<button type="button" onClick={submit} className="button button-gold">Buat Tiket Demo <CheckCircle2 size={18}/></button>}</div>
        </form>
      </div>
    </div>
    <section className="booking-history" id="riwayat" aria-labelledby="my-bookings-title"><div className="history-head"><div><div className="eyebrow"><span className="line"/> SAVED IN YOUR BROWSER</div><h3 id="my-bookings-title">Antreanku</h3></div><button type="button" className="delete-all" onClick={clear} disabled={bookings.length===0}><Trash2 size={16}/> Hapus semua data demo</button></div>
      {notice&&<p className="notice" role="status">{notice}</p>}
      {active.length?<div className="bookings-list">{active.map(b=><article key={b.id} className="booking-item"><div><div className="flex items-center gap-3"><strong className="booking-ticket">{b.ticket}</strong><span className="booking-pill">DEMO AKTIF</span></div><p>{b.name} · {findService(b.service??'')?.name}</p><small><UserRound size={14}/> {barberLabel(b.barber)}</small><small><CalendarDays size={14}/> {formatDate(b.date)} · {b.time} (preferensi)</small></div><button type="button" className="cancel-ticket" onClick={()=>cancel(b.id)}>Batalkan tiket</button></article>)}</div>
      :<div className="empty-booking"><Scissors size={28}/><p>Belum ada tiket demo aktif.</p><small>Lengkapi langkah reservasi di atas untuk mencoba.</small></div>}
    </section>
  </div>{ticket&&<TicketDialog ticket={ticket} onClose={()=>setTicket(null)}/>}</section>;
}
