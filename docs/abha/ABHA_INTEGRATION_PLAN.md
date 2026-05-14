# ABHA Integration Plan — MedPilot

> **Sensitivity: HIGH**
> ABHA handles national health identity and patient health records.
> Every design decision in this plan must treat patient data as sovereign,
> consent-gated, and encrypted at every boundary.

---

## What We Are Building

MedPilot will become a fully ABDM-compliant **Health Information Provider (HIP)**
and optionally a **Health Information User (HIU)**. This means:

- Patients can create or link their ABHA number inside MedPilot
- Every clinical record (prescription, lab, consultation) becomes a
  consent-gated FHIR health document linked to the patient's ABHA
- Patients can pull records from other facilities into their MedPilot timeline
- All data exchange happens over the ABDM gateway with end-to-end encryption

---

## Milestone Overview

| # | Milestone | Description | Depends On | Status |
|---|-----------|-------------|------------|--------|
| M1 | Foundation + ABHA Identity | ABDM sandbox, certs, Aadhaar enrollment, verification flows | — | ✅ Complete |
| M2 | ABHA UI on Patient Profile | Angular ABHA section — create, verify, card download | M1 | 🔄 Next |
| M3 | Care Context & Linking | Attach clinical visits to patient's ABHA | M2 | ⬜ Pending |
| M4 | Consent Management | Request, store, revoke, and audit consent artefacts | M3 | ⬜ Pending |
| M5 | HIP — Record Push | Generate FHIR bundles and push to ABHA locker | M4 | ⬜ Pending |
| M6 | HIU — Record Fetch | Pull records from other facilities with consent | M4 | ⬜ Pending |
| M7 | Security Hardening | Encryption audit, penetration test, DPDP compliance | M5, M6 | ⬜ Pending |
| M8 | Production Go-Live | NHA approval, cert rotation, monitoring | M7 | ⬜ Pending |

---

## M1 — Foundation & ABHA Identity ✅ COMPLETE (2026-05-14)

### What Was Delivered
- ABDM sandbox credentials (`SBXID_035131`) configured and working
- Redis installed for OTP session state and gateway token caching
- `AbdmModule` with full V3 API alignment (REQUEST-ID header, V3 session endpoint, X-CM-ID)
- `AbhaEncryptionService` — RSA/ECB/OAEPWithSHA-1AndMGF1Padding using live ABDM public cert
- `AbhaSessionService` — HMAC-signed, Redis-backed OTP sessions with rate limiting
- `AbhaIdentityService` — 2-step enrollment (initiate OTP → enroll), verification flow
- Patient entity extended with ABHA columns (`abhaNumber`, `abhaAddress`, `abhaVerified`, etc.)
- All M1 NHA test cases verified end-to-end in sandbox

### Goals (original)
- Register MedPilot as a Health Information Provider (HIP) with the NHA
- Set up sandbox and production ABDM credentials
- Establish certificate infrastructure

### Tasks

#### 1.1 NHA Registration
- Register on the ABDM sandbox portal (`sandbox.abdm.gov.in`)
- Obtain `clientId` and `clientSecret` for gateway authentication
- Complete HIP onboarding form (facility details, specialisation, operator contacts)
- Register each clinic as a sub-HIP with a unique `hipId`

#### 1.2 Certificate Management
- Generate RSA-2048 or EC P-256 X.509 key pairs per clinic
- Store private keys in a **secrets manager** (AWS Secrets Manager / HashiCorp Vault) — never in DB or codebase
- Register public key with ABDM gateway
- Implement certificate rotation (keys expire every 12 months)

#### 1.3 Backend Infrastructure
- New NestJS module: `AbdmModule`
- Environment-segregated config: `sandbox` / `production` base URLs, credentials
- Gateway token cache: fetch short-lived ABDM access tokens, cache with TTL
- Webhook endpoint: `POST /api/v1/abdm/callback` (gateway pushes events here)
- Request signing middleware: every outgoing ABDM call must carry signed headers

#### 1.4 Sandbox Testing Environment
- Dedicated sandbox clinic seeded in DB (flag: `isAbdmSandbox: true`)
- All ABHA operations against this clinic route to sandbox gateway
- Sandbox never touches real patient data

