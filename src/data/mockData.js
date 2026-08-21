export const initialUsers = [
  { id: 'u0', role: 'admin', fullName: 'Clarence Lagamia', email: 'clarence@novalinkhub.tech', status: 'active', emailVerified: true },
  { id: 'u1', role: 'admin', fullName: 'Maria Santos', email: 'admin@novalinkhub.tech', status: 'active', emailVerified: true },
];

export const initialHomeowners = [];

export const initialVehicles = [];

export const initialReservations = [];

export const initialDues = [];
export const initialPayments = [];

export const initialVisitorLogs = [];

export const initialConcerns = [];

export const initialAnnouncements = [];

export const initialStickerRenewals = [];

export const initialFacilities = [
  { id: 'f1', name: 'Clubhouse Main Hall', description: 'Spacious indoor hall perfect for events, parties, and gatherings.', capacity: 150, rate: '₱2,500 / 4 hours', guestBookable: true, isActive: true },
  { id: 'f2', name: 'Covered Basketball Court', description: 'Full-sized covered basketball court suitable for sports events.', capacity: 50, rate: '₱500 / hour', guestBookable: true, isActive: true },
  { id: 'f3', name: 'Swimming Pool Area', description: 'Community pool with lounge area. For residents only.', capacity: 30, rate: '₱200 / person / day', guestBookable: false, isActive: true },
  { id: 'f4', name: 'Function Room', description: 'Smaller meeting room for seminars, meetings, and small gatherings.', capacity: 30, rate: '₱1,000 / 4 hours', guestBookable: false, isActive: true },
];

export const paymentQRCode = {
  gcashName: 'Novaville HOA Inc.',
  gcashNumber: '0917-123-4567',
  qrLabel: 'GCash QR Code'
};

export const initialEmailLog = [];
