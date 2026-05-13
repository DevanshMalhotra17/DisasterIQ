import json
import numpy as np
# pyrefly: ignore [missing-import]
from xgboost import XGBClassifier
# pyrefly: ignore [missing-import]
from features import engineer_features
from seir import run_seir, run_all_diseases, DISEASE_PARAMS
from ml.mock_test import get_mock_climate_inputs

DISEASES = list(DISEASE_PARAMS.keys())
LABEL_MAP = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
LABEL_MAP_INV = {v: k for k, v in LABEL_MAP.items()}
LABEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"]

# Documented historical outbreak severity (CDC/WHO sources).
# Used only for calibration offset reporting — NOT as model accuracy target.
# The model is trained to replicate SEIR outputs; SEIR truth is auto-computed.

# Sources:
#   Harvey   — Harris County PH post-Harvey report (2017); CDC MMWR (2018)
#   Chennai  — WHO Disease Outbreak News Dec 2015; India MoH surveillance

DOCUMENTED_TRUTH = {
    "houston_harvey": {
        "cholera":       "HIGH",
        "dengue":        "LOW",
        "malaria":       "LOW",
        "leptospirosis": "HIGH",     # CDC: confirmed cases; SEIR overshoots to CRITICAL
        "salmonella":    "MODERATE",
    },
    "chennai_floods": {
        "cholera":       "HIGH",
        "dengue":        "MODERATE",
        "malaria":       "MODERATE",
        "leptospirosis": "HIGH",
        "salmonella":    "LOW",
    },
    "normal_baseline": {
        "cholera":       "LOW",
        "dengue":        "LOW",
        "malaria":       "LOW",
        "leptospirosis": "LOW",
        "salmonella":    "LOW",
    },
}


def load_models() -> dict:
    models = {}
    for disease in DISEASES:
        model = XGBClassifier()
        model.load_model(f"ml/models/xgb_{disease}.json")
        models[disease] = model
    return models


def compute_seir_truth(scenarios: list) -> dict:
    """Auto-compute SEIR ground truth by actually running the SEIR model."""
    truth = {}
    for scenario in scenarios:
        climate = get_mock_climate_inputs(scenario)
        features = engineer_features(climate)
        results = run_all_diseases(features)
        truth[scenario] = {d: results[d].risk_label for d in DISEASES}
    return truth


def predict_risk(models: dict, climate: dict) -> dict:
    features = engineer_features(climate)
    vec = features.to_vector().reshape(1, -1)
    predictions = {}
    for disease, model in models.items():
        label_int = int(model.predict(vec)[0])
        proba = model.predict_proba(vec)[0]
        predictions[disease] = {
            "label": LABEL_MAP_INV[label_int],
            "confidence": float(proba.max()),
            "probabilities": {
                LABEL_MAP_INV[i]: float(p)
                for i, p in enumerate(proba)
                if i in LABEL_MAP_INV
            },
        }
    return predictions


def calibration_offset(seir_label: str, documented: str) -> str:
    """How many levels does SEIR over/under-estimate vs documented reality?"""
    diff = LABEL_ORDER.index(seir_label) - LABEL_ORDER.index(documented)
    if diff == 0:   return "exact"
    elif diff > 0:  return f"+{diff} (over)"
    else:           return f"{diff} (under)"


def bootstrap_seir(
    disease_key: str,
    climate: dict,
    n_bootstrap: int = 200,
    noise_scale: float = 0.05,
) -> dict:
    rng = np.random.default_rng(42)
    peak_infecteds, total_infecteds, r0s = [], [], []

    for _ in range(n_bootstrap):
        noisy = climate.copy()
        noisy["temp_c"] += rng.normal(0, noise_scale * 5)
        noisy["humidity_pct"] = np.clip(
            noisy["humidity_pct"] + rng.normal(0, noise_scale * 10), 0, 100
        )
        noisy["rain_1h_mm"] = max(0, noisy["rain_1h_mm"] + rng.normal(0, noise_scale * 10))
        noisy["rain_3h_mm"] = max(0, noisy["rain_3h_mm"] + rng.normal(0, noise_scale * 20))

        features = engineer_features(noisy)
        result = run_seir(disease_key, features)
        peak_infecteds.append(result.peak_infected)
        total_infecteds.append(result.total_infected)
        r0s.append(result.r0)

    def ci(arr):
        arr = np.array(arr)
        return {
            "mean": float(arr.mean()),
            "lower_95": float(np.percentile(arr, 2.5)),
            "upper_95": float(np.percentile(arr, 97.5)),
        }

    return {
        "peak_infected": ci(peak_infecteds),
        "total_infected": ci(total_infecteds),
        "r0": ci(r0s),
    }


