export const services = [
  { id: 'classic', no: '01', category: 'DASAR', name: 'Potong Klasik', description: 'Potongan rapi dan presisi yang selalu relevan untuk keseharianmu.', price: 55000, duration: 45, icon: 'scissors' },
  { id: 'fade', no: '02', category: 'PALING DICARI', name: 'Fade & Taper', description: 'Gradasi tajam, blending halus, dan detail yang membuatmu tampil menonjol.', price: 75000, duration: 60, icon: 'sparkles' },
  { id: 'wash', no: '03', category: 'PERAWATAN LENGKAP', name: 'Potong & Cuci', description: 'Potongan khas dan keramas untuk hasil akhir yang bersih dan segar.', price: 85000, duration: 60, icon: 'droplets' },
  { id: 'beard', no: '04', category: 'PERAPIAN', name: 'Rapikan Jenggot', description: 'Rapikan jenggot dan garis wajah untuk tampilan lebih rapi.', price: 35000, duration: 30, icon: 'badge' },
] as const;

export type ServiceId = (typeof services)[number]['id'];
export const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
export const findService = (id: string) => services.find(s => s.id === id);
