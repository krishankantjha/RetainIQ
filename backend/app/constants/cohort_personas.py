"""Cluster persona labels aligned with ml/artifacts/metrics/kmeans_personas.md."""

from typing import Optional

COHORT_PERSONAS: dict[int, str] = {
    0: "Cluster 0: Moderate-Value, Budget-Conscious Users",
    1: "Cluster 1: New Churn-Risk Users",
    2: "Cluster 2: High-Value Premium Cohort",
}


def get_cohort_persona_name(cluster_id: Optional[int]) -> Optional[str]:
    if cluster_id is None:
        return None
    return COHORT_PERSONAS.get(cluster_id, "N/A")
