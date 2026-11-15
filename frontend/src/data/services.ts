export const services = [
  { id: 'classic', no: '01', category: 'ESSENTIAL', name: 'Classic Haircut', description: 'Potongan clean dan presisi yang selalu relevan untuk keseharianmu.', price: 55000, duration: 45, icon: 'scissors' },
  { id: 'fade', no: '02', category: 'MOST REQUESTED', name: 'Fade & Taper', description: 'Gradasi tajam, blending halus, dan detail yang membuatmu standout.', price: 75000, duration: 60, icon: 'sparkles' },
  { id: 'wash', no: '03', category: 'COMPLETE CARE', name: 'Cut & Wash', description: 'Potongan khas dan keramas untuk hasil akhir yang bersih dan segar.', price: 85000, duration: 60, icon: 'droplets' },
  { id: 'beard', no: '04', category: 'GROOMING', name: 'Beard Trim', description: 'Rapikan jenggot dan garis wajah untuk tampilan lebih refined.', price: 35000, duration: 30, icon: 'badge' },
] as const;

export type ServiceId = (typeof services)[number]['id'];
export const formatRupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
export const findService = (id: string) => services.find(s => s.id === id);
