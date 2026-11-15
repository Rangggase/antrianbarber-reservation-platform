import { test, expect, type Page } from '@playwright/test';

const services = [
  { id:1, code:'classic', name:'Classic Haircut', description:'Demo service', duration_minutes:45, price_idr:55000 },
  { id:2, code:'fade', name:'Fade & Taper', description:'Demo fade', duration_minutes:60, price_idr:75000 },
];
const barbers = [ { id:1, code:'raka', full_name:'Raka Pratama', specialty:'Fade', bio:'Demo barber' } ];
const accessToken = 'SAMPLE_PRIVATE_TOKEN_1234567890';
const code = 'AB-20261110-ABCDEF1234';
const cors = {'access-control-allow-origin':'*', 'access-control-allow-headers':'Content-Type,X-Booking-Token,Accept', 'access-control-allow-methods':'GET,POST,OPTIONS'};

function tomorrow() {
  const d=new Date();d.setDate(d.getDate()+1);
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const part=(n:string)=>parts.find(x=>x.type===n)?.value||'';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function mockApi(page:Page, failCreate=false){
  const day=tomorrow();
  const view={ reference_code:code,barber_id:1,service_id:1,starts_at:`${day}T10:00:00+07:00`,ends_at:`${day}T10:45:00+07:00`,status:'pending',price_idr:55000 };
  let created=0, cancelled=0, getAuthorized=0;
  await page.route('http://127.0.0.1:8000/api/v1/**',route=>{
    const request=route.request();const url=new URL(request.url());const pathname=url.pathname;
    const fulfill=(status:number,json:unknown)=>route.fulfill({status,json,headers:cors});
    if(request.method()==='OPTIONS') return route.fulfill({status:204,body:'',headers:cors});
    if(pathname.endsWith('/services'))return fulfill(200,services);
    if(pathname.endsWith('/barbers'))return fulfill(200,barbers);
    if(pathname.endsWith('/availability'))return fulfill(200,{date:url.searchParams.get('date'),barber_id:Number(url.searchParams.get('barber_id')),service_id:Number(url.searchParams.get('service_id')),timezone:'Asia/Jakarta',slots:[`${url.searchParams.get('date')}T10:00:00+07:00`]});
    if(pathname.endsWith('/bookings') && request.method()==='POST'){
      created++;return failCreate?fulfill(409,{detail:'Slot tidak tersedia atau tidak sesuai jadwal'}):fulfill(201,{...view, access_token:accessToken});
    }
    if(pathname.endsWith(`/bookings/${code}`) && request.method()==='GET'){
      if(request.headers()['x-booking-token']===accessToken){ getAuthorized++;return fulfill(200,{...view,status:cancelled?'cancelled':'pending'}); }
      return fulfill(403,{detail:'Token reservasi tidak valid'});
    }
    if(pathname.endsWith(`/bookings/${code}/cancel`) && request.method()==='POST'){
      if(request.headers()['x-booking-token']!==accessToken)return fulfill(403,{detail:'Token reservasi tidak valid'});
      cancelled++;return fulfill(200,{...view,status:'cancelled'});
    }
    return fulfill(404,{detail:'Not Found'});
  });
  return { stats:()=>({created,cancelled,getAuthorized}) };
}

async function fillWizard(page:Page){
  await page.goto('/reservasi');
  await page.getByRole('group',{name:'Pilih layanan'}).getByRole('button',{name:/Classic Haircut/}).click();
  await page.getByRole('button',{name:'Lanjutkan'}).click();
  await page.getByRole('group',{name:'Pilih barber'}).getByRole('button',{name:/Raka Pratama/}).click();
  await page.locator('#wizard-date').fill(tomorrow());
  const slot=page.getByRole('group',{name:'Jam preferensi'}).getByRole('button',{name:'10:00'});
  await expect(slot).toBeVisible();await slot.click();
  await page.getByRole('button',{name:'Lanjutkan'}).click();
  await page.locator('#wizard-name').fill('Pelanggan Demo');
  await page.locator('#wizard-phone').fill('081299991234');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button',{name:'Lanjutkan'}).click();
}

test('POST 201 menampilkan tiket, GET menggunakan token, dan pembatalan POST mengubah status', async ({page})=>{
  const api=await mockApi(page);
  await fillWizard(page);
  await page.getByRole('button',{name:'Buat Tiket PostgreSQL'}).click();
  await expect(page.getByRole('dialog',{name:'Tiket tersimpan.'})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(code);
  await page.getByRole('button',{name:'Tutup tiket'}).click();
  await expect(page.getByText(code)).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Periksa status'}).click();
  await expect(page.getByRole('status').filter({hasText:'Status tiket berhasil diperbarui'})).toBeVisible();
  page.once('dialog',dlg=>dlg.accept());
  await page.getByRole('button',{name:'Batalkan di API'}).click();
  await expect(page.getByText('CANCELLED',{exact:true})).toBeVisible();
  expect(api.stats()).toEqual({created:1,cancelled:1,getAuthorized:1});
});

test('HTTP 409 tidak menghasilkan tiket palsu dan meminta memilih ulang slot',async({page})=>{
  const api=await mockApi(page,true);
  await fillWizard(page);
  await page.getByRole('button',{name:'Buat Tiket PostgreSQL'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Konflik reservasi (HTTP 409)'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Pilih barber & jadwal.'})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(api.stats().created).toBe(1);
});

test('menghapus catatan sesi tidak memanggil cancel API',async({page})=>{
  const api=await mockApi(page);
  await fillWizard(page);
  await page.getByRole('button',{name:'Buat Tiket PostgreSQL'}).click();
  await page.getByRole('button',{name:'Tutup tiket'}).click();
  page.once('dialog',dlg=>dlg.accept());
  await page.getByRole('button',{name:'Lupakan lokal'}).click();
  await expect(page.getByText('Belum ada tiket API dalam sesi ini.')).toBeVisible();
  expect(api.stats().cancelled).toBe(0);
});
