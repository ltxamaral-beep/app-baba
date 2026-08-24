import type { Metadata } from 'next';
import './globals.css';
import ToastContainer from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Reis da Pelada | Organiza o baba, equilibra o time e coroa a resenha.',
  description: 'Reis da Pelada - Organiza o baba, equilibra o time e coroa a resenha. Controle financeiro completo, lista de presença automática e sorteio equilibrado por IA.',
  icons: {
    icon: '/logo.png',
  },
};

import { SessionSync } from '@/components/auth/SessionSync';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-emerald-500 selection:text-black">
        <SessionSync />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
