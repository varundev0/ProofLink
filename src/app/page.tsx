'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle, ShieldCheck, Search, Lock } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'freelancer' | 'client'>('freelancer');
  
  // Freelancer State
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    freelancerEmail: '',
    title: '',
    amount: ''
  });
  const [generatedId, setGeneratedId] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Client State
  const [dropLink, setDropLink] = useState('');

  const handleFreelancerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        setGeneratedId(data.projectId);
        setGeneratedUrl(`${window.location.origin}/p/${data.projectId}`);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropLink) return;
    
    // Simple parsing to extract projectId if they pasted full URL or just ID
    let projectId = dropLink.trim();
    if (projectId.includes('/p/')) {
      const parts = projectId.split('/p/');
      projectId = parts[parts.length - 1].split('/')[0];
    }
    
    if (projectId) {
      router.push(`/p/${projectId.toUpperCase()}`);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight text-white">Prooflink.</h1>
          <p className="text-gray-400">The trusted bridge between freelancers and clients.</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 mb-8 w-fit mx-auto relative z-10">
          <button
            onClick={() => setActiveTab('freelancer')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'freelancer' ? 'bg-accent text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white'
            }`}
          >
            For Freelancers
          </button>
          <button
            onClick={() => setActiveTab('client')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === 'client' ? 'bg-accent text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'text-gray-400 hover:text-white'
            }`}
          >
            For Clients
          </button>
        </div>

        {/* --- FREELANCER VIEW --- */}
        {activeTab === 'freelancer' && (
          generatedId ? (
            <div className="glass-card p-8 rounded-2xl text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="mx-auto w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-semibold text-white">The Drop is Ready</h2>
              <p className="text-gray-400">Share this Tracking Code or secure link with your client.</p>
              
              <div className="bg-background border border-white/10 p-6 rounded-lg mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Tracking Code</p>
                <p className="text-4xl font-mono font-bold text-accent tracking-wider">{generatedId}</p>
              </div>

              <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-lg">
                <code className="text-gray-300 text-xs truncate mr-4">{generatedUrl}</code>
                <button 
                  onClick={() => navigator.clipboard.writeText(generatedUrl)}
                  className="text-accent hover:text-accent-hover text-sm font-medium transition-colors"
                >
                  Copy Link
                </button>
              </div>
              
              <button 
                onClick={() => router.push(`/p/${generatedId}`)}
                className="mt-6 w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-medium transition-colors border border-white/10"
              >
                Preview Client View
              </button>
            </div>
          ) : (
            <form onSubmit={handleFreelancerSubmit} className="glass-card p-8 rounded-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Your Email</label>
                  <input 
                    type="email" 
                    required
                    className="w-full bg-background border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none transition-colors"
                    placeholder="you@example.com"
                    value={formData.freelancerEmail}
                    onChange={e => setFormData({...formData, freelancerEmail: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Project Title</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-background border border-white/10 rounded-lg p-3 text-white focus:border-accent outline-none transition-colors"
                    placeholder="Logo Design Final Files"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Amount (INR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input 
                      type="number" 
                      required
                      className="w-full bg-background border border-white/10 rounded-lg p-3 pl-8 text-white focus:border-accent outline-none transition-colors"
                      placeholder="10000"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="border border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-accent/50 transition-colors cursor-pointer bg-white/5">
                  <Upload className="text-gray-400 mb-2" size={24} />
                  <span className="text-sm text-gray-300 font-medium">Proof File</span>
                  <span className="text-xs text-gray-500 mt-1">Public (Watermarked)</span>
                </div>
                <div className="border border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-accent/50 transition-colors cursor-pointer bg-white/5">
                  <FileText className="text-gray-400 mb-2" size={24} />
                  <span className="text-sm text-gray-300 font-medium">Final File</span>
                  <span className="text-xs text-gray-500 mt-1">Private (Vault)</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-colors shadow-[0_0_20px_rgba(168,85,247,0.2)] disabled:opacity-50"
              >
                {loading ? 'Generating Drop...' : 'Create The Drop'}
              </button>
            </form>
          )
        )}

        {/* --- CLIENT VIEW --- */}
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
                    type="text" 
                    required
                    className="w-full bg-background border border-white/10 rounded-lg p-3 pl-11 text-white focus:border-accent outline-none transition-colors"
                    placeholder="e.g. PRJ-9X2A"
                    value={dropLink}
                    onChange={e => setDropLink(e.target.value)}
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

            {/* Trust Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-white">100% Escrow Protection</p>
                  <p className="text-xs text-gray-500 mt-1">Funds are held securely until you receive and verify the final files.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="text-accent shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-sm font-medium text-white">Zero-Risk Delivery</p>
                  <p className="text-xs text-gray-500 mt-1">Verify the watermarked proof before releasing any payment.</p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
