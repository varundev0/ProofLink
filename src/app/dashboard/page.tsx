'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, Clock, Copy, ExternalLink, ArrowLeft,
  IndianRupee, Briefcase, TrendingUp, ChevronDown, ChevronUp,
  Plus, User, LogOut,
} from 'lucide-react';

type Project = {
  projectId: string;
  title: string;
  amount: number;
  status: 'pending' | 'paid';
  proofFileUrl?: string;
  freelancerEmail: string;
};

type DashboardData = {
  projects: Project[];
  totalEarned: number;
  paidCount: number;
};

type AuthedUser = { id: string; email: string };

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<AuthedUser | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Check auth
      const sessionRes = await fetch('/api/auth/session');
      const { user: sessionUser } = await sessionRes.json();
      if (!sessionUser) {
        router.replace('/');
        return;
      }
      setUser(sessionUser);

      // Load projects
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        setData(await projRes.json());
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.replace('/');
  };

  const copyLink = (projectId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${projectId}`);
    setCopied(projectId);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Loading / auth ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        Failed to load dashboard. <Link href="/" className="ml-2 underline">Go home</Link>
      </div>
    );
  }

  const { projects, totalEarned, paidCount } = data;
  const pendingCount = projects.length - paidCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User size={14} className="text-accent" />
            <span className="truncate max-w-[180px]">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> New Drop
          </Link>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-3">
            <IndianRupee size={13} />
            Total Earned
          </div>
          <p className="text-3xl font-bold text-white">
            ₹{totalEarned.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">from paid drops</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-3">
            <TrendingUp size={13} />
            Paid Drops
          </div>
          <p className="text-3xl font-bold text-green-400">{paidCount}</p>
          <p className="text-xs text-gray-500 mt-1">completed</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-3">
            <Briefcase size={13} />
            Pending
          </div>
          <p className="text-3xl font-bold text-yellow-400">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">awaiting payment</p>
        </div>
      </div>

      {/* Project List */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          Your Drops ({projects.length})
        </h2>

        {projects.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center">
            <p className="text-gray-500 mb-4">No drops yet.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={15} /> Create your first drop
            </Link>
          </div>
        )}

        {projects.map((project) => {
          const isExpanded = expandedId === project.projectId;
          const isPaid = project.status === 'paid';
          const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${project.projectId}`;

          return (
            <div
              key={project.projectId}
              className="glass-card rounded-2xl overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : project.projectId)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Status icon */}
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isPaid ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                  }`}>
                    {isPaid ? <CheckCircle size={16} /> : <Clock size={16} />}
                  </div>

                  {/* Title + ID */}
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{project.title}</p>
                    <p className="text-xs text-gray-500 font-mono">{project.projectId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 ml-4">
                  {/* Amount */}
                  <p className={`text-sm font-semibold ${isPaid ? 'text-green-400' : 'text-white'}`}>
                    ₹{project.amount.toLocaleString('en-IN')}
                  </p>

                  {/* Status badge */}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    isPaid
                      ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {isPaid ? 'Paid' : 'Pending'}
                  </span>

                  {/* Expand chevron */}
                  <span className="text-gray-500">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/5 p-5 bg-black/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">

                  {/* Proof preview */}
                  {project.proofFileUrl && !project.proofFileUrl.startsWith('/mock-') && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Proof Preview</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.proofFileUrl}
                        alt="Watermarked proof"
                        className="w-full max-h-48 object-cover rounded-lg opacity-80"
                      />
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Amount</p>
                      <p className="text-white font-semibold">₹{project.amount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <p className={`font-semibold ${isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                        {isPaid ? '✓ Payment received' : '⏳ Awaiting payment'}
                      </p>
                    </div>
                  </div>

                  {/* Share link */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Client Link</p>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <code className="text-gray-300 text-xs truncate flex-1">{shareUrl}</code>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copyLink(project.projectId)}
                          className="text-accent hover:text-accent-hover transition-colors p-1"
                          title="Copy link"
                        >
                          {copied === project.projectId
                            ? <CheckCircle size={15} className="text-green-400" />
                            : <Copy size={15} />}
                        </button>
                        <Link
                          href={`/p/${project.projectId}`}
                          target="_blank"
                          className="text-gray-500 hover:text-white transition-colors p-1"
                          title="Open client view"
                        >
                          <ExternalLink size={15} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
