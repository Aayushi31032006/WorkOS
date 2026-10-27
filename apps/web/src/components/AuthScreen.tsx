import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Hash,
  ArrowRight,
  ShieldCheck,
  Building2,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { WorkOSLogo } from './WorkOSLogo';
import { SYNTHETIC_USERS, MOCK_TOKENS } from '../packages/test-fixtures/fixtures';
import { TokenClaims } from '../packages/contracts/types';

interface AuthScreenProps {
  onSignIn: (claims: TokenClaims) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn }) => {
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Organization/SSO Email discovery; Step 2: Password & Verification
  const [email, setEmail] = useState('vedant@company.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const handleContinueToPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your work email.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    // Match synthetic user
    const foundToken = Object.values(MOCK_TOKENS).find(
      (t) => t.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (foundToken) {
      onSignIn(foundToken);
    } else {
      setErrorMsg('Unknown company email. Try one of the synthetic personas below.');
    }
  };

  const selectPersona = (personaKey: 'vedant' | 'rohan' | 'sneha' | 'aaditya' | 'alex_external') => {
    const claims = MOCK_TOKENS[personaKey];
    if (claims) {
      setEmail(claims.email);
      onSignIn(claims);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf3fc] flex flex-col justify-between p-4 md:p-8 selection:bg-blue-600 selection:text-white">
      {/* Central Card Container */}
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Panel: White Login Card with Blue Accents */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-[0_10px_35px_rgba(37,99,235,0.06)] border border-blue-100 flex flex-col justify-between">
            <div>
              {/* Header: Logo & Step indicator */}
              <div className="flex items-center justify-between mb-8">
                <WorkOSLogo theme="light" size="md" />
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      step === 1 ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:text-slate-600'
                    }`}
                  >
                    1. Organization
                  </button>
                  <span>→</span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      step === 2 ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:text-slate-600'
                    }`}
                  >
                    2. Workspace
                  </button>
                </div>
              </div>

              {/* Error message */}
              {errorMsg && (
                <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* STEP 1: Organization & SSO Email Discovery */}
              {step === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-2">
                      ORGANIZATION SIGN IN
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Enter your work email.
                    </h1>
                    <p className="text-sm text-slate-500">
                      We'll direct you to your company's communication workspace.
                    </p>
                  </div>

                  <form onSubmit={handleContinueToPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Work email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="name@company.com"
                          className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 mt-3"
                    >
                      <span>Continue with SSO</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* SSO Options */}
                  <div className="pt-2 space-y-2">
                    <div className="relative text-center my-3">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200/80" />
                      </div>
                      <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Or authenticate with
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEmail('vedant@company.com');
                        setStep(2);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700"
                    >
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Single Sign-On (SAML / Okta)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEmail('vedant@company.com');
                        setStep(2);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2.5 text-xs font-semibold text-slate-700"
                    >
                      <KeyRound className="w-4 h-4 text-slate-600" />
                      <span>Google Workspace SSO</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Password & Identity Verification (matching image_4e54f67a.png) */}
              {step === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                        YOUR WORKSPACE, CONNECTED
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Change email</span>
                      </button>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Welcome back.
                    </h1>
                    <p className="text-sm text-slate-500">
                      Sign in to continue to your workspace.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Work email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full pl-10 pr-10 py-2.5 bg-blue-50/40 border border-blue-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-blue-300 text-blue-600 focus:ring-blue-600 w-3.5 h-3.5"
                        />
                        <span>Remember me</span>
                      </label>
                      <a href="#forgot" onClick={(e) => e.preventDefault()} className="font-medium text-blue-600 hover:text-blue-800">
                        Forgot password?
                      </a>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 mt-3"
                    >
                      <span>Sign in</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-center text-xs text-slate-400 pt-2">
                      Sign in with your company email address.
                    </p>
                  </form>
                </div>
              )}
            </div>

            {/* Quick Synthetic Personas Switcher (Works from either step) */}
            <div className="mt-8 pt-6 border-t border-blue-50">
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block mb-2.5">
                Quick Sign-in (Synthetic Test Personas)
              </span>
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => selectPersona('vedant')}
                  className="p-2.5 bg-blue-50/50 hover:bg-blue-100/60 rounded-xl border border-blue-200/60 text-xs transition flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                    VK
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 truncate">Vedant Kulkarni</div>
                    <div className="text-[10px] text-blue-600 font-medium">Member</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selectPersona('rohan')}
                  className="p-2.5 bg-blue-50/50 hover:bg-blue-100/60 rounded-xl border border-blue-200/60 text-xs transition flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-[#0a1a36] text-white flex items-center justify-center font-bold text-[10px]">
                    RD
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 truncate">Rohan Deshmukh</div>
                    <div className="text-[10px] text-indigo-600 font-medium">Admin</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selectPersona('sneha')}
                  className="p-2.5 bg-blue-50/50 hover:bg-blue-100/60 rounded-xl border border-blue-200/60 text-xs transition flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-[10px]">
                    SP
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-slate-800 truncate">Sneha Patil</div>
                    <div className="text-[10px] text-slate-500">Designer</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selectPersona('alex_external')}
                  className="p-2.5 bg-rose-50/70 hover:bg-rose-100/70 rounded-xl border border-rose-200 text-xs transition flex items-center gap-2"
                  title="Cross-Company Tenant to test 403 isolation rejection"
                >
                  <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-[10px]">
                    AV
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-rose-900 truncate">Alex (Cyberdyne)</div>
                    <div className="text-[10px] text-rose-600 font-medium">External Tenant</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Deep Sapphire Blue Hero Card Matching image_4e54f67a.png */}
          <div className="bg-gradient-to-br from-[#061530] via-[#0b214a] to-[#0f2d65] rounded-3xl p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl border border-blue-900/60">
            {/* Glowing blue radial background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Header Pill */}
              <div className="flex items-center justify-between mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white/90 text-xs font-medium rounded-full backdrop-blur-sm border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  PRIVATE WORKSPACE
                </span>

                {/* 3D Tactile WorkOS Squircle Emblem matching screenshot */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-100 via-white to-blue-200 rounded-[24px] p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-center">
                  <div className="w-full h-full bg-[#0a1a36] rounded-[18px] flex items-center justify-center shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-8 h-8 text-blue-400">
                      <path d="M12 4L3 20h18L12 4z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Subheading & Title */}
              <div className="mt-8 mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300 block mb-3">
                  BUILT FOR TEAMS
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white mb-4">
                  Better communication. <br />
                  Stronger teams.
                </h2>
                <p className="text-blue-100/80 text-sm leading-relaxed max-w-md">
                  Every conversation, file, and project update — thoughtfully brought together with zero context switching.
                </p>
              </div>
            </div>

            {/* Interactive Preview Badges matching screenshot */}
            <div className="space-y-3 pt-6">
              <div className="bg-white/10 hover:bg-white/15 transition border border-white/10 rounded-2xl p-3.5 flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Messages</div>
                    <div className="text-xs text-blue-200/70">Everything in sync</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-blue-950/80 text-blue-300 font-mono text-xs font-bold rounded-lg border border-blue-400/20">
                  12
                </span>
              </div>

              <div className="bg-white/10 hover:bg-white/15 transition border border-white/10 rounded-2xl p-3.5 flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Team channels</div>
                    <div className="text-xs text-blue-200/70">Work better together</div>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs text-blue-600/70 pt-4 gap-2 border-t border-blue-100">
        <span>WorkOS Internal Communication · Blue Edition</span>
        <span>Secure collaboration starts here</span>
      </div>
    </div>
  );
};
