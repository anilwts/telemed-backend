# Telemed Backend

A manageable, production-oriented Node.js backend starter for telemedicine workflows. Stack: Node.js 20+, Express, PostgreSQL, `pg`, Zod, JWT, bcrypt, Pino and Prometheus metrics.

> **Important:** This repository is a strong starting point, not a claim of production certification. Before real patient data, complete the MFA challenge flow, refresh-token/session lifecycle, provider integrations, cloud IaC, tracing exporter, restore drills, security testing and applicable legal/compliance review. The 99.95% SLO and latency targets require load testing and production operations; they are not guaranteed by source code alone.

## Included

- User registration/login, role-based access (PATIENT, DOCTOR, ADMIN)
- Doctor search and availability publishing
- Transactional booking with PostgreSQL row locking and `Idempotency-Key`
- Consultation state transitions and prescriptions
- Admin analytics and audit-event listing
- PostgreSQL schema/indexes, Docker, Compose, OpenAPI
- Request IDs, structured/redacted logs, Prometheus metrics and health probes
- Architecture, sequence diagram, ER diagram, threat model and release checklist
- Jest tests and GitHub Actions CI

## Quick start

Requirements: Docker Desktop, or Node.js 20+ and PostgreSQL 16+.

1. Copy environment file: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`).
2. Replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Start local services: `docker compose up --build`.
4. In a second terminal, apply migration if not already applied by the Postgres init mount:
   `npm install` then `npm run db:migrate`.
5. API: `http://localhost:3000`; OpenAPI file: `openapi/openapi.yaml`.
6. Check `GET /health/live`, `GET /health/ready`, and `GET /metrics`.

If using Docker Compose, the database init script runs when the database volume is first created. If you change migration files during development, use a proper migration tool or reset the local volume (`docker compose down -v`; this deletes local DB data) and start again.

## Windows PowerShell local setup

```powershell
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL and a strong JWT_SECRET
npm install
npm run db:migrate
npm run dev
```

## Example workflow

Register patient:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"ChangeThisPassword123!","role":"PATIENT","fullName":"Demo Patient"}'
```

Login and save `data.accessToken` from response:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.com","password":"ChangeThisPassword123!"}'
```

Doctor registration requires `specialty` and `licenseNumber`. Doctor profiles are **not searchable/bookable until an administrator verifies the doctor** (`doctors.verified = true`); implement an explicit admin verification endpoint before production.

Create availability as a doctor:
```bash
curl -X POST http://localhost:3000/api/v1/doctors/availability \
  -H "Authorization: Bearer DOCTOR_TOKEN" -H "Content-Type: application/json" \
  -d '{"startsAt":"2027-01-15T10:00:00.000Z","endsAt":"2027-01-15T10:30:00.000Z"}'
```

Book as patient (use an available slot UUID):
```bash
curl -X POST http://localhost:3000/api/v1/consultations \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Idempotency-Key: booking-unique-2027-0001" \
  -H "Content-Type: application/json" \
  -d '{"slotId":"SLOT_UUID","reason":"Routine consultation"}'
```

Update lifecycle as assigned doctor:
`PATCH /api/v1/consultations/{id}/status` with `{"status":"CONFIRMED"}`, then `IN_PROGRESS`, then `COMPLETED`. Create prescription using `POST /api/v1/prescriptions/{consultationId}`.

## API endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register patient/doctor |
| POST | `/api/v1/auth/login` | Public | Login |
| GET | `/api/v1/doctors/search` | Public | Search verified doctors |
| POST | `/api/v1/doctors/availability` | Doctor | Publish slot |
| GET | `/api/v1/doctors/:doctorId/availability` | Public | List available slots |
| POST | `/api/v1/consultations` | Patient | Book; requires idempotency key |
| GET | `/api/v1/consultations/mine` | Authenticated | Caller-visible consultations |
| PATCH | `/api/v1/consultations/:id/status` | Assigned doctor/admin | Lifecycle transition |
| POST | `/api/v1/prescriptions/:consultationId` | Assigned doctor | Create prescription |
| GET | `/api/v1/prescriptions/:consultationId` | Patient/doctor/admin | Read prescription |
| GET | `/api/v1/admin/analytics` | Admin | Aggregate analytics |
| GET | `/api/v1/admin/audit` | Admin | Audit events |
| GET | `/health/live` | Public | Liveness |
| GET | `/health/ready` | Public | Readiness / DB check |
| GET | `/metrics` | Internal network only in production | Prometheus metrics |

See `openapi/openapi.yaml` for the machine-readable contract.

## Tests and CI

```bash
npm test
npm run test:coverage
npm run lint
```

The test suite includes request-schema contract tests and HTTP smoke/security behavior. Add PostgreSQL integration tests for transaction rollback, concurrent booking, idempotency replay/conflict, ownership/IDOR and status transition coverage before release. CI runs tests and builds a container image.

## Design documents

- `docs/architecture.md`: architecture/data flow, booking sequence, ER model, scaling, retries, partitioning, transactions/sagas, backup/DR.
- `docs/threat-model.md`: data classification, attack surface, OWASP-oriented threats and release checklist.
- `infra/terraform/README.md`: cloud-agnostic IaC scope and production topology.

## Operational notes

- Set production `DATABASE_URL` to a managed TLS endpoint and configure certificate validation.
- Run migrations as a one-off deployment job with a migration-only DB role.
- Keep `/metrics` private to the monitoring network; do not expose it publicly.
- Configure ingress TLS, WAF, HSTS, trusted proxy settings, autoscaling and multi-zone deployment.
- Use a secrets manager/KMS, never commit `.env`, and rotate JWT keys with a documented key ID/overlap strategy.
- Configure OpenTelemetry SDK/exporter and collector to export traces; current app exposes metrics and structured logs.
- Configure DB PITR, encrypted cross-region backups and practice restore drills.
- Review all dependencies and run `npm audit`, SAST, secret scan, container scan, SBOM generation and penetration tests.
