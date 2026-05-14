# ABHA Integration — High Level Design (HLD)
## MedPilot Backend (medpilot-api)

> **Classification: INTERNAL — SENSITIVE**
> Contains architecture decisions for national health identity integration.

**Version:** 1.0
**Last Updated:** 2026-05-14
**Status:** Draft — Pending Review

---

## 1. System Context

### 1.1 Where MedPilot Sits in the ABDM Ecosystem

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ABDM ECOSYSTEM                               │
│                                                                     │
│   ┌──────────────┐     ┌────────────────────┐     ┌─────────────┐  │
│   │  ABHA App    │     │   ABDM Gateway /   │     │ Other HIPs  │  │
│   │  (Patient)   │◄───►│   Consent Manager  │◄───►│ (Hospitals) │  │
│   └──────────────┘     └────────┬───────────┘     └─────────────┘  │
│                                 │                                   │
│                    ┌────────────▼────────────┐                      │
│                    │       MedPilot           │                      │
│                    │  (HIP + optional HIU)    │                      │
│                    │                          │                      │
│                    │  ┌──────────────────┐   │                      │
│                    │  │  medpilot-api    │   │                      │
│                    │  │  (NestJS)        │   │                      │
│                    │  └──────────────────┘   │                      │
│                    │  ┌──────────────────┐   │                      │
│                    │  │  PostgreSQL      │   │                      │
│                    │  └──────────────────┘   │                      │
│                    │  ┌──────────────────┐   │                      │
│                    │  │  Redis           │   │                      │
│                    │  └──────────────────┘   │                      │
│                    └─────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘

Roles:
  HIP  — Health Information Provider: MedPilot generates and shares records
  HIU  — Health Information User: MedPilot fetches records from other facilities
  CM   — Consent Manager: ABDM Gateway manages patient consent (not us)
```

### 1.2 Key ABDM Participants

| Participant | Role | Our Interaction |
|-------------|------|----------------|
| NHA / ABDM Gateway | Routes all health data requests | All API calls go through gateway |
| ABHA App | Patient-side consent approval | Patient uses app to approve OTPs |
| Other HIPs | Hospitals, labs, pharmacies | We push to / pull from them via gateway |
| Healthcare Professional Registry (HPR) | Doctor identity | Practitioners referenced in FHIR |
| Health Facility Registry (HFR) | Clinic identity | `hipId` registered here |

---

## 2. Architecture Overview

### 2.1 Component Diagram

```
medpilot-api (NestJS)
│
├── AbdmModule
│   ├── AbdmGatewayClient          ← single HTTP client for all ABDM calls
│   │     Token mgmt, signing,
│   │     retry, circuit breaker
│   │
│   ├── AbdmCallbackController     ← PUBLIC endpoint, receives gateway events
│   │     Signature validation,
│   │     enqueue only, never inline process
│   │
│   ├── AbhaIdentityService        ← ABHA create / link / verify flows
│   ├── CareContextService         ← care context registration & discovery
│   ├── ConsentService             ← consent artefact lifecycle
│   ├── HipService                 ← FHIR bundle generation and push
│   ├── HiuService                 ← record fetch from other facilities
│   │
│   ├── FhirMapperService          ← domain entities → FHIR R4 bundles
│   ├── EncryptionService          ← ECDH key exchange, AES-256-GCM
│   ├── KeyManagerService          ← per-clinic keys from Secrets Manager
│   └── AbhaAuditService           ← append-only audit writer
│
├── BullMQ Queues
│   ├── care-context-sync          ← register care contexts with ABDM
│   ├── fhir-push                  ← encrypt and push FHIR data
│   └── consent-expiry             ← cron: expire stale consent artefacts
│
├── Redis
│   ├── abdm:token:{env}           ← cached gateway access token
│   ├── abha:otp:{txnId}           ← OTP flow session state (TTL: 15 min)
│   └── abdm:pending:{requestId}   ← outgoing request correlation store
│
└── PostgreSQL
    ├── patients                   ← +abha_number, +abha_address (encrypted)
    ├── abha_transactions          ← OTP flow audit trail
    ├── abha_care_contexts         ← care context registry
    ├── abha_consent_artefacts     ← consent lifecycle store
    └── abha_audit_logs            ← append-only, revoke UPDATE/DELETE at DB level
