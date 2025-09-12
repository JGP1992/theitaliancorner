import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from '../components/Header';
import { AuthProvider } from '../components/AuthContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Stocktake',
  description: 'Visual stocktake for gelato stores',
  icons: {
    icon: '/TIC_Icon.png',
    shortcut: '/TIC_Icon.png',
    apple: '/TIC_Icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}>
        <AuthProvider>
          <div className="min-h-screen">
            <Header />
            <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
            <footer className="mx-auto max-w-7xl px-6 py-8 text-xs text-gray-500 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src="/TIC_Icon.png"
                    alt="TIC Icon"
                    className="h-6 w-6"
                  />
                  <span>© {new Date().getFullYear()} TIC Gelato</span>
                </div>
                <div className="text-gray-400">
                  Powered by TIC Technologies
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
