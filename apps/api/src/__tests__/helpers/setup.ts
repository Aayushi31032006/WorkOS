export async function setup() {
  process.env.DATABASE_URL =
    "postgresql://app_user:app_pass@localhost:5432/communication_system_test";
  process.env.MIGRATION_DATABASE_URL =
    "postgresql://cs_user:cs_pass@localhost:5432/communication_system_test";
  process.env.TEST_DATABASE_URL =
    "postgresql://cs_user:cs_pass@localhost:5432/communication_system_test";
  process.env.JWKS_URI = "http://localhost:4001/.well-known/jwks.json";
  process.env.JWT_ISSUER = "http://localhost:4001";
  process.env.JWT_AUDIENCE = "communication-system";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  process.env.WEBHOOK_SIGNING_SECRET = "test_webhook_secret_32chars_min__";
  process.env.NODE_ENV = "test";
}
