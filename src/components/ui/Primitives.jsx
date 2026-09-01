import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Inbox, LoaderCircle, X } from 'lucide-react';

export const buttonStyles = {
  primary: 'ui-button bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-400',
  secondary: 'ui-button border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700 focus-visible:ring-slate-500',
  danger: 'ui-button bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400',
  warning: 'ui-button bg-amber-600 text-white hover:bg-amber-500 focus-visible:ring-amber-400',
  ghost: 'ui-button text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:ring-slate-500',
};

export const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <button className={`${buttonStyles[variant] || buttonStyles.primary} ${className}`} {...props}>{children}</button>
);

export const PageHeader = ({ eyebrow, title, description, actions, children }) => (
  <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-400">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export const StatCard = ({ label, value, detail, icon: Icon, tone = 'blue', onClick }) => {
  const content = (
    <>
      <div className="min-w-0">
        <p className="ui-eyebrow">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-100">{value}</p>
        {detail && <p className="mt-1 text-xs leading-4 text-slate-400">{detail}</p>}
      </div>
      {Icon && <span className={`ui-icon-tile ui-icon-${tone}`}><Icon className="h-5 w-5" /></span>}
    </>
  );
  const classes = 'ui-surface flex min-h-32 items-start justify-between gap-4 p-5 text-left';
  return onClick
    ? <button type="button" onClick={onClick} className={`${classes} ui-interactive w-full`}>{content}</button>
    : <div className={classes}>{content}</div>;
};

export const EmptyState = ({ icon: Icon = Inbox, title, description, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-400"><Icon className="h-5 w-5" /></span>
    <p className="text-sm font-bold text-slate-200">{title}</p>
    {description && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const LoadingPanel = ({ label = 'Loading current information…' }) => (
  <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-400" role="status" aria-live="polite">
    <LoaderCircle className="h-7 w-7 animate-spin text-blue-400" />
    <p className="mt-3 text-sm font-medium">{label}</p>
  </div>
);

export const HelpText = ({ children }) => <p className="mt-1.5 text-xs leading-4 text-slate-500">{children}</p>;

export const FieldError = ({ children }) => children ? <p className="mt-1.5 text-xs font-medium text-red-300" role="alert">{children}</p> : null;

export const ConfirmDialog = ({ open, title, description, impact, confirmLabel = 'Confirm', tone = 'danger', busy = false, requireReason = false, reason = '', onReasonChange, onConfirm, onCancel }) => {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]') || [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;
  const blocked = busy || (requireReason && reason.trim().length < 3);
  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel?.()}>
      <section ref={dialogRef} className="ui-modal max-w-lg" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone === 'danger' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}><AlertTriangle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-slate-100">{title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Close confirmation"><X className="h-5 w-5" /></button>
        </div>
        {impact && <div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-xs leading-5 text-amber-200"><strong>Impact:</strong> {impact}</div>}
        {requireReason && <label className="mt-4 block text-xs font-bold text-slate-300">Reason <span className="text-red-400">*</span><textarea autoFocus rows="3" maxLength="500" value={reason} onChange={(event) => onReasonChange?.(event.target.value)} className="ui-input mt-2 resize-none" placeholder="Explain why this action is necessary." /><HelpText>This reason is recorded for administrators and audit review.</HelpText></label>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" variant={tone === 'danger' ? 'danger' : 'warning'} onClick={onConfirm} disabled={blocked}>{busy ? 'Working…' : confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
};
