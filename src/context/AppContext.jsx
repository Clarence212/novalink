import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  apiAction,
  apiChangePassword,
  apiFetchPublicFacilities,
  apiFetchState,
  apiLogin,
  apiLogout,
  apiRegister,
  apiResetPassword,
  apiSession,
  apiUploadPayment,
  apiUploadPaymentQr,
} from '../services/api';

const AppContext = createContext(null);

const EMPTY_STATE = {
  users: [],
  homeowners: [],
  vehicles: [],
  reservations: [],
  dues: [],
  payments: [],
  visitorLogs: [],
  visitorPasses: [],
  visitorPassesReady: false,
  concerns: [],
  announcements: [],
  stickerRenewals: [],
  facilities: [],
  emailLog: [],
  paymentQRCode: {
    provider: 'GCash',
    gcashName: 'Not configured',
    gcashNumber: '',
    imagePath: null,
  },
  duesSettings: {
    monthlyDueAmount: 1500,
    monthlyDueDay: 15,
    monthlyPenaltyAmount: 200,
    restrictAfterUnpaidMonths: 2,
  },
  stickerRenewalPeriod: '',
};

export const AppProvider = ({ children }) => {
  const [data, setData] = useState(EMPTY_STATE);
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuestMode, setGuestMode] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const applyState = useCallback((nextState) => {
    setData({ ...EMPTY_STATE, ...(nextState || {}) });
    setLastUpdatedAt(new Date());
  }, []);

  const refreshState = useCallback(async (silent = false) => {
    if (!currentUser) return null;
    if (!silent) setIsRefreshing(true);
    try {
      const nextState = await apiFetchState();
      applyState(nextState);
      return nextState;
    } catch (error) {
      if (error.status === 401) {
        setCurrentUser(null);
        applyState(EMPTY_STATE);
      }
      if (!silent) showToast(error.message || 'Could not refresh system data.', 'warning');
      return null;
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [applyState, currentUser, showToast]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const session = await apiSession();
        if (!active) return;
        setCurrentUser(session.user || null);
        if (session.user && !session.user.forcePasswordChange) {
          applyState(await apiFetchState());
        } else {
          const facilities = await apiFetchPublicFacilities();
          applyState({ ...EMPTY_STATE, facilities });
        }
      } catch (error) {
        if (active) showToast(error.message || 'NovaLink could not connect to the server.', 'warning');
      } finally {
        if (active) setIsBootstrapping(false);
      }
    };
    initialize();
    return () => {
      active = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [applyState, showToast]);

  const setIsGuestMode = useCallback(async (enabled) => {
    setGuestMode(Boolean(enabled));
    if (enabled && !currentUser) {
      try {
        const facilities = await apiFetchPublicFacilities();
        setData((previous) => ({ ...previous, facilities }));
      } catch (error) {
        showToast(error.message || 'Guest facilities could not be loaded.', 'warning');
      }
    }
  }, [currentUser, showToast]);

  const login = useCallback(async (email, password, rememberMe = false) => {
    try {
      const result = await apiLogin(email, password, rememberMe);
      setCurrentUser(result.user);
      setGuestMode(false);
      if (result.user.forcePasswordChange) {
        applyState(EMPTY_STATE);
      } else {
        applyState(await apiFetchState());
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Sign-in failed.',
        code: error.payload?.code || '',
      };
    }
  }, [applyState]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (error) {
      showToast(error.message || 'The server could not complete logout.', 'warning');
    } finally {
      setCurrentUser(null);
      setGuestMode(false);
      try {
        const facilities = await apiFetchPublicFacilities();
        applyState({ ...EMPTY_STATE, facilities });
      } catch {
        applyState(EMPTY_STATE);
      }
    }
  }, [applyState, showToast]);

  const runAction = useCallback(async (resource, action, payload, successMessage, refresh = true) => {
    try {
      const result = await apiAction(resource, action, payload);
      if (refresh && currentUser) {
        applyState(await apiFetchState());
      }
      if (successMessage) showToast(successMessage, 'success');
      if (result.emailDelivered === false) {
        showToast(`${successMessage || 'The change was saved'}, but its email notification could not be delivered.`, 'warning');
      }
      return { success: true, ...result };
    } catch (error) {
      showToast(error.message || 'The requested change could not be saved.', 'warning');
      return { success: false, message: error.message };
    }
  }, [applyState, currentUser, showToast]);

  const createUserAccount = useCallback(async (userData, verificationToken = '') => {
    if (!currentUser) {
      try {
        await apiRegister(userData, verificationToken);
        return { success: true };
      } catch (error) {
        return { success: false, message: error.message || 'Registration failed.' };
      }
    }
    return runAction('users', 'create', userData, 'User account created.');
  }, [currentUser, runAction]);

  const updatePassword = useCallback(async (email, newPassword, verificationToken = '') => {
    try {
      await apiResetPassword(email, newPassword, verificationToken);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Password reset failed.' };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const result = await apiChangePassword(currentPassword, newPassword);
      setCurrentUser(result.user);
      applyState(await apiFetchState());
      showToast('Password changed successfully.', 'success');
      return { success: true };
    } catch (error) {
      showToast(error.message || 'Password could not be changed.', 'warning');
      return { success: false, message: error.message };
    }
  }, [applyState, showToast]);

  const approveUser = (id) => runAction('users', 'status', { id, status: 'active' }, 'Account approved.');
  const rejectUser = (id, reason) => runAction('users', 'status', { id, status: 'rejected', reason }, 'Account rejected.');
  const deactivateUser = (id, reason) => runAction('users', 'status', { id, status: 'inactive', reason }, 'Account deactivated.');
  const reactivateUser = (id) => runAction('users', 'status', { id, status: 'active' }, 'Account reactivated.');
  const editUser = (id, updates) => runAction('users', 'update', { id, ...updates }, 'User account updated.');
  const unlockUser = (id) => runAction('users', 'unlock', { id }, 'Account lock and failed sign-in counter cleared.');
  const forceUserPasswordReset = (id) => runAction(
    'users',
    'force-password-reset',
    { id },
    'The account must change its password at the next sign-in.',
  );
  const resendUserVerification = (id) => runAction(
    'users',
    'resend-verification',
    { id },
    'A new account-verification code was emailed.',
  );

  const addVisitorLog = (payload) => runAction('visitors', 'create', payload, 'Visitor entry saved.');
  const updateVisitorExit = (id) => runAction('visitors', 'exit', { id }, 'Visitor exit recorded.');
  const createVisitorPass = (payload) => runAction('visitor-passes', 'create', payload, 'Visitor pass created.');
  const cancelVisitorPass = (id) => runAction('visitor-passes', 'cancel', { id }, 'Visitor pass cancelled.');
  const lookupVisitorPass = (passCode) => runAction('visitor-passes', 'lookup', { passCode }, null, false);
  const admitVisitorPass = (passCode) => runAction('visitor-passes', 'redeem', { passCode }, 'Visitor admitted and entry recorded.');
  const addAnnouncement = (payload) => runAction('announcements', 'create', payload, 'Announcement published.');
  const addReservation = (payload) => runAction('reservations', 'create', payload, 'Reservation request submitted.', Boolean(currentUser));
  const updateReservationStatus = (id, status) => runAction('reservations', 'status', { id, status }, `Reservation ${status}.`);
  const validatePayment = (id) => runAction('payments', 'validate', { id }, 'Payment validated.');
  const rejectPayment = (id, reason) => runAction('payments', 'reject', { id, reason }, 'Payment proof rejected.');
  const reconcilePaymentCredits = () => runAction(
    'payments',
    'reconcile-credits',
    {},
    'Available homeowner credits were applied to outstanding dues.',
  );
  const sendDuesReminder = (homeownerId = null) => runAction('payments', 'remind', { homeownerId }, 'Dues reminders processed.');
  const generateDues = (payload) => runAction('dues', 'generate', payload, 'Monthly dues generated.');
  const configureDues = (payload) => runAction('dues', 'configure', payload, 'Automatic dues settings updated.');
  const submitConcern = (payload) => runAction('concerns', 'create', payload, 'Concern submitted.');
  const respondToConcern = (id, response, status) => runAction('concerns', 'respond', { id, response, status }, 'Concern response saved.');
  const submitVehicle = (payload) => runAction('vehicles', 'create', payload, 'Vehicle information submitted.');
  const reviewVehicle = (id, status) => runAction('vehicles', 'review', { id, status }, `Vehicle ${status}.`);
  const submitStickerRenewal = (vehicleId) => runAction('stickers', 'create', { vehicleId }, 'Sticker renewal submitted.');
  const reviewStickerRenewal = (id, status) => runAction('stickers', 'review', { id, status }, `Sticker renewal ${status}.`);
  const setStickerRenewalPeriod = (period) => runAction('stickers', 'set-period', { period }, 'Sticker renewal period updated.');
  const addHomeownerRecord = (payload) => runAction('homeowners', 'create', payload, 'Homeowner record created.');
  const updateHomeownerRecord = (id, payload) => runAction('homeowners', 'update', { id, ...payload }, 'Homeowner record updated.');
  const saveFacility = (payload) => runAction('facilities', 'save', payload, 'Facility settings saved.');

  const submitPaymentProof = useCallback(async (_homeownerId, payload) => {
    try {
      if (!(payload.proofFile instanceof File)) {
        throw new Error('Select a payment-proof image.');
      }
      const result = await apiUploadPayment({
        amount: payload.amount,
        reference: payload.reference,
        proof: payload.proofFile,
        paymentId: payload.paymentId || null,
      });
      applyState(await apiFetchState());
      showToast(payload.paymentId ? 'Payment proof resubmitted for validation.' : 'Payment proof submitted for validation.', 'success');
      return { success: true, ...result };
    } catch (error) {
      showToast(error.message || 'Payment proof could not be submitted.', 'warning');
      return { success: false, message: error.message };
    }
  }, [applyState, showToast]);

  const updatePaymentQr = useCallback(async (payload) => {
    try {
      await apiUploadPaymentQr(payload);
      applyState(await apiFetchState());
      showToast('Payment QR settings updated.', 'success');
      return { success: true };
    } catch (error) {
      showToast(error.message || 'Payment QR settings could not be updated.', 'warning');
      return { success: false, message: error.message };
    }
  }, [applyState, showToast]);

  const currentHomeowner = useMemo(
    () => data.homeowners.find((homeowner) => homeowner.id === currentUser?.homeownerId) || null,
    [currentUser?.homeownerId, data.homeowners],
  );
  const isRestricted = Boolean(currentHomeowner?.restricted);

  const value = {
    ...data,
    currentUser,
    currentHomeowner,
    isGuestMode,
    setIsGuestMode,
    isBootstrapping,
    isRefreshing,
    lastUpdatedAt,
    toast,
    isRestricted,
    showToast,
    refreshState,
    login,
    logout,
    updatePassword,
    changePassword,
    createUserAccount,
    approveUser,
    rejectUser,
    deactivateUser,
    reactivateUser,
    editUser,
    unlockUser,
    forceUserPasswordReset,
    resendUserVerification,
    addVisitorLog,
    updateVisitorExit,
    createVisitorPass,
    cancelVisitorPass,
    lookupVisitorPass,
    admitVisitorPass,
    addAnnouncement,
    addReservation,
    updateReservationStatus,
    validatePayment,
    rejectPayment,
    reconcilePaymentCredits,
    submitPaymentProof,
    sendDuesReminder,
    generateDues,
    configureDues,
    updatePaymentQr,
    submitConcern,
    respondToConcern,
    submitVehicle,
    reviewVehicle,
    submitStickerRenewal,
    reviewStickerRenewal,
    setStickerRenewalPeriod,
    addHomeownerRecord,
    updateHomeownerRecord,
    saveFacility,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider.');
  return context;
};
