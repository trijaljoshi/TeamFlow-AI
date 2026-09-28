import os
import numpy as np
import pandas as pd


# ============================================================
# TEAMFLOW SYNTHETIC DATA GENERATOR
# ============================================================

np.random.seed(42)

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

NUM_RECORDS = 10000

# Output path:
# backend/ml/scripts/generate_data.py
#              ↓
# backend/ml/data/teamflow_training_data.csv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "teamflow_training_data.csv")

os.makedirs(DATA_DIR, exist_ok=True)


# ------------------------------------------------------------
# Helper function
# ------------------------------------------------------------

def sigmoid(x):
    return 1 / (1 + np.exp(-x))


# ------------------------------------------------------------
# Generate basic IDs
# ------------------------------------------------------------

employee_ids = np.random.randint(1, 101, NUM_RECORDS)
task_ids = np.arange(1, NUM_RECORDS + 1)


# ------------------------------------------------------------
# Skill match
# 0.0 = no match
# 1.0 = perfect match
# ------------------------------------------------------------

skill_match = np.clip(
    np.random.beta(5, 2, NUM_RECORDS),
    0,
    1
)


# ------------------------------------------------------------
# Skill proficiency
# 0 = beginner
# 1 = intermediate
# 2 = advanced
# 3 = expert
# ------------------------------------------------------------

skill_proficiency = np.random.choice(
    [0, 1, 2, 3],
    size=NUM_RECORDS,
    p=[0.10, 0.30, 0.40, 0.20]
)


# ------------------------------------------------------------
# Current active tasks
# Most employees should have moderate workload
# ------------------------------------------------------------

active_tasks = np.random.poisson(
    lam=3,
    size=NUM_RECORDS
)

active_tasks = np.clip(active_tasks, 0, 10)


# ------------------------------------------------------------
# Active tickets
# Usually lower than active tasks
# ------------------------------------------------------------

active_tickets = np.random.poisson(
    lam=1.2,
    size=NUM_RECORDS
)

active_tickets = np.clip(active_tickets, 0, 6)


# ------------------------------------------------------------
# Task priority
#
# LOW    = 1
# MEDIUM = 2
# HIGH   = 3
# ------------------------------------------------------------

task_priority = np.random.choice(
    [1, 2, 3],
    size=NUM_RECORDS,
    p=[0.20, 0.55, 0.25]
)


# ------------------------------------------------------------
# Days remaining before deadline
# ------------------------------------------------------------

days_until_deadline = np.random.randint(
    1,
    15,
    NUM_RECORDS
)


# ------------------------------------------------------------
# Historical completion rate
#
# Higher skill + lower workload
# generally correlate with better historical performance.
# ------------------------------------------------------------

completion_base = (
    0.55
    + (skill_match * 0.25)
    + (skill_proficiency / 3 * 0.15)
    - (active_tasks / 10 * 0.12)
)

completion_rate = np.clip(
    completion_base + np.random.normal(0, 0.08, NUM_RECORDS),
    0.35,
    1.00
)


# ------------------------------------------------------------
# Historical on-time rate
# ------------------------------------------------------------

on_time_base = (
    0.50
    + (completion_rate * 0.35)
    - (active_tasks / 10 * 0.10)
)

on_time_rate = np.clip(
    on_time_base + np.random.normal(0, 0.08, NUM_RECORDS),
    0.30,
    1.00
)


# ------------------------------------------------------------
# Average task completion time
#
# More workload → slower
# Better skill → faster
# ------------------------------------------------------------

avg_completion_hours = (
    48
    - (skill_match * 18)
    - (skill_proficiency * 4)
    + (active_tasks * 3)
    + np.random.normal(0, 5, NUM_RECORDS)
)

avg_completion_hours = np.clip(
    avg_completion_hours,
    4,
    100
)


# ------------------------------------------------------------
# QA pass rate
# ------------------------------------------------------------

qa_pass_base = (
    0.45
    + (skill_match * 0.25)
    + (skill_proficiency / 3 * 0.15)
    + (completion_rate * 0.10)
)

qa_pass_rate = np.clip(
    qa_pass_base + np.random.normal(0, 0.07, NUM_RECORDS),
    0.30,
    1.00
)


