import '@/styles/reference.css';
import '@/styles/custom.css';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const metadata = {
  title: 'Happier Leads — Lead Dashboard',
  description: 'Capture and manage website visitor leads from Happier Leads',
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
