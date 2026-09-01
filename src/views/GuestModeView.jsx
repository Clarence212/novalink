import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, CheckCircle } from 'lucide-react';
import { apiSendOtp, apiVerifyOtp } from '../services/api';
import { SiteFooter } from '../components/SiteFooter';

export const GuestModeView = () => {
  const { facilities, addReservation, showToast, setIsGuestMode } = useApp();

  const [step, setStep] = useState(1); 
  const [guestInfo, setGuestInfo] = useState({ fullName: '', email: '', contactNumber: '' });
  const [otp, setOtp] = useState('');
  const [form, setForm] = useState({ facilityId: 'f1', date: '', timeSlot: '', purpose: '' });
  const [submitted, setSubmitted] = useState(false);

  const guestFacilities = facilities.filter(f => f.isActive && f.guestBookable);
  const timeSlots = ['8:00 AM - 12:00 PM', '12:00 PM - 4:00 PM', '4:00 PM - 8:00 PM', '9:00 AM - 1:00 PM', '1:00 PM - 5:00 PM'];

  useEffect(() => {
    if (guestFacilities.length > 0 && !guestFacilities.some(facility => facility.id === form.facilityId)) {
      setForm(previous => ({ ...previous, facilityId: guestFacilities[0].id }));
    }
  }, [facilities, form.facilityId]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      await apiSendOtp(
        guestInfo.email,
        guestInfo.fullName || 'Guest',
        'guest',
        guestInfo.contactNumber,
      );
      showToast('Verification code sent to your email address.', 'info');
      setStep(2);
    } catch (error) {
      showToast(error.message || 'Verification code could not be sent.', 'warning');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      await apiVerifyOtp(guestInfo.email, otp, 'guest');
      setStep(3);
    } catch (error) {
      showToast(error.message || 'Invalid verification code.', 'warning');
    }
  };

  const handleSubmitReservation = async (e) => {
    e.preventDefault();
    const result = await addReservation({
      facilityId: form.facilityId,
      date: form.date,
      timeSlot: form.timeSlot,
      purpose: form.purpose,
    });
    if (result.success) setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
        {}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-2xl shadow-lg mx-auto mb-3">N</div>
          <h1 className="text-xl font-bold text-slate-100">Guest Mode</h1>
          <p className="text-xs text-slate-500 mt-1">Facility Reservation for Visitors</p>
          <button onClick={() => setIsGuestMode(false)} className="text-xs text-slate-500 hover:text-slate-300 underline mt-1 transition">Back to login</button>
        </div>

        {}
        {submitted && (
          <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-3xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-base font-bold text-emerald-300">Reservation Submitted!</h2>
            <p className="text-xs text-slate-400 mt-2">Your request is pending NHAI administrator approval. A confirmation has been sent to <strong className="text-slate-300">{guestInfo.email}</strong>.</p>
            <button onClick={() => { setSubmitted(false); setStep(1); setGuestInfo({ fullName: '', email: '', contactNumber: '' }); }}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
              Submit Another Request
            </button>
          </div>
        )}

        {}
        {!submitted && step === 1 && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Your Contact Information</h2>
            <p className="text-xs text-slate-500 mb-4">Required for email verification before booking</p>
            <form onSubmit={handleSendOtp} className="space-y-3">
              {[
                { key: 'fullName', label: 'Full Name', placeholder: 'Your full name', type: 'text' },
                { key: 'email', label: 'Email Address', placeholder: 'your.email@example.com', type: 'email' },
                { key: 'contactNumber', label: 'Contact Number', placeholder: '09XXXXXXXXX', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
                  <input type={f.type} required value={guestInfo[f.key]} onChange={e => setGuestInfo({ ...guestInfo, [f.key]: e.target.value })}
                    placeholder={f.placeholder} className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition mt-1">
                Send Email Verification Code
              </button>
            </form>
          </div>
        )}

        {}
        {!submitted && step === 2 && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Email Verification</h2>
            <div className="p-3 rounded-xl bg-blue-950/50 border border-blue-800/50 text-xs text-blue-300 mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0 text-blue-400" />
              <span>Verification code sent to <strong>{guestInfo.email}</strong>. Please check your inbox.</span>
            </div>
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <input type="text" required inputMode="numeric" pattern="\d{6}" minLength={6} maxLength={6} value={otp} onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit code" className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-center font-bold text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">Verify & Continue</button>
              <button type="button" onClick={() => setStep(1)} className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition">Back</button>
            </form>
          </div>
        )}

        {}
        {!submitted && step === 3 && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <h2 className="text-sm font-bold text-slate-200 mb-1">Reserve a Facility</h2>
            <p className="text-xs text-slate-500 mb-4">Select from guest-bookable community facilities</p>
            <form onSubmit={handleSubmitReservation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Facility</label>
                <select required value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                  {guestFacilities.map(f => <option key={f.id} value={f.id}>{f.name} · {f.rate}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date</label>
                <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Time Slot</label>
                <select value={form.timeSlot} onChange={e => setForm({ ...form, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">Select time slot</option>
                  {timeSlots.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Purpose</label>
                <input type="text" required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g. Company Outing, Event" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition mt-1">Submit Reservation Request</button>
            </form>
          </div>
        )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
};
