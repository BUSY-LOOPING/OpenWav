# Security

## Security

- **Input:** every route validates input with zod.
- **Rate limits:** stored in Redis, with a global limit, a strict limit on auth and a limit on downloads.
- **Headers:** helmet, and CORS from `CORS_ORIGINS`.
- **Passwords and tokens:** passwords are hashed with bcrypt. Refresh tokens are stored hashed, rotate, and are revoked on reuse, password change or ban.
- **Downloads:** URLs are checked against an allowlist, and each user has a daily limit.
- **Admin:** admin endpoints are role-guarded on the API and in the UI.
- **Streams and progress:** stream URLs and SSE tickets are short-lived and signed, so access tokens never appear in URLs.
- **Storage:** the buckets allow anonymous reads only from the internal network, behind nginx's signature check.
- **Secrets:** all credentials come from `.env`.
