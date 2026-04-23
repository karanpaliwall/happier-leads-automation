import '@/styles/reference.css';
import '@/styles/custom.css';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
  title: 'Website Traffic Signal',
  description: 'Capture and manage website visitor leads from Happier Leads',
  icons: { icon: '/favicon.png' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