```

### 2.2 The Async Nature of ABDM

**Critical:** Almost every ABDM call is asynchronous. You send a request and receive a `202 Accepted`. The actual result arrives minutes later via a callback pushed to your public endpoint.

```
MedPilot                    ABDM Gateway
   │                             │
   │── POST /v0.5/links/... ────►│
   │◄── 202 Accepted (requestId) │
   │                             │  (ABDM processes internally)
   │                             │
   │◄── POST /abdm/callback/ ────│  ← actual result arrives here
   │         on-add-context      │
```

This means **every outgoing call needs a pending-request store** (Redis) keyed by `requestId`, and every callback handler must correlate back to it before processing.

---

## 3. Architectural Decision Records (ADRs)

### ADR-001: NestJS Module, Not Microservice

**Decision:** Implement ABHA as a module inside `medpilot-api`, not as a separate service.

**Rationale:**
- Multi-clinic SaaS model means clinics share the API instance — extracting ABHA would require duplicating auth, RBAC, and clinic resolution
- ABHA operations are tightly coupled to existing Patient, Appointment, Prescription entities — cross-service DB joins or REST calls would add latency and complexity
- Team size doesn't justify microservice operational overhead at this stage

**Consequence:** Module boundaries must be clean (`AbdmModule` exposes services, never imports from other modules except core entities). Extraction to a microservice later is possible with this boundary in place.

---

### ADR-002: Redis for OTP Flow State

**Decision:** Store multi-step OTP flow state (txnId, attempts, expiry) in Redis with TTL, not PostgreSQL.

**Rationale:**
- OTP state is ephemeral — valid for 10–15 minutes, meaningless after
- PostgreSQL writes for transient state adds unnecessary I/O and table bloat
- Redis TTL provides automatic cleanup without a cron job

**Consequence:** Redis is a hard infrastructure dependency for ABHA flows. The service must fail fast with a clear error if Redis is unavailable, not silently degrade.

---

### ADR-003: ECDH + AES-256-GCM for FHIR Data Exchange

**Decision:** Use ABDM-mandated encryption: X25519 ECDH for key exchange, AES-256-GCM for data encryption.

**Rationale:** ABDM specification mandates this scheme. Non-negotiable.

**Implementation:** Node.js native `crypto` module — no third-party dependency for cryptographic operations. The ephemeral key pair is generated per data push, used once, discarded.

---

### ADR-004: Append-Only Audit Table with DB-Level Enforcement

**Decision:** ABHA audit logs are stored in a PostgreSQL table where the application DB user has INSERT-only permission — UPDATE and DELETE are revoked at the database level.

**Rationale:**
- Audit integrity must survive application-level bugs or compromised code
- ORM-level soft-delete is not sufficient — a compromised service could still call the ORM
- DB-level REVOKE is the only guarantee

**Consequence:** Migrations for this table must be run as a privileged user. The permission REVOKE is a one-time migration step that cannot be automated via TypeORM schema sync.

---

### ADR-005: BullMQ for All Async Callback Processing

**Decision:** Callback controller acknowledges ABDM immediately and enqueues a BullMQ job. No business logic runs inline in the callback handler.

**Rationale:**
- ABDM gateway has a callback acknowledgement timeout (~30 seconds). If our processing takes longer (DB write, FHIR generation, encryption), we miss the window
- BullMQ provides retry, exponential backoff, dead-letter queue — essential for production reliability
- Jobs are durable: a server restart mid-processing does not lose the callback event

---

### ADR-006: Per-Clinic Feature Flag with Dedicated HIP ID

**Decision:** Each clinic has an `abhaEnabled` boolean and its own `abhaHipId`. ABHA features are invisible until explicitly enabled per clinic.

**Rationale:**
- ABDM registration is per-facility — each clinic registers separately with NHA/HFR
- Allows phased rollout without code deploys
- Emergency disable without rollback

---

### ADR-007: Custom FHIR Mappers — No FHIR Server

**Decision:** Write custom TypeScript mappers from MedPilot domain objects to FHIR R4 resources. Use `@medplum/fhirtypes` for type safety only. Do not run a FHIR server (HAPI, Medplum).

**Rationale:**
- MedPilot generates a finite set of FHIR document types (Prescription, Lab, Consultation, Discharge). A full FHIR server is overengineering.
- Custom mappers are testable, lightweight, and keep the dependency surface minimal
- A FHIR server adds operational cost (separate process, storage, licensing)

**Consequence:** We own the FHIR validity of generated bundles. Validation step (against FHIR schema) is mandatory before every push.

---

### ADR-008: Circuit Breaker on ABDM Gateway Client

**Decision:** Wrap all ABDM gateway HTTP calls in a circuit breaker (opossum library).

**Rationale:** ABDM gateway has documented availability issues, particularly in peak hours and during NHA maintenance windows. Without a circuit breaker, a gateway outage causes cascading failures in MedPilot (appointment save → care context job → gateway timeout → retry storm).

**Behaviour:**
- Opens circuit after 50% failure rate over 10 requests
- Half-open probe after 60 seconds
- Failed requests during open circuit are queued in BullMQ for retry, not dropped

---

## 4. Data Flow Diagrams

### 4.1 ABHA Creation via Aadhaar OTP

```
Staff Browser       medpilot-api          Redis         ABDM Gateway
     │                   │                  │                  │
     │─ POST initiate ──►│                  │                  │
     │                   │─ POST generateOtp──────────────────►│
     │                   │◄─ { txnId } ────────────────────────│
     │                   │─ SET abha:otp:{txnId} TTL:900 ──►  │
     │◄─ { sessionToken }│                  │                  │
     │                   │                  │         (SMS OTP sent to patient mobile)
     │                   │                  │                  │
     │─ POST verify-otp ►│                  │                  │
     │  { sessionToken,  │─ GET abha:otp ──►│                  │
     │    otp }          │◄─ { txnId } ─────│                  │
     │                   │─ POST verifyOtp ────────────────────►│
     │                   │◄─ { txnId (new) } ──────────────────│
     │                   │─ UPDATE session in Redis ──────────►│
     │◄─ { sessionToken }│                  │                  │
     │                   │                  │                  │
     │─ POST complete ──►│                  │                  │
     │                   │─ GET session ───►│                  │
     │                   │─ POST createHealthId ───────────────►│
     │                   │◄─ { abhaNumber, abhaAddress } ───────│
     │                   │─ encrypt(abhaNumber) → DB save       │
     │                   │─ DEL abha:otp:{txnId} ──────────────►│
     │                   │─ audit.log(ABHA_CREATE, SUCCESS)     │
     │◄─ { abhaNumber (masked) }            │                  │
