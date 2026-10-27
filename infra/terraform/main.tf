terraform {
  required_version = ">= 1.6.0"
  required_providers {
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
}
# Cloud-neutral foundation only. Add provider-specific networking, managed
# PostgreSQL, KMS, secret manager, registry, ingress/WAF and container service.
# State must be remote, encrypted and locked in each real environment.
resource "random_id" "deployment_suffix" {
  byte_length = 4
}
output "deployment_suffix" {
  description = "Unique suffix for naming provider-specific resources."
  value       = random_id.deployment_suffix.hex
}
