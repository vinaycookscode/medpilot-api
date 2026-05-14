# ABHA Integration — Low Level Design (LLD)
## MedPilot Backend (medpilot-api)

> **Classification: INTERNAL — SENSITIVE**

**Version:** 1.0
**Last Updated:** 2026-05-14
**Status:** Draft

---

## 1. Module File Structure

```
src/modules/abdm/
│
├── abdm.module.ts
│
├── config/
│   └── abdm.config.ts               ← typed config (env vars, base URLs per env)
│
├── gateway/
│   ├── abdm-gateway.client.ts       ← HTTP client: token, signing, retry, circuit breaker
│   └── abdm-gateway.types.ts        ← raw ABDM API request/response types
│
├── services/
│   ├── abha-identity.service.ts     ← ABHA create (Aadhaar/mobile), link, unlink
│   ├── care-context.service.ts      ← register care contexts, handle discovery
│   ├── consent.service.ts           ← consent artefact lifecycle
│   ├── hip.service.ts               ← validate consent, orchestrate FHIR push
│   └── hiu.service.ts               ← consent-gated record fetch from other HIPs
│
├── fhir/
│   ├── fhir-mapper.service.ts       ← orchestrates per-type mappers
│   ├── fhir-validator.service.ts    ← validates bundle before push
│   ├── mappers/
│   │   ├── prescription.mapper.ts
│   │   ├── lab-report.mapper.ts
│   │   ├── consultation.mapper.ts
│   │   ├── patient.mapper.ts
│   │   └── practitioner.mapper.ts
│   └── fhir.types.ts                ← FHIR R4 interfaces (or use @medplum/fhirtypes)
│
├── crypto/
│   ├── encryption.service.ts        ← ECDH + AES-256-GCM operations
│   └── key-manager.service.ts       ← per-clinic keys from Secrets Manager, TTL cache
│
├── callbacks/
│   ├── abdm-callback.controller.ts  ← receives ALL gateway callbacks
│   └── callback-signature.guard.ts  ← HMAC validation guard
│
├── controllers/
│   ├── abha-identity.controller.ts  ← staff-facing ABHA identity APIs
│   └── abha-consent.controller.ts   ← consent dashboard APIs
│
├── jobs/
│   ├── care-context-sync.processor.ts
│   ├── fhir-push.processor.ts
│   └── consent-expiry.processor.ts
│
├── audit/
│   └── abha-audit.service.ts        ← append-only audit writer
│
├── entities/
│   ├── abha-transaction.entity.ts
│   ├── abha-care-context.entity.ts
│   ├── abha-consent-artefact.entity.ts
│   └── abha-audit-log.entity.ts
│
├── dto/
│   ├── initiate-aadhaar-otp.dto.ts
│   ├── verify-otp.dto.ts
│   ├── complete-abha-creation.dto.ts
│   ├── link-abha.dto.ts
│   └── query-consents.dto.ts
│
├── guards/
│   └── abha-enabled.guard.ts        ← checks clinic.abhaEnabled flag
│
└── enums/
    ├── abha-audit-action.enum.ts
    ├── care-context-status.enum.ts
    └── consent-status.enum.ts
```

---

## 2. Database Schema

### 2.1 Patient Entity — Additional Columns

```typescript
// Migration: add_abha_columns_to_patients

// New columns on existing `patients` table
abha_number        TEXT         NULL  -- AES-256-GCM encrypted 14-digit number
abha_address       TEXT         NULL  -- AES-256-GCM encrypted ABHA address (name@abdm)
abha_verified      BOOLEAN      NOT NULL DEFAULT false
abha_kyc_type      VARCHAR(20)  NULL  -- 'aadhaar' | 'mobile' | 'linked'
abha_linked_at     TIMESTAMPTZ  NULL
abha_env           VARCHAR(20)  NULL  -- 'sandbox' | 'production'
```

### 2.2 abha_transactions

```sql
CREATE TABLE abha_transactions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID         NOT NULL REFERENCES clinics(id),
  patient_id      UUID         NULL REFERENCES patients(id),
  txn_id          VARCHAR(255) NOT NULL,
  flow_type       VARCHAR(50)  NOT NULL,  -- 'aadhaar_otp' | 'mobile_otp' | 'link'
  step            VARCHAR(50)  NOT NULL,  -- 'otp_sent' | 'otp_verified' | 'completed' | 'failed'
  initiated_by    UUID         NOT NULL REFERENCES users(id),
  attempts        INTEGER      NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ  NOT NULL,
  completed_at    TIMESTAMPTZ  NULL,
  failure_reason  TEXT         NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_abha_txn_clinic   ON abha_transactions(clinic_id);
CREATE INDEX idx_abha_txn_patient  ON abha_transactions(patient_id);
```

