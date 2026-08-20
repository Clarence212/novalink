// hey reader! production system seed data — all sample/demo data removed for fresh deployment

// D1 — User Account Records (Essential System Accounts)
export const initialUsers = [
  { id: 'u0', role: 'admin', fullName: 'Clarence Lagamia', email: 'clarence@novaville.org', status: 'active', emailVerified: true },
  { id: 'u1', role: 'admin', fullName: 'Maria Santos', email: 'admin@novaville.org', status: 'active', emailVerified: true },
  { id: 'u2', role: 'security', fullName: 'Ramon Dela Cruz', email: 'guard@novaville.org', status: 'active', emailVerified: true },
  { id: 'u3', role: 'resident', fullName: 'Clarence Lagamia', email: 'clarence.lagamia@gmail.com', status: 'active', emailVerified: true, homeownerId: 'h1' },
];

// D2 — Homeowners' Master Records
export const initialHomeowners = [
  {
    id: 'h1', userId: 'u3', ownerName: 'Clarence Lagamia',
    blockLot: 'Block 1, Lot 1', street: 'Sunrise St.', contactNumber: '09179998888',
    email: 'clarence.lagamia@gmail.com', unpaidMonths: 0, restricted: false,
    occupants: []
  },
];

// D3 — Vehicle Records (Fresh)
export const initialVehicles = [];

// D4 — Facility Reservation Records (Fresh)
export const initialReservations = [];

// D5 — Dues & Payment Records (Fresh)
export const initialDues = [];
export const initialPayments = [];

// D6 — Visitor Records (Fresh)
export const initialVisitorLogs = [];

// D7 — Concern Records (Fresh)
export const initialConcerns = [];

// D8 — Announcement Records (Fresh)
export const initialAnnouncements = [];

// D9 — Vehicle Sticker Renewal Records (Fresh)
export const initialStickerRenewals = [];

// D10 — Facility Records (Active Amenities Available for Reservation)
export const initialFacilities = [
  { id: 'f1', name: 'Clubhouse Main Hall', description: 'Spacious indoor hall perfect for events, parties, and gatherings.', capacity: 150, rate: '₱2,500 / 4 hours', guestBookable: true, isActive: true },
  { id: 'f2', name: 'Covered Basketball Court', description: 'Full-sized covered basketball court suitable for sports events.', capacity: 50, rate: '₱500 / hour', guestBookable: true, isActive: true },
  { id: 'f3', name: 'Swimming Pool Area', description: 'Community pool with lounge area. For residents only.', capacity: 30, rate: '₱200 / person / day', guestBookable: false, isActive: true },
  { id: 'f4', name: 'Function Room', description: 'Smaller meeting room for seminars, meetings, and small gatherings.', capacity: 30, rate: '₱1,000 / 4 hours', guestBookable: false, isActive: true },
];

// Official payment QR code configuration
export const paymentQRCode = {
  gcashName: 'Novaville HOA Inc.',
  gcashNumber: '0917-123-4567',
  qrLabel: 'GCash QR Code'
};

// Email notification log (Fresh)
export const initialEmailLog = [];
