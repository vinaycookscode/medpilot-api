# MedPilot API

> Modern Clinic Management System — REST API

MedPilot is a SaaS ERP built for small clinics — dental, skin, physiotherapy, and general practice. It replaces paper records, Excel sheets, and outdated desktop software with a fast, modern, role-based system.

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16 (installed via Homebrew: `brew install postgresql@16`)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file and fill in values
cp .env.example .env

# Seed the database with demo clinic and users
npm run seed

# Start development server
npm run start:dev
```

The API will be available at `http://localhost:3000`.

---

## API Documentation

Interactive Swagger UI is available at:

```
http://localhost:3000/api/docs
```

All endpoints are grouped by module. Use the **Authorize** button in Swagger to paste your Bearer token after logging in.

---

## Demo Login Credentials

These accounts are created by `npm run seed` and point to **MedPilot Demo Clinic**.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@democlinic.com` | `Admin@123` |
| Doctor | `doctor@democlinic.com` | `Admin@123` |
| Receptionist | `reception@democlinic.com` | `Admin@123` |

### Get a token via curl

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@democlinic.com","password":"Admin@123"}'
```

Copy the `accessToken` from the response and use it as `Authorization: Bearer <token>`.

---

## Project Structure

```
medpilot/
├── medpilot-api/        ← This project (NestJS backend)
└── medpilot-web/        ← Angular frontend (coming soon)
```

```
src/
├── common/
│   ├── decorators/      # @CurrentUser, @Roles, @Public
│   ├── dto/             # PaginationDto, shared DTOs
│   ├── entities/        # BaseEntity (id, createdAt, updatedAt, deletedAt)
│   ├── filters/         # Global exception filter
│   ├── guards/          # RolesGuard
│   └── interceptors/    # TransformInterceptor (wraps all responses)
├── database/
│   └── seed.ts          # Demo data seeder
└── modules/
    ├── auth/            # JWT login, refresh tokens, change password
    ├── clinics/         # Clinic settings & configuration
    ├── users/           # Staff management (admin/doctor/receptionist)
    ├── patients/        # Patient CRUD, vitals, documents
    ├── appointments/    # Booking, schedules, slots, calendar
    ├── prescriptions/   # Doctor prescriptions, medicine search
    ├── billing/         # Invoices, GST, payments, services catalog
    └── dashboard/       # Revenue, stats, aggregation queries
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. JWT Bearer token required unless marked Public.

### Authentication

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/login` | Public | Login — returns access + refresh tokens |
| POST | `/auth/refresh` | Public | Exchange refresh token for new pair |
| GET | `/auth/me` | All | Current user profile |
| PUT | `/auth/change-password` | All | Change own password |

### Patients

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/patients` | All | List with search (`?search=`) & pagination |
| POST | `/patients` | Admin, Receptionist | Register new patient |
| GET | `/patients/:id` | All | Patient detail |
| PUT | `/patients/:id` | Admin, Receptionist | Update patient |
| DELETE | `/patients/:id` | Admin | Soft delete |
| POST | `/patients/:id/vitals` | Admin, Doctor | Record vitals |
| GET | `/patients/:id/vitals` | All | Vitals history |
| GET | `/patients/:id/documents` | All | List documents |

### Appointments

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/appointments/today` | All | Today's queue |
| GET | `/appointments/calendar` | All | `?startDate&endDate` |
| GET | `/appointments` | All | List with filters |
| POST | `/appointments` | Admin, Receptionist | Book appointment |
| PATCH | `/appointments/:id/status` | All | Update status |
| GET | `/doctors/:id/available-slots` | All | `?date=YYYY-MM-DD` |
| GET | `/doctors/:id/schedule` | All | Weekly schedule |
| POST | `/doctors/:id/schedule` | Admin | Set schedule slot |
| POST | `/doctors/:id/schedule/override` | Admin | Add holiday/override |

### Prescriptions

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/prescriptions` | Doctor | Create prescription |
| GET | `/prescriptions` | Admin, Doctor | List |
| GET | `/prescriptions/:id` | Admin, Doctor | Detail |
| PUT | `/prescriptions/:id` | Doctor | Update (same day only) |
| GET | `/prescriptions/medicines/search` | All | `?q=amox` — autocomplete |

### Billing

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/invoices` | Admin, Receptionist | Create invoice |
| GET | `/invoices` | Admin, Receptionist | List with filters |
| GET | `/invoices/pending` | Admin, Receptionist | Pending/partial invoices |
| GET | `/invoices/:id` | Admin, Receptionist | Invoice detail |
| PATCH | `/invoices/:id/send` | Admin, Receptionist | Mark as sent |
| POST | `/invoices/:id/payments` | Admin, Receptionist | Record payment |
| GET | `/invoices/:id/payments` | Admin, Receptionist | Payment history |
| GET | `/services` | All | Services catalog |
| POST | `/services` | Admin | Add service |
| PUT | `/services/:id` | Admin | Update service |

### Dashboard

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/dashboard/summary` | All | Today's KPIs |
| GET | `/dashboard/revenue` | Admin | `?period=today\|week\|month\|year` |
| GET | `/dashboard/appointments/stats` | All | Status breakdown |
| GET | `/dashboard/patients/stats` | All | New vs returning |
| GET | `/dashboard/doctors/stats` | Admin | Per-doctor performance |

---

## Response Format

Every response is wrapped in a standard envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Paginated responses include a `meta` object:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 84,
    "page": 1,
    "limit": 20
  }
}
```

Error responses:

```json
{
  "success": false,
  "statusCode": 404,
  "timestamp": "2026-05-07T10:00:00.000Z",
  "path": "/api/v1/patients/invalid-id",
  "message": "Patient not found"
}
```

---

## Role Permissions

| Feature | Admin | Doctor | Receptionist |
|---------|:-----:|:------:|:------------:|
| View patients | ✅ | ✅ | ✅ |
| Create / edit patients | ✅ | | ✅ |
| Delete patients | ✅ | | |
| View all appointments | ✅ | Own only | ✅ |
| Book appointments | ✅ | | ✅ |
| Write prescriptions | | ✅ | |
| View prescriptions | ✅ | ✅ | |
| Create invoices | ✅ | | ✅ |
| Record payments | ✅ | | ✅ |
| View revenue dashboard | ✅ | | |
| Manage staff | ✅ | | |
| Clinic settings | ✅ | | |

---

## Database

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Database | `medpilot_db` |
| User | `medpilot_user` |
| Password | `medpilot_dev_2024` |

Connect with **TablePlus** (installed at `/Applications/TablePlus.app`) using the above credentials.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | DB user | — |
| `DB_PASSWORD` | DB password | — |
| `DB_NAME` | DB name | — |
| `JWT_SECRET` | Access token secret | — |
| `JWT_EXPIRY` | Access token TTL | `15m` |
| `JWT_REFRESH_SECRET` | Refresh token secret | — |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:4200` |

---

## Available Scripts

```bash
npm run start:dev     # Start with hot reload
npm run build         # Compile TypeScript
npm run start:prod    # Run compiled build
npm run seed          # Seed demo clinic + users + medicines
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 |
| ORM | TypeORM 0.3 |
| Auth | JWT + Passport |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI 3 |
| Security | Helmet, throttler (100 req/min) |