### 2.3 abha_care_contexts

```sql
CREATE TABLE abha_care_contexts (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID         NOT NULL REFERENCES clinics(id),
  patient_id        UUID         NOT NULL REFERENCES patients(id),
  visit_id          UUID         NULL,          -- appointment / encounter id
  source_type       VARCHAR(50)  NOT NULL,      -- 'prescription' | 'lab' | 'consultation'
  source_id         UUID         NOT NULL,      -- FK to prescription/lab/appointment
  reference_number  VARCHAR(255) NOT NULL UNIQUE,  -- sent to ABDM, our internal ID
  display           VARCHAR(500) NOT NULL,      -- human label shown in ABHA timeline
  hi_types          TEXT[]       NOT NULL,      -- ABDM hiType array
  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  attempts          INTEGER      NOT NULL DEFAULT 0,
  abdm_request_id   VARCHAR(255) NULL,          -- X-Request-ID sent to gateway
  linked_at         TIMESTAMPTZ  NULL,
  last_attempted_at TIMESTAMPTZ  NULL,
  failure_reason    TEXT         NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_status CHECK (status IN ('pending','linked','failed','skipped'))
);

CREATE INDEX idx_care_ctx_patient   ON abha_care_contexts(patient_id);
CREATE INDEX idx_care_ctx_status    ON abha_care_contexts(status);
CREATE INDEX idx_care_ctx_source    ON abha_care_contexts(source_type, source_id);
```

### 2.4 abha_consent_artefacts

```sql
CREATE TABLE abha_consent_artefacts (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID         NOT NULL REFERENCES clinics(id),
  consent_id          VARCHAR(255) NOT NULL UNIQUE,    -- ABDM consent artefact ID
  patient_abha        TEXT         NOT NULL,            -- AES encrypted ABHA address
  hiu_id              VARCHAR(255) NOT NULL,
  hiu_name            VARCHAR(500) NULL,
  purpose_code        VARCHAR(50)  NOT NULL,            -- ABDM purpose codes
  hi_types            TEXT[]       NOT NULL,
  date_from           DATE         NOT NULL,
  date_to             DATE         NOT NULL,
  expiry              TIMESTAMPTZ  NOT NULL,
  status              VARCHAR(50)  NOT NULL DEFAULT 'requested',
  artefact_signature  TEXT         NOT NULL,            -- gateway-signed JWS
  artefact_hash       VARCHAR(255) NOT NULL,            -- SHA-256 of artefact JSON
  granted_at          TIMESTAMPTZ  NULL,
  revoked_at          TIMESTAMPTZ  NULL,
  flagged             BOOLEAN      NOT NULL DEFAULT false,
  flagged_by          UUID         NULL REFERENCES users(id),
  flagged_reason      TEXT         NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_consent_status CHECK (
    status IN ('requested','granted','revoked','expired','failed')
  )
);

CREATE INDEX idx_consent_clinic    ON abha_consent_artefacts(clinic_id);
CREATE INDEX idx_consent_status    ON abha_consent_artefacts(status, expiry);
CREATE INDEX idx_consent_hiu       ON abha_consent_artefacts(hiu_id);
```

### 2.5 abha_audit_logs

```sql
CREATE TABLE abha_audit_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  clinic_id       UUID         NOT NULL,
  user_id         UUID         NOT NULL,
  user_role       VARCHAR(50)  NOT NULL,
  patient_id      UUID         NULL,
  action          VARCHAR(100) NOT NULL,
  outcome         VARCHAR(20)  NOT NULL,   -- 'SUCCESS' | 'FAILURE'
  ip_address      INET         NULL,
  request_hash    VARCHAR(255) NOT NULL,   -- SHA-256 of sanitised payload
  failure_reason  TEXT         NULL,
  metadata        JSONB        NULL        -- non-PII context
  -- NO updated_at, NO deleted_at — immutable
);

CREATE INDEX idx_audit_clinic    ON abha_audit_logs(clinic_id, timestamp DESC);
CREATE INDEX idx_audit_patient   ON abha_audit_logs(patient_id, timestamp DESC);
CREATE INDEX idx_audit_action    ON abha_audit_logs(action, outcome);

-- Run as superuser after migration:
-- REVOKE UPDATE, DELETE ON abha_audit_logs FROM medpilot_app;
```