```

### 4.2 Care Context Registration (Async)

```
Trigger              medpilot-api          BullMQ        ABDM Gateway
(prescription save)       │                  │                │
     │─ save complete ───►│                  │                │
     │                   │─ INSERT care_context (status:pending)
     │                   │─ addJob(care-context-sync) ──────►│
     │◄─ 201 response    │                  │                │
     │                              (worker picks up job)
     │                   │◄─────────────────│                │
     │                   │─ POST /v0.5/links/link/add-contexts─►│
     │                   │  { X-Request-ID: uuid }           │
     │                   │─ SET abdm:pending:{uuid} ────────►│
     │                   │◄─ 202 Accepted ────────────────────│
     │                             (async — gateway processes)
     │                   │                  │    ┌──────────────────┐
     │                   │◄─ POST /abdm/callback/links/on-add-context
     │                   │   validate HMAC signature         │
     │                   │─ GET abdm:pending:{requestId}     │
     │                   │─ addJob(complete-link) ──────────►│
     │                   │─ UPDATE care_context (status:linked)
     │                   │─ audit.log(CARE_CONTEXT_LINKED)   │
```

### 4.3 Consent Lifecycle

```
ABDM Gateway          medpilot-api           BullMQ          Doctor UI
     │                     │                    │                │
     │─ POST /callback/    │                    │                │
     │   consent/request ─►│                    │                │
     │                     │─ validate signature │                │
     │                     │─ store artefact (REQUESTED)        │
     │                     │─ addJob(notify-staff) ────────────►│
     │◄─ 202 ACK ──────────│                    │                │
     │                             (staff sees notification)
     │                     │◄───────────────────│                │
     │                     │──────────────────────────────────────►│
     │                     │  (doctor reviews in consent dashboard)
     │                                                           │
     │─ POST /callback/    │                    │                │
     │   consent/notify ──►│                    │                │
     │   (GRANTED)         │─ validate signature │                │
     │                     │─ UPDATE artefact (GRANTED)         │
     │                     │─ verify artefact hash (tamper check)│
     │◄─ 202 ACK ──────────│                    │                │
     │                     │                    │                │
     │─ POST /callback/    │                    │                │
     │   health-info/ ─────►│                   │                │
     │   request           │─ validate signature │                │
     │                     │─ RE-VALIDATE consent (not expired/revoked)
     │                     │─ addJob(fhir-push) ───────────────►│
     │◄─ 202 ACK ──────────│                    │                │
     │                              (worker processes)
     │                     │◄───────────────────│                │
     │                     │─ fetch records from DB              │
     │                     │─ generate FHIR bundle               │
     │                     │─ encrypt (ECDH + AES-GCM)          │
     │◄─ POST data-push ───│                    │                │
     │   (encrypted)       │─ audit.log(RECORD_PUSH, SUCCESS)   │
