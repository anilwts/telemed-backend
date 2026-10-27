# Security Checklist and Threat Model

## Assets and data classification

| Data | Classification | Controls |
|---|---|---|
| Password hash, MFA secret | Restricted credential | bcrypt, secret/KMS encryption for MFA, never log |
| Consultation reason, prescription, DOB, phone | Sensitive personal/health data | Least privilege, TLS, DB encryption, access audit, retention controls |
| Email, role, doctor license | Confidential personal data | Validation, RBAC, access audit |
| Audit events | Confidential/security telemetry | Append-only DB permissions, restricted admin access, export to tamper-resistant storage |
| Public doctor specialty/availability | Public or low sensitivity | Rate limit, avoid exposing private profile fields |

## Attack surface

- Public registration, login, doctor search and availability reads
- Authenticated slot creation, booking, consultation state transitions, prescriptions
- Admin analytics and audit endpoints
- Database credentials, JWT signing key, CI secrets, container image, deployment control plane
- Future integrations: payment callbacks, SMS/email, video provider, object storage

## Threats and mitigations

| Threat | Risk | Mitigation / status |
|---|---|---|
| Credential stuffing / brute force | Account takeover | Global rate limit included; add per-account/IP login throttling, bot controls and breached-password checks |
| Weak password storage | Credential exposure | bcrypt cost 12; enforce password policy and rotate compromised credentials |
| JWT theft/replay | Unauthorized access | TLS, short access token TTL; add refresh-token rotation, revocation/session registry, device controls |
| MFA bypass | Account takeover | MFA-enabled accounts are denied token until challenge flow exists; implement TOTP/WebAuthn before production |
| Broken object-level authorization | PHI exposure | Ownership checks for prescription reads and doctor consultation updates; review every endpoint with negative tests |
| Double booking / replay | Duplicate booking | Idempotency key + payload hash + DB row lock + unique constraints |
| SQL injection | Data theft/modification | Parameterized SQL; never interpolate user values into SQL |
| Denial of service | Outage | Rate limiting, body size limits, ingress WAF, DB timeouts, autoscaling, per-route budgets |
| PHI in logs | Privacy breach | Pino redaction and no payload logging; review traces/log fields before launch |
| Malicious dependency/image | Supply-chain compromise | CI npm audit, pin/lock dependencies, SBOM, image scanning/signing and controlled registry |
| Insider misuse | Unauthorized data access | Least privilege, immutable audit export, periodic access review, alerting |
| Ransomware/data loss | Service/data loss | Encrypted PITR backups, cross-region copy, restore drills, least-privilege backup credentials |
| Secrets leakage | Full system compromise | Env injection only for local; production secret manager/KMS, rotation, no secrets in repo or image |

## Security release checklist

- [ ] HTTPS only; HSTS configured at ingress; secure trusted-proxy configuration reviewed.
- [ ] Replace local secrets; store signing/encryption keys in managed secret store; documented rotation and rollback.
- [ ] Implement and test TOTP/WebAuthn MFA enrollment, challenge, recovery and step-up.
- [ ] Add refresh-token rotation/revocation and session/device management.
- [ ] Separate DB migration and runtime roles; runtime role cannot alter schema or delete audit records.
- [ ] Add login-specific throttling, email verification, account recovery and alerting.
- [ ] Review every endpoint for role + object ownership and cross-tenant access.
- [ ] Validate webhook signatures and idempotency before enabling payments or vendors.
- [ ] Enable encryption at rest for DB, snapshots, object storage, logs and backups; verify key rotation.
- [ ] Configure retention/deletion, consent, access request and breach response workflows with counsel.
- [ ] Run SAST, `npm audit`, secret scan, container scan, SBOM and penetration test.
- [ ] Test rate limits, request size, CORS, SQL injection, IDOR, concurrency and backup restore.
- [ ] Define alert thresholds, on-call escalation, incident playbooks and postmortems.

## Residual risks

This is a starter implementation, not a certified clinical platform. MFA challenge, email verification, password recovery, payment provider integration, video consultations, notification workers, tamper-evident audit export, formal retention automation, and full tracing exporter are not complete. Do not process real patient data until those controls, clinical workflows, legal obligations, and an independent security review are complete.
