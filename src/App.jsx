import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginView } from './views/LoginView';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { EmailLogModal } from './components/EmailLogModal';


import { AdminDashboard } from './views/AdminDashboard';
import { ResidentDashboard } from './views/ResidentDashboard';
import { GuardDashboard } from './views/GuardDashboard';
import { HomeownersRecords } from './views/HomeownersRecords';
import { UserManagement } from './views/UserManagement';
import { AccountReconciliation } from './views/AccountReconciliation';
import { VisitorManagement } from './views/VisitorManagement';
import { AnnouncementsView } from './views/AnnouncementsView';
import { FacilityReservations } from './views/FacilityReservations';
import { DuesManagement } from './views/DuesManagement';
import { DuesSummaryCharts } from './views/DuesSummaryCharts';
import { ReportingDashboard } from './views/ReportingDashboard';
import { ResidentConcerns } from './views/ResidentConcerns';
import { VehicleManagement } from './views/VehicleManagement';
import { StickerRenewals } from './views/StickerRenewals';
import { GuestModeView } from './views/GuestModeView';
import { LoadingPanel } from './components/ui/Primitives';
import { CookieConsent } from './components/CookieConsent';

const AppContent = () => {
  const { currentUser, isGuestMode, setIsGuestMode, isBootstrapping, logout, changePassword } = useApp();
  const [activeView, setActiveView] = useState('dashboard');
  const [showEmailLog, setShowEmailLog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });

  
  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <LoadingPanel label="Connecting securely to NovaLink…" />
      </div>
    );
  }

  if (!currentUser && !isGuestMode) {
    return (
      <>
        <Toast />
        <LoginView
          onLoginSuccess={() => setActiveView('dashboard')}
          onGuestMode={() => { setIsGuestMode(true); setActiveView('guest'); }}
        />
      </>
    );
  }

  if (currentUser?.forcePasswordChange) {
    const handleRequiredPasswordChange = async (event) => {
      event.preventDefault();
      if (passwordForm.next !== passwordForm.confirm) return;
      const result = await changePassword(passwordForm.current, passwordForm.next);
      if (result.success) setPasswordForm({ current: '', next: '', confirm: '' });
    };
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <Toast />
        <form onSubmit={handleRequiredPasswordChange} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-7 space-y-4 shadow-2xl">
          <div>
            <h1 className="text-xl font-bold">Set your private password</h1>
            <p className="text-xs text-slate-400 mt-1">Your administrator-issued password is temporary. Change it before continuing.</p>
          </div>
          <input type="password" required autoComplete="current-password" placeholder="Current password" value={passwordForm.current}
            onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="New password (12+ characters)" value={passwordForm.next}
            onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="Confirm new password" value={passwordForm.confirm}
            onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
            className={`w-full px-4 py-3 rounded-xl bg-slate-800 border text-sm focus:outline-none ${passwordForm.confirm && passwordForm.confirm !== passwordForm.next ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'}`} />
          {passwordForm.confirm && passwordForm.confirm !== passwordForm.next && <p className="text-xs text-red-400">Passwords do not match.</p>}
          <button type="submit" disabled={passwordForm.next !== passwordForm.confirm}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-bold transition">
            Change Password & Continue
          </button>
        </form>
      </div>
    );
  }

  
  const allowedViews = {
    admin: new Set(['dashboard', 'homeowners', 'user-management', 'account-reconciliation', 'visitor-management', 'announcements', 'reservations', 'dues', 'dues-charts', 'reports', 'concerns', 'vehicles', 'stickers', 'email-log']),
    security: new Set(['dashboard', 'visitor-management', 'announcements']),
    resident: new Set(['dashboard', 'announcements', 'visitor-management', 'reservations', 'dues', 'concerns', 'vehicles', 'stickers']),
  };

  const handleSetView = (view) => {
    if (view === 'email-log' && currentUser?.role === 'admin') {
      setShowEmailLog(true);
      setSidebarOpen(false);
      return;
    }
    if (allowedViews[currentUser?.role]?.has(view)) {
      setActiveView(view);
      setSidebarOpen(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setActiveView('dashboard');
    setSidebarOpen(false);
  };

  
  const renderView = () => {
    if (isGuestMode) return <GuestModeView />;

    const role = currentUser?.role;
    if (!allowedViews[role]?.has(activeView)) {
      return role === 'admin'
        ? <AdminDashboard setActiveView={handleSetView} />
        : role === 'security'
          ? <GuardDashboard setActiveView={handleSetView} />
          : <ResidentDashboard setActiveView={handleSetView} />;
    }

    
    if (activeView === 'dashboard') {
      if (role === 'admin') return <AdminDashboard setActiveView={handleSetView} />;
      if (role === 'security') return <GuardDashboard setActiveView={handleSetView} />;
      return <ResidentDashboard setActiveView={handleSetView} />;
    }

    const viewMap = {
      'homeowners': <HomeownersRecords />,
      'user-management': <UserManagement />,
      'account-reconciliation': <AccountReconciliation onOpenHomeowners={() => handleSetView('homeowners')} />,
      'visitor-management': <VisitorManagement />,
      'announcements': <AnnouncementsView />,
      'reservations': <FacilityReservations />,
      'dues': <DuesManagement />,
      'dues-charts': <DuesSummaryCharts />,
      'reports': <ReportingDashboard setActiveView={handleSetView} />,
      'concerns': <ResidentConcerns />,
      'vehicles': <VehicleManagement />,
      'stickers': <StickerRenewals />,
      'email-log': null, 
    };

    return viewMap[activeView] || (role === 'admin' ? <AdminDashboard setActiveView={handleSetView} /> : <ResidentDashboard setActiveView={handleSetView} />);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Toast />
      {showEmailLog && <EmailLogModal onClose={() => setShowEmailLog(false)} />}

      <Navbar
        onSignOut={handleSignOut}
        onOpenEmailLog={() => setShowEmailLog(true)}
        toggleSidebar={() => setSidebarOpen(open => !open)}
      />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 53px)' }}>
        {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden" />}
        <Sidebar activeView={activeView} setActiveView={handleSetView} isOpen={sidebarOpen} />
        <main id="main-content" tabIndex="-1" className="flex-1 overflow-y-auto bg-slate-950 focus:outline-none">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <CookieConsent />
    </AppProvider>
  );
}
