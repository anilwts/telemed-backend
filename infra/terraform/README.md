# Terraform deployment boundary

This folder documents the recommended IaC scope without locking you to a cloud provider. Implement modules for: VPC/private subnets, managed PostgreSQL HA + PITR, secret manager, container registry, managed container service/Kubernetes, HTTPS load balancer/WAF, log/metrics/tracing sinks, KMS keys, and durable queue. Keep state in a remote encrypted backend with locking; never commit state or secrets.

Minimum production topology:
- Two or more API replicas in separate availability zones, autoscaling on CPU and request latency.
- PostgreSQL private endpoint, TLS, encryption at rest, automated PITR backups, connection pooling.
- Secrets injected at runtime; separate least-privilege migration and application identities.
- HTTPS ingress, WAF, health probes, rollout rollback, network egress restrictions.
- Alerts on availability, p95 latency, 5xx, DB connections/replication lag, queue age and failed jobs.

Before applying IaC, choose AWS/GCP/Azure and add provider-specific modules, budgets, policies and environment separation. No cloud resources are created by this repository.
