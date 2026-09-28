import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "teamflow_training_data.csv"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

MODEL_FILE = os.path.join(
    MODEL_DIR,
    "teamflow_recommender.pkl"
)

FEATURE_FILE = os.path.join(
    MODEL_DIR,
    "feature_columns.pkl"
)

os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# LOAD DATA
# ============================================================

print("\n========================================")
print("TEAMFLOW MODEL TRAINING")
print("========================================")

print("\nLoading dataset...")

df = pd.read_csv(DATA_FILE)

print(f"Dataset shape: {df.shape}")


# ============================================================
# FEATURES
# ============================================================

FEATURE_COLUMNS = [
    "skill_match",
    "skill_proficiency",
    "active_tasks",
    "active_tickets",
    "task_priority",
    "days_until_deadline",
    "completion_rate",
    "on_time_rate",
    "avg_completion_hours",
    "qa_pass_rate",
    "similar_task_success_rate"
]


TARGET_COLUMN = "successful_completion"


# ============================================================
# X AND Y
# ============================================================

X = df[FEATURE_COLUMNS]

y = df[TARGET_COLUMN]


print("\nFeatures:")
for feature in FEATURE_COLUMNS:
    print(f"  - {feature}")

print(f"\nTarget: {TARGET_COLUMN}")


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))


# ============================================================
# RANDOM FOREST
# ============================================================

print("\nTraining Random Forest...")


model = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    random_state=42,
    n_jobs=-1
)


model.fit(
    X_train,
    y_train
)


print("Training complete.")


# ============================================================
# PREDICTIONS
# ============================================================

y_pred = model.predict(X_test)

y_probability = model.predict_proba(X_test)[:, 1]


# ============================================================
# EVALUATION
# ============================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

precision = precision_score(
    y_test,
    y_pred
)

recall = recall_score(
    y_test,
    y_pred
)

f1 = f1_score(
    y_test,
    y_pred
)

roc_auc = roc_auc_score(
    y_test,
    y_probability
)


print("\n========================================")
print("MODEL PERFORMANCE")
print("========================================")

print(f"\nAccuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1 Score  : {f1:.4f}")
print(f"ROC-AUC   : {roc_auc:.4f}")


# ============================================================
# CONFUSION MATRIX
# ============================================================

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        y_pred
    )
)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        y_pred
    )
)


# ============================================================
# FEATURE IMPORTANCE
# ============================================================

importance_df = pd.DataFrame({
    "feature": FEATURE_COLUMNS,
    "importance": model.feature_importances_
})

importance_df = importance_df.sort_values(
    by="importance",
    ascending=False
)


print("\nFeature Importance:")

print(
    importance_df.to_string(index=False)
)


# ============================================================
# SAVE MODEL
# ============================================================

joblib.dump(
    model,
    MODEL_FILE
)


# ============================================================
# SAVE FEATURE COLUMNS
# ============================================================

joblib.dump(
    FEATURE_COLUMNS,
    FEATURE_FILE
)


print("\n========================================")
print("MODEL SAVED")
print("========================================")

print(f"\nModel:")
print(MODEL_FILE)

print("\nFeatures:")
print(FEATURE_FILE)

print("\nTraining finished successfully.")