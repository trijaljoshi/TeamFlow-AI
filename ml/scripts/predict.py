import os
import joblib
import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_FILE = os.path.join(
    BASE_DIR,
    "models",
    "teamflow_recommender.pkl"
)

FEATURE_FILE = os.path.join(
    BASE_DIR,
    "models",
    "feature_columns.pkl"
)


# ============================================================
# LOAD MODEL
# ============================================================

model = joblib.load(MODEL_FILE)

feature_columns = joblib.load(FEATURE_FILE)


# ============================================================
# SAMPLE EMPLOYEE + TASK
# ============================================================

employee = {
    "skill_match": 0.90,
    "skill_proficiency": 3,
    "active_tasks": 2,
    "active_tickets": 0,
    "task_priority": 2,
    "days_until_deadline": 7,
    "completion_rate": 0.88,
    "on_time_rate": 0.91,
    "avg_completion_hours": 24,
    "qa_pass_rate": 0.92,
    "similar_task_success_rate": 0.90
}


# ============================================================
# CREATE DATAFRAME
# ============================================================

input_data = pd.DataFrame(
    [employee],
    columns=feature_columns
)


# ============================================================
# PREDICTION
# ============================================================

prediction = model.predict(input_data)[0]

probability = model.predict_proba(
    input_data
)[0][1]


# ============================================================
# OUTPUT
# ============================================================

print("\n========================================")
print("TEAMFLOW EMPLOYEE RECOMMENDATION TEST")
print("========================================")

print("\nEmployee features:")

for key, value in employee.items():
    print(f"{key}: {value}")

print("\nPrediction:")

if prediction == 1:
    print("Likely successful completion")
else:
    print("Higher risk of unsuccessful completion")

print(
    f"\nSuccess probability: {probability * 100:.2f}%"
)

print("\n========================================")