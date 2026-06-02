'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Download, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useMockRazorpay } from '@/lib/mocks/MockRazorpayProvider';

type ProjectData = {
  project: {
    projectId: string;
    freelancerEmail: string;
    title: string;
    amount: number;
    status: 'pending' | 'paid';
    proofFileUrl?: string;
  };
  freelancer: {
    deal_count: number;
  };
};

// Load the Razorpay checkout.js script once
const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function ClientGate() {
  const params = useParams();
  const { openModal } = useMockRazorpay();

  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);

  // ── Token storage helpers ─────────────────────────────────────────────────
  const tokenKey = `prooflink_token_${params.projectId}`;

  const persistToken = (token: string) => {
    setDownloadToken(token);
    try { localStorage.setItem(tokenKey, token); } catch { /* private browsing */ }
  };

  const restoreToken = (): string | null => {
    try { return localStorage.getItem(tokenKey); } catch { return null; }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/projects/${params.projectId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          // If the project is already paid, try to restore a saved token
          if (json?.project?.status === 'paid') {
            const saved = restoreToken();
            if (saved) setDownloadToken(saved);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (params.projectId) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  // ── Payment handler ───────────────────────────────────────────────────────

  const handlePay = async () => {
    if (!data) return;

    // 1. Create a Razorpay order (or mock order) on the server
    const orderRes = await fetch('/api/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: data.project.projectId }),
    });
    const order = await orderRes.json();

    if (order.mock) {
      // ── Dev path: no real Razorpay keys — use the mock modal ─────────────
      openModal(data.project.amount, async () => {
        const verifyRes = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: data.project.projectId,
            razorpayOrderId: order.orderId,
          }),
        });
        const result = await verifyRes.json();
        if (result.success) {
          setData((prev) =>
            prev ? { ...prev, project: { ...prev.project, status: 'paid' } } : null
          );
          persistToken(result.downloadToken);
        }
      }, '24h');
      return;
    }

    // ── Production path: real Razorpay checkout ───────────────────────────
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      alert('Failed to load payment gateway. Please try again.');
      return;
    }

    const RazorpayCheckout = (window as unknown as Record<string, unknown>).Razorpay as new (
      opts: Record<string, unknown>
    ) => { open: () => void };

    const rzp = new RazorpayCheckout({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'ProofLink',
      description: data.project.title,
      theme: { color: '#a855f7' },
      handler: async (response: Record<string, string>) => {
        const verifyRes = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: data.project.projectId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });
        const result = await verifyRes.json();
        if (result.success) {
          setData((prev) =>
            prev ? { ...prev, project: { ...prev.project, status: 'paid' } } : null
          );
          persistToken(result.downloadToken);
        } else {
          alert('Payment verification failed. Please contact support.');
        }
      },
    });

    rzp.open();
  };

  // ── Download handler ──────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!downloadToken) {
      alert('Download token not found. Please refresh and try again.');
      return;
    }
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/projects/${params.projectId}/download?token=${downloadToken}`
      );
      const json = await res.json();
      if (json.signedUrl) {
        // In production this opens the real Supabase Storage signed URL
        window.open(json.signedUrl, '_blank');
      } else {
        alert(json.error ?? 'Failed to get download link.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleReport = () => {
    alert('Issue reported. Admin notified and funds flagged for review.');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading secure drop...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Project not found. Please check your Tracking Code.
      </div>
    );
  }

  const { project, freelancer } = data;
  const isPaid = project.status === 'paid';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Trust Badge */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20 text-sm w-max max-w-full z-50">
        <ShieldCheck size={16} className="shrink-0" />
        <span className="truncate">Verified Deal via Prooflink</span>
        <span className="opacity-50 mx-1 shrink-0">|</span>
        <span className="opacity-80 shrink-0">{freelancer.deal_count} deals</span>
      </div>

      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-md">
            <span className="text-xs text-gray-500 mr-2">DROP ID</span>
            <code className="text-accent text-sm font-bold">{project.projectId}</code>
          </div>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl flex flex-col md:flex-row relative z-10">
          {/* Proof Preview */}
          <div className="md:w-1/2 bg-black/50 border-r border-white/5 relative min-h-[300px] flex items-center justify-center p-8 group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

            {project.proofFileUrl && !project.proofFileUrl.startsWith('/mock-') ? (
              // Real uploaded proof (already watermarked server-side)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.proofFileUrl}
                alt="Watermarked proof"
                className="relative z-0 w-full h-full object-cover rounded-lg"
              />
            ) : (
              // Mock proof — apply CSS watermark effect as fallback
              <div className="relative z-0 opacity-40 blur-[2px] transition-all group-hover:blur-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
                  alt="Proof"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            )}

            <div className="absolute z-20 flex flex-col items-center text-center px-6">
              <Lock className="text-white/50 mb-3" size={32} />
              <p className="text-white font-medium">Proof File</p>
              <p className="text-xs text-white/50 mt-1">Watermarked Preview</p>
            </div>
          </div>

          {/* Action Area */}
          <div className="md:w-1/2 p-8 flex flex-col justify-center">
            <div className="mb-8">
              <p className="text-xs text-accent font-semibold tracking-wider uppercase mb-2">
                Project Delivery
              </p>
              <h1 className="text-2xl font-bold text-white mb-2">{project.title}</h1>
              <p className="text-gray-400 text-sm truncate">From: {project.freelancerEmail}</p>
            </div>

            <div className="space-y-4 mt-auto">
              {isPaid ? (
                <>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-green-400 font-medium">Payment Secured</p>
                      <p className="text-xs text-green-500/70">Download your final file below</p>
                    </div>
                    <ShieldCheck className="text-green-400" />
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={downloading || !downloadToken}
                    className="w-full bg-white text-black hover:bg-gray-200 py-3.5 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download size={20} />
                    {downloading ? 'Decrypting...' : 'Download Final Work'}
                  </button>

                  {!downloadToken && (
                    <p className="text-xs text-center text-yellow-500/70 mt-1">
                      Download link unavailable — please contact the freelancer to re-send your link.
                    </p>
                  )}

                  <div className="text-center pt-4">
                    <button
                      onClick={handleReport}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center justify-center gap-1 mx-auto transition-colors"
                    >
                      <AlertCircle size={14} /> Report Issue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-end justify-between mb-6">
                    <div>
                      <p className="text-sm text-gray-400">Total Amount</p>
                      <p className="text-3xl font-bold text-white">₹{project.amount}</p>
                    </div>
                  </div>

                  <button
                    onClick={handlePay}
                    className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-colors shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                  >
                    Pay to Unlock Final File
                  </button>

                  <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center gap-1">
                    <Lock size={12} /> Payment secured — final file unlocked instantly
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
