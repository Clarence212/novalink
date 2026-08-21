import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initialUsers, initialHomeowners, initialVehicles, initialReservations,
  initialDues, initialPayments, initialVisitorLogs, initialConcerns,
  initialAnnouncements, initialStickerRenewals, initialFacilities,
  initialEmailLog, paymentQRCode
} from '../data/mockData';
import { apiSendNotification } from '../services/api';

const AppContext = createContext();
const DB_STORAGE_KEY = 'novalink_clean_production_v3';


const PENALTY_PER_MONTH = 200;

const RESTRICT_AFTER_MONTHS = 2;



const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `nv_${Math.abs(hash).toString(36)}`;
};

const loadPersistedData = (key, fallback) => {
  try {
    const saved = localStorage.getItem(`${DB_STORAGE_KEY}_${key}`);
    if (!saved) return fallback;
    return JSON.parse(saved);
  } catch (e) {
    console.error(`Failed loading ${key} from storage:`, e);
    return fallback;
  }
};


const seedUsersWithPasswords = (users) => users.map(u => ({
  ...u,
  passwordHash: u.passwordHash || simpleHash('novalink2026')
}));

const loadUsers = () => {
  const persisted = loadPersistedData('users', initialUsers);
  const persistedIds = new Set(persisted.map(u => u.id));
  const missingInitial = initialUsers.filter(u => !persistedIds.has(u.id));
  const merged = [...persisted, ...missingInitial];
  return seedUsersWithPasswords(merged);
};

