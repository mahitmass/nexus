import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrahaariNet — UPI Mule Ring Detector',
  description: 'Real-time UPI fraud detection via Temporal Graph Neural Networks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
