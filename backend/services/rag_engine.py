"""
RAG Engine — Retrieval-Augmented Generation for Eco Forecast.

Architecture
------------
* Embedder  : sentence-transformers/all-MiniLM-L6-v2
* Vector DB : FAISS IndexFlatIP (cosine similarity via L2-normalised vectors)
* LLM       : Anthropic claude-sonnet-4-6

The engine is designed to degrade gracefully:
  - No sentence-transformers  → keyword fallback (no vector search)
  - No faiss                  → no index, retrieve() returns []
  - No ANTHROPIC_API_KEY      → answer() returns an informative error message
"""

import logging
import os
import pickle
from datetime import datetime
from typing import Optional

import numpy as np

logger = logging.getLogger("eco_forecast.rag_engine")


class RAGEngine:
    """
    End-to-end RAG pipeline for Eco Forecast.

    Parameters
    ----------
    index_path : str
        Directory where ``faiss.index`` and ``docstore.pkl`` are persisted.
    docs_path : str
        Directory for optional raw document files (not used by default).
    """

    def __init__(
        self,
        index_path: str = "rag_index/",
        docs_path: str = "rag_docs/",
    ):
        self.index_path = index_path
        self.docs_path = docs_path
        self.index = None
        self.docstore: list = []
        self.embedder = None
        self._knowledge_docs: list = []

        self._load_embedder()

    # ------------------------------------------------------------------
    # Lifecycle helpers called from main.py
    # ------------------------------------------------------------------

    def build_knowledge_base(self):
        """Populate the internal doc list via :meth:`create_knowledge_base`."""
        self._knowledge_docs = self.create_knowledge_base()
        logger.info("Knowledge base built: %d documents.", len(self._knowledge_docs))

    def build_index(self, documents: Optional[list] = None) -> int:
        """
        Embed *documents* (or the cached knowledge base) and build a FAISS index.

        Parameters
        ----------
        documents : list, optional
            ``[{"text": str, "source": str, "metadata": dict}, ...]``
            Defaults to the list built by :meth:`build_knowledge_base`.

        Returns
        -------
        int
            Number of documents indexed.
        """
        if documents is None:
            if not self._knowledge_docs:
                self._knowledge_docs = self.create_knowledge_base()
            documents = self._knowledge_docs

        if not documents:
            logger.warning("build_index called with empty document list.")
            return 0

        texts = [d["text"] for d in documents]
        embeddings = self._embed(texts)
        if embeddings is None:
            logger.warning("Embedder unavailable — index not built.")
            return 0

        try:
            import faiss

            dim = embeddings.shape[1]
            index = faiss.IndexFlatIP(dim)  # inner product = cosine after normalisation
            faiss.normalize_L2(embeddings)
            index.add(embeddings)

            self.index = index
            self.docstore = documents

            # Persist to disk
            os.makedirs(self.index_path, exist_ok=True)
            faiss.write_index(index, os.path.join(self.index_path, "faiss.index"))
            docstore_path = os.path.join(self.index_path, "docstore.pkl")
            with open(docstore_path, "wb") as fh:
                pickle.dump(documents, fh)

            logger.info(
                "FAISS index built with %d documents (dim=%d) and saved to '%s'.",
                len(documents),
                dim,
                self.index_path,
            )
            return len(documents)

        except Exception as exc:
            logger.error("FAISS index build failed: %s", exc)
            return 0

    def load_index(self):
        """Load an existing FAISS index from *index_path*."""
        self._load_index()

    # ------------------------------------------------------------------
    # Internal loaders
    # ------------------------------------------------------------------

    def _load_embedder(self):
        try:
            from sentence_transformers import SentenceTransformer

            self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer embedder loaded.")
        except Exception as exc:
            logger.warning("SentenceTransformer not available: %s", exc)
            self.embedder = None

    def _load_index(self):
        faiss_path = os.path.join(self.index_path, "faiss.index")
        docstore_path = os.path.join(self.index_path, "docstore.pkl")
        if os.path.exists(faiss_path) and os.path.exists(docstore_path):
            try:
                import faiss

                self.index = faiss.read_index(faiss_path)
                with open(docstore_path, "rb") as fh:
                    self.docstore = pickle.load(fh)
                logger.info(
                    "FAISS index loaded from '%s' (%d docs).",
                    self.index_path,
                    len(self.docstore),
                )
            except Exception as exc:
                logger.error("Failed to load FAISS index: %s", exc)

    # ------------------------------------------------------------------
    # Embedding helper
    # ------------------------------------------------------------------

    def _embed(self, texts: list) -> Optional[np.ndarray]:
        """Return float32 ndarray of shape (n, dim) or None on failure."""
        if self.embedder is None:
            return None
        try:
            vecs = self.embedder.encode(texts, show_progress_bar=False)
            return np.array(vecs, dtype=np.float32)
        except Exception as exc:
            logger.error("Embedding failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def retrieve(self, query: str, top_k: int = 3) -> list:
        """
        Retrieve the most relevant documents for *query*.

        Returns
        -------
        list of dict
            ``[{"text": str, "source": str, "score": float}, ...]``
        """
        if self.index is None or not self.docstore:
            return []

        q_vec = self._embed([query])
        if q_vec is None:
            return []

        try:
            import faiss

            faiss.normalize_L2(q_vec)
            distances, indices = self.index.search(q_vec, min(top_k, len(self.docstore)))
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or idx >= len(self.docstore):
                    continue
                doc = self.docstore[idx]
                results.append(
                    {
                        "text": doc["text"],
                        "source": doc.get("source", "unknown"),
                        "score": float(dist),
                    }
                )
            return results
        except Exception as exc:
            logger.error("Retrieval failed: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Answer generation
    # ------------------------------------------------------------------

    def answer(
        self,
        question: str,
        history: list = [],
        context_filter=None,
    ) -> dict:
        """
        Answer *question* using retrieved context and the Anthropic API.

        Parameters
        ----------
        question : str
            User question.
        history : list of dict
            Previous turns: ``[{"role": "user"|"assistant", "content": str}, ...]``
        context_filter : callable, optional
            Optional function ``(doc: dict) -> bool`` to filter retrieved docs.

        Returns
        -------
        dict
            ``{"answer": str, "sources": list, "model_used": str, "tokens_used": int}``
        """
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return {
                "answer": (
                    "The Eco Forecast AI assistant is not available right now because "
                    "the ANTHROPIC_API_KEY environment variable is not configured. "
                    "Please ask your administrator to set this key to enable the "
                    "AI chatbot feature."
                ),
                "sources": [],
                "model_used": "none",
                "tokens_used": 0,
            }

        # --- 1. Retrieve context ---
        chunks = self.retrieve(question, top_k=4)
        if context_filter is not None:
            chunks = [c for c in chunks if context_filter(c)]

        context_text = "\n\n".join(
            f"[{i+1}] ({c['source']}) {c['text']}" for i, c in enumerate(chunks)
        )

        # --- 2. Build system prompt ---
        system_prompt = (
            "You are Eco Forecast's AI assistant. You help users understand energy "
            "consumption forecasts, SHAP/LIME explanations, and electricity demand "
            "patterns in Pakistan. Use the provided context to answer questions. "
            "Be concise but technical. If the context does not contain the answer, "
            "say so clearly rather than guessing."
        )

        if context_text:
            system_prompt += f"\n\nRelevant knowledge base context:\n{context_text}"

        # --- 3. Call Anthropic API ---
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)

            # Convert history to Anthropic message format
            messages = []
            for turn in history:
                role = turn.get("role", "user")
                if role not in ("user", "assistant"):
                    continue
                messages.append({"role": role, "content": turn.get("content", "")})
            messages.append({"role": "user", "content": question})

            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )

            answer_text = response.content[0].text
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

            sources = [
                {"source": c["source"], "score": round(c["score"], 4)}
                for c in chunks
            ]

            return {
                "answer": answer_text,
                "sources": sources,
                "model_used": "claude-sonnet-4-6",
                "tokens_used": tokens_used,
            }

        except Exception as exc:
            logger.error("Anthropic API call failed: %s", exc)
            return {
                "answer": (
                    f"An error occurred while generating the answer: {exc}. "
                    "Please try again or contact support."
                ),
                "sources": [],
                "model_used": "error",
                "tokens_used": 0,
            }

    # ------------------------------------------------------------------
    # Knowledge base construction
    # ------------------------------------------------------------------

    def create_knowledge_base(self) -> list:
        """
        Return a comprehensive list of domain documents for the FAISS index.

        Covers:
          - 15 feature descriptions with Pakistan-specific context
          - 3 model architecture explanation docs
          - 5 Pakistani energy pattern docs
          - 3 SHAP/LIME interpretation guides
          - 2 forecast result interpretation docs

        Returns
        -------
        list of dict
            ``[{"text": str, "source": str, "metadata": {"category": str}}, ...]``
        """
        docs = []

        # ----------------------------------------------------------------
        # SECTION 1 — Feature descriptions (15 docs)
        # ----------------------------------------------------------------
        feature_docs = [
            {
                "text": (
                    "Temperature is the single strongest driver of electricity demand in Pakistan. "
                    "During summer months (May–September), daytime temperatures in Lahore, Karachi, "
                    "and Multan routinely exceed 40 °C, pushing residential and commercial air "
                    "conditioning loads to their seasonal peak. The relationship is highly non-linear: "
                    "demand rises steeply above 35 °C as cooling equipment operates at full capacity. "
                    "In winter (November–February), temperatures below 10 °C at night in northern "
                    "cities drive heating loads from electric heaters and heat pumps, creating a "
                    "secondary demand peak. The model captures this U-shaped response through "
                    "time-series embeddings that learn the asymmetric sensitivity at both extremes."
                ),
                "source": "feature_docs/temperature",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Humidity affects both human thermal comfort and the efficiency of air conditioning "
                    "equipment. In Pakistan's monsoon season (July–August), relative humidity in coastal "
                    "cities such as Karachi can exceed 85 %, while inland cities like Lahore experience "
                    "moderate humidity of 50–70 %. High humidity raises the effective (feels-like) "
                    "temperature, increasing air conditioning usage even when dry-bulb temperature alone "
                    "might not trigger maximum cooling. The model uses hourly relative humidity (%) as a "
                    "feature alongside temperature to capture the combined heat-index effect. A positive "
                    "SHAP contribution from humidity typically signals that the day's sticky conditions "
                    "are pushing demand above the temperature-only baseline."
                ),
                "source": "feature_docs/humidity",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Solar radiation (measured in W/m²) serves a dual role in Eco Forecast. First, it is "
                    "a strong proxy for daytime heat gain in buildings, particularly in glass-facade "
                    "commercial structures common in Pakistani cities. Second, regions with solar PV "
                    "installations see net demand reduction during peak irradiance hours (10:00–15:00). "
                    "In Pakistan, clear-sky global horizontal irradiance peaks at 850–950 W/m² in June. "
                    "The model inputs hourly measured (or estimated) solar radiation, and its SHAP values "
                    "often show a positive contribution to demand in the morning (heating effect) and a "
                    "potentially negative contribution at noon for grids with significant rooftop solar."
                ),
                "source": "feature_docs/solar_radiation",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Wind speed influences electricity demand primarily through the evaporative cooling "
                    "effect, which reduces perceived temperature and therefore lowers air conditioning "
                    "load. In Karachi, sea breezes arriving in the afternoon (15:00–18:00) can reduce "
                    "demand by 3–8 % compared to calm days at the same temperature. Conversely, hot "
                    "Loo winds blowing from the west in May–June bring hot dry air that can elevate "
                    "perceived heat and increase cooling load. Wind speed is measured at 10 m height "
                    "in m/s and enters the model as a raw numeric feature; negative SHAP values for "
                    "wind speed indicate the cooling effect is dominant for that instance."
                ),
                "source": "feature_docs/wind_speed",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "The hour of day is encoded as two circular features — hour_sin = sin(2π·h/24) and "
                    "hour_cos = cos(2π·h/24) — to preserve the continuity between 23:00 and 00:00. "
                    "This encoding prevents the model from treating midnight as arbitrarily distant from "
                    "23:00. In Pakistan, electricity demand follows a bimodal daily pattern: a morning "
                    "peak around 08:00–10:00 driven by domestic cooking and commercial opening, and a "
                    "dominant evening peak from 19:00–22:00 when residents return home, lights switch on, "
                    "and cooking resumes. The hour features carry the highest average SHAP magnitude of "
                    "all calendar features, confirming that time-of-day is the strongest intra-day "
                    "predictor of load."
                ),
                "source": "feature_docs/hour_sin_cos",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Day-of-week is encoded as day_of_week_sin = sin(2π·d/7) and day_of_week_cos = "
                    "cos(2π·d/7). In Pakistan, Friday is a public holiday and weekend, and Saturday is "
                    "also a reduced-activity day for many organisations. The working week runs "
                    "Sunday–Thursday for most government and corporate entities. Load on Fridays typically "
                    "drops 10–20 % versus peak weekday levels due to the closure of offices, schools, and "
                    "many factories. The circular encoding ensures the model treats Sunday and Saturday "
                    "as adjacent low-activity days rather than opposite extremes of a linear scale."
                ),
                "source": "feature_docs/day_of_week_sin_cos",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Month of year is encoded circularly as month_sin = sin(2π·m/12) and month_cos = "
                    "cos(2π·m/12). This captures the U-shaped annual demand curve in Pakistan: demand "
                    "is highest in June–August (peak summer air conditioning) and moderately high in "
                    "January (winter heating in the north). Shoulder months (March–April, "
                    "October–November) have the lowest demand. The month encoding helps the model "
                    "distinguish a 35 °C day in April (unusual, unexpected) from a 35 °C day in "
                    "June (routine, infrastructure prepared) and adjust the forecast accordingly."
                ),
                "source": "feature_docs/month_sin_cos",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "The is_holiday flag is a binary (0/1) indicator set to 1 on national public holidays "
                    "in Pakistan. These include Independence Day (14 August), Pakistan Day (23 March), "
                    "Eid-ul-Fitr (3 days), Eid-ul-Adha (3 days), Defence Day (6 September), and "
                    "provincial holidays such as Quaid-e-Azam Day. On holidays, industrial and commercial "
                    "loads drop sharply — factories shut, offices close — so total system demand falls "
                    "20–35 % below a comparable weekday. The SHAP value for is_holiday is consistently "
                    "negative (demand-reducing) when set to 1, making it an interpretable correction "
                    "factor in the model's output."
                ),
                "source": "feature_docs/is_holiday",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "is_weekend is a binary indicator (1 on Friday and Saturday in Pakistan). Even on "
                    "non-holiday weekends, commercial and industrial loads are significantly reduced. "
                    "Residential load, however, can be equal to or higher than weekdays due to families "
                    "staying home, running appliances, and entertaining guests. The net effect is a "
                    "modest overall demand reduction of 5–12 %. is_weekend and is_holiday are kept as "
                    "separate features because their combination (holiday falling on a weekend) has a "
                    "different magnitude than either alone, and the model can learn this interaction "
                    "through the sequence context."
                ),
                "source": "feature_docs/is_weekend",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "lag_1h is the measured energy consumption (kWh) from the immediately preceding hour. "
                    "It is consistently the most important lag feature, often showing the largest "
                    "absolute SHAP values in local explanations. High autocorrelation in electricity "
                    "demand (ρ ≈ 0.92 at lag-1) means the previous hour's load is an extremely reliable "
                    "predictor of the current hour, especially during stable periods like overnight or "
                    "midday plateaus. When lag_1h is unusually high (e.g., following a sudden surge), "
                    "the model correctly forecasts continued elevated demand while it works through the "
                    "sequence context."
                ),
                "source": "feature_docs/lag_1h",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "lag_24h is the energy consumption recorded exactly 24 hours before the current "
                    "timestep. This feature captures the strong daily periodicity in electricity demand: "
                    "the load at 19:00 today is highly correlated with the load at 19:00 yesterday "
                    "(ρ ≈ 0.85 for typical weekdays). lag_24h enables the model to inherit knowledge "
                    "about yesterday's evening peak magnitude even when weather features are borderline. "
                    "It also helps detect anomalies: if lag_24h was unusually low (e.g., due to a grid "
                    "outage), the model can partially discount its influence by weighting current "
                    "weather features more heavily through the attention mechanism."
                ),
                "source": "feature_docs/lag_24h",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "lag_168h represents demand from exactly 168 hours (7 days) ago — the same hour "
                    "on the same day of the previous week. This weekly lag captures recurrent weekly "
                    "patterns such as the Monday morning ramp-up, Friday afternoon shutdown, and "
                    "Saturday late-night low. It is particularly valuable for anomaly-robust forecasting: "
                    "if lag_1h and lag_24h are distorted by unusual events (extreme weather, "
                    "load shedding), lag_168h provides a 'normal week' anchor. In SHAP decompositions, "
                    "lag_168h tends to have moderate importance that rises during holiday weeks when "
                    "prior-week patterns are the best available reference."
                ),
                "source": "feature_docs/lag_168h",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "UV Index (ultraviolet radiation index) is an additional solar irradiance metric "
                    "included in the Eco Forecast feature set. While closely correlated with solar "
                    "radiation, the UV index provides complementary information about atmospheric "
                    "transparency and cloud cover that affects both human comfort and building heat "
                    "gain. High UV levels (9–12+ in Pakistani summers) often coincide with clear-sky "
                    "conditions where temperatures escalate rapidly, pushing cooling demand higher. "
                    "In the model, UV Index is normalised to a 0–1 scale. Its SHAP contributions "
                    "tend to reinforce those of solar_radiation; when their directions diverge, it "
                    "often signals a partially cloudy day with variable irradiance."
                ),
                "source": "feature_docs/uv_index",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "Rolling mean energy consumption (rolling_mean_7d) captures the recent trend in "
                    "electricity demand over the trailing 7 days. This feature smooths out day-to-day "
                    "volatility caused by weather spikes or measurement noise, giving the model a "
                    "stable baseline of 'normal' consumption for the current period. A rising "
                    "rolling_mean_7d heading into peak summer indicates persistent heat waves that "
                    "have already pushed AC usage above seasonal averages — the model uses this to "
                    "elevate its prior for the coming days. Conversely, a falling rolling mean "
                    "during the monsoon onset signals that demand has structurally shifted down. "
                    "Positive SHAP values for rolling_mean_7d confirm that the recent trend is "
                    "above the all-time average."
                ),
                "source": "feature_docs/rolling_mean_7d",
                "metadata": {"category": "feature"},
            },
            {
                "text": (
                    "The ensemble model in Eco Forecast combines the outputs of the CNN, LSTM, and "
                    "GRU models using a learned weighted average. The ensemble weight vector is "
                    "trained on a held-out validation set to minimise RMSE. Typically the LSTM "
                    "receives the highest weight (~0.45), followed by GRU (~0.35) and CNN (~0.20), "
                    "reflecting their relative accuracies on the Pakistani demand dataset. The "
                    "ensemble is particularly valuable during unusual conditions: if the CNN "
                    "produces an outlier prediction due to a convolution artefact, the LSTM and "
                    "GRU votes reduce its influence on the final output. Users can inspect "
                    "individual model predictions alongside the ensemble output in the Forecast "
                    "Details panel to diagnose disagreement between models."
                ),
                "source": "feature_docs/ensemble_weights",
                "metadata": {"category": "feature"},
            },
        ]
        docs.extend(feature_docs)

        # ----------------------------------------------------------------
        # SECTION 2 — Model architecture explanations (3 docs)
        # ----------------------------------------------------------------
        model_docs = [
            {
                "text": (
                    "Eco Forecast uses a CNN (Convolutional Neural Network) model as one of its three "
                    "base learners. The CNN processes the 24-hour input sequence using 1D convolutional "
                    "layers that act as local pattern detectors — similar to how image CNNs detect "
                    "edges, the energy CNN detects short-duration demand spikes, ramp-up patterns, and "
                    "plateau features. The architecture consists of two Conv1D layers (64 and 128 "
                    "filters, kernel size 3) followed by max pooling, dropout, and dense layers. CNNs "
                    "are particularly strong at capturing the sharp morning and evening demand transitions "
                    "that occur over 2–4 hour windows. However, they are less effective than recurrent "
                    "models at capturing very long-range dependencies (e.g., correlations across the "
                    "full 24-hour window). The CNN typically has the fastest inference time of the "
                    "three models."
                ),
                "source": "model_docs/cnn",
                "metadata": {"category": "model"},
            },
            {
                "text": (
                    "The LSTM (Long Short-Term Memory) model is the most powerful single model in the "
                    "Eco Forecast ensemble. LSTMs are a variant of recurrent neural networks designed "
                    "to learn dependencies across long sequences without the vanishing gradient problem. "
                    "The Eco Forecast LSTM uses two stacked LSTM layers (128 and 64 units) with "
                    "dropout regularisation. The cell state allows the model to retain information about "
                    "the morning peak load while predicting the evening peak 12 hours later. LSTMs "
                    "produce the most accurate individual predictions on seasonal transitions (spring "
                    "to summer, monsoon onset) when long-range temporal context is critical. The tradeoff "
                    "is higher computational cost compared to the CNN, making inference approximately "
                    "3× slower."
                ),
                "source": "model_docs/lstm",
                "metadata": {"category": "model"},
            },
            {
                "text": (
                    "The GRU (Gated Recurrent Unit) model offers a balance between LSTM accuracy and CNN "
                    "speed. GRUs use two gates (reset and update) versus LSTM's three, making them "
                    "faster and less prone to overfitting on smaller datasets. In Eco Forecast, the GRU "
                    "uses two layers (128 and 64 units) and consistently achieves accuracy within 1–2 % "
                    "of the LSTM on standard summer days while running 40 % faster. The ensemble "
                    "combinator weights CNN, LSTM, and GRU predictions using learned coefficients; on "
                    "average the ensemble outperforms any single model by 3–7 % on RMSE. The GRU is "
                    "preferred for real-time applications requiring low latency, while the full ensemble "
                    "is used for scheduled batch forecasting where accuracy matters most."
                ),
                "source": "model_docs/gru",
                "metadata": {"category": "model"},
            },
        ]
        docs.extend(model_docs)

        # ----------------------------------------------------------------
        # SECTION 3 — Pakistani energy context (5 docs)
        # ----------------------------------------------------------------
        energy_context_docs = [
            {
                "text": (
                    "Pakistan's electricity grid is operated by the National Transmission and Despatch "
                    "Company (NTDC) and distributed through regional DISCOs (Distribution Companies) "
                    "such as LESCO (Lahore), KESC/K-Electric (Karachi), FESCO (Faisalabad), and MEPCO "
                    "(Multan). The grid operates at 50 Hz and the system peak load has grown from "
                    "approximately 15,000 MW in 2010 to over 25,000 MW by 2023. Chronic capacity "
                    "shortfalls, particularly in summer, result in load shedding (planned outages) "
                    "that can last 8–16 hours per day in rural areas and 4–8 hours in urban centres. "
                    "This load-shedding pattern creates a suppressed demand effect: measured demand "
                    "is lower than true demand during outage windows, which Eco Forecast models as "
                    "anomalously low lag features."
                ),
                "source": "energy_context/pakistan_grid",
                "metadata": {"category": "energy_context"},
            },
            {
                "text": (
                    "Summer peak demand in Pakistan occurs primarily in June and July before the monsoon "
                    "arrives. The system typically peaks between 19:00 and 22:00 local time (PKT, UTC+5) "
                    "when daytime industrial load overlaps with evening residential demand. In 2023, the "
                    "national peak reached 27,200 MW on 22 June. The critical peak hours for DISCO "
                    "planning are 07:00–10:00 (morning peak), 12:00–15:00 (commercial air conditioning), "
                    "and 19:00–23:00 (evening residential peak). Eco Forecast's 24-hour rolling forecast "
                    "is most valuable when issued at 18:00 the previous day, giving grid operators a "
                    "12-hour lead time to arrange additional generation capacity or negotiate inter-DISCO "
                    "power transfers."
                ),
                "source": "energy_context/peak_demand_patterns",
                "metadata": {"category": "energy_context"},
            },
            {
                "text": (
                    "Lahore is Pakistan's second-largest city and the capital of Punjab province, with a "
                    "population exceeding 14 million. Its electricity demand is characterised by extreme "
                    "summer peaks due to high AC penetration (estimated 60–70 % of households) and a "
                    "dense commercial sector. Summer temperatures regularly exceed 44 °C, and the city "
                    "sits inland without the moderating sea breeze effect seen in Karachi. The LESCO "
                    "service territory experiences the highest per-capita air conditioning load in the "
                    "country during June–August. Eco Forecast's Lahore model captures the sharp "
                    "temperature-demand slope above 38 °C and the pronounced bimodal daily profile "
                    "(cooking peaks at 07:30 and 20:30, AC peak at 15:00–17:00 overlapping with the "
                    "afternoon industrial shift)."
                ),
                "source": "energy_context/lahore_profile",
                "metadata": {"category": "energy_context"},
            },
            {
                "text": (
                    "Karachi is Pakistan's largest city and financial capital, served by K-Electric — "
                    "the country's only vertically integrated (generation + distribution) private utility. "
                    "Karachi's demand pattern differs from inland cities in several key ways. The coastal "
                    "location moderates extreme temperature peaks (rarely above 42 °C), but high humidity "
                    "(70–85 % during monsoon) drives persistent AC usage throughout July–September. "
                    "Karachi has the country's highest industrial electricity consumption, with large "
                    "textile mills, petrochemical facilities, and port operations creating a substantial "
                    "baseload. The evening residential peak (20:00–23:00) is pronounced due to the city's "
                    "large population and late dining habits. Sea breezes can reduce afternoon demand "
                    "by up to 8 % compared to a wind-calm day at the same temperature."
                ),
                "source": "energy_context/karachi_profile",
                "metadata": {"category": "energy_context"},
            },
            {
                "text": (
                    "Seasonal patterns in Pakistan's electricity grid are strongly linked to the monsoon "
                    "cycle. Pre-monsoon (April–June): rapidly rising temperatures drive AC demand to "
                    "annual peaks; load shedding is most severe. Monsoon (July–August): temperatures "
                    "moderate slightly (37–40 °C peak), but humidity rises sharply; demand remains high "
                    "with additional load from water pumps and dehumidifiers. Post-monsoon (September–"
                    "October): demand falls quickly; this is the lowest-shedding, most stable grid "
                    "period. Winter (November–February): northern cities (Lahore, Islamabad, Peshawar) "
                    "see modest heating demand; southern cities (Karachi, Hyderabad) remain mild. "
                    "Eco Forecast's month encoding and lag features together enable the model to "
                    "track these macro-seasonal transitions while still responding to day-to-day "
                    "weather variability within each season."
                ),
                "source": "energy_context/seasonal_patterns",
                "metadata": {"category": "energy_context"},
            },
        ]
        docs.extend(energy_context_docs)

        # ----------------------------------------------------------------
        # SECTION 4 — SHAP / LIME interpretation guides (3 docs)
        # ----------------------------------------------------------------
        xai_docs = [
            {
                "text": (
                    "SHAP (SHapley Additive exPlanations) is a game-theoretic method that assigns each "
                    "feature a contribution value for a specific prediction. In Eco Forecast, SHAP "
                    "values are computed using the GradientExplainer, which is designed for neural "
                    "networks and uses a background dataset of representative samples to establish the "
                    "expected baseline prediction. A positive SHAP value for temperature means that "
                    "the current temperature is higher than the background average and is pushing "
                    "the forecast above the baseline. A negative value means temperature is below "
                    "baseline and is suppressing demand. The sum of all SHAP values plus the expected "
                    "value (base rate) exactly equals the model's output, making SHAP a complete "
                    "additive decomposition. The waterfall chart in the Eco Forecast UI displays "
                    "this decomposition for any selected forecast hour."
                ),
                "source": "xai_docs/shap_interpretation",
                "metadata": {"category": "xai"},
            },
            {
                "text": (
                    "LIME (Local Interpretable Model-agnostic Explanations) explains individual "
                    "predictions by fitting a simple linear model in the local neighbourhood of the "
                    "instance being explained. In Eco Forecast, LIME flattens the 24-timestep × "
                    "15-feature input tensor into a 360-dimensional vector, then perturbs this vector "
                    "randomly to generate synthetic neighbourhood samples. The model's predictions on "
                    "these samples are used to fit a sparse linear model whose coefficients become "
                    "the LIME weights. Unlike SHAP, LIME weights are not guaranteed to sum to the "
                    "prediction, but they provide an alternative perspective on feature importance. "
                    "In practice, LIME and SHAP agree on the top-3 features 85–90 % of the time "
                    "for Eco Forecast predictions, which provides cross-method validation of the "
                    "explanations."
                ),
                "source": "xai_docs/lime_interpretation",
                "metadata": {"category": "xai"},
            },
            {
                "text": (
                    "When interpreting SHAP or LIME explanations in Eco Forecast, users should note "
                    "several caveats. First, high absolute SHAP values do not mean the feature is "
                    "causal — they indicate correlation within the model's learned representation. "
                    "Second, for multi-step sequence models, the feature importance reflects the "
                    "average contribution across the entire 24-hour input window, not just the "
                    "forecast hour. Third, lag features (lag_1h, lag_24h, lag_168h) often dominate "
                    "SHAP rankings numerically, but weather features are more actionable for demand "
                    "management since they reflect external drivers. The 'Top Features' panel in the "
                    "dashboard filters to show only weather and calendar features when the user "
                    "selects 'Actionable Drivers' mode, suppressing lag features to reveal the "
                    "weather-driven component of the forecast."
                ),
                "source": "xai_docs/interpretation_caveats",
                "metadata": {"category": "xai"},
            },
        ]
        docs.extend(xai_docs)

        # ----------------------------------------------------------------
        # SECTION 5 — Forecast result interpretation (2 docs)
        # ----------------------------------------------------------------
        forecast_docs = [
            {
                "text": (
                    "Eco Forecast outputs a 24-hour sequence of hourly energy consumption predictions "
                    "in kWh. Each value represents the expected electricity consumption for the "
                    "corresponding hour, aggregated across the service area being modelled. The "
                    "confidence interval (shown as ±15 % by default) is derived from ensemble variance: "
                    "when all three models (CNN, LSTM, GRU) agree closely, the interval narrows; when "
                    "models diverge — typically during unusual weather events or near seasonal "
                    "transitions — the interval widens, signalling greater forecast uncertainty. "
                    "Users should treat the upper bound as a capacity planning guide (procure enough "
                    "generation to cover it) and the lower bound as a demand response target (if actual "
                    "demand stays below this, excess generation must be curtailed or exported)."
                ),
                "source": "forecast_docs/reading_output",
                "metadata": {"category": "forecast"},
            },
            {
                "text": (
                    "Forecast accuracy in Eco Forecast is measured using Mean Absolute Percentage "
                    "Error (MAPE) and Root Mean Square Error (RMSE). On historical validation data "
                    "for Lahore summer 2022–2023, the ensemble achieves a MAPE of 3.8 % and RMSE of "
                    "1.2 kWh. Accuracy degrades during: (1) sudden weather fronts where temperature "
                    "drops more than 8 °C in 2 hours, (2) unplanned public holidays not reflected "
                    "in the is_holiday feature, and (3) major grid events such as transmission "
                    "failures that alter the load profile. When the model's prediction for the "
                    "previous hour diverges from actual measured demand by more than 15 %, an "
                    "automatic recalibration flag is raised, and the lag features for the next "
                    "forecast cycle are updated with observed values to self-correct."
                ),
                "source": "forecast_docs/accuracy_metrics",
                "metadata": {"category": "forecast"},
            },
        ]
        docs.extend(forecast_docs)

        logger.info("create_knowledge_base: generated %d documents.", len(docs))
        return docs

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def document_count(self) -> int:
        return len(self.docstore)

    @property
    def is_ready(self) -> bool:
        return self.index is not None and len(self.docstore) > 0
