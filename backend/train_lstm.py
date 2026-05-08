"""
train_lstm.py — Train a stacked LSTM for Smart Energy Consumption Forecasting.

Architecture
------------
LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.1)
-> LSTM(64,  return_sequences=False, dropout=0.2, recurrent_dropout=0.1)
-> Dense(64, relu) -> Dropout(0.3) -> Dense(32, relu) -> Dense(1)

Run from the backend/ directory:
    python train_lstm.py
"""

import os
import numpy as np

import tensorflow as tf
from tensorflow.keras import layers, Model, Input, callbacks

from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "processed", "processed_data.npz")
MODEL_DIR = os.path.join(BASE_DIR, "models")
PLOT_DIR  = os.path.join(BASE_DIR, "plots")
MODEL_OUT = os.path.join(MODEL_DIR, "lstm_model.keras")
PLOT_OUT  = os.path.join(PLOT_DIR,  "lstm_history.png")


# ---------------------------------------------------------------------------
# Model builder
# ---------------------------------------------------------------------------
def build_lstm(input_shape: tuple) -> Model:
    """
    Parameters
    ----------
    input_shape : (window_size, n_features)

    Returns
    -------
    Compiled Keras Model
    """
    inp = Input(shape=input_shape, name="input")

    # Layer 1 — return sequences for stacking
    x = layers.LSTM(
        128,
        return_sequences=True,
        dropout=0.2,
        recurrent_dropout=0.1,
        name="lstm1",
    )(inp)

    # Layer 2 — collapse time dimension
    x = layers.LSTM(
        64,
        return_sequences=False,
        dropout=0.2,
        recurrent_dropout=0.1,
        name="lstm2",
    )(x)

    # Head
    x = layers.Dense(64, activation="relu", name="dense1")(x)
    x = layers.Dropout(0.3, name="dropout1")(x)
    x = layers.Dense(32, activation="relu", name="dense2")(x)
    out = layers.Dense(1, name="output")(x)

    model = Model(inputs=inp, outputs=out, name="LSTM_EnergyForecaster")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae"],
    )
    return model


# ---------------------------------------------------------------------------
# Training entry-point
# ---------------------------------------------------------------------------
def train():
    # ---- Directories -------------------------------------------------------
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(PLOT_DIR,  exist_ok=True)

    # ---- Load data ---------------------------------------------------------
    if not os.path.isfile(DATA_PATH):
        raise FileNotFoundError(
            f"Processed data not found at {DATA_PATH}.\n"
            "Run services/data_preprocessor.py first."
        )

    print(f"Loading data from {DATA_PATH} ...")
    npz = np.load(DATA_PATH, allow_pickle=True)
    X_train = npz["X_train"].astype(np.float32)
    X_test  = npz["X_test"].astype(np.float32)
    y_train = npz["y_train"].astype(np.float32)
    y_test  = npz["y_test"].astype(np.float32)

    print(f"  X_train : {X_train.shape}   y_train : {y_train.shape}")
    print(f"  X_test  : {X_test.shape}    y_test  : {y_test.shape}")

    input_shape = (X_train.shape[1], X_train.shape[2])

    # ---- Build model -------------------------------------------------------
    model = build_lstm(input_shape)
    model.summary()

    # ---- Callbacks ---------------------------------------------------------
    cb_list = [
        callbacks.EarlyStopping(
            monitor="val_loss",
            patience=10,
            restore_best_weights=True,
            verbose=1,
        ),
        callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1,
        ),
        callbacks.ModelCheckpoint(
            filepath=MODEL_OUT,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
    ]

    # ---- Train -------------------------------------------------------------
    history = model.fit(
        X_train, y_train,
        epochs=100,
        batch_size=32,
        validation_split=0.2,
        callbacks=cb_list,
        verbose=1,
    )

    # ---- Evaluate ----------------------------------------------------------
    y_pred = model.predict(X_test, verbose=0).flatten()

    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae  = float(mean_absolute_error(y_test, y_pred))
    r2   = float(r2_score(y_test, y_pred))

    print("\n=== LSTM Test Metrics ===")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  MAE  : {mae:.4f}")
    print(f"  R²   : {r2:.4f}")

    # ---- Save model --------------------------------------------------------
    model.save(MODEL_OUT)
    print(f"\nModel saved -> {MODEL_OUT}")

    # ---- Plot training history ---------------------------------------------
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    fig.suptitle("LSTM Training History", fontsize=14)

    axes[0].plot(history.history["loss"],     label="train loss")
    axes[0].plot(history.history["val_loss"], label="val loss")
    axes[0].set_title("Loss (MSE)")
    axes[0].set_xlabel("Epoch")
    axes[0].legend()
    axes[0].grid(True)

    axes[1].plot(history.history["mae"],     label="train MAE")
    axes[1].plot(history.history["val_mae"], label="val MAE")
    axes[1].set_title("Mean Absolute Error")
    axes[1].set_xlabel("Epoch")
    axes[1].legend()
    axes[1].grid(True)

    plt.tight_layout()
    plt.savefig(PLOT_OUT, dpi=150)
    plt.close()
    print(f"Training plot saved -> {PLOT_OUT}")

    return model, history, {"rmse": rmse, "mae": mae, "r2": r2}


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    train()