### Security Checklist
- [ ] No credentials committed to git (use `.env` + secrets manager)
- [ ] Callback endpoint requires HMAC signature validation from gateway
- [ ] Separate DB schema / table prefix for all ABDM data
- [ ] All ABDM API calls logged with request/response hash (no PII in logs)

---

## M2 — ABHA UI on Patient Profile 🔄 IN PROGRESS

### Goals
- Angular ABHA section on the patient profile page
- Staff can initiate create/verify flows directly from the patient record
- ABHA status badge, masked number display, and card download button

### What's Already Done (from M1)
- All backend API endpoints live and tested
- Patient entity has ABHA columns

### Remaining Work

#### 2.1 Patient Profile — ABHA Section (Angular)
- ABHA status card on patient profile: shows badge (Verified / Not Linked)
- **Create ABHA flow**: modal → enter Aadhaar → OTP entry (60s countdown) → success
- **Verify ABHA flow**: modal → enter ABHA number → OTP entry → links to patient record
- **Download ABHA card**: button → downloads PNG inline
- Masked ABHA number display: `XX-XXXX-XXXX-3500`
- ABHA address display: `vinay@sbx`

#### 2.2 Role Guards (UI)
- Admin + Doctor: full access (create, verify, download card, unlink)
- Receptionist: can initiate create/verify, cannot unlink

#### 2.3 OTP Modal UX
- 60-second countdown timer with auto-dismiss
- Resend OTP button (appears after 30s)
- 3-attempt limit with clear error message
- Spinner + disabled submit during API call

### Security Checklist
- [ ] Aadhaar number is **never stored** — only last 4 digits for display
- [ ] ABHA number encrypted at rest (AES-256, per-clinic key)
- [ ] OTP flows have server-side rate limiting (max 3 attempts per 10 min)
- [ ] txnId is single-use and has TTL
- [ ] Audit log entry for every ABHA create/link/view action

---

## M2-old — Patient ABHA Identity (original plan, superseded)

### Goals (original — now moved to M1 backend completion)
- Let clinic staff create a new ABHA number for a patient
- Let patients link an existing ABHA number to their profile
- Store ABHA number securely on the patient record

### Flows

#### 2.1 Create ABHA via Aadhaar OTP
```
1. Staff enters patient Aadhaar (last 4 digits verified, full number never stored)
2. NHA sends OTP to patient's Aadhaar-linked mobile
3. Patient provides OTP to staff
4. ABDM API: POST /v1/registration/aadhaar/generateOtp
5. ABDM API: POST /v1/registration/aadhaar/verifyOtp  → returns txnId
6. ABDM API: POST /v1/registration/aadhaar/createHealthId → returns ABHA number
7. Store encrypted ABHA number on Patient record
```

#### 2.2 Create ABHA via Mobile OTP (no Aadhaar)
```
1. Patient's mobile number used (already in MedPilot profile)
2. ABDM API: POST /v1/registration/mobile/generateOtp
3. ABDM API: POST /v1/registration/mobile/verifyOtp
4. Collect name, DOB, gender → ABDM API: POST /v1/registration/mobile/createHealthId
5. Store encrypted ABHA number
```

#### 2.3 Link Existing ABHA
```
1. Patient provides ABHA number or ABHA address (name@abdm)
2. ABDM API: POST /v2/patients/profile/share → patient receives consent OTP on ABHA app
3. Patient confirms on ABHA app or provides OTP
4. Store and mark as verified
```

### Data Model Changes

```typescript
// Add to Patient entity
abhaNumber:        string | null  // AES-256 encrypted, 14-digit
abhaAddress:       string | null  // e.g. name@abdm — encrypted
abhaVerified:      boolean
abhaKycType:       'aadhaar' | 'mobile' | null
abhaLinkedAt:      Date | null
abhaConsentTxnId:  string | null  // last txnId from ABDM
```

### UI Changes
- Patient profile card: ABHA section (create / link / status badge)
- OTP entry modal — time-limited (90 seconds), auto-dismiss on expiry
- ABHA number displayed masked: `XX-XXXX-XXXX-1234`
- Staff role guard: only `admin` and `doctor` can initiate ABHA flows

