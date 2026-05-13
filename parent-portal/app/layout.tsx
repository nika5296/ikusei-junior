import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '鎌倉グリーン｜育成クラス・振替の残り',
  description: '育成クラス・振替残数の確認（保護者向け）'
};

export const viewport: Viewport = {
  themeColor: '#14532d'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
