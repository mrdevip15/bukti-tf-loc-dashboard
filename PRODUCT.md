# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Players use a unique mobile-friendly invoice link to review the generated invoice, explicitly grant camera/location access, and submit their identity details while visible photo capture runs.
- Administrators use a protected page to generate fictional transfer receipt content and create a shareable player link for that exact invoice.

## Product Purpose

Provide an invoice-linked, transparent internal identity-verification flow that sends explicitly consented player data, location when permitted, IP address, and up to 10 visible camera photos to the company Telegram bot. Keep invoice editing and link generation inside the protected administrator experience.

## Operating Context

Administrators generate an invoice, save it, and copy its unique HTTPS link. Players open that link on a phone, review the exact invoice, read the collection disclosure, grant browser camera/location permissions, keep the live preview visible, and enter their name and phone or ID while up to 10 photos are collected. The submission and photos stay associated with the invoice token.

## Capabilities and Constraints

- Player-facing routes must not expose the invoice/receipt generator or its controls.
- Player verification requires a valid, unguessable invoice link created by an administrator.
- Generated invoice links and invoice status persist across application restarts and deployments.
- Camera and location access require explicit, visible consent.
- Camera preview and active-capture status remain visible while collecting photos.
- Identity fields are completed after capture permission is granted so collection state remains visible while the player types.
- A verification session captures at most 10 photos.
- Identity data and photos are delivered server-side to Telegram; bot credentials never enter browser code or Git.
- The administrator surface remains protected by authentication.
- Administrator authentication is enforced at both the reverse proxy and application route boundary; peer containers cannot bypass it by calling the app directly.
- GitHub pushes to `main` deploy automatically after container health checks.

## Brand Commitments

Retain the incumbent yellow, white, charcoal, and muted-gray interface language unless the user requests a redesign.

## Evidence on Hand

- Existing admin receipt generator: `index.html`
- Existing verification API and Telegram integration: `server.js`
- Existing deployment container and health check: `Dockerfile` and `compose.yml`

## Product Principles

- Player tasks are focused on reviewing one linked invoice and never reveal administrator tooling.
- Data collection is explicit, visible, and understandable before permission prompts.
- Secrets and delivery logic stay on the server.
- Failed submissions explain recovery without discarding unsent captured photos.
