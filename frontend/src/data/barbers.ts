export const barbers = [
  { id: 'raka', name: 'Raka Pratama', initials: 'RP', role: 'Barber Senior', experience: '6+ tahun', specialty: 'Fade presisi & taper', bio: 'Detail gradasi yang bersih dan potongan rapi untuk keseharian.', tone: 'sage' },
  { id: 'naufal', name: 'Naufal Ardi', initials: 'NA', role: 'Spesialis Gaya', experience: '5+ tahun', specialty: 'Crop bertekstur & potongan modern', bio: 'Fokus pada tekstur, bentuk, dan gaya yang praktis.', tone: 'sand' },
  { id: 'dimas', name: 'Dimas Putra', initials: 'DP', role: 'Spesialis Perawatan', experience: '4+ tahun', specialty: 'Potong klasik & detail jenggot', bio: 'Potongan klasik dengan perhatian pada garis dan kerapian.', tone: 'stone' },
] as const;

export type BarberId = (typeof barbers)[number]['id'];
export type BarberChoice = BarberId | 'any';
export const findBarber = (id: string) => barbers.find(b => b.id === id);
export const barberLabel = (choice?: string) => choice && choice !== 'any' ? (findBarber(choice)?.name ?? 'Barber pilihan') : 'Barber tersedia (demo)';
