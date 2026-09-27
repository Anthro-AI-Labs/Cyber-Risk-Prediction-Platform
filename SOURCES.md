# Data sources and citations — ROI Cyber-Validator (data update v3.1)

Every number and mapping in the app falls into one of three groups: **verified data** (from an official dataset), **published figure** (from a named public report), or **sample assumption / model parameter** (clearly labeled, editable).

## 1. Verified datasets

| File | What it provides | Source | License / terms |
|---|---|---|---|
| `MITRE_ATTACK_demo_subset.json` | 4 scenarios, 21 steps, 28 techniques (names, descriptions, links), 115 mitigations, 28 detection strategies, documented threat-group counts | MITRE ATT&CK® Enterprise v19.2 (released 5 Aug 2026), official STIX data: https://github.com/mitre-attack/attack-stix-data | Free to use with attribution. Terms: https://attack.mitre.org/resources/legal-and-branding/terms-of-use/ |
| `ctid_m365_mappings_subset.json` | 179 official mapping rows linking Microsoft 365 security capabilities (Entra ID, Defender, Exchange Online Protection, Purview) to our 28 techniques, with protect/detect/respond category and minimal/partial/significant score | Center for Threat-Informed Defense, Mappings Explorer — M365 mappings, version 07/18/2025 (ATT&CK v16.1): https://ctid.mitre.org/projects/mappings-explorer/ · https://github.com/center-for-threat-informed-defense/mappings-explorer | Apache License 2.0 (see `CTID_MAPPINGS_EXPLORER_LICENSE.txt`) |

Required attribution line (MITRE):
> © 2026 The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation.

Suggested attribution line (CTID):
> Microsoft 365 capability mappings: Center for Threat-Informed Defense, Mappings Explorer (Apache-2.0).

## 2. Published figures used in the calculations

| Value used | Figure | Source |
|---|---|---|
| Invoice fraud (S3) — cost per success: **$123,005** | FBI IC3 reported $3,046,598,558 in business email compromise losses across 24,768 complaints in 2025. $3,046,598,558 ÷ 24,768 = $123,005 average per complaint. | FBI Internet Crime Complaint Center, *2025 Internet Crime Report*: https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf |
| Ransomware (S4) — cost per success: **$1,700,200** | Mean cost to recover from a ransomware attack, excluding any ransom paid (survey of 2,158 organizations). | Sophos, *The State of Ransomware 2026*: https://www.sophos.com/en-us/content/state-of-ransomware |

Caveats:
- The IC3 average is pulled up by a few very large losses; the median is lower.
- The Sophos figure is a mean across all organization sizes and excludes ransom payments.

## 3. Context figure (shown, not used in calculations)

- Global average cost of a data breach: **$4.99M** — IBM *Cost of a Data Breach Report 2026*, released 29 July 2026 (602 organizations). https://newsroom.ibm.com/2026-07-29-ibm-study-one-in-four-malicious-breaches-are-ai-enabled,-costing-companies-6-million-on-average
- Not used for the fictional 400-person company, because IBM's figure covers full multi-record breaches in a mostly large-organization sample and would overstate a single-mailbox incident.

## 4. Tool → technique effects: how each is backed

| Tool | Evidence |
|---|---|
| Second login check (MFA) | **CTID M365 mapping** — Entra ID Multifactor Authentication (EID-MFA-E3): *protect, significant* for T1078.004, T1621, T1110.003, T1110.004, T1098.005. |
| Email Security | MITRE mitigation, plus a comparable **CTID M365 mapping** — Exchange Online Protection Anti-Phishing (EOP-APH-E3) and Antimalware (EOP-AMW-E3): *protect, significant* for T1566.001 / T1566.002. Applies directly if the email security is Microsoft's. |
| EDR, Firewall, SIEM | MITRE mitigations / detection strategies (validated at load time). No CTID mapping exists for generic tools. |
| Tool X; EDR on T1490 | Team assumption — to be validated. |
| Identity Protection Suite | Vendor description — not tested. |
| Payment check by phone | MITRE mitigation "User Training" for T1657. |

Rule used: only CTID rows with category **protect** and score **significant** are treated as "stop". Partial or minimal scores are not counted.

## 5. Still sample assumptions (no public per-company source exists)

- Yearly cost of each tool.
- Attack attempts per year for every scenario.
- Cost per success for fake login page (S1) and password guessing (S2).
- Step pass probabilities (0.20 / 0.60 / 0.95): model parameters.
- Normal-workday alert counts.

All of these are labeled in the app and editable in the Assumptions drawer.
