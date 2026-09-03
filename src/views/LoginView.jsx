import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiSendOtp, apiVerifyOtp } from '../services/api';
import { SiteFooter } from '../components/SiteFooter';

const EMPTY_REGISTRATION = {
  fullName: '',
  email: '',
  requestedAddress: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
};

export const LoginView = ({ onLoginSuccess, onGuestMode }) => {
  const { login, setIsGuestMode, showToast, createUserAccount, updatePassword } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [regData, setRegData] = useState(EMPTY_REGISTRATION);
  const [regStep, setRegStep] = useState(1);
  const [regOtp, setRegOtp] = useState('');
  const [regVerificationToken, setRegVerificationToken] = useState('');
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');
  const [regResendSeconds, setRegResendSeconds] = useState(0);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetVerificationToken, setResetVerificationToken] = useState('');
  const [accountVerificationEmail, setAccountVerificationEmail] = useState('');
  const [accountVerificationOtp, setAccountVerificationOtp] = useState('');

  useEffect(() => {
    if (regResendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setRegResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [regResendSeconds]);

  const passwordChecks = {
    length: regData.password.length >= 12,
    letter: /[A-Za-z]/.test(regData.password),
    number: /\d/.test(regData.password),
    matches: Boolean(regData.confirmPassword) && regData.password === regData.confirmPassword,
  };

  const resetRegistration = () => {
    setRegData(EMPTY_REGISTRATION);
    setRegStep(1);
    setRegOtp('');
    setRegVerificationToken('');
    setRegBusy(false);
    setRegError('');
    setRegResendSeconds(0);
    setShowRegPassword(false);
  };

  const openRegistration = () => {
    resetRegistration();
    setActiveModal('register');
  };

  const closeRegistration = () => {
    setActiveModal(null);
    resetRegistration();
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const result = await login(email, password, rememberMe);
    if (!result.success) {
      if (result.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setAccountVerificationEmail(email.trim());
        setAccountVerificationOtp('');
        setActiveModal('verify-account');
      }
      showToast(result.message, 'warning');
      return;
    }
    showToast('Signed in successfully!', 'success');
    if (onLoginSuccess) onLoginSuccess();
  };

  const handleGuestAccess = () => {
    setIsGuestMode(true);
    showToast('Entered Guest Mode for facility reservations', 'info');
    if (onGuestMode) onGuestMode();
  };

  const handleRegisterOtpSend = async (e) => {
    e.preventDefault();
    const normalized = {
      fullName: regData.fullName.trim(),
      email: regData.email.trim().toLowerCase(),
      requestedAddress: regData.requestedAddress.trim(),
    };

    if (!normalized.fullName || !normalized.email || !normalized.requestedAddress) {
      setRegError('Complete your name, email address, and household address.');
      return;
    }
    if (!passwordChecks.length || !passwordChecks.letter || !passwordChecks.number) {
      setRegError('Use at least 12 characters with at least one letter and one number.');
      return;
    }
    if (!passwordChecks.matches) {
      setRegError('The passwords do not match.');
      return;
    }
    if (!regData.acceptedTerms) {
      setRegError('Accept the Terms and Conditions and Privacy Policy to continue.');
      return;
    }

    setRegBusy(true);
    setRegError('');
    try {
      await apiSendOtp(normalized.email, normalized.fullName, 'registration');
      setRegData((current) => ({ ...current, ...normalized }));
      setRegVerificationToken('');
      setRegStep(2);
      setRegResendSeconds(60);
      showToast('Verification code sent to your email address.', 'info');
    } catch (error) {
      const message = error.message || 'Failed to send the verification code.';
      setRegError(message);
      showToast(message, 'warning');
    } finally {
      setRegBusy(false);
    }
  };

  const handleRegisterResend = async () => {
    if (regBusy || regResendSeconds > 0) return;
    setRegBusy(true);
    setRegError('');
    try {
      await apiSendOtp(regData.email, regData.fullName, 'registration');
      setRegOtp('');
      setRegVerificationToken('');
      setRegResendSeconds(60);
      showToast('A new verification code was sent.', 'info');
    } catch (error) {
      const message = error.message || 'Failed to resend the verification code.';
      setRegError(message);
      showToast(message, 'warning');
    } finally {
      setRegBusy(false);
    }
  };

  const handleRegisterVerify = async (e) => {
    e.preventDefault();
    setRegBusy(true);
    setRegError('');
    try {
      let verificationToken = regVerificationToken;
      if (!verificationToken) {
        const verification = await apiVerifyOtp(regData.email, regOtp, 'registration');
        verificationToken = verification.verificationToken;
        setRegVerificationToken(verificationToken);
      }
      const result = await createUserAccount(
        {
          fullName: regData.fullName,
          email: regData.email,
          requestedAddress: regData.requestedAddress,
          password: regData.password,
          role: 'resident',
        },
        verificationToken,
      );
      if (!result.success) throw new Error(result.message || 'Registration failed.');
      setRegStep(3);
      showToast('Registration submitted for NHAI administrator approval.', 'success');
    } catch (error) {
      const message = error.message || 'The verification code is invalid or expired.';
      setRegError(message);
      showToast(message, 'warning');
    } finally {
      setRegBusy(false);
    }
  };

  const handleForgotSend = async (e) => {
    e.preventDefault();
    try {
      await apiSendOtp(forgotEmail, 'User', 'reset');
      setForgotStep(2);
      showToast('Password reset code sent to your email address.', 'info');
    } catch (error) {
      showToast(error.message || 'Failed to send reset code.', 'warning');
    }
  };

  const handleResetVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const verification = await apiVerifyOtp(forgotEmail, forgotOtp, 'reset');
      setResetVerificationToken(verification.verificationToken);
      setForgotStep(3);
    } catch (error) {
      showToast(error.message || 'Invalid verification code.', 'warning');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      showToast('Password must be at least 12 characters and include a letter and number.', 'warning');
      return;
    }
    const result = await updatePassword(forgotEmail, newPassword, resetVerificationToken);
    if (!result.success) {
      showToast(result.message, 'warning');
      return;
    }
    showToast('Password reset successfully! Please sign in with your new password.', 'success');
    setActiveModal(null);
    setForgotStep(1);
    setForgotEmail('');
    setForgotOtp('');
    setNewPassword('');
    setResetVerificationToken('');
  };

  const handleExistingAccountVerification = async (event) => {
    event.preventDefault();
    try {
      const result = await apiVerifyOtp(accountVerificationEmail, accountVerificationOtp, 'registration');
      if (!result.accountVerified) throw new Error('This code is not for an existing account.');
      showToast('Account email verified successfully. You may now sign in once the account is active.', 'success');
      setActiveModal(null);
      setAccountVerificationEmail('');
      setAccountVerificationOtp('');
    } catch (error) {
      showToast(error.message || 'The verification code is invalid or expired.', 'warning');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        { }
        <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl shadow-black/25 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[680px]">

        { }
        <div className="md:col-span-6 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          { }
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none"></div>

          { }
          <div className="relative z-10 space-y-6 text-center flex flex-col items-center">
            <div className="mb-6">
              <img src="/NHAI_Insignia.png" alt="NHAI Insignia" className="w-36 h-36 lg:w-40 lg:h-40 object-contain drop-shadow-xl mx-auto" />
            </div>

            <div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">NovaLink Portal</h1>
              <p className="text-blue-100 font-medium text-base mt-1">PUBLIC BETA TESTING</p>
            </div>
          </div>

          { }
          <div className="relative z-10 space-y-6 my-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Community Management</h3>
                <p className="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Manage residents, facilities, and community events all in one place
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Secure & Reliable</h3>
                <p className="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Your data is protected with enterprise-grade security
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Stay Connected</h3>
                <p className="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Real-time notifications and updates for your community
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-blue-200/80 font-medium">
            Novaville Homeowners Association, Inc. © 2026
          </div>
        </div>

        { }
        <div className="md:col-span-6 p-8 lg:p-12 bg-white flex flex-col justify-between text-slate-800">
          <div>
            { }
            <div className="mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-slate-500 text-xs mt-1">Sign in to continue to your dashboard</p>
            </div>

            { }
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              { }
              <div className="flex items-center justify-between gap-3 text-xs pt-1">
                <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-600">
                  <span className="relative h-4 w-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 bg-white transition checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                    />
                    <Check className="pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 text-white opacity-0 transition peer-checked:opacity-100" strokeWidth={3} aria-hidden="true" />
                  </span>
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setActiveModal('forgot')}
                  className="text-blue-600 hover:text-blue-700 font-semibold text-xs transition"
                >
                  Forgot password?
                </button>
              </div>

              { }
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition transform active:scale-[0.99] mt-2"
              >
                Sign In
              </button>
            </form>

            { }
            <div className="text-center text-xs text-slate-600 my-5">
              Don't have an account?{' '}
              <button
                onClick={openRegistration}
                className="text-blue-600 hover:text-blue-700 font-bold underline underline-offset-2 transition"
              >
                Register as Resident
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[11px] text-slate-400 uppercase font-medium absolute">or</span>
            </div>

            {/* Guest mode button */}
            <button
              onClick={handleGuestAccess}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Continue as Guest (Facility Reservation Only)</span>
            </button>
          </div>
        </div>

        </div>
      </div>

      <SiteFooter />

      {/* EXISTING ACCOUNT EMAIL VERIFICATION MODAL */}
      {activeModal === 'verify-account' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" role="presentation">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 text-slate-800" role="dialog" aria-modal="true" aria-labelledby="verify-account-title">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 id="verify-account-title" className="text-lg font-bold text-slate-900">Verify Existing Account Email</h3>
              <button type="button" onClick={() => { setActiveModal(null); setAccountVerificationEmail(''); setAccountVerificationOtp(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleExistingAccountVerification} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-start gap-2">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <span>Use the six-digit account-verification code sent by an NHAI administrator. Codes expire after 15 minutes.</span>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Account Email</label>
                <input
                  type="email"
                  required
                  value={accountVerificationEmail}
                  onChange={(event) => setAccountVerificationEmail(event.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Verification Code</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="\d{6}"
                  minLength={6}
                  maxLength={6}
                  value={accountVerificationOtp}
                  onChange={(event) => setAccountVerificationOtp(event.target.value)}
                  placeholder="6-digit code"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-center font-bold text-base text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition">Verify Account Email</button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {activeModal === 'register' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="presentation">
          <div className="grid min-h-screen lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]" role="dialog" aria-modal="true" aria-labelledby="registration-title">
            <aside className="relative overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-700 px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12">
              <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-blue-300/10 blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <img src="/NHAI_Insignia.png" alt="NHAI Insignia" className="h-14 w-14 object-contain drop-shadow-md" />
                  <div><p className="text-lg font-black tracking-tight">NovaLink Portal</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">Resident registration</p></div>
                </div>
                <div className="mt-10 max-w-md lg:mt-20">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Welcome home</p>
                  <h3 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">One account for your community services.</h3>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100/85">Create your account, verify your email, and submit it to the Novaville Homeowners' Association for approval.</p>
                </div>
                <ol className="mt-8 hidden space-y-5 text-sm lg:block">
                  {['Create your account details', 'Verify your email address', 'Wait for administrator approval'].map((label, index) => (
                    <li key={label} className="flex items-center gap-3 text-blue-100">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold ${regStep > index + 1 ? 'border-emerald-300 bg-emerald-400 text-emerald-950' : regStep === index + 1 ? 'border-white bg-white text-blue-700' : 'border-blue-300/50 text-blue-200'}`}>{regStep > index + 1 ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                      <span className={regStep === index + 1 ? 'font-bold text-white' : ''}>{label}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="relative z-10 mt-8 hidden border-t border-white/15 pt-5 text-xs text-blue-200 lg:block">Already have an account? Close registration and sign in.</div>
            </aside>

            <main className="relative flex min-h-screen bg-white text-slate-800">
              <button type="button" onClick={closeRegistration} className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close registration"><X className="h-5 w-5" /></button>
              <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-10 sm:px-10 lg:justify-center lg:px-14 lg:py-12 xl:px-20">
                <div className="mb-8 pr-12">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Step {regStep} of 3</p>
                  <h2 id="registration-title" className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{regStep === 1 ? 'Create your resident account' : regStep === 2 ? 'Verify your email' : 'Registration submitted'}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{regStep === 1 ? 'Provide your details and household address. An administrator may use the address to suggest an existing household record.' : regStep === 2 ? `We sent a six-digit verification code to ${regData.email}.` : 'Your details are now ready for administrator review.'}</p>
                </div>

                <div className="mb-9 flex max-w-xl items-center" aria-label={`Registration step ${regStep} of 3`}>
                  {['Details', 'Verify', 'Submitted'].map((label, index) => {
                    const step = index + 1;
                    const complete = regStep > step;
                    const active = regStep === step;
                    return <React.Fragment key={label}><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-400'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : step}</span><span className={`hidden text-xs font-semibold sm:inline ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span></div>{index < 2 && <span className={`mx-3 h-px flex-1 ${regStep > step ? 'bg-blue-600' : 'bg-slate-200'}`} />}</React.Fragment>;
                  })}
                </div>

                {regError && <div className="mb-5 max-w-xl border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-900" role="alert">{regError}</div>}

                {regStep === 1 && (
                  <form onSubmit={handleRegisterOtpSend} className="max-w-xl space-y-5 text-xs">
                    <div><label className="mb-1.5 block font-semibold text-slate-700">Full Name</label><input type="text" required autoComplete="name" placeholder="Full name" value={regData.fullName} onChange={(event) => setRegData({ ...regData, fullName: event.target.value })} className="w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600" /></div>
                    <div><label className="mb-1.5 block font-semibold text-slate-700">Email Address</label><input type="email" required autoComplete="email" placeholder="Email" value={regData.email} onChange={(event) => setRegData({ ...regData, email: event.target.value })} className="w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600" /></div>
                    <div><label className="mb-1.5 block font-semibold text-slate-700">Household Address</label><input type="text" required autoComplete="street-address" maxLength={190} placeholder="Block, lot, and street" value={regData.requestedAddress} onChange={(event) => setRegData({ ...regData, requestedAddress: event.target.value })} className="w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600" /><p className="mt-1.5 text-[11px] leading-4 text-slate-400">Used only to help the administrator find a possible household record. It will not block registration.</p></div>
                    <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-1.5 block font-semibold text-slate-700">Password</label><div className="relative"><input type={showRegPassword ? 'text' : 'password'} required autoComplete="new-password" minLength={12} maxLength={128} placeholder="Create password" value={regData.password} onChange={(event) => setRegData({ ...regData, password: event.target.value })} className="w-full border-b border-slate-300 bg-transparent px-0 py-3 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600" /><button type="button" onClick={() => setShowRegPassword((visible) => !visible)} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showRegPassword ? 'Hide registration password' : 'Show registration password'}>{showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div><div><label className="mb-1.5 block font-semibold text-slate-700">Confirm Password</label><input type={showRegPassword ? 'text' : 'password'} required autoComplete="new-password" placeholder="Confirm password" value={regData.confirmPassword} onChange={(event) => setRegData({ ...regData, confirmPassword: event.target.value })} className="w-full border-b border-slate-300 bg-transparent px-0 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600" /></div></div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-[11px]">{[[passwordChecks.length, '12+ characters'], [passwordChecks.letter, 'Contains a letter'], [passwordChecks.number, 'Contains a number'], [passwordChecks.matches, 'Passwords match']].map(([passed, label]) => <span key={label} className={`flex items-center gap-1.5 ${passed ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>{passed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}{label}</span>)}</div>
                    <label className="flex cursor-pointer items-start gap-2.5 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-600"><input type="checkbox" checked={regData.acceptedTerms} onChange={(event) => setRegData({ ...regData, acceptedTerms: event.target.checked })} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" /><span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">Terms and Conditions</a> and acknowledge the <a href="/privacy-policy" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">Privacy Policy</a>.</span></label>
                    <div className="flex justify-end pt-2"><button type="submit" disabled={regBusy} className="flex min-h-11 w-full items-center justify-center gap-2 bg-blue-600 px-7 py-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{regBusy && <Loader2 className="h-4 w-4 animate-spin" />}Continue to verification</button></div>
                  </form>
                )}

                {regStep === 2 && (
                  <form onSubmit={handleRegisterVerify} className="max-w-xl space-y-7 text-xs"><div className="flex items-start gap-4 border-b border-slate-200 pb-6"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Mail className="h-4 w-4" /></div><div><p className="font-bold text-slate-900">Check your inbox</p><p className="mt-1 leading-5 text-slate-500">The code expires after 15 minutes. You may edit your details if the email is incorrect.</p></div></div><div><label className="mb-2 block font-semibold text-slate-700">Six-digit verification code</label><input type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" minLength={6} maxLength={6} placeholder="000000" value={regOtp} onChange={(event) => setRegOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full max-w-xs border-b-2 border-slate-300 bg-transparent px-0 py-3 text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-blue-600" /></div><div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-5"><button type="button" onClick={() => { setRegStep(1); setRegOtp(''); setRegVerificationToken(''); setRegError(''); }} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft className="h-3.5 w-3.5" /> Edit details</button><button type="button" onClick={handleRegisterResend} disabled={regBusy || regResendSeconds > 0} className="font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">{regResendSeconds > 0 ? `Resend in ${regResendSeconds}s` : 'Resend code'}</button></div><button type="submit" disabled={regBusy || regOtp.length !== 6} className="flex min-h-11 items-center justify-center gap-2 bg-blue-600 px-7 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{regBusy && <Loader2 className="h-4 w-4 animate-spin" />}Verify and submit</button></div></form>
                )}

                {regStep === 3 && (
                  <div className="max-w-xl"><div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></div><p className="text-sm leading-6 text-slate-600">Your email has been verified. An NHAI administrator will review your account before you can sign in.</p><div className="my-7 border-y border-slate-200 py-5 text-sm text-slate-600"><p className="font-bold text-slate-900">What happens next</p><p className="mt-2 leading-6">You will receive an update after approval. Use <strong>{regData.email}</strong> when signing in.</p></div><button type="button" onClick={closeRegistration} className="bg-blue-600 px-7 py-3 text-xs font-bold text-white transition hover:bg-blue-700">Return to sign in</button></div>
                )}
              </div>
            </main>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {activeModal === 'forgot' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" role="presentation">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 text-slate-800" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 id="password-reset-title" className="text-lg font-bold text-slate-900">Reset Account Password</h3>
              <button onClick={() => { setActiveModal(null); setForgotStep(1); setForgotEmail(''); setForgotOtp(''); setNewPassword(''); setResetVerificationToken(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* step 1: enter email */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotSend} className="space-y-3 text-xs">
                <p className="text-slate-500">Enter your registered email address and we will send you a verification code.</p>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Registered Account Email</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter registered email..."
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Send Reset Code
                </button>
              </form>
            )}

            {/* step 2: verify OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleResetVerifyOtp} className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Verification code sent to <strong>{forgotEmail}</strong>. Check your inbox.</span>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Enter Verification Code</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="\d{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="Enter the code from your email"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-center font-bold text-base focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Verify Code
                </button>
              </form>
            )}

            {/* step 3: enter new password */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  Identity verified. Enter your new password below.
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    pattern="(?=.*[A-Za-z])(?=.*\d).{12,128}"
                    title="Use 12–128 characters with at least one letter and one number."
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Save New Password
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