export const AppProvider = ({ children }) => {
  const [users, setUsers] = useState(loadUsers);
  const [homeowners, setHomeowners] = useState(() => loadPersistedData('homeowners', initialHomeowners));
  const [vehicles, setVehicles] = useState(() => loadPersistedData('vehicles', initialVehicles));
  const [reservations, setReservations] = useState(() => loadPersistedData('reservations', initialReservations));
  const [dues, setDues] = useState(() => loadPersistedData('dues', initialDues));
  const [payments, setPayments] = useState(() => loadPersistedData('payments', initialPayments));
  const [visitorLogs, setVisitorLogs] = useState(() => loadPersistedData('visitorLogs', initialVisitorLogs));
  const [concerns, setConcerns] = useState(() => loadPersistedData('concerns', initialConcerns));
  const [announcements, setAnnouncements] = useState(() => loadPersistedData('announcements', initialAnnouncements));
  const [stickerRenewals, setStickerRenewals] = useState(() => loadPersistedData('stickerRenewals', initialStickerRenewals));
  const [facilities] = useState(initialFacilities);
  const [emailLog, setEmailLog] = useState(() => loadPersistedData('emailLog', initialEmailLog));

  const [currentUser, setCurrentUser] = useState(() => loadPersistedData('currentUser', null));
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [toast, setToast] = useState(null);

  
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_users`, JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_homeowners`, JSON.stringify(homeowners)); }, [homeowners]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_vehicles`, JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_reservations`, JSON.stringify(reservations)); }, [reservations]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_dues`, JSON.stringify(dues)); }, [dues]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_payments`, JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_visitorLogs`, JSON.stringify(visitorLogs)); }, [visitorLogs]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_concerns`, JSON.stringify(concerns)); }, [concerns]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_announcements`, JSON.stringify(announcements)); }, [announcements]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_stickerRenewals`, JSON.stringify(stickerRenewals)); }, [stickerRenewals]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_emailLog`, JSON.stringify(emailLog)); }, [emailLog]);
  useEffect(() => { localStorage.setItem(`${DB_STORAGE_KEY}_currentUser`, JSON.stringify(currentUser)); }, [currentUser]);

  
  useEffect(() => {
    if (dues.length === 0 || homeowners.length === 0) return;
    setHomeowners(prev => prev.map(h => {
      const unpaidDues = dues.filter(d => d.homeownerId === h.id && d.status === 'unpaid');
      const unpaidMonths = unpaidDues.length;
      const shouldBeRestricted = unpaidMonths >= RESTRICT_AFTER_MONTHS;
      
      if (h.unpaidMonths !== unpaidMonths || h.restricted !== shouldBeRestricted) {
        return { ...h, unpaidMonths, restricted: shouldBeRestricted };
      }
      return h;
    }));
  
  
  }, [dues]);

  
  useEffect(() => {
    setDues(prev => prev.map(d => {
      if (d.status !== 'unpaid') return d;
      const due = new Date(d.dueDate);
      const today = new Date();
      const monthsOverdue = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24 * 30)));
      const penalty = monthsOverdue > 0 ? monthsOverdue * PENALTY_PER_MONTH : 0;
      if (d.penaltyAmount !== penalty) return { ...d, penaltyAmount: penalty };
      return d;
    }));
  
  
  }, []);

  const currentHomeowner = currentUser?.homeownerId
    ? homeowners.find(h => h.id === currentUser.homeownerId)
    : null;

  const isRestricted = currentHomeowner?.restricted || false;

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  
  const sendEmailNotification = (to, subject, body, name = 'Resident') => {
    const newEmail = {
      id: `e${Date.now()}`,
      to, subject, body,
      sentAt: new Date().toLocaleString('en-PH')
    };
    setEmailLog(prev => [newEmail, ...prev]);
    
    apiSendNotification(to, name, subject, body).catch(err =>
      console.warn('Live email dispatch failed:', err.message)
    );
  };

  
  const login = (email, password = '') => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: 'Invalid email address or credentials.' };
    if (user.status === 'pending') return { success: false, message: 'Account pending administrator approval.' };
    if (user.status === 'rejected') return { success: false, message: 'Account registration was not approved. Please contact NHAI office.' };
    if (user.status === 'inactive') return { success: false, message: 'Account is inactive. Please contact NHAI office.' };

    
    const inputHash = simpleHash(password);
    if (user.passwordHash && user.passwordHash !== inputHash) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    setCurrentUser(user);
    setIsGuestMode(false);
    return { success: true };
  };

  
  const updatePassword = (email, newPassword) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: 'No account found with that email.' };
    const newHash = simpleHash(newPassword);
    setUsers(prev => prev.map(u =>
      (u.email || '').trim().toLowerCase() === cleanEmail
        ? { ...u, passwordHash: newHash }
        : u
    ));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setIsGuestMode(false);
    localStorage.removeItem(`${DB_STORAGE_KEY}_currentUser`);
  };

  
  const createUserAccount = (userData) => {
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    
    let targetStatus = userData.status;
    if (!targetStatus) {
      targetStatus = userData.role === 'resident' ? 'pending' : 'active';
    }

    setUsers(prev => {
      const existsIndex = prev.findIndex(u => (u.email || '').trim().toLowerCase() === cleanEmail);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = {
          ...updated[existsIndex],
          fullName: userData.fullName || updated[existsIndex].fullName,
          status: targetStatus,
          passwordHash: userData.password ? simpleHash(userData.password) : updated[existsIndex].passwordHash,
          emailVerified: userData.emailVerified !== undefined ? userData.emailVerified : updated[existsIndex].emailVerified
        };
        return updated;
      }

      const newUser = {
        id: `u${Date.now()}`,
        fullName: userData.fullName,
        email: cleanEmail,
        role: userData.role || 'resident',
        status: targetStatus,
        emailVerified: userData.emailVerified || false,
        passwordHash: simpleHash(userData.password || 'novalink2026'),
        homeownerId: userData.role === 'resident' ? (userData.homeownerId || null) : null
      };

      return [newUser, ...prev];
    });

    if (targetStatus === 'pending') {
      sendEmailNotification(
        userData.email,
        `NovaLink Resident Account Registration Received`,
        `Hi ${userData.fullName}, your registration for a NovaLink resident account has been received and is pending NHAI Administrator approval. You will receive an email once your account is reviewed.`,
        userData.fullName
      );
    } else {
      sendEmailNotification(
        userData.email,
        `NovaLink ${userData.role ? userData.role.toUpperCase() : 'USER'} Account Created`,
        `Your new NovaLink account has been created by the NHAI Administrator. You can now log in using your registered email. Your password is: ${userData.password || 'novalink2026'}`,
        userData.fullName
      );
    }
  };

  const approveUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active', manuallyApproved: true } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(
      user.email,
      'Account Approved - NovaLink Portal',
      `Hi ${user.fullName}, your NovaLink resident account has been approved by the NHAI Administrator. You may now log in to access all resident features.`,
      user.fullName
    );
    showToast('Account approved successfully.', 'success');
  };

  const rejectUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'rejected' } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(
      user.email,
      'Account Registration Update - NovaLink Portal',
      `Hi ${user.fullName}, we regret to inform you that your NovaLink account registration has not been approved at this time. Please contact the NHAI office for further assistance.`,
      user.fullName
    );
    showToast('Account rejected.', 'warning');
  };

  const deactivateUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(
      user.email,
      'Account Deactivated - NovaLink Portal',
      `Hi ${user.fullName}, your NovaLink account has been deactivated by the NHAI Administrator. Please contact the office if you believe this is an error.`,
      user.fullName
    );
    showToast('Account deactivated.', 'warning');
  };

  const reactivateUser = (userId) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u));
    const user = users.find(u => u.id === userId);
    if (user) sendEmailNotification(
      user.email,
      'Account Reactivated - NovaLink Portal',
      `Hi ${user.fullName}, your NovaLink account has been reactivated. You may now log in again.`,
      user.fullName
    );
    showToast('Account reactivated.', 'success');
  };

  const editUser = (userId, updates) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    showToast('Account updated successfully.', 'success');
  };

  
  const addVisitorLog = (logData) => {
    const newLog = { id: `vl${Date.now()}`, ...logData, recordedBy: currentUser?.id, entryTime: new Date().toLocaleString('en-PH'), exitTime: null };
    setVisitorLogs(prev => [newLog, ...prev]);
    showToast('Visitor entry logged successfully.', 'success');
  };

  const updateVisitorExit = (logId) => {
    setVisitorLogs(prev => prev.map(l => l.id === logId ? { ...l, exitTime: new Date().toLocaleString('en-PH') } : l));
    showToast('Visitor exit recorded.', 'success');
  };

  
  const addAnnouncement = (data) => {
    const newAnn = { id: `a${Date.now()}`, ...data, postedBy: currentUser?.id, datePosted: new Date().toLocaleDateString('en-PH'), status: 'published' };
    setAnnouncements(prev => [newAnn, ...prev]);
    
    const residentUsers = users.filter(u => u.role === 'resident' && u.status === 'active');
    residentUsers.forEach(u => sendEmailNotification(
      u.email,
      `NHAI Announcement: ${data.title}`,
      `Priority: ${data.priority.toUpperCase()}\n\n${data.content}\n\nThis announcement was posted by Novaville Homeowners Association, Inc. Visit your NovaLink portal for more details.`,
      u.fullName
    ));
    showToast(`Announcement posted and emailed to ${residentUsers.length} residents.`, 'success');
  };

  
  const addReservation = (data) => {
    const newRes = { id: `r${Date.now()}`, ...data, status: 'pending', approvedBy: null, createdAt: new Date().toLocaleDateString('en-PH') };
    setReservations(prev => [newRes, ...prev]);
    showToast('Reservation request submitted.', 'success');
  };

  const updateReservationStatus = (resId, status) => {
    setReservations(prev => prev.map(r => r.id === resId ? { ...r, status, approvedBy: currentUser?.id } : r));
    const res = reservations.find(r => r.id === resId);
    if (res) {
      
      const homeowner = homeowners.find(h => h.id === res.homeownerId);
      const recipientEmail = homeowner?.email || res.requesterEmail;
      const recipientName = homeowner?.ownerName || res.requesterName || 'Resident';
      const facility = facilities.find(f => f.id === res.facilityId);
      if (recipientEmail) {
        sendEmailNotification(
          recipientEmail,
          `Facility Reservation ${status === 'approved' ? 'Approved' : 'Rejected'} - NovaLink`,
          `Hi ${recipientName}, your facility reservation request for ${facility?.name || 'the facility'} on ${res.date} (${res.timeSlot}) has been ${status} by the NHAI Administrator. ${status === 'rejected' ? 'Please contact the office for more information.' : 'Please proceed to the NHAI office for any additional requirements.'}`,
          recipientName
        );
      }
    }
    showToast(`Reservation ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  
  const validatePayment = (paymentId, coveredMonths) => {
    setPayments(prev => prev.map(p => p.id === paymentId
      ? { ...p, validationStatus: 'validated', validatedBy: currentUser?.id, validatedAt: new Date().toLocaleString('en-PH'), coveredMonths }
      : p
    ));
    setDues(prev => prev.map(d => coveredMonths.includes(d.billingMonth) ? { ...d, status: 'paid', penaltyAmount: 0 } : d));
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      const homeowner = homeowners.find(h => h.id === payment.homeownerId);
      if (homeowner) sendEmailNotification(
        homeowner.email,
        'Payment Validated - NovaLink Portal',
        `Hi ${homeowner.ownerName}, your payment of ₱${payment.amountPaid?.toLocaleString()} has been validated and applied to: ${coveredMonths.join(', ')}. Thank you for settling your dues on time.`,
        homeowner.ownerName
      );
    }
    showToast('Payment validated and dues updated.', 'success');
  };

  const rejectPayment = (paymentId) => {
    setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, validationStatus: 'rejected' } : p));
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      const homeowner = homeowners.find(h => h.id === payment.homeownerId);
      if (homeowner) sendEmailNotification(
        homeowner.email,
        'Payment Proof Rejected - NovaLink Portal',
        `Hi ${homeowner.ownerName}, your submitted proof of payment could not be validated. Please resubmit with a clear, legible screenshot of the payment receipt. Contact the NHAI office if you need assistance.`,
        homeowner.ownerName
      );
    }
    showToast('Payment proof rejected.', 'warning');
  };

  const submitPaymentProof = (homeownerId, data) => {
    const newPayment = {
      id: `p${Date.now()}`, homeownerId, submittedBy: currentUser?.id, validatedBy: null,
      amountPaid: data.amount, paymentDate: new Date().toLocaleDateString('en-PH'),
      proofImage: data.proofImage || null, paymentReference: data.reference,
      validationStatus: 'pending', validatedAt: null, coveredMonths: []
    };
    setPayments(prev => [newPayment, ...prev]);
    showToast('Proof of payment submitted for validation.', 'success');
  };

  
  const sendDuesReminder = (homeownerId = null) => {
    const targets = homeownerId
      ? homeowners.filter(h => h.id === homeownerId)
      : homeowners.filter(h => h.unpaidMonths > 0);

    let count = 0;
    targets.forEach(h => {
      const unpaid = dues.filter(d => d.homeownerId === h.id && d.status === 'unpaid');
      if (unpaid.length === 0 && !homeownerId) return;
      const totalOwed = unpaid.reduce((sum, d) => sum + d.amountDue + d.penaltyAmount, 0);
      const months = unpaid.map(d => d.billingMonth).join(', ');
      sendEmailNotification(
        h.email,
        'Monthly Dues Reminder - NovaLink Portal',
        `Hi ${h.ownerName}, this is a reminder that you have ${unpaid.length} unpaid month(s) of HOA dues. Unpaid months: ${months || 'N/A'}. Total balance: ₱${totalOwed.toLocaleString()}. Please settle your dues through the NovaLink portal to avoid additional penalties and service restrictions.`,
        h.ownerName
      );
      count++;
    });

    showToast(count > 0 ? `Dues reminders sent to ${count} homeowner(s).` : 'No outstanding dues found.', count > 0 ? 'success' : 'info');
  };

  
  const submitConcern = (data) => {
    const newConcern = {
      id: `c${Date.now()}`, homeownerId: currentHomeowner?.id, submittedBy: currentUser?.id,
      ...data, status: 'pending', adminResponse: null, respondedBy: null, respondedAt: null,
      submittedAt: new Date().toLocaleDateString('en-PH')
    };
    setConcerns(prev => [newConcern, ...prev]);
    showToast('Concern submitted successfully.', 'success');
  };

  const respondToConcern = (concernId, response, status) => {
    setConcerns(prev => prev.map(c => c.id === concernId
      ? { ...c, adminResponse: response, status, respondedBy: currentUser?.id, respondedAt: new Date().toLocaleString('en-PH') }
      : c
    ));
    const concern = concerns.find(c => c.id === concernId);
    if (concern) {
      const homeowner = homeowners.find(h => h.id === concern.homeownerId);
      if (homeowner) sendEmailNotification(
        homeowner.email,
        `Concern Update: ${concern.subject} - NovaLink Portal`,
        `Hi ${homeowner.ownerName}, the NHAI Administrator has responded to your concern.\n\nConcern: ${concern.subject}\nStatus: ${status.toUpperCase()}\n\nOfficial Response:\n${response}\n\nYou may view the full response in your NovaLink portal.`,
        homeowner.ownerName
      );
    }
    showToast('Response sent and emailed to resident.', 'success');
  };

  
  const submitVehicle = (data) => {
    const newVehicle = {
      id: `v${Date.now()}`, homeownerId: currentHomeowner?.id, submittedBy: currentUser?.id,
      reviewedBy: null, approvalStatus: 'pending', ...data
    };
    setVehicles(prev => [...prev, newVehicle]);
    showToast('Vehicle information submitted for review.', 'success');
  };

  const reviewVehicle = (vehicleId, status) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, approvalStatus: status, reviewedBy: currentUser?.id } : v));
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      const homeowner = homeowners.find(h => h.id === vehicle.homeownerId);
      if (homeowner) sendEmailNotification(
        homeowner.email,
        `Vehicle Information ${status === 'approved' ? 'Approved' : 'Rejected'} - NovaLink Portal`,
        `Hi ${homeowner.ownerName}, your vehicle (${vehicle.makeModel} - ${vehicle.plateNumber}) has been ${status} by the NHAI Administrator. ${status === 'rejected' ? 'Please resubmit with corrected information or contact the NHAI office.' : 'Your vehicle is now included in your homeowner master record.'}`,
        homeowner.ownerName
      );
    }
    showToast(`Vehicle information ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  
  const submitStickerRenewal = (vehicleId) => {
    const newRenewal = {
      id: `sr${Date.now()}`, vehicleId, homeownerId: currentHomeowner?.id,
      requestedBy: currentUser?.id, reviewedBy: null,
      renewalPeriod: '2026-2027', status: 'pending', stickerNumber: null,
      requestedAt: new Date().toLocaleDateString('en-PH'), approvedAt: null
    };
    setStickerRenewals(prev => [newRenewal, ...prev]);
    showToast('Sticker renewal request submitted.', 'success');
  };

  const reviewStickerRenewal = (renewalId, status) => {
    const stickerNum = status === 'approved' ? `NVL-2026-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}` : null;
    setStickerRenewals(prev => prev.map(r => r.id === renewalId
      ? { ...r, status, reviewedBy: currentUser?.id, stickerNumber: stickerNum, approvedAt: status === 'approved' ? new Date().toLocaleDateString('en-PH') : null }
      : r
    ));
    const renewal = stickerRenewals.find(r => r.id === renewalId);
    if (renewal) {
      const homeowner = homeowners.find(h => h.id === renewal.homeownerId);
      const vehicle = vehicles.find(v => v.id === renewal.vehicleId);
      if (homeowner) sendEmailNotification(
        homeowner.email,
        `HOA Sticker Renewal ${status === 'approved' ? 'Approved' : 'Rejected'} - NovaLink Portal`,
        status === 'approved'
          ? `Hi ${homeowner.ownerName}, your HOA vehicle sticker renewal for ${vehicle?.makeModel || 'your vehicle'} (${vehicle?.plateNumber || ''}) has been approved. Sticker Number: ${stickerNum}. Please claim your sticker at the NHAI office.`
          : `Hi ${homeowner.ownerName}, your HOA vehicle sticker renewal request has been rejected. Please contact the NHAI office for more information.`,
        homeowner.ownerName
      );
    }
    showToast(`Sticker renewal ${status}.`, status === 'approved' ? 'success' : 'warning');
  };

  
  const addHomeownerRecord = (data) => {
    const newRecord = { id: `h${Date.now()}`, ...data, unpaidMonths: 0, restricted: false, occupants: [] };
    setHomeowners(prev => [...prev, newRecord]);
    showToast('Homeowner record created.', 'success');
  };

  const updateHomeownerRecord = (homeownerId, data) => {
    setHomeowners(prev => prev.map(h => h.id === homeownerId ? { ...h, ...data } : h));
    showToast('Homeowner record updated.', 'success');
  };

  return (
    <AppContext.Provider value={{
      users, homeowners, vehicles, reservations, dues, payments,
      visitorLogs, concerns, announcements, stickerRenewals, facilities, emailLog,
      currentUser, currentHomeowner, isGuestMode, setIsGuestMode, toast, isRestricted,
      paymentQRCode,
      showToast, sendEmailNotification,
      login, logout, updatePassword,
      createUserAccount, approveUser, rejectUser, deactivateUser, reactivateUser, editUser,
      addVisitorLog, updateVisitorExit,
      addAnnouncement,
      addReservation, updateReservationStatus,
      validatePayment, rejectPayment, submitPaymentProof, sendDuesReminder,
      submitConcern, respondToConcern,
      submitVehicle, reviewVehicle,
      submitStickerRenewal, reviewStickerRenewal,
      addHomeownerRecord, updateHomeownerRecord,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
