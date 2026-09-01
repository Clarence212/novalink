import React, { useEffect, useState } from 'react';

const CONSENT_COOKIE = 'novalink_cookie_consent';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const readConsent = () => document.cookie
  .split('; ')
  .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
  ?.split('=')[1] || '';

const saveConsent = (value) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
};

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());

    const openPreferences = () => {
      setShowDetails(true);
      setVisible(true);
    };

    window.addEventListener('novalink:open-cookie-preferences', openPreferences);
    return () => window.removeEventListener('novalink:open-cookie-preferences', openPreferences);
  }, []);

  const choose = (preference) => {
    saveConsent(preference);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      className="fixed bottom-4 right-4 z-[60] w-[calc(100%-2rem)] max-w-sm rounded-lg border border-slate-200 bg-white p-4 text-slate-700 shadow-2xl shadow-slate-950/20 sm:bottom-5 sm:right-5"
      role="region"
      aria-label="Cookie preferences"
    >
      <h2 className="text-sm font-bold text-slate-900">Cookie preferences</h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        NovaLink uses cookies for secure sign-in and to remember your preferences.{' '}
        <button
          type="button"
          className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
          onClick={() => setShowDetails((current) => !current)}
          aria-expanded={showDetails}
          aria-controls="cookie-consent-details"
        >
          More info
        </button>
      </p>

      {showDetails && (
        <div id="cookie-consent-details" className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <p>Secure session cookies are necessary and cannot be disabled while using the portal.</p>
          <p className="mt-1">NovaLink currently does not use advertising or analytics cookies. Your selection is remembered for up to one year.</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose('necessary')}
          className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Disallow optional
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="min-h-10 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Allow cookies
        </button>
      </div>
    </section>
  );
};