# ------------------------------------------------------------
# Similar task success rate
# ------------------------------------------------------------

similar_task_success_rate = (
    0.40
    + (skill_match * 0.30)
    + (completion_rate * 0.20)
    + (qa_pass_rate * 0.10)
    + np.random.normal(0, 0.06, NUM_RECORDS)
)

similar_task_success_rate = np.clip(
    similar_task_success_rate,
    0.25,
    1.00
)


# ------------------------------------------------------------
# Deadline pressure
#
# High priority + short deadline + high workload
# = more pressure
# ------------------------------------------------------------

deadline_pressure = (
    (1 / days_until_deadline) * 2
    + (task_priority / 3)
    + (active_tasks / 10)
)


# ------------------------------------------------------------
# Calculate probability of successful completion
#
# This is the hidden relationship from which the synthetic
# target is generated.
#
# IMPORTANT:
# We are NOT randomly assigning success/failure.
# ------------------------------------------------------------

score = (
    0.40

    # Skill compatibility
    + ((skill_match - 0.50) * 2.5)

    # Skill proficiency
    + (((skill_proficiency / 3) - 0.50) * 0.7)

    # Historical completion performance
    + ((completion_rate - 0.70) * 1.5)

    # Deadline reliability
    + ((on_time_rate - 0.70) * 1.3)

    # QA performance
    + ((qa_pass_rate - 0.70) * 1.0)

    # Similar task performance
    + ((similar_task_success_rate - 0.70) * 1.2)

    # More days = more breathing room
    + ((days_until_deadline - 7) * 0.10)

    # Workload penalty
    - ((active_tasks - 3) * 0.25)

    # Ticket workload penalty
    - ((active_tickets - 1) * 0.15)

    # Higher priority = slightly more pressure
    - ((task_priority - 2) * 0.25)

    # Slower historical completion = slight penalty
    - ((avg_completion_hours - 30) * 0.01)
)
success_probability = sigmoid(score)
# ------------------------------------------------------------
# Add realistic noise
# ------------------------------------------------------------

success_probability = np.clip(
    success_probability + np.random.normal(
        0,
        0.04,
        NUM_RECORDS
    ),
    0.03,
    0.97
)


# ------------------------------------------------------------
# Generate target
#
# 1 = successful completion
# 0 = unsuccessful completion
# ------------------------------------------------------------

successful_completion = np.random.binomial(
    1,
    success_probability
)


# ------------------------------------------------------------
# Create DataFrame
# ------------------------------------------------------------

df = pd.DataFrame({

    "employee_id": employee_ids,

    "task_id": task_ids,

    "skill_match": np.round(skill_match, 3),

    "skill_proficiency": skill_proficiency,

    "active_tasks": active_tasks,

    "active_tickets": active_tickets,

    "task_priority": task_priority,

    "days_until_deadline": days_until_deadline,

    "completion_rate": np.round(
        completion_rate,
        3
    ),

    "on_time_rate": np.round(
        on_time_rate,
        3
    ),

    "avg_completion_hours": np.round(
        avg_completion_hours,
        2
    ),

    "qa_pass_rate": np.round(
        qa_pass_rate,
        3
    ),

    "similar_task_success_rate": np.round(
        similar_task_success_rate,
        3
    ),

    "successful_completion": successful_completion
})


# ------------------------------------------------------------
# Save CSV
# ------------------------------------------------------------

df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ------------------------------------------------------------
# Print information
# ------------------------------------------------------------

print("\n========================================")
print("TeamFlow Synthetic Dataset Generated")
print("========================================")

print(f"\nRecords: {len(df)}")
print(f"Columns: {len(df.columns)}")

print(f"\nSaved to:")
print(OUTPUT_FILE)

print("\nTarget distribution:")
print(
    df["successful_completion"]
    .value_counts()
    .sort_index()
)

print("\nTarget percentage:")
print(
    df["successful_completion"]
    .value_counts(normalize=True)
    .sort_index()
    .round(3)
)

print("\nFirst 10 rows:")
print(
    df.head(10).to_string(index=False)
)

print("\nDataset information:")
print(df.info())

print("\n========================================")
print("Generation complete!")
print("========================================")