"""
Run this script ONCE before training to preprocess the raw REWDP datasets.
It reads from the Forcasting/ directory and writes processed_data.npz + scaler.pkl
into data/processed/.

Usage (from backend/ directory):
    python run_preprocessing.py
"""

import os
import sys

# Resolve paths relative to this file
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))  # Desktop/Hamza FYP/

# Raw data paths — adjust if your Forcasting/ folder is elsewhere
REWDP_PATH = os.path.join(PROJECT_ROOT, "Forcasting", "rewdp_dataset")
WEATHER_PATH = os.path.join(PROJECT_ROOT, "Forcasting", "weather_dataset")
SAVE_PATH = os.path.join(BACKEND_DIR, "data", "processed")

# Validate paths
for path, name in [(REWDP_PATH, "REWDP dataset"), (WEATHER_PATH, "Weather dataset")]:
    if not os.path.exists(path):
        print(f"ERROR: {name} not found at: {path}")
        print("Please update REWDP_PATH and WEATHER_PATH in this script.")
        sys.exit(1)

os.makedirs(SAVE_PATH, exist_ok=True)

print(f"REWDP data:   {REWDP_PATH}")
print(f"Weather data: {WEATHER_PATH}")
print(f"Output:       {SAVE_PATH}")
print()

from services.data_preprocessor import DataPreprocessor

dp = DataPreprocessor(window_size=24)
X_train, X_test, y_train, y_test = dp.preprocess(
    data_path=REWDP_PATH,
    save_path=SAVE_PATH,
    weather_path=WEATHER_PATH,
)

print()
print("Preprocessing complete.")
print(f"  X_train: {X_train.shape}")
print(f"  X_test:  {X_test.shape}")
print(f"  Features ({dp.n_features}): {dp.feature_names}")
print()
print(f"Saved to: {SAVE_PATH}")