### 2.6 Redis Key Schema

```
abdm:token:{env}                 STRING  Gateway access token. TTL = token.expiresIn - 30s
abha:otp:{txnId}                 JSON    OTP session state. TTL = 900s
abdm:pending:{requestId}         JSON    Outgoing request correlation. TTL = 300s
abha:ratelimit:otp:{mobile}      INT     OTP attempt counter. TTL = 600s (10 min window)
abha:key:{clinicId}:enc          BYTES   Cached encryption key. TTL = 300s
```

---

## 3. API Contracts

### 3.1 Staff-Facing ABHA Identity APIs

All routes are prefixed `/api/v1/abha`. Require `Authorization: Bearer <jwt>`.
All routes require `AbhaEnabledGuard` (checks `clinic.abhaEnabled`).

---

#### `POST /identity/:patientId/create/aadhaar/initiate`

Sends OTP to patient's Aadhaar-linked mobile.

**Guards:** `JwtAuthGuard`, `AbhaEnabledGuard`, `RolesGuard(admin, doctor, receptionist)`

**Request Body:**
```typescript
{
  aadhaarLastFour: string;  // display only — never transmitted to ABDM
  supervisedBy?: string;    // required if initiator role is receptionist
}
```

**Response `201`:**
```typescript
{
  success: true,
  data: {
    sessionToken: string;  // signed JWT, 15 min TTL, carry to next step
    maskedMobile: string;  // e.g. ******7890 — shown to staff for confirmation
    expiresAt: string;     // ISO timestamp
  }
}
```

**Response `429`:** Rate limit exceeded (max 3 per 10 min per patient)

---

#### `POST /identity/:patientId/create/aadhaar/verify-otp`

**Request Body:**
```typescript
{
  sessionToken: string;
  otp: string;             // 6-digit OTP from patient
}
```

**Response `200`:**
```typescript
{
  success: true,
  data: {
    sessionToken: string;  // new token with updated txnId
    expiresAt: string;
  }
}
```

**Response `400`:** Invalid OTP or session expired

---

#### `POST /identity/:patientId/create/aadhaar/complete`

Creates the ABHA number. Final step.

**Request Body:**
```typescript
{
  sessionToken: string;
}
```

**Response `201`:**
```typescript
{
  success: true,
  data: {
    abhaNumber: string;   // masked: XX-XXXX-XXXX-1234
    abhaAddress: string;  // e.g. firstname.lastname@abdm
    kycVerified: boolean;
    linkedAt: string;
  }
}
```

---

#### `POST /identity/:patientId/create/mobile/initiate`

Same pattern as Aadhaar flow but uses patient's registered mobile.

**Response `201`:** Same as Aadhaar initiate + `mobile: string` (masked)

---

#### `POST /identity/:patientId/create/mobile/verify-otp`
#### `POST /identity/:patientId/create/mobile/complete`

Same pattern as Aadhaar equivalents. Complete step requires additional fields:

```typescript
{
  sessionToken: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;   // YYYY-MM-DD
  gender: 'M' | 'F' | 'O';
}
```

---

#### `POST /identity/:patientId/link`

Link an existing ABHA to a patient profile.

**Request Body:**
```typescript
{
  abhaNumber?: string;   // 14-digit or formatted XX-XXXX-XXXX-XXXX
  abhaAddress?: string;  // name@abdm — one of abhaNumber/abhaAddress required
}
```

**Response `200`:**
```typescript
{
  success: true,
  data: {
    status: 'pending_patient_approval';
    message: 'Patient will receive a notification on their ABHA app to approve the link.';
  }
}
```

---

#### `GET /identity/:patientId`

**Response `200`:**
```typescript
{
  success: true,
  data: {
    hasAbha: boolean;
    abhaNumber: string | null;   // always masked
    abhaAddress: string | null;
    verified: boolean;
    kycType: string | null;
    linkedAt: string | null;
  }
}
```

---

#### `DELETE /identity/:patientId/unlink`

**Guards:** `RolesGuard(admin)` only

**Response `200`:** Soft-deletes ABHA references, creates audit log, retains audit trail.

