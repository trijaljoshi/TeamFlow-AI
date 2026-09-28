import os
import pandas as pd


# ------------------------------------------------------------
# Locate dataset
# ------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_FILE = os.path.join(
    BASE_DIR,
    "data",
    "teamflow_training_data.csv"
)


# ------------------------------------------------------------
# Load dataset
# ------------------------------------------------------------

df = pd.read_csv(DATA_FILE)


print("\n========================================")
print("TEAMFLOW DATASET CHECK")
print("========================================")


# ------------------------------------------------------------
# Basic information
# ------------------------------------------------------------

print("\nDataset shape:")
print(df.shape)


# ------------------------------------------------------------
# Missing values
# ------------------------------------------------------------

print("\nMissing values:")
print(df.isnull().sum())


# ------------------------------------------------------------
# Target distribution
# ------------------------------------------------------------

print("\nTarget distribution:")
print(
    df["successful_completion"]
    .value_counts()
)


# ------------------------------------------------------------
# Target percentage
# ------------------------------------------------------------

print("\nTarget percentage:")
print(
    (
        df["successful_completion"]
        .value_counts(normalize=True) * 100
    ).round(2)
)


# ------------------------------------------------------------
# Numerical statistics
# ------------------------------------------------------------

print("\nNumerical statistics:")
print(
    df.describe().round(3)
)


# ------------------------------------------------------------
# Compare successful vs unsuccessful cases
# ------------------------------------------------------------

print("\nAverage features by outcome:")

comparison = df.groupby(
    "successful_completion"
)[
    [
        "skill_match",
        "skill_proficiency",
        "active_tasks",
        "active_tickets",
        "days_until_deadline",
        "completion_rate",
        "on_time_rate",
        "avg_completion_hours",
        "qa_pass_rate",
        "similar_task_success_rate"
    ]
].mean()

print(comparison.round(3))


print("\n========================================")
print("DATASET CHECK COMPLETE")
print("========================================")
