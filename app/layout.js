import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'automated-trading-meme',
  description: 'Automated trading meme dashboard with SOL radar, paper trading and realtime signals.',
  icons: {
    icon: '/image.ico',
    shortcut: '/image.ico',
    apple: '/branding/logo.jpg',
  },
  openGraph: {
    title: 'automated-trading-meme',
    description: 'Automated trading meme dashboard with SOL radar, paper trading and realtime signals.',
    images: ['/branding/logo.jpg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