```

---

## 5. Security Architecture

### 5.1 Encryption Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Transit                                       │
│  TLS 1.3 on all connections (ABDM API, internal, DB)   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: At Rest (Sensitive Columns)                   │
│  AES-256-GCM, per-clinic key from KMS                  │
│  Applied to: abhaNumber, abhaAddress, patientAbha       │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Data Exchange (FHIR Bundles)                  │
│  ECDH (X25519) ephemeral key exchange                   │
│  AES-256-GCM with shared secret                         │
│  Each bundle uses a fresh ephemeral key pair            │
├─────────────────────────────────────────────────────────┤
│  Layer 4: Request Signing                               │
│  RSA-SHA256 on every outgoing ABDM API call             │
│  HMAC validation on every incoming ABDM callback        │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Key Hierarchy

```
AWS Secrets Manager / HashiCorp Vault
│
├── abdm/gateway/clientId          ← ABDM platform credential
├── abdm/gateway/clientSecret      ← ABDM platform credential
│
├── clinic/{clinicId}/abha/encryptionKey    ← AES key for column encryption
├── clinic/{clinicId}/abha/privateKey       ← X.509 private key for ABDM signing
└── clinic/{clinicId}/abha/publicKey        ← registered with ABDM gateway
```

**Key access rules:**
- Private keys are fetched at operation time, never cached in application memory
- Encryption keys cached in memory for max 5 minutes with automatic rotation check
- No key material ever written to logs, error messages, or audit records

### 5.3 RBAC Matrix

| Action | Admin | Doctor | Receptionist | System (internal) |
|--------|:-----:|:------:|:------------:|:-----------------:|
| Initiate ABHA creation | ✅ | ✅ | ✅* | — |
| Link existing ABHA | ✅ | ✅ | ❌ | — |
| View ABHA number | masked | masked | ❌ | full (for ops) |
| View consent dashboard | ✅ | ✅ | ❌ | — |
| Approve/flag consents | ✅ | ✅ | ❌ | — |
| Initiate HIU record fetch | ✅ | ✅ | ❌ | — |
| View ABHA audit logs | ✅ | ❌ | ❌ | — |
| Receive ABDM callbacks | — | — | — | ✅ |

*Receptionist can initiate with a `supervisedBy` doctor ID required in payload.

### 5.4 Audit Trail Coverage

Every ABHA operation produces an immutable audit log. Covered actions:

```
ABHA_CREATE_INITIATE     ABHA_CREATE_OTP_VERIFY    ABHA_CREATE_COMPLETE
ABHA_LINK_INITIATE       ABHA_LINK_COMPLETE         ABHA_UNLINK
ABHA_VIEW                CARE_CONTEXT_REGISTER      CARE_CONTEXT_FAILED
CONSENT_RECEIVED         CONSENT_GRANTED            CONSENT_REVOKED
CONSENT_EXPIRED          CONSENT_FLAGGED
RECORD_PUSH_INITIATE     RECORD_PUSH_COMPLETE       RECORD_PUSH_FAILED
RECORD_FETCH_INITIATE    RECORD_FETCH_COMPLETE       RECORD_FETCH_EXPIRED
KEY_ROTATION             CALLBACK_INVALID_SIGNATURE  CALLBACK_UNKNOWN_REQUEST
```

---

## 6. Infrastructure Requirements

### 6.1 New Dependencies

| Component | Purpose | Requirement |
|-----------|---------|-------------|
| Redis | OTP flow state, token cache, callback correlation | ≥ Redis 7.0 |
| AWS Secrets Manager (or Vault) | Key and credential storage | Mandatory for production |
| BullMQ | Async job processing | Added to medpilot-api |
| Publicly routable HTTPS URL | ABDM callback delivery | Required from Milestone 1 |

### 6.2 Environment Variables (new, never commit values)

```bash
# ABDM Gateway
ABDM_ENV=sandbox                          # sandbox | production
ABDM_GATEWAY_URL=https://dev.abdm.gov.in
ABDM_CLIENT_ID=<from secrets manager>
ABDM_CLIENT_SECRET=<from secrets manager>
ABDM_CM_ID=sbx                            # sbx | abdm