---

### 3.2 Consent Dashboard APIs

#### `GET /consents`

**Query Params:**
```typescript
status?: 'requested' | 'granted' | 'revoked' | 'expired';
patientId?: string;
dateFrom?: string;
dateTo?: string;
page?: number;         // default: 1
limit?: number;        // default: 20, max: 50
```

**Response `200`:**
```typescript
{
  success: true,
  data: ConsentArtefactDto[],
  meta: { total: number, page: number, limit: number }
}
```

---

#### `GET /consents/:consentId`

Returns full artefact detail including hiTypes, dateRange, HIU info.

---

#### `POST /consents/:consentId/flag`

**Guards:** `RolesGuard(admin, doctor)`

**Request Body:** `{ reason: string }`

---

### 3.3 ABDM Callback Endpoints

Prefix: `/api/v1/abdm/callback`. **No JWT auth.** Protected only by `CallbackSignatureGuard`.

All callbacks respond `202 Accepted` immediately. Processing is async via BullMQ.

```
POST /links/on-add-context           care context link result
POST /care-contexts/on-discover      patient discovery response
POST /consent/request                new consent request from HIU
POST /consent/notify                 consent status update (GRANTED / REVOKED)
POST /health-info/request            data push request (under consent)
POST /health-info/on-transfer        data transfer acknowledgement (HIU mode)
```

---

## 4. Service Interfaces

### 4.1 AbdmGatewayClient

```typescript
@Injectable()
export class AbdmGatewayClient {
  // Returns ABDM access token, fetching fresh if cache expired
  async getAccessToken(): Promise<string>

  // POST to ABDM gateway — adds auth header, X-Request-ID, signs request
  // Stores pending correlation in Redis
  async post<T>(path: string, body: unknown, meta?: RequestMeta): Promise<AbdmResponse<T>>

  // GET to ABDM gateway
  async get<T>(path: string, params?: Record<string, string>): Promise<AbdmResponse<T>>

  // Fetch a public key from ABDM key registry (for HIU encryption)
  async getHiuPublicKey(hiuId: string): Promise<string>
}

interface RequestMeta {
  clinicId: string;
  context: string;         // human label for correlation logging
  skipPending?: boolean;   // set true for synchronous ABDM calls (rare)
}
```

### 4.2 AbhaIdentityService

```typescript
@Injectable()
export class AbhaIdentityService {
  async initiateAadhaarOtp(patientId: string, clinicId: string, initiatedBy: string): Promise<OtpSessionResult>
  async verifyAadhaarOtp(sessionToken: string, otp: string): Promise<OtpSessionResult>
  async completeAadhaarCreation(patientId: string, sessionToken: string, clinicId: string): Promise<AbhaResult>

  async initiateMobileOtp(patientId: string, clinicId: string, initiatedBy: string): Promise<OtpSessionResult>
  async verifyMobileOtp(sessionToken: string, otp: string): Promise<OtpSessionResult>
  async completeMobileCreation(patientId: string, sessionToken: string, dto: MobileCompleteDto): Promise<AbhaResult>

  async linkAbha(patientId: string, clinicId: string, dto: LinkAbhaDto): Promise<{ status: string }>
  async unlinkAbha(patientId: string, clinicId: string, unlinkedBy: string): Promise<void>
  async getAbhaProfile(patientId: string, clinicId: string): Promise<AbhaProfileDto>
}
```

### 4.3 CareContextService

```typescript
@Injectable()
export class CareContextService {
  // Called by Prescription/Lab/Appointment services on record creation
  async registerCareContext(params: RegisterCareContextParams): Promise<void>

  // Handles gateway discovery callback
  async handleDiscovery(payload: AbdmDiscoveryRequest): Promise<AbdmDiscoveryResponse>

  // Handles on-add-context callback (care context linked)
  async handleLinkCallback(requestId: string, payload: unknown): Promise<void>

  // Returns all care contexts for a patient
  async getCareContexts(patientId: string, clinicId: string): Promise<AbhaCareContext[]>
}

interface RegisterCareContextParams {
  patientId: string;
  clinicId: string;
  sourceType: 'prescription' | 'lab' | 'consultation';
  sourceId: string;
  visitId?: string;
  display: string;
  hiTypes: string[];
}
```

### 4.4 ConsentService

