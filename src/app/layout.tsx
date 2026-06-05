import type { Metadata } from 'next';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