# Secrets Manager
AWS_REGION=ap-south-1                     # India region — mandatory
AWS_SECRETS_MANAGER_PREFIX=medpilot/abha

# Redis
REDIS_URL=redis://localhost:6379

# Callback
ABDM_CALLBACK_BASE_URL=https://api.medpilot.io  # must be public HTTPS
```

### 6.3 Data Residency

All infrastructure hosting ABHA data **must** be in `ap-south-1` (Mumbai) or another AWS India region. ABDM/DPDP mandates Indian data residency for health data.

---

## 7. Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| ABDM callback acknowledgement | < 5 seconds | Enqueue only — no inline processing |
| FHIR bundle generation | < 3 seconds | Per record type |
| Care context registration | Eventually consistent | BullMQ with retry |
| Audit log write | < 100ms | Synchronous, in same DB transaction |
| OTP flow session TTL | 900 seconds | Matches ABDM txnId expiry |
| Consent re-validation on push | Every push | Not cached |
| Key rotation | Every 12 months | Automated via cron |
| Audit log retention | 5 years | Regulatory minimum |
| Gateway token cache TTL | token.expiresIn - 30s | Refresh before expiry |

---

## 8. Milestone to Component Mapping

| Milestone | Components Built |
|-----------|-----------------|
| M1 — Foundation | AbdmGatewayClient, AbhaAuditService, AbdmCallbackController (skeleton), Redis setup, BullMQ setup |
| M2 — ABHA Identity | AbhaIdentityService, patient entity migration, OTP session management |
| M3 — Care Context | CareContextService, abha_care_contexts table, discovery callback |
| M4 — Consent | ConsentService, abha_consent_artefacts table, consent callbacks, consent dashboard API |
| M5 — Record Push | HipService, FhirMapperService, EncryptionService (ECDH), fhir-push queue |
| M6 — Record Fetch | HiuService, temporary record store, HIU consent initiation |
| M7 — Hardening | KeyManagerService (production), audit DB permission migration, pen test remediation |
| M8 — Go-Live | Production config swap, monitoring dashboards, cert rotation cron |

---

*HLD Version 1.0 — Review required before M1 implementation begins*
