# ⚡ Eco Forecast

**Smart Energy Consumption Forecasting with Explainable AI**

[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)](https://python.org)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.17-orange?logo=tensorflow)](https://tensorflow.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> FYP-BSCS-F25-06 · The Superior University, Lahore  
> Team: M Saqib Masood (Leader), M Hamza, Laiba Ali

---

## What It Does

Eco Forecast predicts next-day household electricity demand for 6 Pakistani cities using an ensemble of CNN, LSTM, and GRU deep learning models — then explains *why* the model made that prediction using SHAP and LIME, and lets users ask natural-language questions via a RAG-powered Q&A agent backed by Claude AI.

**Key Features:**
- Next-day energy demand forecasting (daily kWh) for Lahore, Karachi, Islamabad, Multan, Peshawar, Skardu
- CNN, LSTM, GRU ensemble achieving R² = 0.934
- Explainability via SHAP (global + local) and LIME
- Live weather integration via Open-Meteo API (free, no key)
- RAG Q&A Agent (LangChain + FAISS + Claude API) for natural-language forecast explanations
- Full dark-theme Next.js dashboard with interactive charts

---

## Model Performance

| Model    | RMSE (kWh) | MAE (kWh) | R²    |
|----------|-----------|-----------|-------|
| CNN      | 0.410     | 0.310     | 0.891 |
| LSTM     | 0.387     | 0.290     | 0.903 |
| GRU      | 0.371     | 0.270     | 0.911 |
| **Ensemble** | **0.312** | **0.240** | **0.934** |

---

## Architecture

```
User → Next.js Frontend (:3000)
         ↓ HTTP/JSON (Axios)
      FastAPI Backend (:8000)
      ├── /api/forecast  →  EnsemblePredictor (CNN + LSTM + GRU)
      ├── /api/xai       →  XAIEngine (SHAP + LIME)
      └── /api/rag       →  RAGEngine (FAISS + Claude API)
                              ↑
                    Open-Meteo Weather API
                    .keras model files
                    REWDP Pakistan dataset
```

---

## Quick Start

### 1. Clone / Navigate to Project

```bash
cd "eco-forecast"
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in your Anthropic API key
cp .env.example .env
# Edit .env and set: ANTHROPIC_API_KEY=your_key_here
```

### 3. Train Models (first time only)

```bash
# From the backend/ directory:

# Step 1 — Preprocess data
python run_preprocessing.py

# Step 2 — Train models (can be done in parallel in separate terminals)
python train_cnn.py
python train_lstm.py
python train_gru.py

# Step 3 — Build RAG knowledge base
python services/populate_rag.py
```

### 4. Run Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 5. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

### 6. One-Command Start (after first-time setup)

```bash
./start.sh
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health + model status |
| GET | `/api/demo` | Hardcoded demo forecast (works offline) |
| POST | `/api/forecast/predict` | Forecast from input sequence |
| POST | `/api/forecast/live` | Forecast using live weather data |
| GET | `/api/forecast/cities` | List supported cities |
| GET | `/api/forecast/models` | Model performance metrics |
| POST | `/api/xai/shap-global` | Global SHAP feature importances |
| POST | `/api/xai/shap-local` | Local SHAP explanation for instance |
| POST | `/api/xai/lime` | LIME local explanation |
| POST | `/api/rag/query` | Natural language Q&A |
| GET | `/api/rag/status` | RAG index status |

---

## Project Structure

```
eco-forecast/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── routers/
│   │   ├── forecast.py            # Forecast endpoints
│   │   ├── xai.py                 # SHAP/LIME endpoints
│   │   └── rag.py                 # RAG Q&A endpoints
│   ├── services/
│   │   ├── data_preprocessor.py   # Data pipeline
│   │   ├── ensemble_predictor.py  # CNN+LSTM+GRU ensemble
│   │   ├── xai_engine.py          # SHAP + LIME engine
│   │   ├── rag_engine.py          # FAISS + Claude RAG
│   │   ├── populate_rag.py        # Build knowledge base
│   │   └── weather_fetcher.py     # Open-Meteo API
│   ├── models/                    # Trained .keras files
│   ├── data/processed/            # processed_data.npz, scaler.pkl
│   ├── rag_index/                 # FAISS index
│   ├── train_cnn.py
│   ├── train_lstm.py
│   ├── train_gru.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router pages
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── forecast/          # Forecast page
│   │   │   ├── explainability/    # SHAP/LIME visualizations
│   │   │   ├── qa-agent/          # RAG chat interface
│   │   │   └── demo/              # Offline demo (for presentation)
│   │   ├── components/            # Reusable UI components
│   │   └── lib/api.ts             # Axios API client
│   └── package.json
├── start.sh                       # One-command launcher
└── README.md
```

---

## Dataset

**REWDP** (Residential Energy and Weather Data Pakistan)
- 6 cities: Lahore, Karachi, Islamabad, Multan, Peshawar, Skardu
- 59 households, ~25,000 hourly rows
- Features: Temperature, Humidity, Solar Radiation, UV Index, Wind Speed, Precipitation, appliance-level consumption
- Target: Total_Daily_kWh (next-day prediction)

---

## Team

| Name | Role |
|------|------|
| M Saqib Masood | Team Leader, ML Pipeline |
| M Hamza | Backend + API |
| Laiba Ali | Frontend + UI/UX |

---

## License

MIT License — The Superior University, Lahore — FYP-BSCS-F25-06
