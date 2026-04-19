# infra/terraform/variables.tf

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID (used for globally unique bucket names)"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

# ── THEME VARIABLE — change per deployment ────────────────────
variable "domain_theme" {
  description = "Business domain theme for tagging"
  type        = string
  default     = "generic"
  validation {
    condition     = contains(["generic", "agriculture", "healthcare", "fintech"], var.domain_theme)
    error_message = "Theme must be generic, agriculture, healthcare, or fintech."
  }
}

# ── Database ─────────────────────────────────────────────────
variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_storage_gb" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

# ── Redis ────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

# ── Compute ──────────────────────────────────────────────────
variable "api_gateway_count" {
  description = "Number of API gateway EC2 instances"
  type        = number
  default     = 2
}

variable "api_gateway_instance_type" {
  description = "EC2 instance type for API gateway"
  type        = string
  default     = "t3.small"
}

variable "api_gateway_docker_image" {
  description = "Docker image for the API gateway"
  type        = string
  default     = "ghcr.io/your-org/nexus/api-gateway:latest"
}
