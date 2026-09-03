'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import PhoneInput from '@/components/PhoneInput';
import {
  Lock,
  Mail,
  User,
  Phone,
  Building,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  MessageSquare,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Crown,
  Briefcase,
  Layers
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sign Up State
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // 1-Click Quick Demo Login
  const handleQuickDemoLogin = async (roleSlug: string, label: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_role: roleSlug }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('crm_user', JSON.stringify(data.user));
        localStorage.setItem('crm_token', data.token);

        Swal.fire({
          icon: 'success',
          title: `Welcome, ${data.user.name}!`,
          text: `Authenticated as ${data.user.role}`,
          timer: 1500,
          showConfirmButton: false,
        });

        setTimeout(() => {
          if (data.user.role === 'Super Admin') {
            router.push('/');
          } else {
            router.push('/queue');
          }
        }, 600);
      } else {
        Swal.fire({ icon: 'error', title: 'Login Failed', text: data.message });
      }
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Connection Error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Standard Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail || !signInPassword) {
      Swal.fire({ icon: 'warning', title: 'Required Fields', text: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInEmail.trim(),
          password: signInPassword,
        }),
      });
      const data = await res.json();

      if (res.status === 403 || data.is_pending) {
        Swal.fire({
          icon: 'info',
          title: 'Account Under Review',
          html: `
            <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
              <p>Your account registration is currently <b>under review</b> by the executive administration.</p>
              <p class="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 font-medium">
                ⏳ A confirmation notice has been sent to <b>${signInEmail}</b>. You will receive an official activation email once an administrator approves your account.
              </p>
            </div>
          `,
          confirmButtonColor: '#081428',
        });
        return;
      }

      if (data.success) {
        localStorage.setItem('crm_user', JSON.stringify(data.user));
        localStorage.setItem('crm_token', data.token);

        Swal.fire({
          icon: 'success',
          title: `Welcome, ${data.user.name}!`,
          text: `Signed in as ${data.user.role || 'Advisor'}`,
          timer: 1400,
          showConfirmButton: false,
        });

        setTimeout(() => {
          if (data.user.role === 'Super Admin') {
            router.push('/');
          } else {
            router.push('/queue');
          }
        }, 600);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: data.message || 'Invalid credentials.',
        });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Server Error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirmPassword) {
      Swal.fire({ icon: 'warning', title: 'Password Mismatch', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName.trim(),
          email: signUpEmail.trim(),
          phone: signUpPhone.trim(),
          password: signUpPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Registration Submitted!',
          html: `
            <div class="text-left text-xs text-slate-600 space-y-2 mt-2">
              <p>Your account request has been received and is currently <b>in review</b> by the executive administration.</p>
              <p class="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 font-medium">
                ⏳ A confirmation notice has been dispatched from <b>notifications@crm.fsadvisory.ae</b> to <b>${signUpEmail}</b>.
              </p>
              <p class="text-slate-500">Once your credentials are confirmed and your account is approved, you will receive an activation email with your direct login link.</p>
            </div>
          `,
          confirmButtonText: 'Proceed to Sign In',
          confirmButtonColor: '#081428',
        });

        setSignUpPassword('');
        setSignUpConfirmPassword('');
        setMode('signin');
      } else {
        Swal.fire({ icon: 'error', title: 'Registration Error', text: data.message });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setForgotSent(true);
      } else {
        Swal.fire({ icon: 'error', title: 'Email Not Found', text: data.message });
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Request Failed', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-[#FAF8F5] font-sans">
      {/* ========================================================= */}
      {/* LEFT COLUMN: Luxury Real Estate & CRM Showcase (55% Width) */}
      {/* ========================================================= */}
      <div className="relative hidden md:flex md:w-[52%] lg:w-[56%] bg-[#081428] text-white flex-col justify-between p-10 lg:p-14 overflow-hidden select-none">
        {/* Background Showcase Image with Clear Visibility & Subtle Warm Vignette */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/login-hero.jpg"
            alt="FS Advisory Real Estate CRM"
            fill
            className="object-cover object-center opacity-85"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#081428]/80 via-[#081428]/35 to-[#081428]/55" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#C9A84C]/25 via-transparent to-transparent" />
        </div>

        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex flex-col gap-2">
            <Image
              src="/logo.svg"
              alt="FS Advisory"
              width={190}
              height={48}
              className="w-48 h-auto object-contain"
              priority
            />
            <div className="text-[11px] tracking-wider text-[#C9A84C] uppercase font-semibold">
              Dubai Luxury Real Estate Operating System
            </div>
          </div>
        </div>

        {/* Center Hero Message & Floating Glass Cards */}
        <div className="relative z-10 max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
            <span>Next-Generation Real Estate Platform</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-heading font-bold text-white leading-tight tracking-tight">
            Accelerate Luxury Deal Pipeline with Intelligence & Real-Time Sync
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Empower your advisory team with synchronized 3CX telephony, direct WhatsApp Web gateway, title deed owner data, and granular role permissions.
          </p>

          {/* 3 Feature Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="flex items-center gap-1.5 text-[#C9A84C] font-bold text-xs">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>3CX Telephony</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                Live click-to-dial & in-browser audio playback
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Sync</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                Device QR link, voice notes & unified chat
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Granular Roles</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                Multi-module checkbox permission control
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Compliance */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C9A84C]" />
            <span>256-Bit SSL Encrypted Enterprise Cloud</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">v2.8 Enterprise Dubai</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: Interactive Luxury Auth Card (48% Width)    */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto bg-white">
        {/* Top Header Mobile Brand & Switcher */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:hidden">
            <div className="bg-[#081428] px-2.5 py-1.5 rounded-md">
              <Image
                src="/logo.svg"
                alt="FS Advisory"
                width={120}
                height={30}
                className="w-28 h-auto object-contain"
                priority
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg p-1 text-xs">
            <button
              onClick={() => { setMode('signin'); setForgotSent(false); }}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-[#081428] text-[#C9A84C] shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setForgotSent(false); }}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#081428] text-[#C9A84C] shadow-2xs'
                  : 'text-slate-600 hover:text-[#081428]'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Center Form Card */}
        <div className="max-w-md w-full mx-auto my-auto py-6">
          {/* ================= MODE 1: SIGN IN ================= */}
          {mode === 'signin' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-heading font-bold text-[#081428]">
                  Welcome Back
                </h2>
                <p className="text-xs text-[#7A7A7A] mt-1">
                  Enter your credentials to access your real estate advisor portal.
                </p>
              </div>

              {/* Standard Sign In Form */}
              <form onSubmit={handleSignIn} className="space-y-4 text-xs">
                {/* Email */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Corporate Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="e.g. faraz@fsadvisory.ae"
                      className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C] text-[#081428] font-medium"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[#C9A84C] font-semibold text-[11px] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-9 pr-10 py-2.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C] text-[#081428]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between py-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-[#C9A84C] rounded"
                    />
                    <span className="text-slate-600 font-medium">Keep me signed in for 30 days</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Advisor Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ================= MODE 2: SIGN UP ================= */}
          {mode === 'signup' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-heading font-bold text-[#081428]">
                  Create Advisor Account
                </h2>
                <p className="text-xs text-[#7A7A7A] mt-1">
                  Register your account to access your assigned queue and sales tools.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Tariq Al-Mansoor"
                      className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C] text-[#081428]"
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Corporate Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        placeholder="tariq@fsadvisory.ae"
                        className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mobile / WhatsApp Number</label>
                    <PhoneInput
                      value={signUpPhone}
                      onChange={(phone) => setSignUpPhone(phone)}
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                </div>



                {/* Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      required
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Advisor Account'}
                </button>
              </form>
            </div>
          )}

          {/* ================= MODE 3: FORGOT PASSWORD ================= */}
          {mode === 'forgot' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <button
                  onClick={() => { setMode('signin'); setForgotSent(false); }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#081428] font-bold mb-3 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
                <h2 className="text-2xl font-heading font-bold text-[#081428]">
                  Reset Your Password
                </h2>
                <p className="text-xs text-[#7A7A7A] mt-1">
                  Enter your registered corporate email and we will send password recovery instructions.
                </p>
              </div>

              {forgotSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h3 className="font-bold text-sm text-emerald-900">Reset Instructions Dispatched</h3>
                  <p className="text-xs text-emerald-700">
                    If an account matches <strong>{forgotEmail}</strong>, an email with recovery instructions has been sent.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMode('signin'); setForgotSent(false); }}
                    className="mt-3 px-4 py-2 bg-[#081428] text-[#C9A84C] text-xs font-bold rounded-md"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Corporate Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. faraz@fsadvisory.ae"
                        className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] border border-[#E8E2D9] rounded-lg focus:outline-none focus:border-[#C9A84C] text-[#081428]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-[#081428] hover:bg-[#122444] text-[#C9A84C] font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Send Reset Instructions'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[#7A7A7A] border-t border-[#E8E2D9] pt-4">
          <span>FS Advisory CRM Enterprise • </span>
          <Link href="/" className="text-[#C9A84C] font-semibold hover:underline">
            Lead Pool Portal
          </Link>
          <span> • Dubai, United Arab Emirates</span>
        </div>
      </div>
    </div>
  );
}
