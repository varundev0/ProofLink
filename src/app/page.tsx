'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    freelancerEmail: '',
    title: '',
    amount: ''
  });
  const [generatedUrl, setGeneratedUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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
        setGeneratedUrl(`${window.location.origin}/p/${data.uuid}`);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3 tracking-tight text-white">Prooflink.</h1>
          <p className="text-gray-400">The mechanical handshake for freelancers.</p>
        </div>

        {generatedUrl ? (
          <div className="glass-card p-8 rounded-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-semibold text-white">The Drop is Ready</h2>
            <p className="text-gray-400">Share this secure link with your client to get paid.</p>
            
            <div className="bg-background border border-white/10 p-4 rounded-lg flex items-center justify-between">
              <code className="text-accent text-sm truncate mr-4">{generatedUrl}</code>
              <button 
                onClick={() => navigator.clipboard.writeText(generatedUrl)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
            
            <button 
              onClick={() => router.push(new URL(generatedUrl).pathname)}
              className="mt-4 w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg font-medium transition-colors border border-white/10"
            >
              Preview Client View
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card p-8 rounded-2xl space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Freelancer Email</label>
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
              className="w-full bg-accent hover:bg-accent-hover text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating Drop...' : 'Create The Drop'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
