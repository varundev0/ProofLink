'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, FileText, CheckCircle, ShieldCheck,
  Search, Lock, LogOut, User, X, LayoutDashboard,
} from 'lucide-react';

type AuthedUser = { id: string; email: string };

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'freelancer' | 'client'>('freelancer');

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<AuthedUser | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);

  // ── Drop form ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', amount: '' });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [generatedId, setGeneratedId] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const proofInputRef = useRef<HTMLInputElement>(null);
  const finalInputRef = useRef<HTMLInputElement>(null);

  // ── Client ────────────────────────────────────────────────────────────────
  const [dropLink, setDropLink] = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then(({ user }) => setCurrentUser(user ?? null))
      .catch(() => setCurrentUser(null))
      .finally(() => setSessionLoading(false));
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) setAuthError(data.error ?? 'Something went wrong.');
      else { setCurrentUser(data.user); setAuthForm({ email: '', password: '' }); }
    } catch { setAuthError('Network error. Please try again.'); }
    finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setCurrentUser(null);
    setGeneratedId('');
    setGeneratedUrl('');
    setFormData({ title: '', amount: '' });
    setProofFile(null);
    setFinalFile(null);
  };

  // ── Upload helper ─────────────────────────────────────────────────────────

  const uploadFile = async (file: File, type: 'proof' | 'final'): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Failed to upload ${type} file`);
    const { url } = await res.json();
    return url as string;
  };

  // ── Drop creation ─────────────────────────────────────────────────────────

  const handleFreelancerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile) { alert('Please select a proof file.'); return; }
    if (!finalFile) { alert('Please select the final deliverable file.'); return; }

    setLoading(true);
    try {
      // 1. Upload both files (proof gets watermarked server-side)
      const [proofFileUrl, finalFileUrl] = await Promise.all([
        uploadFile(proofFile, 'proof'),
        uploadFile(finalFile, 'final'),
      ]);

      // 2. Create the project with the real file URLs
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, proofFileUrl, finalFileUrl }),
      });
      const data = await res.json();

      if (data.success) {
        setGeneratedId(data.projectId);
        setGeneratedUrl(`${window.location.origin}/p/${data.projectId}`);
      } else {
        alert(data.error ?? 'Failed to create project');
      }
    } catch (err) {
      alert((err as Error).message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropLink) return;
    let projectId = dropLink.trim();
    if (projectId.includes('/p/')) {
      const parts = projectId.split('/p/');
      projectId = parts[parts.length - 1].split('/')[0];
    }
    if (projectId) router.push(`/p/${projectId.toUpperCase()}`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight text-white">Prooflink.</h1>
          <p className="text-gray-400">The trusted bridge between freelancers and clients.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-8 w-fit mx-auto relative z-10">
          {(['freelancer', 'client'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-accent text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'freelancer' ? 'For Freelancers' : 'For Clients'}
            </button>
          ))}
        </div>

        {/* ── FREELANCER VIEW ── */}
        {activeTab === 'freelancer' && (
          <>
            {sessionLoading ? (
              <div className="text-center text-gray-500 py-12">Checking session...</div>

            ) : !currentUser ? (
              /* ── Auth Gate ── */
              <div className="glass-card p-8 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 mb-6 w-fit">
                  {(['signin', 'signup'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setAuthMode(mode); setAuthError(''); }}
                      className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                        authMode === mode ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>

                <h2 className="text-xl font-semibold text-white mb-1">
                  {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-sm text-gray-400 mb-6">
                  {authMode === 'signin'
                    ? 'Sign in to create and manage your drops.'
                    : 'Sign up to start delivering work securely.'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                  {(['email', 'password'] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-400 mb-1 capitalize">{field}</label>
                      <input
                        type={field}
                        required
                        minLength={field === 'password' ? 8 : undefined}
                        className="w-full bg-background border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none transition-colors"
                        placeholder={field === 'email' ? 'you@example.com' : '••••••••'}
                        value={authForm[field]}
                        onChange={(e) => setAuthForm({ ...authForm, [field]: e.target.value })}
                      />
                      {field === 'password' && authMode === 'signup' && (
                        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters.</p>
                      )}
                    </div>
                  ))}

                  {authError && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                      {authError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-colors shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50"
                  >
                    {authLoading
                      ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...')
                      : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
                  </button>
                </form>
              </div>

            ) : generatedId ? (
              /* ── Drop Created ── */
              <div className="glass-card p-8 rounded-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="mx-auto w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-semibold text-white">The Drop is Ready</h2>
                <p className="text-gray-400">Share this Tracking Code or secure link with your client.</p>

                <div className="bg-background border border-white/10 p-6 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Tracking Code</p>
                  <p className="text-4xl font-mono font-bold text-accent tracking-wider">{generatedId}</p>
                </div>

                <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg">
                  <code className="text-gray-300 text-xs truncate mr-4">{generatedUrl}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedUrl)}
                    className="text-accent hover:text-accent-hover text-sm font-medium transition-colors shrink-0"
                  >
                    Copy Link
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/p/${generatedId}`)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-medium transition-colors border border-white/10"
                  >
                    Preview Client View
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedId(''); setGeneratedUrl('');
                      setFormData({ title: '', amount: '' });
                      setProofFile(null); setFinalFile(null);
                    }}
                    className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent py-3 rounded-lg font-medium transition-colors border border-accent/20"
                  >
                    New Drop
                  </button>
                </div>
              </div>

            ) : (
              /* ── Create Drop Form ── */
              <div className="space-y-4">
                {/* Signed-in banner */}
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <User size={14} className="text-accent" />
                    <span className="truncate">{currentUser.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent transition-colors"
                    >
                      <LayoutDashboard size={13} /> Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleFreelancerSubmit}
                  className="glass-card p-8 rounded-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Project Title</label>
                      <input
                        type="text" required
                        className="w-full bg-background border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none transition-colors"
                        placeholder="Logo Design Final Files"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Amount (INR)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          type="number" required
                          className="w-full bg-background border border-white/10 rounded-lg p-3 pl-8 text-white focus:border-accent outline-none transition-colors"
                          placeholder="10000"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* File Pickers */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Proof file */}
                    <div>
                      <input
                        ref={proofInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => proofInputRef.current?.click()}
                        className={`w-full border border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-white/5 ${
                          proofFile ? 'border-accent/60' : 'border-white/20 hover:border-accent/50'
                        }`}
                      >
                        {proofFile ? (
                          <>
                            <CheckCircle className="text-accent mb-2" size={22} />
                            <span className="text-xs text-accent font-medium truncate w-full text-center">{proofFile.name}</span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); setProofFile(null); }}
                              className="mt-1 text-gray-500 hover:text-red-400 cursor-pointer"
                            >
                              <X size={14} />
                            </span>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 mb-2" size={22} />
                            <span className="text-sm text-gray-300 font-medium">Proof File</span>
                            <span className="text-xs text-gray-500 mt-1">Image (watermarked)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Final file */}
                    <div>
                      <input
                        ref={finalInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setFinalFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => finalInputRef.current?.click()}
                        className={`w-full border border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-white/5 ${
                          finalFile ? 'border-accent/60' : 'border-white/20 hover:border-accent/50'
                        }`}
                      >
                        {finalFile ? (
                          <>
                            <CheckCircle className="text-accent mb-2" size={22} />
                            <span className="text-xs text-accent font-medium truncate w-full text-center">{finalFile.name}</span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); setFinalFile(null); }}
                              className="mt-1 text-gray-500 hover:text-red-400 cursor-pointer"
                            >
                              <X size={14} />
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText className="text-gray-400 mb-2" size={22} />
                            <span className="text-sm text-gray-300 font-medium">Final File</span>
                            <span className="text-xs text-gray-500 mt-1">Private (Vault)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-colors shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50"
                  >
                    {loading ? 'Uploading & Creating Drop…' : 'Create The Drop'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* ── CLIENT VIEW ── */}
        {activeTab === 'client' && (
          <div className="glass-card p-8 rounded-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white">Access Your Drop</h2>
              <p className="text-sm text-gray-400">Review watermarked proofs and securely pay to unlock final files.</p>
            </div>

            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Tracking Code or URL</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text" required
                    className="w-full bg-background border border-white/10 rounded-lg p-3 pl-11 text-white focus:border-accent outline-none transition-colors"
                    placeholder="e.g. PRJ-9X2A"
                    value={dropLink}
                    onChange={(e) => setDropLink(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-white text-black hover:bg-gray-200 py-3.5 rounded-lg font-bold transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
              >
                Track & Pay Securely
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-white">100% Escrow Protection</p>
                  <p className="text-xs text-gray-500 mt-1">Funds held securely until you verify the final files.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-white">Zero-Risk Delivery</p>
                  <p className="text-xs text-gray-500 mt-1">Verify the watermarked proof before releasing payment.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