```typescript
@Injectable()
export class ConsentService {
  // Handles incoming consent request callback
  async handleConsentRequest(payload: AbdmConsentRequestPayload): Promise<void>

  // Handles consent status notification (GRANTED / REVOKED / EXPIRED)
  async handleConsentNotification(payload: AbdmConsentNotifyPayload): Promise<void>

  // Returns artefact for use in record push — throws if expired/revoked
  async getValidConsent(consentId: string, clinicId: string): Promise<AbhaConsentArtefact>

  // Dashboard queries
  async listConsents(clinicId: string, query: QueryConsentsDto): Promise<PaginatedResult<AbhaConsentArtefact>>
  async getConsent(consentId: string, clinicId: string): Promise<AbhaConsentArtefact>
  async flagConsent(consentId: string, clinicId: string, userId: string, reason: string): Promise<void>

  // Cron: expires artefacts past their expiry timestamp
  async expireStaleConsents(): Promise<void>
}
```

### 4.5 HipService

```typescript
@Injectable()
export class HipService {
  // Entry point from fhir-push BullMQ job
  async processDataRequest(jobData: FhirPushJobData): Promise<void>

  // Core push logic — validates consent, generates FHIR, encrypts, pushes
  private async pushHealthRecords(consent: AbhaConsentArtefact, clinicId: string): Promise<void>

  // Fetches records from DB scoped to consent's dateRange and hiTypes
  private async fetchRecordsForConsent(consent: AbhaConsentArtefact): Promise<ClinicalRecords>
}
```

### 4.6 FhirMapperService

```typescript
@Injectable()
export class FhirMapperService {
  mapPrescription(prescription: Prescription, patient: Patient, doctor: User, clinic: Clinic): Bundle
  mapLabReport(order: LabOrder, result: LabResult, patient: Patient, doctor: User, clinic: Clinic): Bundle
  mapConsultation(appointment: Appointment, patient: Patient, doctor: User, clinic: Clinic): Bundle

  // Validates bundle against FHIR R4 schema — throws FhirValidationError if invalid
  validateBundle(bundle: Bundle): void
}
```

### 4.7 EncryptionService

```typescript
@Injectable()
export class EncryptionService {
  // ECDH + AES-256-GCM — for FHIR bundle transmission to HIU
  async encryptForHiu(data: object, hiuPublicKeyB64: string): Promise<EncryptedPayload>

  // Decrypt incoming FHIR data (HIU mode — data from other HIPs)
  async decryptFromHip(payload: EncryptedPayload, clinicId: string): Promise<object>

  // Column-level encryption — for storing abhaNumber/abhaAddress in DB
  encryptColumn(value: string, clinicId: string): Promise<string>
  decryptColumn(ciphertext: string, clinicId: string): Promise<string>
}

interface EncryptedPayload {
  content: string;         // base64 encrypted data + GCM auth tag
  algorithm: 'ECDH';
  curve: 'X25519';
  publicKey: string;       // ephemeral public key, base64
  nonce: string;           // base64
  checksum: string;        // SHA-256 of plaintext
  media: string;           // 'application/fhir+json'
}
```

### 4.8 AbhaAuditService

```typescript
@Injectable()
export class AbhaAuditService {
  // Always synchronous — must complete before response is returned
  async log(entry: AuditEntry): Promise<void>
  async warn(message: string, context: Record<string, unknown>): Promise<void>

  // Admin query
  async queryLogs(clinicId: string, filters: AuditQueryDto): Promise<AbhaAuditLog[]>
}

interface AuditEntry {
  clinicId: string;
  userId: string;
  userRole: string;
  patientId?: string;
  action: AbhaAuditAction;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  requestPayload?: Record<string, unknown>;   // PII stripped before hashing
  failureReason?: string;
  metadata?: Record<string, unknown>;
}
```

---

## 5. Sequence Diagrams

### 5.1 ABHA Create — Aadhaar OTP (Full Detail)