### Security Checklist
- [ ] Aadhaar number is **never stored** — only last 4 digits for display
- [ ] ABHA number encrypted at rest (AES-256, per-clinic key)
- [ ] OTP flows have server-side rate limiting (max 3 attempts per 10 min)
- [ ] txnId is single-use and has TTL
- [ ] Audit log entry for every ABHA create/link/view action

---

## M3 — Care Context & Linking

### Goals
- Every patient visit in MedPilot becomes a "care context" in ABDM
- Link care contexts to the patient's ABHA so they appear in their health timeline

### What is a Care Context?
A care context is a pointer from ABDM to a specific record in MedPilot.
It contains: `referenceNumber` (our visit ID), `display` (human label), `hiTypes` (list of record types).

### Tasks

#### 3.1 Care Context Creation
- On appointment completion / prescription save / lab result:
  - Auto-create care context record in DB
  - Queue an async job to register it with ABDM gateway
- ABDM API: `POST /v0.5/links/link/add-contexts`

#### 3.2 Patient Discovery
When a patient walks into the clinic without a known ABHA link:
- ABDM may push a discovery request: `POST /v0.5/care-contexts/discover`
- MedPilot must respond with matched patient + their care contexts
- Match on: name + DOB + gender + (mobile OR ABHA)
- Strict fuzzy matching — do not expose records without strong match

#### 3.3 Care Context Types (hiTypes)
| MedPilot Record | ABDM hiType |
|----------------|-------------|
| Prescription | `Prescription` |
| Lab Order + Result | `DiagnosticReport` |
| Consultation Note | `DischargeSummary` or `OPConsultation` |
| Immunisation | `ImmunizationRecord` |

### Data Model — New Table: `abha_care_contexts`
```
id, patientId, visitId, referenceNumber, display,
hiTypes[], linkedAt, status (pending/linked/failed), clinicId
```

### Security Checklist
- [ ] Discovery endpoint validates gateway HMAC before processing
- [ ] Discovery response never includes more data than minimal identifiers
- [ ] All care context registrations are idempotent (safe to retry)
- [ ] Failed links are retried with exponential backoff (max 3 attempts)

---

## M4 — Consent Management

### Goals
- Patients (or the gateway on their behalf) request consent to access records
- MedPilot stores consent artefacts and gates all record access behind them
- Consent can be revoked — MedPilot must honour revocation immediately

### Consent Artefact Fields
```
consentId, patientAbha, requesterNid (HIU id), purpose, dateRange,
hiTypes[], expiry, signature (gateway-signed), status (granted/revoked/expired)
```

### Consent Flows

#### 4.1 Consent Request (push from gateway)
```
Gateway → POST /abdm/callback/consent/request
MedPilot: validate signature → store artefact → notify doctor/admin
```

#### 4.2 Consent Granted
```
Gateway → POST /abdm/callback/consent/notify (GRANTED)
MedPilot: update artefact status → enable record push for this HIU
```

#### 4.3 Consent Revoked
```
Gateway → POST /abdm/callback/consent/notify (REVOKED)
MedPilot: immediately mark artefact REVOKED → block any further data push
Log the revocation with timestamp
```

### UI — Consent Dashboard (Admin/Doctor only)
- List of all consent requests for clinic patients
- Columns: Patient, HIU Name, Purpose, Record Types, Date Range, Status, Expiry
- Actions: View detail, flag suspicious requests
- Filters: status, date, patient name

### Security Checklist
- [ ] Every consent callback validated against gateway public key signature
- [ ] Consent artefacts stored with tamper-evident hash
- [ ] Revocation takes effect within 1 request cycle (no lazy revocation)
- [ ] Consent purpose codes validated against ABDM allowed list
- [ ] Consent expiry enforced server-side — expired artefacts auto-blocked
- [ ] Suspicious patterns (bulk consents, unusual HIU) trigger admin alert

---

## M5 — HIP: Health Record Push

### Goals
- When a HIU requests data under valid consent, MedPilot packages the
  clinical records as FHIR R4 bundles and pushes them through the gateway
