# Customer Segmentation Personas & Profiles

This document outlines the customer behavioral segments identified via K-Means++ clustering on natural, continuous feature coordinates. 

---

## Behavioral Personas Overview

### Cluster 0: Moderate-Value, Budget-Conscious Users
* **Size**: 1254 customers (22.26% of training set)
* **Average Churn Rate**: **7.10%**
* **Scaled Behavioral Scores**:
  * Tenure: -0.084 (Low tenure)
  * Monthly Charges: -1.404 (Low monthly billing)
  * Ecosystem Services: -1.264 (Low ecosystem lock-in)
* **Description**: Medium-tenure customers paying low-to-moderate monthly charges with moderate ecosystem services. This represents your budget-conscious core user base.
* **Retention Save Play Strategy**: Trigger Auto-Pay conversion and cross-sell technical security add-ons to improve retention friction.

---

### Cluster 1: New Churn-Risk Users
* **Size**: 2402 customers (42.63% of training set)
* **Average Churn Rate**: **40.76%**
* **Scaled Behavioral Scores**:
  * Tenure: -0.369 (Low tenure)
  * Monthly Charges: +0.235 (High monthly billing)
  * Ecosystem Services: -0.056 (Low ecosystem lock-in)
* **Description**: Short-tenure customers with high initial monthly charges, short contract types, and low ecosystem subscription counts. This represents your highest churn-risk group.
* **Retention Save Play Strategy**: Prioritize direct welcome onboarding check-ins, rate audits, and transition them to long-term contract lock-in campaigns.

---

### Cluster 2: High-Value Premium Cohort
* **Size**: 1978 customers (35.11% of training set)
* **Average Churn Rate**: **21.59%**
* **Scaled Behavioral Scores**:
  * Tenure: +0.502 (High tenure)
  * Monthly Charges: +0.605 (High monthly billing)
  * Ecosystem Services: +0.869 (High ecosystem lock-in)
* **Description**: Long-tenure customers with high ecosystem service counts and high monthly billing rates. This is your most valuable premium group.
* **Retention Save Play Strategy**: Ensure high-priority VIP customer support. Check fiber router performance and offer loyalty credits proactively.

---

