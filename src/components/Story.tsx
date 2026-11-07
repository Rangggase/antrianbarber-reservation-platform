import { ArrowUpRight, Filter } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

type Category = 'Semua' | 'Classic' | 'Fade' | 'Textured';
const categories: Category[] = ['Semua','Classic','Fade','Textured'];
const shots: {id:number;title:string;tag:string;category:Exclude<Category,'Semua'>;service:string;photo:string;detail:string}[] = [
  {id:1,title:'Classic & Timeless',tag:'THE SIGNATURE',category:'Classic',service:'classic',photo:'https://images.pexels.com/photos/4625626/pexels-photo-4625626.jpeg?auto=compress&cs=tinysrgb&w=1000',detail:'Siluet klasik yang rapi.'},
  {id:2,title:'Sharp & Clean',tag:'THE DETAIL',category:'Fade',service:'fade',photo:'https://images.pexels.com/photos/19664876/pexels-photo-19664876.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Gradasi halus, hasil presisi.'},
  {id:3,title:'Modern & Versatile',tag:'THE MODERN',category:'Textured',service:'fade',photo:'https://images.pexels.com/photos/7518755/pexels-photo-7518755.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Tekstur natural untuk aktivitas sehari-hari.'},
  {id:4,title:'Everyday Essential',tag:'THE EVERYDAY',category:'Classic',service:'classic',photo:'https://images.pexels.com/photos/3998423/pexels-photo-3998423.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Potongan versatile dengan bentuk tegas.'},
  {id:5,title:'Low Fade Detail',tag:'THE GRADIENT',category:'Fade',service:'fade',photo:'https://images.pexels.com/photos/1805600/pexels-photo-1805600.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Fade bersih dengan sentuhan modern.'},
  {id:6,title:'Textured Movement',tag:'THE TEXTURE',category:'Textured',service:'wash',photo:'https://images.pexels.com/photos/3998417/pexels-photo-3998417.jpeg?auto=compress&cs=tinysrgb&w=850',detail:'Volume dan tekstur yang terasa ringan.'},
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
    <div className="section-head"><div><div className="eyebrow"><span className="line"/> STYLE JOURNAL</div><h2>Fresh cut.<br/><em>Fresh perspective.</em></h2></div><p>Dari clean look hingga statement cut. Filter referensi gaya, lalu pilih layanan demo yang paling cocok.</p></div>
    <div className="gallery-toolbar"><div className="gallery-filter-label"><Filter size={16}/> FILTER INSPIRASI</div><div className="gallery-filter-buttons" role="group" aria-label="Filter kategori inspirasi">{categories.map(c=><button key={c} type="button" className={`gallery-filter ${active===c?'is-active':''}`} aria-pressed={active===c} onClick={()=>setActive(c)}>{c}</button>)}</div><p aria-live="polite">{visible.length} inspirasi ditampilkan</p></div>
    <div className="style-grid gallery-grid">{visible.map(shot=><Shot key={shot.id} shot={shot}/>)}</div>
    <p className="disclaimer mt-6">*Foto adalah referensi gaya, bukan dokumentasi hasil barber demo. Foto eksternal memerlukan koneksi internet.</p>
  </div></section>;
}
export { About } from './StoryAbout';
