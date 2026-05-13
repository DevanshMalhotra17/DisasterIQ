import numpy as np
from dataclasses import dataclass
from typing import List
from features import PathogenFeatures

@dataclass
class DiseaseParams:
    name: str
    beta_base: float       # base transmission rate (per day)
    sigma: float           # 1 / incubation period (days)
    gamma: float           # 1 / infectious period (days)
    ifr: float             # infection fatality rate
    feature_key: str       # which score from PathogenFeatures drives beta


DISEASE_PARAMS = {
    "cholera": DiseaseParams(
        name="Cholera",
        beta_base=0.25,
        sigma=1/2.0,
        gamma=1/5.0,
        ifr=0.012,
        feature_key="cholera_score",
    ),
    "dengue": DiseaseParams(
        name="Dengue",
        beta_base=0.10,
        sigma=1/6.0,
        gamma=1/7.0,
        ifr=0.001,
        feature_key="dengue_score",
    ),
    "malaria": DiseaseParams(
        name="Malaria",
        beta_base=0.08,
        sigma=1/12.0,
        gamma=1/14.0,
        ifr=0.005,
        feature_key="malaria_score",
    ),
    "leptospirosis": DiseaseParams(
        name="Leptospirosis",
        beta_base=0.25,
        sigma=1/7.0,
        gamma=1/10.0,
        ifr=0.019,
        feature_key="leptospirosis_score",
    ),
    "salmonella": DiseaseParams(
        name="Salmonella",
        beta_base=0.20,
        sigma=1/1.5,
        gamma=1/4.0,
        ifr=0.003,
        feature_key="salmonella_score",
    ),
}

# SEIR simulation

@dataclass
class SEIRResult:
    disease: str
    days: List[int]
    S: List[float]  # Susceptible
    E: List[float]  # Exposed
    I: List[float]  # Infected
    R: List[float]  # Recovered
    peak_infected: float
    peak_day: int
    total_infected: float
    estimated_fatalities: float
    r0: float
    risk_label: str        # LOW / MODERATE / HIGH / CRITICAL


def run_seir(
    disease_key: str,
    features: PathogenFeatures,
    population: int = 500_000,
    days: int = 90,
    initial_exposed: int = 10,
) -> SEIRResult:
    """
    Run SEIR simulation for a given disease and feature set.

    The climate feature score scales beta between 0.1x and 2.5x its base value,
    so a flooded, low-sanitation area will spread disease much faster.
    """
    params = DISEASE_PARAMS[disease_key]
    feature_score = getattr(features, params.feature_key)

    beta_scale = 0.1 + (feature_score * 2.4)
    beta = params.beta_base * beta_scale

    sigma = params.sigma
    gamma = params.gamma

    r0 = beta / gamma

    # Initial conditions (normalized)
    N = population
    E0 = initial_exposed
    I0 = 0
    R0_pop = 0
    S0 = N - E0 - I0 - R0_pop

    S, E, I, R = [S0], [E0], [I0], [R0_pop]

    # Euler integration (daily steps)
    dt = 1.0
    for _ in range(days - 1):
        s, e, i, r = S[-1], E[-1], I[-1], R[-1]

        dS = -beta * s * i / N
        dE = beta * s * i / N - sigma * e
        dI = sigma * e - gamma * i
        dR = gamma * i

        S.append(max(0, s + dS * dt))
        E.append(max(0, e + dE * dt))
        I.append(max(0, i + dI * dt))
        R.append(max(0, r + dR * dt))

    I_arr = np.array(I)
    peak_infected = float(I_arr.max())
    peak_day = int(I_arr.argmax())
    total_infected = float(R[-1])
    estimated_fatalities = total_infected * params.ifr

    # Risk label
    attack_rate = total_infected / N
    if attack_rate < 0.01:
        risk_label = "LOW"
    elif attack_rate < 0.05:
        risk_label = "MODERATE"
    elif attack_rate < 0.20:
        risk_label = "HIGH"
    else:
        risk_label = "CRITICAL"

    return SEIRResult(
        disease=params.name,
        days=list(range(days)),
        S=S, E=E, I=I, R=R,
        peak_infected=peak_infected,
        peak_day=peak_day,
        total_infected=total_infected,
        estimated_fatalities=estimated_fatalities,
        r0=r0,
        risk_label=risk_label,
    )


def run_all_diseases(
    features: PathogenFeatures,
    population: int = 500_000,
    days: int = 90,
) -> dict:
    """Run SEIR for all 5 diseases and return results dict."""
    return {
        key: run_seir(key, features, population, days)
        for key in DISEASE_PARAMS
    }

# CLI

if __name__ == "__main__":
    from data_ingestion import get_mock_climate_inputs
    from features import engineer_features

    for scenario in ["houston_harvey", "chennai_floods", "normal_baseline"]:
        climate = get_mock_climate_inputs(scenario)
        features = engineer_features(climate)
        results = run_all_diseases(features, population=500_000, days=90)

        print(f"\n{'='*55}")
        print(f"Scenario: {scenario}  (pop=500,000, 90-day window)")
        print(f"{'='*55}")
        print(f"  {'Disease':<18} {'R0':>5}  {'Peak Day':>8}  {'Total Infected':>14}  {'Fatalities':>10}  Risk")
        print(f"  {'-'*75}")
        for key, r in results.items():
            print(
                f"  {r.disease:<18} {r.r0:>5.2f}  {r.peak_day:>8}  "
                f"{r.total_infected:>14,.0f}  {r.estimated_fatalities:>10,.0f}  {r.risk_label}"
            )