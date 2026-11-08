import type { Metadata } from 'next';
import '@radix-ui/themes/styles.css';
import '../styles/light-theme.css';
import '../styles/dark-theme.css';
import '../styles/reactflow-overrides.css';
import '../styles/table-overrides.css';
import '../styles/global-font.css';

export const metadata: Metadata = {
  title: 'Orcher Dashboard',
  description: 'Workflow orchestration dashboard for Orcher',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
