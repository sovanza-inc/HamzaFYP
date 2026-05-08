import type { Metadata } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './globals.css'
import Sidebar from '@/src/components/Sidebar'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Eco Forecast | Smart Energy Consumption Forecasting',
    template: '%s | Eco Forecast',
  },
  description:
    'Eco Forecast is an AI-powered smart energy consumption forecasting platform for Pakistani cities (Lahore, Karachi, Islamabad, Multan, Peshawar, Skardu) using CNN, LSTM, GRU, and Ensemble deep learning models with SHAP/LIME explainability.',
  keywords: [
    'energy forecasting',
    'smart energy',
    'deep learning',
    'Pakistan electricity',
    'LSTM forecasting',
    'CNN energy',
    'explainable AI',
    'SHAP LIME',
    'Lahore energy',
    'household electricity demand',
    'FYP Superior University',
  ],
  authors: [{ name: 'M Saqib Masood' }, { name: 'M Hamza' }, { name: 'Laiba Ali' }],
  creator: 'FYP-BSCS-F25-06, The Superior University Lahore',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Eco Forecast | Smart Energy Consumption Forecasting',
    description:
      'AI-powered energy demand forecasting for 6 Pakistani cities using CNN, LSTM, GRU ensemble with SHAP/LIME explainability and RAG-powered Q&A.',
    siteName: 'Eco Forecast',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eco Forecast | Smart Energy Forecasting',
    description:
      'Deep learning-based household energy demand forecasting for Pakistan. R²=0.934 ensemble model.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${bricolage.variable}`}>
      <body className="bg-slate-950 text-white min-h-screen antialiased font-[family-name:var(--font-bricolage)]">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
            <div className="p-6 lg:p-8 min-h-screen">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
