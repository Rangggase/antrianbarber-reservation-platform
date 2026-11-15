import { ArrowUpRight, Filter } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

type Category = 'Semua' | 'Klasik' | 'Fade' | 'Bertekstur';
const categories: Category[] = ['Semua','Klasik','Fade','Bertekstur'];
const shots: {id:number;title:string;tag:string;category:Exclude<Category,'Semua'>;service:string;photo:string;detail:string}[] = [
  {id:1,title:'Klasik & Abadi',tag:'SIGNATUR',category:'Klasik',service:'classic',photo:'https://images.pexels.com/photos/4625626/pexels-photo-4625626.jpeg?auto=compress&cs=tinysrgb&w=1000',detail:'Siluet klasik yang rapi.'},
  {id:2,title:'Tajam & Rapi',tag:'DETAIL',category:'Fade',service:'fade',photo:'https://images.pexels.com/photos/19664876/pexels-photo-19664876.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Gradasi halus, hasil presisi.'},
  {id:3,title:'Modern & Serbaguna',tag:'MODERN',category:'Bertekstur',service:'fade',photo:'https://images.pexels.com/photos/7518755/pexels-photo-7518755.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Tekstur natural untuk aktivitas sehari-hari.'},
  {id:4,title:'Harian yang Praktis',tag:'HARIAN',category:'Klasik',service:'classic',photo:'https://images.pexels.com/photos/3998423/pexels-photo-3998423.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Potongan serbaguna dengan bentuk tegas.'},
  {id:5,title:'Detail Low Fade',tag:'GRADASI',category:'Fade',service:'fade',photo:'https://images.pexels.com/photos/1805600/pexels-photo-1805600.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Fade bersih dengan sentuhan modern.'},
  {id:6,title:'Gerak Bertekstur',tag:'TEKSTUR',category:'Bertekstur',service:'wash',photo:'https://images.pexels.com/photos/3998417/pexels-photo-3998417.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Volume dan tekstur yang terasa ringan.'},
];
function Shot({shot}:{shot:typeof shots[number]}){
  const [src,setSrc]=useState(shot.photo);
  return <article className="style-card gallery-card"><div className="style-image"><img src={src} loading="lazy" decoding="async" alt={`Contoh inspirasi: ${shot.title}`} onError={()=>{if(src!=='/images/photo-fallback.svg')setSrc('/images/photo-fallback.svg');}}/><span>{String(shot.id).padStart(2,'0')} / 06</span></div>
    <div className="style-info"><div><small>{shot.tag} · {shot.category}</small><h3>{shot.title}</h3><p>{shot.detail}</p></div></div>
    <Link className="gallery-book-link" to={`/reservasi?layanan=${encodeURIComponent(shot.service)}`}>Coba gaya ini <ArrowUpRight size={17}/></Link>
  </article>;
}
export function Inspiration(){
  const [active,setActive]=useState<Category>('Semua');
  const visible=shots.filter(s=>active==='Semua'||s.category===active);
  return <section className="section-light section-alt" id="inspirasi"><div className="container-shell">
    <div className="section-head"><div><div className="eyebrow"><span className="line"/> JURNAL GAYA</div><h2>Potongan segar.<br/><em>Sudut pandang baru.</em></h2></div><p>Dari tampilan rapi hingga potongan yang berani. Filter referensi gaya, lalu pilih layanan demo yang paling cocok.</p></div>
    <div className="gallery-toolbar"><div className="gallery-filter-label"><Filter size={16}/> FILTER INSPIRASI</div><div className="gallery-filter-buttons" role="group" aria-label="Filter kategori inspirasi">{categories.map(c=><button key={c} type="button" className={`gallery-filter ${active===c?'is-active':''}`} aria-pressed={active===c} onClick={()=>setActive(c)}>{c}</button>)}</div><p aria-live="polite">{visible.length} inspirasi ditampilkan</p></div>
    <div className="style-grid gallery-grid">{visible.map(shot=><Shot key={shot.id} shot={shot}/>)}</div>
    <p className="disclaimer mt-6">*Foto adalah referensi gaya, bukan dokumentasi hasil barber demo. Foto eksternal memerlukan koneksi internet.</p>
  </div></section>;
}
export { About } from './StoryAbout';
