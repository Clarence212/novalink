import React from 'react';

export const SiteFooter = () => {
  const year = new Date().getFullYear();
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

  const openCookiePreferences = () => {
    window.dispatchEvent(new CustomEvent('novalink:open-cookie-preferences'));
  };

  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)] sm:px-8 lg:px-12">
        <div>
          <div className="flex items-center gap-3">
            <img src="/NHAI_Insignia.png" alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-white">NovaLink Portal</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-400">Public Beta</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5">Novaville Homeowners' Association, Inc.</p>
          <p className="text-xs leading-5 text-slate-500">© {year} All Rights Reserved.</p>
        </div>

        <nav className="border-slate-800 sm:border-l sm:pl-8" aria-label="Legal and privacy links">
          <p className="text-sm font-bold text-white">Links</p>
          <div className="mt-3 flex flex-col items-start gap-2 text-xs">
            <button type="button" onClick={openCookiePreferences} className="transition hover:text-blue-400">Cookie Notice</button>
            <a href="/terms-and-conditions" aria-current={currentPath === '/terms-and-conditions' ? 'page' : undefined} className="transition hover:text-blue-400 aria-[current=page]:font-semibold aria-[current=page]:text-blue-400">Terms and Conditions</a>
            <a href="/privacy-policy" aria-current={currentPath === '/privacy-policy' ? 'page' : undefined} className="transition hover:text-blue-400 aria-[current=page]:font-semibold aria-[current=page]:text-blue-400">Privacy Policy</a>
          </div>
        </nav>
      </div>
    </footer>
  );
};
