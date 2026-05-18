// Env vars required by modules that validate at startup.
// These are set BEFORE any test file imports its modules.
process.env.JWT_SECRET  = 'test-secret-ci-vitest-2024';
process.env.DB_HOST     = 'localhost';
process.env.DB_NAME     = 'ppai_test';
process.env.DB_USER     = 'ppai_test';
process.env.DB_PASSWORD = 'ppai_test';
process.env.FRONTEND_URL = 'http://localhost';