```
Controller   AbhaIdentityService   Redis          AbdmGateway     AuditService    DB
    │               │                │                 │               │           │
    │─initiate()───►│                │                 │               │           │
    │               │─rateLimit?────►│                 │               │           │
    │               │◄──ok───────────│                 │               │           │
    │               │                │                 │               │           │
    │               │─ POST /v3/enrollment/request/otp ─────────────────►│          │
    │               │◄─ { txnId, mobile (masked) } ───────────────────│            │
    │               │                │                 │               │           │
    │               │─ SET abha:otp:{txnId} ─────────►│               │           │
    │               │   { txnId, step:'otp_sent',      │               │           │
    │               │     patientId, clinicId,          │               │           │
    │               │     initiatedBy, attempts:0 }     │               │           │
    │               │                │                 │               │           │
    │               │─ INSERT abha_transactions ─────────────────────────────────►│
    │               │   { txnId, step:'otp_sent' }      │               │           │
    │               │─ log(ABHA_CREATE_INITIATE,SUCCESS)──────────────►│           │
    │◄─sessionToken─│                │                 │               │           │
    │               │                │                 │               │           │
    │─verifyOtp()──►│                │                 │               │           │
    │  {token, otp} │                │                 │               │           │
    │               │─ parse+verify token               │               │           │
    │               │─ GET abha:otp:{txnId} ─────────►│               │           │
    │               │◄─ session ─────────────────────│               │           │
    │               │─ session.attempts >= 3? → reject  │               │           │
    │               │                │                 │               │           │
    │               │─ POST /v3/enrollment/auth/confirmWithAadhaarOtp──►│           │
    │               │◄─ { txnId (new) } ──────────────────────────────│            │
    │               │                │                 │               │           │
    │               │─ SET abha:otp:{newTxnId} ──────►│               │           │
    │               │   { step:'otp_verified', ... }    │               │           │
    │               │─ DEL abha:otp:{oldTxnId} ──────►│               │           │
    │               │─ log(ABHA_CREATE_OTP_VERIFY, SUCCESS)──────────►│           │
    │◄─sessionToken─│                │                 │               │           │
    │               │                │                 │               │           │
    │─complete()───►│                │                 │               │           │
    │  {token}      │                │                 │               │           │
    │               │─ GET abha:otp:{txnId} ─────────►│               │           │
    │               │─ step must be 'otp_verified'      │               │           │
    │               │                │                 │               │           │
    │               │─ POST /v3/enrollment/enrol/byAadhaar ──────────►│            │
    │               │◄─ { ABHANumber, preferredAbhaAddress, ... } ───│            │
    │               │                │                 │               │           │
    │               │─ encrypt(abhaNumber, clinicKey) → DB UPDATE patient ────────►│
    │               │─ DEL abha:otp:{txnId} ─────────►│               │           │
    │               │─ UPDATE abha_transactions (completed) ─────────────────────►│
    │               │─ log(ABHA_CREATE_COMPLETE, SUCCESS) ──────────►│           │
    │◄─{ masked }───│                │                 │               │           │
```

### 5.2 FHIR Data Push (HIP Mode — Full Detail)

```
ABDM Gateway    CallbackController   BullMQ       HipService     ConsentService
     │                  │               │               │               │
     │─POST /health-info/request ──────►│               │               │
     │                  │               │               │               │
     │                  │─ validate HMAC signature       │               │
     │                  │─ correlate requestId → Redis   │               │
     │                  │─ addJob(fhir-push, jobData) ──►│               │
     │◄─ 202 ACK ───────│               │               │               │
     │                             (worker)             │               │
     │                  │               │◄──────────────│               │
     │                  │               │   processDataRequest()        │
     │                  │               │               │─getValidConsent()►│
     │                  │               │               │               │─ check status = GRANTED
     │                  │               │               │               │─ check expiry < NOW
     │                  │               │               │               │─ verify artefact hash
     │                  │               │               │◄─ consent ────│
     │                  │               │               │               │
     │                  │               │               │─ fetchRecords(consent)
     │                  │               │               │   scope: hiTypes + dateRange
     │                  │               │               │               │
     │                  │               │               │─ mapToFhir(records)
     │                  │               │               │─ validateBundle()
     │                  │               │               │               │
     │                  │               │               │─ getHiuPublicKey(hiuId) → ABDM
     │                  │               │               │─ encryptForHiu(bundle, key)
     │                  │               │               │   ephemeral X25519 + AES-GCM
     │                  │               │               │               │
     │◄─ POST data-push (encrypted) ────────────────────│               │
     │                  │               │               │               │
     │                  │               │               │─ audit(RECORD_PUSH_COMPLETE, SUCCESS)
     │                  │               │               │   { consentId, recordCount, payloadHash }
```

### 5.3 Consent Revocation — Immediate Enforcement

