import type { Metadata } from 'next';
import './globals.css';
import { MockRazorpayProvider } from '@/lib/mocks/MockRazorpayProvider';

export const metadata: Metadata = {
  title: 'Prooflink',
  description: 'A mechanical handshake tool for freelancers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-gray-100 min-h-screen">
        <MockRazorpayProvider>
          {children}
        </MockRazorpayProvider>
      </body>
    </html>
  );
}
