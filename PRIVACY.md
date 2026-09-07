# Privacy notes

OfferPilot processes job-search materials that may contain personal information. This document describes the current MVP behavior; it is not a substitute for a production privacy policy.

## Current data flow

- Resume and job-description files are parsed in the browser before analysis.
- When real analysis is requested, extracted text and the selected model credential are sent to OfferPilot's `/api/analyze` route and then to the selected model provider.
- A temporary key entered on the page is not written to `localStorage` by the application.
- Saved resumes, profile details, evidence answers, and job archives are stored in the current browser's `localStorage`. They do not automatically sync between devices.
- The application code does not intentionally write resume text or model keys to server-side storage.

## User guidance

- Remove unnecessary identity numbers, home addresses, and unrelated personal information before analysis.
- Review the selected model provider's data-handling terms before sending material.
- Clear the browser's site data when using a shared device.
- Do not use real candidate documents in public bug reports, repository issues, screenshots, or demos.

## Deployment guidance

Operators who add analytics, logs, authentication, databases, shared API keys, or cloud file storage must update this notice and implement appropriate access controls, retention limits, deletion paths, and user consent.
