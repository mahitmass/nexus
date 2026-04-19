# infra/terraform/main.tf
# Project Nexus — Terraform IaC Skeleton
# Provider: AWS — swap module vars per theme deployment

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  backend "s3" {
    bucket         = "nexus-terraform-state"
    key            = "global/s3/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "nexus-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "nexus"
      Environment = var.environment
      ManagedBy   = "terraform"
      Theme       = var.domain_theme
    }
  }
}

# ── VPC ──────────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.7.0"

  name = "nexus-${var.environment}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# ── RDS PostgreSQL ────────────────────────────────────────────
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.5.4"

  identifier        = "nexus-${var.environment}-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_storage_gb

  db_name  = "nexus"
  username = var.db_username
  password = var.db_password
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids             = module.vpc.private_subnets

  backup_retention_period = var.environment == "production" ? 7 : 1
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"

  performance_insights_enabled = var.environment == "production"
}

# ── ElastiCache Redis ─────────────────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "nexus-${var.environment}-redis"
  description                = "Nexus Redis cluster"
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.environment == "production" ? 3 : 1
  automatic_failover_enabled = var.environment == "production"
  engine_version             = "7.1"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "nexus-${var.environment}-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

# ── S3 Buckets ────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "nexus-${var.environment}-assets-${var.aws_account_id}"
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── EC2 — API Gateway ─────────────────────────────────────────
resource "aws_instance" "api_gateway" {
  count         = var.api_gateway_count
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.api_gateway_instance_type

  subnet_id              = module.vpc.private_subnets[count.index % length(module.vpc.private_subnets)]
  vpc_security_group_ids = [aws_security_group.api_gateway.id]
  iam_instance_profile   = aws_iam_instance_profile.api_gateway.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    delete_on_termination = true
  }

  user_data = base64encode(templatefile("${path.module}/scripts/api-gateway-init.sh", {
    environment  = var.environment
    docker_image = var.api_gateway_docker_image
  }))

  tags = { Name = "nexus-${var.environment}-api-gateway-${count.index}" }
}

# ── Security Groups ───────────────────────────────────────────
resource "aws_security_group" "rds" {
  name   = "nexus-${var.environment}-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api_gateway.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "redis" {
  name   = "nexus-${var.environment}-redis-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api_gateway.id]
  }
}

resource "aws_security_group" "api_gateway" {
  name   = "nexus-${var.environment}-api-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 4000
    to_port     = 4001
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Data sources ──────────────────────────────────────────────
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

data "aws_caller_identity" "current" {}
