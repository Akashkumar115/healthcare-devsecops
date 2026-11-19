# DevSecOps Implementation: Healthcare Patient Records System

> **Note:** This project uses **fake demo data only**. No real patient information (PHI) is stored or processed.

## 1. Overview

A patient-records REST API built with Node.js and Express, packaged with Docker and deployed on Kubernetes through a Jenkins pipeline. Security is added at every stage of the lifecycle ("shift left"), so problems are caught before deployment rather than after.

## 2. Pipeline security stages

| Stage | Tool | What it catches | Fails the build on |
|---|---|---|---|
| Secret scan | Gitleaks | Passwords, API keys, tokens committed to code | Any secret found |
| Dependency scan (SCA) | npm audit | Known vulnerabilities in npm packages | High or critical |
| Code scan (SAST) | Semgrep | Insecure code patterns (injection, weak crypto) | Any finding |
| Image scan | Trivy | OS and library vulnerabilities in the Docker image | High or critical |
| Secure deploy | Kubernetes | Misconfiguration (root user, writable filesystem) | Rollout failure |

## 3. Application security controls

| Control | Implementation |
|---|---|
| Authentication | Login with JWT tokens that expire after 15 minutes |
| Password storage | bcrypt hashes, never plain text |
| Role-based access control | Doctors read and create records; nurses read only; others denied |
| Rate limiting | 100 requests/min overall, 5 login attempts/min (slows brute force) |
| Security headers | Helmet: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy |
| Input validation | Type checks, length limits, 10 KB body limit |
| Audit logging | JSON log of every login, access, denial, with time, user, IP |
| Fingerprint hiding | `X-Powered-By` header disabled |

## 4. Container and Kubernetes hardening

| Control | Implementation |
|---|---|
| Non-root container | `USER node`; `runAsNonRoot: true` |
| Minimal image | `node:20-alpine`, production dependencies only |
| Read-only filesystem | `readOnlyRootFilesystem: true` |
| No privilege escalation | `allowPrivilegeEscalation: false` |
| Dropped capabilities | `capabilities: drop: ["ALL"]` |
| Resource limits | CPU and memory requests and limits set |
| Secrets management | JWT secret stored in a Kubernetes Secret, not in code or image |
| Network isolation | NetworkPolicy allows ingress on port 3000 only |
| Health checks | Readiness probe on `/health` |

## 5. HIPAA Security Rule mapping

| HIPAA requirement | Reference | Control in this project |
|---|---|---|
| Access control, unique user identification | 164.312(a)(1), (a)(2)(i) | Individual accounts with JWT login |
| Role-based minimum necessary access | 164.308(a)(4), 164.502(b) | Doctor / nurse role checks on every endpoint |
| Automatic logoff | 164.312(a)(2)(iii) | Tokens expire after 15 minutes |
| Audit controls | 164.312(b) | Structured audit log of all access and denials |
| Integrity | 164.312(c)(1) | Input validation, signed tokens, image scanning, immutable image tags |
| Person or entity authentication | 164.312(d) | bcrypt password check plus signed JWT |
| Transmission security | 164.312(e)(1) | HSTS header; in production, TLS at an ingress |
| Risk analysis and management | 164.308(a)(1) | Automated scans on every build |
| Protection from malicious software | 164.308(a)(5)(ii)(B) | Trivy, npm audit, Semgrep |

## 6. Secrets handling

- No secrets are in source code. `JWT_SECRET` is read from an environment variable and the app refuses to start without it.
- `k8s/secret.yaml` is excluded from Git. Gitleaks checks that nothing sensitive is committed.
- In production, secrets would come from a vault (HashiCorp Vault, AWS Secrets Manager) and the cluster would use encryption at rest.

## 7. Limitations and future improvements

- Demo users and data are in memory. A real system needs an encrypted database (encryption at rest).
- TLS is not terminated locally. Production needs HTTPS through an ingress with certificates.
- The local cluster may not enforce NetworkPolicy; a policy-capable network plugin (Calico, Cilium) is needed.
- Add multi-factor authentication, token refresh and revocation, and centralized log storage.
- Add DAST (for example OWASP ZAP) against the running app, and image signing.
- This demo satisfies technical safeguards only. HIPAA also requires administrative and physical safeguards, staff training and signed business associate agreements.
## Triaged scan findings

| Tool | Finding | Decision | Reason |
|---|---|---|---|
| Semgrep | express-check-csurf-middleware-usage | Suppressed (false positive) | Authentication uses Bearer JWT in the Authorization header, not cookies, so CSRF attacks do not apply. |