import type { Metadata } from 'next';
import { Inter, Barlow_Condensed } from 'next/font/google';
import { Toaster } from 'sonner';
import { OfflineIndicator } from '@/components/offline-indicator';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'FDgolf-CM',
  description: 'Real-time golf score tracking — CIBC Capital Markets Tournament',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${barlowCondensed.variable} font-sans antialiased`}>
        {children}
        <OfflineIndicator />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