- Data is encrypted with the requesting HIU's public key before sending

### FHIR Resource Mapping

| MedPilot Entity | FHIR Resource |
|-----------------|---------------|
| Patient | `Patient` |
| Doctor | `Practitioner` |
| Clinic | `Organization` |
| Prescription + Medications | `MedicationRequest` bundle |
| Lab Order | `ServiceRequest` |
| Lab Result | `DiagnosticReport` + `Observation` |
| Consultation Note | `DocumentReference` |
| Vital Signs | `Observation` |

### Data Push Flow
```
1. Gateway: POST /abdm/callback/health-info/request  (contains consent artefact)
2. MedPilot: validate consent → check expiry, revocation, hiTypes, dateRange
3. Fetch matching records from DB
4. Generate FHIR R4 bundles (structured JSON)
5. Encrypt bundle with HIU public key (ECDH key exchange)
6. POST to gateway data push URL with encrypted payload
7. Log push: consentId, recordCount, timestamp, hash of payload
```

### FHIR Bundle Structure (example — Prescription)
```json
{
  "resourceType": "Bundle",
  "type": "document",
  "entry": [
    { "resource": { "resourceType": "Composition", ... } },
    { "resource": { "resourceType": "Patient", ... } },
    { "resource": { "resourceType": "Practitioner", ... } },
    { "resource": { "resourceType": "MedicationRequest", ... } }
  ]
}
```

### Security Checklist
- [ ] Validate consent artefact signature before generating any FHIR data
- [ ] Re-validate consent is not revoked/expired at push time (not just at request time)
- [ ] FHIR bundles never logged or cached — generated on-demand, pushed, discarded
- [ ] Encryption uses HIU's public key from ABDM key registry — never hardcoded
- [ ] Each push has a unique transaction ID logged with audit trail
- [ ] Rate limit: max data pushes per consent artefact

---

## M6 — HIU: Health Record Fetch

### Goals
- Doctors can request records from other facilities where the patient has been seen
- Fetched records are displayed in a unified patient timeline inside MedPilot
- All fetches require explicit patient consent flow

### Fetch Flow
```
1. Doctor clicks "Fetch records from other facilities" on patient profile
2. MedPilot creates consent request → POST /v0.5/consent-requests/init
3. Patient receives notification on ABHA app → approves
4. Gateway pushes consent artefact to MedPilot callback
5. MedPilot requests health data: POST /v0.5/health-information/cm/request
6. External HIP encrypts and pushes records to MedPilot callback
7. MedPilot decrypts with own private key, parses FHIR, displays in timeline
8. Records deleted from MedPilot after display (not stored permanently without re-consent)
```

### UI — Unified Patient Timeline
- Read-only panel on patient profile (doctor view only)
- Shows records from other facilities in chronological order
- Type tags: Prescription, Lab, Discharge, Consultation
- Source facility name shown
- "Fetched on [date], valid until [consent expiry]" watermark
- Records are not downloadable or shareable from within MedPilot

### Security Checklist
- [ ] MedPilot private key used for decryption stored only in secrets manager
- [ ] Fetched records stored temporarily in memory / encrypted temp store — never in main patient DB
- [ ] Consent scope (dateRange, hiTypes) strictly enforced — reject out-of-scope data
- [ ] Doctor must re-initiate consent if expired — no stale data shown
- [ ] Audit log: who fetched, which patient, which facility, when

---

## M7 — Security Hardening & Compliance

### End-to-End Encryption Architecture
```
Rest:     AES-256-GCM per-clinic keys stored in KMS
Transit:  TLS 1.3 for all API calls (ABDM and internal)
Exchange: ECDH ephemeral key exchange for FHIR bundles (ABDM standard)
Signing:  RSA-SHA256 for gateway request headers
Certs:    X.509 per clinic, rotated every 12 months
```

