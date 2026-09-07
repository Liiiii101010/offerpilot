# Security policy

## Supported version

Security fixes currently target the latest version on the `main` branch.

## Reporting a vulnerability

Please do not publish API keys, resumes, personal data, or reproducible security details in a public issue. Use the repository's **Security → Advisories → New draft security advisory** flow to report a vulnerability privately.

Include the affected page or API route, expected and observed behavior, reproduction steps, and the potential impact. Remove real credentials and personal information from screenshots and logs.

## Credential handling

- Never commit `.env`, `.env.local`, access tokens, or provider API keys.
- Rotate a key immediately if it has been pasted into an issue, commit, screenshot, or chat transcript.
- Public deployments should prefer BYOK and should not expose a shared server-side model key without authentication, quotas, and rate limits.