```
ABDM Gateway    CallbackController   ConsentService   HipService
     │                  │               │                │
     │─POST /consent/notify (REVOKED)──►│               │
     │                  │─ validate HMAC │               │
     │                  │─ addJob(consent-revoke) ──────►│
     │◄─ 202 ACK ───────│               │               │
     │                             (worker, priority: HIGH)
     │                  │               │◄──────────────│
     │                  │  handleConsentNotification()  │
     │                  │               │─ UPDATE consent status = REVOKED
     │                  │               │─ SET revoked_at = NOW()
     │                  │               │               │
     │                  │               │   Any in-flight fhir-push jobs
     │                  │               │   for this consentId will call
     │                  │               │   getValidConsent() which now
     │                  │               │   throws ConsentRevokedException
     │                  │               │   → job fails gracefully, no data sent
     │                  │               │               │
     │                  │               │─ audit(CONSENT_REVOKED)
```

---

## 6. Error Handling

### 6.1 ABDM Gateway Errors

```typescript
// abdm-gateway.client.ts

// Errors are mapped to domain exceptions — not raw HTTP errors
class AbdmGatewayException extends Error {
  constructor(
    public readonly code: string,       // ABDM error code
    public readonly message: string,
    public readonly statusCode: number,
    public readonly requestId: string,
  ) { super(message); }
}

// Specific subclasses:
class AbdmTokenExpiredException     extends AbdmGatewayException {}
class AbdmOtpExpiredException       extends AbdmGatewayException {}
class AbdmOtpInvalidException       extends AbdmGatewayException {}
class AbdmRateLimitException        extends AbdmGatewayException {}
class AbdmGatewayUnavailableException extends AbdmGatewayException {}
```

### 6.2 Consent Validation Errors

```typescript
class ConsentRevokedException  extends Error {}   // consent was revoked
class ConsentExpiredException  extends Error {}   // past expiry timestamp
class ConsentScopeException    extends Error {}   // request outside consent hiTypes/dateRange
class ConsentSignatureException extends Error {}  // artefact hash mismatch — tampered
```

### 6.3 BullMQ Job Failure Strategy

```typescript
// care-context-sync.processor.ts
@Processor('care-context-sync')
export class CareContextSyncProcessor {
  @Process()
  async process(job: Job<CareContextJobData>) {
    // attempt 1: immediate
    // attempt 2: 30 seconds
    // attempt 3: 5 minutes
    // after 3 failures: update care_context status = 'failed', audit log
  }
}

// BullMQ queue options
const queueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 500,   // keep failed jobs for inspection
  },
};
```

---

## 7. FHIR Mapper Detail

### 7.1 Prescription Bundle Structure

```typescript
// mappers/prescription.mapper.ts

mapPrescription(rx: Prescription, patient: Patient, doctor: User, clinic: Clinic): Bundle {
  const bundleId = randomUUID();
  const compositionId = randomUUID();
  const patientId = randomUUID();
  const practitionerId = randomUUID();

  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle'] },
    identifier: { system: 'https://medpilot.io/bundle', value: rx.id },
    type: 'document',
    timestamp: rx.createdAt.toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${compositionId}`,
        resource: {
          resourceType: 'Composition',
          id: compositionId,
          status: 'final',
          type: {
            coding: [{ system: 'http://snomed.info/sct', code: '440545006', display: 'Prescription record' }]
          },
          subject: { reference: `urn:uuid:${patientId}` },
          date: rx.createdAt.toISOString(),
          author: [{ reference: `urn:uuid:${practitionerId}` }],
          title: 'Prescription',
          section: [{
            title: 'Medications',
            code: { coding: [{ system: 'http://snomed.info/sct', code: '182836005' }] },
            entry: rx.medications.map((_, i) => ({ reference: `urn:uuid:${medicationIds[i]}` })),
          }],
        },
      },
      {
        fullUrl: `urn:uuid:${patientId}`,
        resource: this.patientMapper.map(patient),
      },
      {
        fullUrl: `urn:uuid:${practitionerId}`,
        resource: this.practitionerMapper.map(doctor),
      },
      ...rx.medications.map((med, i) => ({
        fullUrl: `urn:uuid:${medicationIds[i]}`,
        resource: this.mapMedicationRequest(med, rx, patientId, practitionerId),
      })),
    ],
  };
}
```

### 7.2 Mandatory FHIR Validation Rules

Before any bundle is sent, `FhirValidatorService.validateBundle()` checks:

```typescript
const rules = [
  'Bundle must have resourceType = Bundle',
  'Bundle.type must be document',
  'Bundle.timestamp must be present and valid ISO date',
  'First entry must be a Composition resource',
  'Composition.subject must reference a Patient entry in the bundle',
  'All Composition.section.entry references must resolve within the bundle',
  'All codings must have system + code (display is optional)',
  'Patient resource must have identifier (ABHA number or MR number)',
  'Practitioner must have identifier (HPR ID or NMC registration number)',
  'MedicationRequest must have medicationCodeableConcept or medicationReference',
];
```

---

## 8. Encryption Implementation

### 8.1 ECDH + AES-256-GCM (FHIR Push)

```typescript
// crypto/encryption.service.ts