### Audit Logging — ABHA Operations
Every ABHA-related action must produce an immutable audit log entry:
```
{
  timestamp, clinicId, userId, userRole, patientId,
  action,       // e.g. ABHA_CREATE | ABHA_LINK | CONSENT_GRANT | RECORD_PUSH | RECORD_FETCH
  outcome,      // SUCCESS | FAILURE
  ipAddress,
  requestHash   // SHA-256 of sanitised request (no PII)
}
```
- Audit logs are append-only (no UPDATE/DELETE on audit table)
- Separate audit DB or table with restricted write access
- Retained for minimum 5 years (regulatory requirement)

### DPDP Act 2023 Compliance
- Purpose limitation: ABHA data used only for health record exchange
- Data minimisation: collect only what ABDM requires
- Storage limitation: fetched external records not persisted beyond consent window
- Right to erasure: patient can unlink ABHA — all ABHA references soft-deleted, audit trail retained
- Data breach protocol: incident response SLA defined before go-live

### Penetration Testing Checklist (pre-production)
- [ ] ABDM callback endpoint: replay attack, forged signature
- [ ] ABHA OTP flows: brute force, timing attacks
- [ ] Consent bypass: direct record access without valid artefact
- [ ] Encryption: key extraction attempts, padding oracle
- [ ] Role escalation: receptionist attempting ABHA operations
- [ ] Audit log tampering

### RBAC for ABHA Features
| Action | Admin | Doctor | Receptionist |
|--------|-------|--------|--------------|
| Create ABHA | ✅ | ✅ | ✅ (with supervision flag) |
| Link ABHA | ✅ | ✅ | ❌ |
| View ABHA number | ✅ | ✅ | masked only |
| View consent dashboard | ✅ | ✅ | ❌ |
| Initiate record fetch (HIU) | ✅ | ✅ | ❌ |
| View ABHA audit logs | ✅ | ❌ | ❌ |

---

## M8 — Production Go-Live

### NHA Production Approval Process
1. Complete sandbox testing (ABDM provides test cases)
2. Submit conformance test results to NHA
3. NHA security review (2–4 weeks)
4. Production credentials issued
5. Swap environment config → production gateway URL + production certs

### Pre-Launch Checklist
- [ ] All sandbox `hipId` / `clientId` replaced with production values
- [ ] Production X.509 certs installed in secrets manager
- [ ] Monitoring alerts: gateway callback failures, consent processing lag
- [ ] On-call runbook: key rotation, cert expiry, gateway downtime
- [ ] Staff training: ABHA flows, privacy obligations, what to do if breach suspected
- [ ] Patient-facing consent explainer screen in UI (what ABHA is, what they're consenting to)
- [ ] Rollback plan: feature flag to disable ABHA module without code deploy

### Key Metrics to Monitor Post-Launch
- ABHA creation success rate
- OTP delivery success rate
- Consent artefact processing latency
- FHIR bundle push failure rate
- Gateway callback error rate
- Unusual consent volume per clinic (abuse signal)

---

## Open Questions / Decisions Needed

| # | Question | Owner |
|---|----------|-------|
| Q1 | Do we build HIU (record fetch) in MVP or defer to Phase 2? | Product |
| Q2 | KMS provider: AWS vs HashiCorp Vault vs Azure Key Vault? | Engineering |
| Q3 | FHIR bundle generation: build in-house vs use medblocks/smile CDR SDK? | Engineering |
| Q4 | Will MedPilot have a patient-facing app / portal for consent visibility? | Product |
| Q5 | Data residency: all ABHA data must stay in India — confirm hosting region | DevOps |
| Q6 | ABDM-compliant PHR app integration (ABHA app deep link) for OTP-less consent? | Engineering |

---

## Technology Stack Additions

| Component | Technology |
|-----------|------------|
| ABDM API client | NestJS service with Axios + retry |
| FHIR bundle generation | Custom mapper or `@medplum/fhirtypes` for typing |
| Key/secret storage | AWS Secrets Manager (or Vault) |
| Async job queue | Bull/BullMQ (already available in NestJS ecosystem) |
| Audit log store | Separate PostgreSQL table (append-only, no ORM soft-delete) |
| Encryption | Node.js `crypto` (AES-256-GCM, ECDH) |
| Cert management | Custom service with Secrets Manager + rotation cron |

---

*Document version: 1.0 — Initial planning*
*Last updated: 2026-05-14*
