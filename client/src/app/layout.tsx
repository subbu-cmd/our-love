import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';
import { AppLock } from '../components/AppLock';
import BackgroundEffects from '../components/BackgroundEffects';

export const metadata: Metadata = {
  title: 'Our Space',
  description: 'A private space for two.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col transition-colors duration-500">
        <Providers>
          <BackgroundEffects />
          <AppLock>
            {children}
          </AppLock>
        </Providers>
      </body>
    </html>
  );
}