def run_evaluation():
    print("Loading trained models...")
    models = load_models()
    print("Models loaded.")

    scenarios = list(DOCUMENTED_TRUTH.keys())

    # Auto-compute SEIR truth — no more hardcoded labels
    print("Computing SEIR ground truth...")
    seir_truth = compute_seir_truth(scenarios)
    print("Done.\n")

    all_results = {}
    correct = 0
    total = 0

    for scenario in scenarios:
        climate = get_mock_climate_inputs(scenario)
        predictions = predict_risk(models, climate)
        s_truth = seir_truth[scenario]
        doc = DOCUMENTED_TRUTH[scenario]

        print(f"\n{'='*74}")
        print(f"Scenario: {scenario}")
        print(f"{'='*74}")
        print(f"  {'Disease':<18} {'Predicted':>10}  {'SEIR Truth':>10}  {'Conf':>6}  {'Match':>5}  {'SEIR vs Docs':>13}")
        print(f"  {'-'*74}")

        scenario_results = {}
        for disease in DISEASES:
            pred  = predictions[disease]["label"]
            conf  = predictions[disease]["confidence"]
            truth = s_truth[disease]
            cal   = calibration_offset(truth, doc[disease])
            match = "YES" if pred == truth else "NO"

            if pred == truth:
                correct += 1
            total += 1

            print(f"  {disease:<18} {pred:>10}  {truth:>10}  {conf:>5.1%}  {match:>5}  {cal:>13}")
            scenario_results[disease] = {
                "predicted": pred,
                "seir_truth": truth,
                "documented_truth": doc[disease],
                "confidence": conf,
                "correct": pred == truth,
                "seir_vs_documented": cal,
            }

        all_results[scenario] = scenario_results

    # Bootstrap CI — Harvey leptospirosis
    print(f"\n{'='*74}")
    print("Bootstrap Confidence Intervals — Harvey Leptospirosis")
    print(f"{'='*74}")
    harvey = get_mock_climate_inputs("houston_harvey")
    ci = bootstrap_seir("leptospirosis", harvey, n_bootstrap=200)
    print(f"  R0:              {ci['r0']['mean']:.2f}  [{ci['r0']['lower_95']:.2f} – {ci['r0']['upper_95']:.2f}] 95% CI")
    print(f"  Peak Infected:   {ci['peak_infected']['mean']:,.0f}  [{ci['peak_infected']['lower_95']:,.0f} – {ci['peak_infected']['upper_95']:,.0f}]")
    print(f"  Total Infected:  {ci['total_infected']['mean']:,.0f}  [{ci['total_infected']['lower_95']:,.0f} – {ci['total_infected']['upper_95']:,.0f}]")

    accuracy = correct / total
    print(f"\n{'='*74}")
    print(f"Model→SEIR Fidelity:   {correct}/{total} ({accuracy:.1%})  ← XGBoost replicating SEIR outputs")
    print(f"SEIR→Reality note: see 'SEIR vs Docs' column — SEIR is a theoretical")
    print(f"  population model; documented counts reflect real intervention effects.")
    print(f"  Calibration against WHO/CDC surveillance data: planned in calibrate.py")
    print(f"{'='*74}")

    output = {
        "model_seir_fidelity": accuracy,
        "correct": correct,
        "total": total,
        "seir_truth_used": seir_truth,
        "scenarios": all_results,
        "bootstrap_harvey_leptospirosis": ci,
        "methodology": (
            "SEIR truth auto-computed by running run_all_diseases() on each scenario. "
            "XGBoost fidelity measures how well the ML model replicates the SEIR simulation. "
            "Documented truth (CDC/WHO) is shown separately as a SEIR calibration reference."
        ),
    }
    with open("ml/models/eval_results.json", "w") as f:
        json.dump(output, f, indent=2)
    print("\nResults saved → ml/models/eval_results.json")

    return output


if __name__ == "__main__":
    run_evaluation()