import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { OfflineIndicator } from '@/components/offline-indicator';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'FDgolf',
  description: 'Real-time golf score tracking — CIBC Capital Markets Tournament',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <OfflineIndicator />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
