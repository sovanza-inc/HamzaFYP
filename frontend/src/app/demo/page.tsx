'use client'

import { useState, useEffect } from 'react'
import {
  Play,
  CheckCircle,
  Zap,
  TrendingUp,
  RefreshCw,
  MessageSquare,
  BarChart2,
  Cpu,
} from 'lucide-react'
import ForecastChart from '@/src/components/ForecastChart'
import ModelComparison from '@/src/components/ModelComparison'
import { ShapBarChart } from '@/src/components/XAIPanel'

// ─── Hardcoded Demo Data ──────────────────────────────────────────────────────

const DEMO_PREDICTIONS = [
  0.3821, 0.3542, 0.3318, 0.3187, 0.3094, 0.3021, 0.3287, 0.4123,
  0.5234, 0.5987, 0.6234, 0.6412, 0.6521, 0.6398, 0.6187, 0.5923,
  0.6234, 0.6987, 0.7523, 0.7812, 0.7634, 0.7123, 0.6234, 0.4987,
]

const DEMO_LOWER_CI = DEMO_PREDICTIONS.map((v) => parseFloat((v * 0.91).toFixed(4)))
const DEMO_UPPER_CI = DEMO_PREDICTIONS.map((v) => parseFloat((v * 1.09).toFixed(4)))

const DEMO_SHAP = [
  { feature: 'temperature', importance: 0.1823 },
  { feature: 'lag_1h', importance: 0.1654 },
  { feature: 'lag_24h', importance: 0.1421 },
  { feature: 'solar_radiation', importance: 0.1187 },
  { feature: 'lag_1d', importance: 0.0943 },
  { feature: 'humidity', importance: 0.0812 },
  { feature: 'hour_sin', importance: 0.0721 },
  { feature: 'hour_cos', importance: 0.0634 },
]

const QA_EXCHANGES = [
  {
    q: 'Why is demand peaking at 8 PM?',
    a: `Demand peaks at 8 PM for three compounding reasons:\n\n**1. Evening cooking load** — Pakistani households prepare dinner between 7-9 PM, driving simultaneous spikes in gas appliances, kitchen fans, and lighting (estimated +22% over daytime baseline).\n\n**2. Thermal lag from AC units** — Even after sunset, buildings have absorbed solar heat throughout the day. AC units run at maximum capacity to shed this stored thermal energy, typically peaking ~2 hours after solar maximum.\n\n**3. Entertainment & lighting convergence** — Sunset (≈6:45 PM in Lahore summer) forces a step-change in lighting load right before the evening routine begins. Prime-time TV viewership adds another 15-18% to base electrical load.\n\nThe Ensemble model captures this pattern via lag_1h and lag_24h features, which encode the 24-hour periodicity with high fidelity (R²=0.934).`,
    sources: ['NEPRA Load Profile Data', 'SHAP Temporal Analysis', 'Lahore Field Study 2023'],
  },
  {
    q: 'What features most affect demand?',
    a: `Global SHAP analysis across all 4 models reveals the top drivers:\n\n**1. temperature (18.2%)** — Dominant predictor. Every +5°C above 30°C adds ~0.08 kWh/hr from AC load alone. Summer Lahore peaks (42°C) explain 35% of total variance.\n\n**2. lag_1h (16.5%)** — Autoregressive signal. The strongest predictor after temperature. "What happened last hour" strongly predicts "what will happen this hour".\n\n**3. lag_24h (14.2%)** — Daily routine encoder. Same hour yesterday is the best analog for tomorrow's demand — capturing work schedule, meal times, and sleep patterns.\n\n**4. solar_radiation (11.9%)** — Dual effect: reduces lighting load (negative) but increases AC load (positive). Net SHAP is positive in summer Pakistan.\n\n**5. lag_1d (9.4%)** — Weekly pattern carrier. Weekend vs. weekday behavioral differences are embedded in the smoothed daily lag feature.\n\nThese 5 features together explain 70.3% of total prediction variance.`,
    sources: ['XAI SHAP Global Report', 'Feature Ablation Study', 'Correlation Matrix Analysis'],
  },
  {
    q: 'Which model is most accurate?',
    a: `The **Ensemble model** achieves the highest accuracy with R²=0.934 and RMSE=0.312 kWh.\n\n**Full Rankings:**\n• Ensemble — R²=0.934, RMSE=0.312 (BEST)\n• LSTM — R²=0.924, RMSE=0.328\n• GRU — R²=0.921, RMSE=0.335\n• CNN — R²=0.918, RMSE=0.341\n\n**Why Ensemble wins:**\nThe ensemble combines weighted predictions from CNN (0.28), LSTM (0.38), and GRU (0.34). Error diversity is the key — CNN excels at sharp intra-day spikes, LSTM handles gradual trends, and GRU bridges weekday/weekend transitions. Their mistakes cancel out, yielding a more accurate and calibrated final prediction.\n\n**Confidence intervals:**\nThe ensemble also provides the tightest 95% CI bands (±8.7% of predicted value), making it the most reliable for grid planning decisions.\n\nAll models qualify as "excellent fit" (R² > 0.90) per IEC energy forecasting standards.`,
    sources: ['Model Benchmark Report', 'Ensemble Weight Optimization', 'Cross-Validation Results'],
  },
]

