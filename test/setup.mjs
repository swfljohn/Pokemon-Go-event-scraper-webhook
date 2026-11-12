// Loaded before every test file (see package.json "test"): a fixed, fake configuration.
process.env.SITE_URL = "https://example.com";
process.env.SITE_NAME = "Example Events";
process.env.DEFAULT_TIME_ZONE = "America/New_York";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.EVENT_WEBHOOK_ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