async encryptForHiu(data: object, hiuPublicKeyB64: string): Promise<EncryptedPayload> {
  const plaintext = Buffer.from(JSON.stringify(data));

  // 1. Generate ephemeral key pair — used once, never stored
  const ephemeral = generateKeyPairSync('x25519');

  // 2. Import HIU public key
  const hiuKey = createPublicKey({
    key: Buffer.from(hiuPublicKeyB64, 'base64'),
    format: 'der',
    type: 'spki',
  });

  // 3. ECDH shared secret
  const sharedSecret = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: hiuKey,
  });

  // 4. Derive AES key (first 32 bytes of shared secret)
  const aesKey = sharedSecret.subarray(0, 32);
  const nonce = randomBytes(12);

  // 5. AES-256-GCM encrypt
  const cipher = createCipheriv('aes-256-gcm', aesKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();  // 16 bytes

  // 6. Append tag to ciphertext (ABDM convention)
  const content = Buffer.concat([encrypted, tag]);

  return {
    content: content.toString('base64'),
    algorithm: 'ECDH',
    curve: 'X25519',
    publicKey: ephemeral.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    nonce: nonce.toString('base64'),
    checksum: createHash('sha256').update(plaintext).digest('hex'),
    media: 'application/fhir+json',
  };
}
```

### 8.2 Column Encryption (ABHA Number / Address at Rest)

```typescript
// TypeORM column transformer — transparent to the rest of the codebase
export const abhaColumnTransformer = (keyManager: KeyManagerService, clinicId: string) => ({
  to: (value: string | null): string | null => {
    if (!value) return null;
    const key = keyManager.getKeySync(clinicId);  // cached, never async in transformer
    return encryptColumn(value, key);
  },
  from: (value: string | null): string | null => {
    if (!value) return null;
    const key = keyManager.getKeySync(clinicId);
    return decryptColumn(value, key);
  },
});
```

---

## 9. Callback Signature Validation

Every incoming ABDM callback must be validated before any processing:

```typescript
// guards/callback-signature.guard.ts

@Injectable()
export class CallbackSignatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.rawBody;          // raw bytes — must configure in NestJS
    const signature = request.headers['x-hip-id'] ? ... : request.headers['authorization'];

    // Validate against ABDM gateway public key
    const isValid = this.verifyHmac(body, signature, this.config.gatewayPublicKey);

    if (!isValid) {
      await this.audit.warn('CALLBACK_INVALID_SIGNATURE', {
        ip: request.ip,
        path: request.path,
        signatureHeader: signature?.substring(0, 20),
      });
      throw new UnauthorizedException('Invalid callback signature');
    }

    return true;
  }
}
```

---

## 10. Configuration Schema

```typescript
// config/abdm.config.ts

export interface AbdmConfig {
  env: 'sandbox' | 'production';
  gatewayUrl: string;            // https://dev.abdm.gov.in | https://live.abdm.gov.in
  clientId: string;              // from Secrets Manager
  clientSecret: string;          // from Secrets Manager
  cmId: string;                  // 'sbx' | 'abdm'
  callbackBaseUrl: string;       // public HTTPS URL of this API
  gatewayPublicKey: string;      // ABDM gateway public key for callback signature validation
}

// Resolved per-clinic at runtime:
export interface ClinicAbdmConfig extends AbdmConfig {
  hipId: string;                 // clinic's registered HIP ID
  encryptionKeyArn: string;      // Secrets Manager ARN for AES key
  privateKeyArn: string;         // Secrets Manager ARN for X.509 private key
}
```

---

*LLD Version 1.0 — Covers M1 through M5. M6 (HIU) LLD to be detailed in v1.1*
