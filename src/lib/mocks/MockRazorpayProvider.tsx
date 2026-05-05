'use client';

import React, { createContext, useContext, useState } from 'react';

type MockRazorpayContextType = {
  openModal: (amount: number, onSuccess: () => void, onHoldUntil: string) => void;
};

const MockRazorpayContext = createContext<MockRazorpayContextType | undefined>(undefined);

export const MockRazorpayProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [onSuccessCb, setOnSuccessCb] = useState<(() => void) | null>(null);

  const openModal = (amt: number, onSuccess: () => void, onHoldUntil: string) => {
    setAmount(amt);
    setOnSuccessCb(() => onSuccess);
    setIsOpen(true);
  };

  const handleSuccess = () => {
    if (onSuccessCb) onSuccessCb();
    setIsOpen(false);
  };

  const handleFail = () => {
    alert("Payment failed.");
    setIsOpen(false);
  };

  return (
    <MockRazorpayContext.Provider value={{ openModal }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-xl border border-white/10 shadow-2xl max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2">Mock Razorpay Checkout</h2>
            <p className="text-gray-400 mb-6">Payment Amount: ₹{amount}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSuccess}
                className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-medium transition-colors"
              >
                Simulate Success
              </button>
              <button
                onClick={handleFail}
                className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 py-3 rounded-lg font-medium transition-colors"
              >
                Simulate Failure
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-gray-500 hover:text-white py-3 transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-center text-gray-500 mt-4">
              Holding funds for 24 hours (Route)
            </p>
          </div>
        </div>
      )}
    </MockRazorpayContext.Provider>
  );
};

export const useMockRazorpay = () => {
  const context = useContext(MockRazorpayContext);
  if (!context) throw new Error("useMockRazorpay must be used within MockRazorpayProvider");
  return context;
};
