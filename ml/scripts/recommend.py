import sys
import json
import joblib
import pandas as pd


MODEL_PATH = "ml/models/teamflow_recommender.pkl"
FEATURE_COLUMNS_PATH = "ml/models/feature_columns.pkl"


def main():
    try:
        # JSON input from Node.js
        employees = json.loads(sys.argv[1])

        # Load trained model
        model = joblib.load(MODEL_PATH)

        # Load feature columns
        feature_columns = joblib.load(
            FEATURE_COLUMNS_PATH
        )

        # Build feature rows
        feature_rows = []

        for employee in employees:
            feature_rows.append({
                feature: employee[feature]
                for feature in feature_columns
            })

        # DataFrame in exact training order
        df = pd.DataFrame(
            feature_rows,
            columns=feature_columns
        )

        # Predictions
        predictions = model.predict(df)

        probabilities = model.predict_proba(df)[:, 1]

        recommendations = []

        for i, employee in enumerate(employees):

            probability = round(
                float(probabilities[i]) * 100,
                2
            )

            prediction = (
                "Likely successful completion"
                if predictions[i] == 1
                else "Higher risk of delay/failure"
            )

            recommendations.append({
                "employeeId": employee["employeeId"],
                "successProbability": probability,
                "prediction": prediction,
                "features": {
                    feature: employee[feature]
                    for feature in feature_columns
                }
            })

        # Highest probability first
        recommendations.sort(
            key=lambda x: x["successProbability"],
            reverse=True
        )

        # Add rank
        for index, recommendation in enumerate(
            recommendations,
            start=1
        ):
            recommendation["rank"] = index

        print(json.dumps(recommendations))

    except Exception as error:

        print(
            json.dumps({
                "error": str(error)
            })
        )

        sys.exit(1)


if __name__ == "__main__":
    main()