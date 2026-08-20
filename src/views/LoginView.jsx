// hey reader! high fidelity login view crafted to match your design concept image
import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Users, Bell, UserCheck, ArrowRight, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginView = ({ onLoginSuccess, onGuestMode }) => {
  const { login, setIsGuestMode, showToast, sendSimulatedEmail } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // modal state for register and forgot password
  const [activeModal, setActiveModal] = useState(null); // 'register' | 'forgot' | null

  // register state
  const [regData, setRegData] = useState({
    fullName: '',
    email: '',
    blockLot: '',
    password: ''
  });
  const [regStep, setRegStep] = useState(1);
  const [regOtp, setRegOtp] = useState('');

  // forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1);
  const [newPassword, setNewPassword] = useState('');

  const handleSignIn = (e) => {
    e.preventDefault();
    const result = login(email);
    if (!result.success) {
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

  const handleRegisterOtpSend = (e) => {
    e.preventDefault();
    sendSimulatedEmail(regData.email, 'NovaLink OTP Verification', `Your verification code is 7788`);
    setRegStep(2);
    showToast('Verification code sent to your email address.', 'info');
  };

  const handleRegisterVerify = (e) => {
    e.preventDefault();
    if (regOtp && regOtp.trim().length >= 4) {
      showToast('Registration submitted! Account pending NHAI Admin approval.', 'success');
      setActiveModal(null);
      setRegStep(1);
    } else {
      showToast('Invalid verification code entered.', 'warning');
    }
  };

  const handleForgotSend = (e) => {
    e.preventDefault();
    sendSimulatedEmail(forgotEmail, 'Password Reset Verification', 'Your NovaLink password reset code is 3344');
    setForgotStep(2);
    showToast('Password reset code sent to your email address.', 'info');
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    showToast('Password reset successfully! Please sign in with your new password.', 'success');
    setActiveModal(null);
    setForgotStep(1);
  };

  return (
    <div class="min-h-screen flex items-center justify-center px-4 py-8 bg-slate-900">
      {/* main auth card container */}
      <div class="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[680px] border border-slate-200/50">
        
        {/* LEFT PANEL - Hero Side (Vibrant Gradient) */}
        <div class="md:col-span-6 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-8 lg:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          {/* background decorative glowing circles */}
          <div class="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none"></div>

          {/* brand header */}
          <div class="relative z-10 space-y-6">
            <div class="w-20 h-20 bg-white/95 rounded-2xl shadow-lg flex items-center justify-center mb-6">
              <div class="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-extrabold text-white text-2xl shadow-inner">
                N
              </div>
            </div>

            <div>
              <h1 class="text-3xl lg:text-4xl font-black tracking-tight text-white">NovaLink Portal</h1>
              <p class="text-blue-100 font-medium text-base mt-1">HOA Management System</p>
            </div>
          </div>

          {/* feature highlights */}
          <div class="relative z-10 space-y-6 my-8">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <Users class="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 class="font-bold text-white text-base">Community Management</h3>
                <p class="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Manage residents, facilities, and community events all in one place
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <ShieldCheck class="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 class="font-bold text-white text-base">Secure & Reliable</h3>
                <p class="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Your data is protected with enterprise-grade security
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <Bell class="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 class="font-bold text-white text-base">Stay Connected</h3>
                <p class="text-blue-100/90 text-xs mt-0.5 leading-relaxed">
                  Real-time notifications and updates for your community
                </p>
              </div>
            </div>
          </div>

          <div class="relative z-10 text-xs text-blue-200/80 font-medium">
            Novaville Homeowners Association, Inc. © 2026
          </div>
        </div>

        {/* RIGHT PANEL - Form Side */}
        <div class="md:col-span-6 p-8 lg:p-12 bg-white flex flex-col justify-between text-slate-800">
          <div>
            {/* Header */}
            <div class="mb-8">
              <h2 class="text-2xl lg:text-3xl font-bold text-slate-900">Welcome Back</h2>
              <p class="text-slate-500 text-xs mt-1">Sign in to continue to your dashboard</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSignIn} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div class="relative">
                  <Mail class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <div class="relative">
                  <Lock class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Options row */}
              <div class="flex items-center justify-between text-xs pt-1">
                <label class="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveModal('forgot')}
                  class="text-blue-600 hover:text-blue-700 font-semibold text-xs transition"
                >
                  Forgot password?
                </button>
              </div>

              {/* Sign in button */}
              <button
                type="submit"
                onClick={handleSignIn}
                class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition transform active:scale-[0.99] mt-2"
              >
                Sign In
              </button>
            </form>

            {/* Registration link */}
            <div class="text-center text-xs text-slate-600 my-5">
              Don't have an account?{' '}
              <button
                onClick={() => setActiveModal('register')}
                class="text-blue-600 hover:text-blue-700 font-bold underline underline-offset-2 transition"
              >
                Register as Resident
              </button>
            </div>

            {/* Divider */}
            <div class="relative flex items-center justify-center my-4">
              <div class="border-t border-slate-200 w-full"></div>
              <span class="bg-white px-3 text-[11px] text-slate-400 uppercase font-medium absolute">or</span>
            </div>

            {/* Guest mode button */}
            <button
              onClick={handleGuestAccess}
              class="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <UserCheck class="w-4 h-4 text-blue-600" />
              <span>Continue as Guest (Facility Reservation Only)</span>
            </button>
          </div>
        </div>

      </div>

      {/* REGISTRATION MODAL */}
      {activeModal === 'register' && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 text-slate-800">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 class="text-lg font-bold text-slate-900">Resident Account Registration</h3>
              <button onClick={() => setActiveModal(null)} class="text-slate-400 hover:text-slate-600">
                <X class="w-5 h-5" />
              </button>
            </div>

            {regStep === 1 ? (
              <form onSubmit={handleRegisterOtpSend} class="space-y-3 text-xs">
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={regData.fullName}
                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                    class="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    class="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Block & Lot Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Block 1, Lot 5"
                    value={regData.blockLot}
                    onChange={(e) => setRegData({ ...regData, blockLot: e.target.value })}
                    class="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    class="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Send OTP Email Verification Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterVerify} class="space-y-3 text-xs">
                <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                  <Mail class="w-4 h-4 shrink-0 text-blue-600" />
                  <span>Verification code sent to <strong>{regData.email}</strong>. Please check your inbox.</span>
                </div>
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Enter Verification Code</label>
                  <input
                    type="text"
                    required
                    placeholder="7788"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value)}
                    class="w-full p-2.5 rounded-xl border border-slate-200 text-center font-bold text-base focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Verify & Submit Registration
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {activeModal === 'forgot' && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 text-slate-800">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 class="text-lg font-bold text-slate-900">Reset Account Password</h3>
              <button onClick={() => setActiveModal(null)} class="text-slate-400 hover:text-slate-600">
                <X class="w-5 h-5" />
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSend} class="space-y-3 text-xs">
                <div>
                  <label class="block font-medium text-slate-700 mb-1">Registered Account Email</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter registered email..."
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    class="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition mt-2"
                >
                  Send Reset Link / OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} class="space-y-3 text-xs">
                <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
                  Password reset code sent to <strong>{forgotEmail}</strong>. (Code: 3344)
                </div>
                <div>
                  <label class="block font-medium text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    class="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition mt-2"
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
