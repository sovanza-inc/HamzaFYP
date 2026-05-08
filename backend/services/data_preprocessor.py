"""
DataPreprocessor — loads raw REWDP + weather CSVs for all Pakistani cities,
merges them, engineers features, and produces sliding-window sequences ready
for CNN / LSTM / GRU training.
"""

import os
import glob
import warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib

warnings.filterwarnings("ignore")


# ---------------------------------------------------------------------------
# Column-name normalisation map
# ---------------------------------------------------------------------------
RENAME_MAP = {
    "Usage (kW)":     "usage_kw",
    "Temperature":    "temperature",
    "Humidity":       "humidity",
    "Dew":            "dew",
    "Precipitation":  "precipitation",
    "Wind Speed":     "wind_speed",
    "Wind Direction": "wind_direction",
    "Pressure":       "pressure",
    "Solar Radiation":"solar_radiation",
    "Solar Energy":   "solar_energy",
    "UV Index":       "uv_index",
}


class DataPreprocessor:
    """
    Handles the full data pipeline from raw CSV files to numpy arrays
    suitable for sequence-to-scalar forecasting.

    Parameters
    ----------
    window_size : int
        Number of consecutive hourly time-steps fed as input to the model.
        Default is 24 (one full day).
    """

    def __init__(self, window_size: int = 24):
        self.window_size = window_size
        self.scaler = MinMaxScaler()
        self.feature_names: list = []
        self.n_features: int = 0

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------

    def load_city_data(
        self,
        rewdp_path: str,
        weather_path: str,
        city: str,
    ) -> pd.DataFrame:
        """
        Load and merge all house CSVs for *city* with the city's weather CSV.

        Parameters
        ----------
        rewdp_path   : str  – base directory of the REWDP dataset
        weather_path : str  – directory that contains ``{City}.csv`` files
        city         : str  – e.g. "Lahore"

        Returns
        -------
        pd.DataFrame  – hourly merged DataFrame with a 'city' column
        """
        city_dir = os.path.join(rewdp_path, city)
        if not os.path.isdir(city_dir):
            raise FileNotFoundError(f"City directory not found: {city_dir}")

        # Collect every CSV in the city folder
        csv_files = glob.glob(os.path.join(city_dir, "*.csv"))
        if not csv_files:
            raise FileNotFoundError(f"No CSV files found in {city_dir}")

        house_frames = []
        for fp in sorted(csv_files):
            try:
                df = pd.read_csv(fp, low_memory=False)
                df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
                df = df.dropna(subset=["datetime"]).sort_values("datetime")
                df = df.set_index("datetime")

                # Resample to hourly — numeric columns only
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                df_hourly = df[numeric_cols].resample("1h").mean()
                house_frames.append(df_hourly)
            except Exception as exc:
                print(f"  [warn] Skipping {fp}: {exc}")

        if not house_frames:
            raise ValueError(f"No usable house data for city '{city}'")

        # Average across all houses at each timestamp
        combined = pd.concat(house_frames, axis=0)
        city_hourly = combined.groupby(combined.index).mean()

        # Keep only the usage column (averaged) — rename for consistency
        usage_col = None
        for col in city_hourly.columns:
            if "usage" in col.lower() or "kw" in col.lower():
                usage_col = col
                break
        if usage_col is None and "Usage (kW)" in city_hourly.columns:
            usage_col = "Usage (kW)"

        keep_cols = [c for c in city_hourly.columns if c == usage_col or "usage" in c.lower()]
        # Fallback: keep the first numeric column if nothing matched
        if not keep_cols:
            keep_cols = [city_hourly.columns[0]]

        city_hourly = city_hourly[keep_cols].copy()
        city_hourly.rename(columns={usage_col: "usage_kw"}, inplace=True)

        # ----- Load weather -----
        weather_file = os.path.join(weather_path, f"{city}.csv")
        if os.path.isfile(weather_file):
            wdf = pd.read_csv(weather_file, low_memory=False)
            wdf["datetime"] = pd.to_datetime(wdf["datetime"], errors="coerce")
            wdf = wdf.dropna(subset=["datetime"]).sort_values("datetime")
            wdf = wdf.set_index("datetime")
            # Weather data is daily — resample to hourly then forward-fill each day's values
            w_numeric = wdf.select_dtypes(include=[np.number]).columns.tolist()
            wdf_hourly = wdf[w_numeric].resample("1h").mean().ffill()

            merged = city_hourly.join(wdf_hourly, how="left")
        else:
            print(f"  [warn] Weather file not found for {city}, skipping weather features.")
            merged = city_hourly

        merged["city"] = city
        return merged

    # ------------------------------------------------------------------

    def preprocess(
        self,
        data_path: str,
        save_path: str,
        weather_path: str = None,
    ):
        """
        Full pipeline: load all cities → merge → clean → feature engineer →
        scale → create sliding windows → 80/20 split → save artefacts.

        Parameters
        ----------
        data_path    : str  – path to the ``rewdp_dataset`` directory
        save_path    : str  – directory where artefacts will be written
        weather_path : str  – directory containing ``{City}.csv`` weather files

        Returns
        -------
        X_train, X_test, y_train, y_test  (numpy arrays)
        """
        os.makedirs(save_path, exist_ok=True)

        cities = ["Lahore", "Karachi", "Multan", "Islamabad", "Peshawar", "Skardu"]
        all_frames = []

        for city in cities:
            print(f"Loading {city}...")
            try:
                df_city = self.load_city_data(data_path, weather_path or "", city)
                all_frames.append(df_city)
                print(f"  -> {len(df_city):,} hourly rows")
            except Exception as exc:
                print(f"  [error] {city}: {exc}")

        if not all_frames:
            raise RuntimeError("No city data could be loaded — check your paths.")

        data = pd.concat(all_frames, axis=0).sort_index()

        # ------------------------------------------------------------------
        # 1. Rename columns to clean names
        # ------------------------------------------------------------------
        data.rename(columns=RENAME_MAP, inplace=True)
        # Generic clean-up for any remaining columns
        data.columns = [
            c.lower().replace(" ", "_").replace("(", "").replace(")", "").strip()
            for c in data.columns
        ]

        # ------------------------------------------------------------------
        # 2. Drop columns with > 70 % NaN
        # ------------------------------------------------------------------
        thresh = int(0.3 * len(data))
        data = data.dropna(axis=1, thresh=thresh)

        # ------------------------------------------------------------------
        # 3. Fill remaining NaN: forward-fill then median
        # ------------------------------------------------------------------
        data = data.ffill()
        for col in data.select_dtypes(include=[np.number]).columns:
            data[col] = data[col].fillna(data[col].median())

        # ------------------------------------------------------------------
        # 4. Ensure usage_kw exists
        # ------------------------------------------------------------------
        if "usage_kw" not in data.columns:
            raise KeyError("'usage_kw' column missing after preprocessing.")

        # ------------------------------------------------------------------
        # 5. Derived target: Total_Daily_kWh (24-h rolling sum, clipped >= 0)
        # ------------------------------------------------------------------
        data["total_daily_kwh"] = (
            data["usage_kw"]
            .rolling(window=24, min_periods=1)
            .sum()
            .clip(lower=0)
        )

        # ------------------------------------------------------------------
        # 6. Time features
        # ------------------------------------------------------------------
        idx = data.index
        data["hour_of_day"]  = idx.hour
        data["day_of_week"]  = idx.dayofweek
        data["month"]        = idx.month
        data["is_weekend"]   = (idx.dayofweek >= 5).astype(int)

        def _season(month):
            if month in (12, 1, 2):
                return 0   # Winter
            elif month in (3, 4, 5):
                return 1   # Spring
            elif month in (6, 7, 8):
                return 2   # Summer
            else:
                return 3   # Fall

        data["season"] = data["month"].map(_season)

        # ------------------------------------------------------------------
        # 7. Lag features
        # ------------------------------------------------------------------
        data["lag_1d"]  = data["usage_kw"].shift(24)
        data["lag_7d"]  = data["usage_kw"].shift(168)

        # ------------------------------------------------------------------
        # 8. Rolling features
        # ------------------------------------------------------------------
        data["rolling_mean_7d"] = data["usage_kw"].rolling(window=168, min_periods=1).mean()
        data["rolling_std_7d"]  = data["usage_kw"].rolling(window=168, min_periods=1).std()

        # ------------------------------------------------------------------
        # 9. Drop rows with NaN introduced by lags/rolling
        # ------------------------------------------------------------------
        data = data.dropna()

        # ------------------------------------------------------------------
        # 10. Select numeric features only (drop 'city' string column)
        # ------------------------------------------------------------------
        if "city" in data.columns:
            data = data.drop(columns=["city"])

        feature_cols = data.select_dtypes(include=[np.number]).columns.tolist()
        # Make sure target is in there
        if "total_daily_kwh" not in feature_cols:
            feature_cols.append("total_daily_kwh")

        data = data[feature_cols]

        # ------------------------------------------------------------------
        # 11. 80 / 20 time-based split
        # ------------------------------------------------------------------
        split_idx = int(len(data) * 0.8)
        train_df  = data.iloc[:split_idx]
        test_df   = data.iloc[split_idx:]

        # ------------------------------------------------------------------
        # 12. Scale (fit on train, transform both)
        # ------------------------------------------------------------------
        train_scaled = self.scaler.fit_transform(train_df.values)
        test_scaled  = self.scaler.transform(test_df.values)

        # Save scaler
        scaler_path = os.path.join(save_path, "scaler.pkl")
        joblib.dump(self.scaler, scaler_path)
        print(f"Scaler saved -> {scaler_path}")

        # Index of target column in the scaled array
        target_idx = feature_cols.index("total_daily_kwh")

        # ------------------------------------------------------------------
        # 13. Sliding windows
        # ------------------------------------------------------------------
        def _make_windows(arr: np.ndarray, window: int, tgt_idx: int):
            X_list, y_list = [], []
            for i in range(window, len(arr)):
                X_list.append(arr[i - window: i, :])   # (window, n_features)
                y_list.append(arr[i, tgt_idx])          # scalar target
            return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.float32)

        X_train, y_train = _make_windows(train_scaled, self.window_size, target_idx)
        X_test,  y_test  = _make_windows(test_scaled,  self.window_size, target_idx)

        # ------------------------------------------------------------------
        # 14. Store metadata and print shapes
        # ------------------------------------------------------------------
        self.feature_names = feature_cols
        self.n_features    = len(feature_cols)

        print(f"\nFeature count : {self.n_features}")
        print(f"X_train shape : {X_train.shape}")
        print(f"y_train shape : {y_train.shape}")
        print(f"X_test  shape : {X_test.shape}")
        print(f"y_test  shape : {y_test.shape}")

        # ------------------------------------------------------------------
        # 15. Save processed data
        # ------------------------------------------------------------------
        npz_path = os.path.join(save_path, "processed_data.npz")
        np.savez(
            npz_path,
            X_train=X_train,
            X_test=X_test,
            y_train=y_train,
            y_test=y_test,
            feature_names=np.array(self.feature_names),
        )
        print(f"Processed data saved -> {npz_path}")

        return X_train, X_test, y_train, y_test


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    REWDP_PATH   = os.path.join(
        os.path.dirname(BASE), "Forcasting", "rewdp_dataset"
    )
    WEATHER_PATH = os.path.join(
        os.path.dirname(BASE), "Forcasting", "weather_dataset"
    )
    SAVE_PATH    = os.path.join(BASE, "data", "processed")

    preprocessor = DataPreprocessor(window_size=24)
    preprocessor.preprocess(
        data_path=REWDP_PATH,
        save_path=SAVE_PATH,
        weather_path=WEATHER_PATH,
    )
