import './globals.css';
import { withAppBasePath } from '../src/lib/app-path.js';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'automated trading meme',
  description: 'Automated trading meme dashboard with SOL, BNB Chain and Base signal scan, paper trading and realtime signals.',
  icons: {
    icon: withAppBasePath('/image.ico'),
    shortcut: withAppBasePath('/image.ico'),
    apple: withAppBasePath('/branding/logo.jpg'),
  },
  openGraph: {
    title: 'automated trading meme',
    description: 'Automated trading meme dashboard with SOL, BNB Chain and Base signal scan, paper trading and realtime signals.',
    images: [withAppBasePath('/branding/logo.jpg')],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
