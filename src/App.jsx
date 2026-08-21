// hey reader! main App routing coordinator — handles auth state and view switching
import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginView } from './views/LoginView';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { EmailLogModal } from './components/EmailLogModal';

// view imports
import { AdminDashboard } from './views/AdminDashboard';
import { ResidentDashboard } from './views/ResidentDashboard';
import { GuardDashboard } from './views/GuardDashboard';
import { HomeownersRecords } from './views/HomeownersRecords';
import { UserManagement } from './views/UserManagement';
import { VisitorManagement } from './views/VisitorManagement';
import { AnnouncementsView } from './views/AnnouncementsView';
import { FacilityReservations } from './views/FacilityReservations';
import { DuesManagement } from './views/DuesManagement';
import { DuesSummaryCharts } from './views/DuesSummaryCharts';
import { ResidentConcerns } from './views/ResidentConcerns';
import { VehicleManagement } from './views/VehicleManagement';
import { StickerRenewals } from './views/StickerRenewals';
import { GuestModeView } from './views/GuestModeView';

const AppContent = () => {
  const { currentUser, isGuestMode, setIsGuestMode, login, logout, showToast } = useApp();
  const [activeView, setActiveView] = useState('dashboard');
  const [showEmailLog, setShowEmailLog] = useState(false);

  // not logged in → initial page is directly login page
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

  // determine default view based on role
  const handleSetView = (view) => setActiveView(view);

  const handleSignOut = () => {
    logout();
    setActiveView('dashboard');
  };

  // render the right view component
  const renderView = () => {
    if (isGuestMode) return <GuestModeView />;

    const role = currentUser?.role;

    // role-specific dashboard
    if (activeView === 'dashboard') {
      if (role === 'admin') return <AdminDashboard setActiveView={handleSetView} />;
      if (role === 'security') return <GuardDashboard />;
      return <ResidentDashboard setActiveView={handleSetView} />;
    }

    const viewMap = {
      'homeowners': <HomeownersRecords />,
      'user-management': <UserManagement />,
      'visitor-management': <VisitorManagement />,
      'announcements': <AnnouncementsView />,
      'reservations': <FacilityReservations />,
      'dues': <DuesManagement />,
      'dues-charts': <DuesSummaryCharts />,
      'concerns': <ResidentConcerns />,
      'vehicles': <VehicleManagement />,
      'stickers': <StickerRenewals />,
      'email-log': null, // handled via modal
    };

    return viewMap[activeView] || (role === 'admin' ? <AdminDashboard setActiveView={handleSetView} /> : <ResidentDashboard setActiveView={handleSetView} />);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
      <Toast />
      {showEmailLog && <EmailLogModal onClose={() => setShowEmailLog(false)} />}

      <Navbar
        onSignOut={handleSignOut}
        onOpenEmailLog={() => setShowEmailLog(true)}
      />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 53px)' }}>
        <Sidebar activeView={activeView} setActiveView={handleSetView} />
        <main className="flex-1 overflow-y-auto bg-slate-950">
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
    </AppProvider>
  );
}
