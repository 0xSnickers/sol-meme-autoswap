import './globals.css';

export const metadata = {
  title: 'GMGN SOL Meme Radar',
  description: 'SOL Meme scanning dashboard powered by GMGN radar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
