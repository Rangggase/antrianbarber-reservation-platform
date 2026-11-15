export const barbers = [
  { id: 'raka', name: 'Raka Pratama', initials: 'RP', role: 'Senior Barber', experience: '6+ tahun', specialty: 'Precision fade & taper', bio: 'Detail gradasi yang bersih dan potongan rapi untuk keseharian.', tone: 'sage' },
  { id: 'naufal', name: 'Naufal Ardi', initials: 'NA', role: 'Style Specialist', experience: '5+ tahun', specialty: 'Textured crop & modern cut', bio: 'Fokus pada tekstur, bentuk, dan styling yang praktis.', tone: 'sand' },
  { id: 'dimas', name: 'Dimas Putra', initials: 'DP', role: 'Grooming Specialist', experience: '4+ tahun', specialty: 'Classic cut & beard detail', bio: 'Potongan klasik dengan perhatian pada garis dan kerapian.', tone: 'stone' },
] as const;

export type BarberId = (typeof barbers)[number]['id'];
export type BarberChoice = BarberId | 'any';
export const findBarber = (id: string) => barbers.find(b => b.id === id);
export const barberLabel = (choice?: string) => choice && choice !== 'any' ? (findBarber(choice)?.name ?? 'Barber pilihan') : 'Barber tersedia (demo)';