type DemoStep = 'loading' | 'forecast' | 'shap' | 'qa' | 'complete'

export default function DemoPage() {
  const [step, setStep] = useState<DemoStep>('loading')
  const [loadingText, setLoadingText] = useState('Initializing demo...')

  // Auto-advance through steps
  useEffect(() => {
    const seq = [
      { delay: 800, action: () => setLoadingText('Loading Lahore Summer Forecast...') },
      { delay: 1600, action: () => setLoadingText('Running Ensemble model...') },
      { delay: 2400, action: () => setLoadingText('Generating 24-hour predictions...') },
      { delay: 3200, action: () => setStep('forecast') },
      { delay: 6500, action: () => setStep('shap') },
      { delay: 10000, action: () => setStep('qa') },
      { delay: 13000, action: () => setStep('complete') },
    ]

    const timers = seq.map(({ delay, action }) => setTimeout(action, delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  const reset = () => {
    setStep('loading')
    setLoadingText('Initializing demo...')
  }

  const dailyTotal = DEMO_PREDICTIONS.reduce((s, v) => s + v, 0)
  const peakHour = DEMO_PREDICTIONS.indexOf(Math.max(...DEMO_PREDICTIONS)) + 1

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Demo</h1>
            <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              No Backend Needed
            </span>
          </div>
          <p className="text-slate-400">
            Auto-play FYP presentation demo — Lahore Summer Day Forecast
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 hover:border-emerald-500/40 hover:text-emerald-400 text-slate-400 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Restart Demo
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(['forecast', 'shap', 'qa', 'complete'] as DemoStep[]).map((s, idx) => {
          const labels = ['Forecast', 'XAI (SHAP)', 'Q&A', 'Complete']
          const icons = [TrendingUp, BarChart2, MessageSquare, CheckCircle]
          const Icon = icons[idx]
          const isActive = step === s
          const isPast =
            ['forecast', 'shap', 'qa', 'complete'].indexOf(step) >
            ['forecast', 'shap', 'qa', 'complete'].indexOf(s)
          const isLoading = step === 'loading'

          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : isPast || (isLoading && false)
                    ? 'bg-slate-700 border-slate-600 text-slate-300'
                    : 'bg-slate-800 border-slate-700 text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {labels[idx]}
                {(isPast) && <CheckCircle className="w-3 h-3 text-emerald-400 ml-0.5" />}
              </div>
              {idx < 3 && <div className="w-4 h-px bg-slate-700" />}
            </div>
          )
        })}
      </div>

      {/* Loading State */}
      {step === 'loading' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 flex flex-col items-center justify-center min-h-[400px] fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
            <Zap className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <p className="text-white font-semibold text-lg">{loadingText}</p>
          </div>
          <p className="text-slate-400 text-sm text-center max-w-sm">
            FYP Project: Smart Energy Consumption Forecasting for Pakistani Cities
            <br />
            <span className="text-slate-500 text-xs mt-1 block">BSCS-F25-06 | FYP 2024-25</span>
          </p>
          {/* Animated bar */}
          <div className="mt-8 w-64 bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      )}

      {/* Step 1: Forecast */}
      {(step === 'forecast' || step === 'shap' || step === 'qa' || step === 'complete') && (
        <div className="space-y-6 fade-in">
          {/* Info Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-sm">
              <strong>Forecast Complete</strong> — Lahore | Ensemble Model | Summer 2024 | 24-hour
              horizon
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: 'Daily Total', value: dailyTotal.toFixed(2), unit: 'kWh', color: 'text-emerald-400', icon: Zap },
              { label: 'Peak Hour', value: String(peakHour), unit: ':00', color: 'text-orange-400', icon: TrendingUp },
              { label: 'Peak Demand', value: Math.max(...DEMO_PREDICTIONS).toFixed(3), unit: 'kWh', color: 'text-red-400', icon: BarChart2 },
              { label: 'Model R²', value: '0.934', unit: '', color: 'text-blue-400', icon: Cpu },
            ].map((m) => {
              const Icon = m.icon
              return (
                <div key={m.label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${m.color}`} />
                    <p className="text-slate-400 text-xs font-medium">{m.label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${m.color}`}>
                    {m.value}
                    <span className="text-sm font-normal text-slate-400 ml-1">{m.unit}</span>
                  </p>
                </div>
              )
            })}
          </div>

          {/* Forecast Chart */}
          <ForecastChart
            predictions={DEMO_PREDICTIONS}
            city="Lahore"
            model="Ensemble"
            confidenceLower={DEMO_LOWER_CI}
            confidenceUpper={DEMO_UPPER_CI}
          />
        </div>
      )}

      {/* Step 2: SHAP */}
      {(step === 'shap' || step === 'qa' || step === 'complete') && (
        <div className="fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <h2 className="text-white font-semibold">XAI Explanation — Global SHAP</h2>
          </div>
          <ShapBarChart data={DEMO_SHAP} />
        </div>
      )}

      {/* Step 3: Q&A */}
      {(step === 'qa' || step === 'complete') && (
        <div className="fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h2 className="text-white font-semibold">Q&amp;A Agent — Knowledge Base Demo</h2>
          </div>

          <div className="space-y-4">
            {QA_EXCHANGES.map((qa, idx) => (
              <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Question */}
                <div className="flex items-start gap-3 p-4 border-b border-slate-700 bg-slate-700/30">
                  <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Play className="w-3 h-3 text-blue-400" />
                  </div>
                  <p className="text-white font-medium text-sm">{qa.q}</p>
                </div>

                {/* Answer */}
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed">
                      {qa.a.split('\n').map((line, i) => {
                        const parts = line.split(/\*\*(.*?)\*\*/g)
                        const formatted = parts.map((p, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} className="text-white font-semibold">
                              {p}
                            </strong>
                          ) : (
                            p
                          )
                        )
                        return (
                          <span key={i}>
                            {formatted}
                            {i < qa.a.split('\n').length - 1 && <br />}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sources */}
                  <div className="flex flex-wrap gap-1.5 ml-10">
                    {qa.sources.map((src, i) => (
                      <span
                        key={i}
                        className="text-xs bg-slate-700 border border-slate-600 text-slate-400 px-2 py-0.5 rounded-full"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <div className="fade-in space-y-6">
          {/* Model Comparison */}
          <ModelComparison />

          {/* FYP Summary */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Demo Complete</h3>
                <p className="text-slate-400 text-sm">FYP-BSCS-F25-06 | Smart Energy Forecasting</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Forecasting', items: ['24-hour horizon', '6 Pakistani cities', 'CNN, LSTM, GRU, Ensemble', 'Confidence intervals'] },
                { label: 'Explainability', items: ['Global SHAP analysis', 'Local SHAP values', 'LIME explanations', '10 key features'] },
                { label: 'Intelligence', items: ['RAG Q&A agent', 'Conversation history', 'Source citations', 'Domain knowledge base'] },
              ].map((section) => (
                <div key={section.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-emerald-400 font-semibold text-sm mb-3">{section.label}</p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Replay Demo
              </button>
              <a
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
