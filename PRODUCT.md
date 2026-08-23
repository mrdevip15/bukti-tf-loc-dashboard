# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Players use a public mobile-friendly page to submit their identity details and complete visible camera verification.
- Administrators use a protected page to generate and manage fictional transfer receipt content.

## Product Purpose

Provide a transparent internal identity-verification flow that sends explicitly consented player data, location when permitted, IP address, and up to 10 visible camera photos to the company Telegram bot. Keep receipt generation separate from the player experience.

## Operating Context

Players usually open a shared HTTPS link on a phone, enter their full name and phone or ID, grant browser camera/location permissions, review the live camera preview, and submit. Administrators access the receipt generator through a separately protected route.

## Capabilities and Constraints

- Player-facing routes must not expose the invoice/receipt generator or its controls.
- Camera and location access require explicit, visible consent.
- Camera preview and active-capture status remain visible while collecting photos.
- A verification session captures at most 10 photos.
- Identity data and photos are delivered server-side to Telegram; bot credentials never enter browser code or Git.
- The administrator surface remains protected by authentication.
- GitHub pushes to `main` deploy automatically after container health checks.

## Brand Commitments

Retain the incumbent yellow, white, charcoal, and muted-gray interface language unless the user requests a redesign.

## Evidence on Hand

- Existing admin receipt generator: `index.html`
- Existing verification API and Telegram integration: `server.js`
- Existing deployment container and health check: `Dockerfile` and `compose.yml`

## Product Principles

- Player tasks are focused and never reveal administrator tooling.
- Data collection is explicit, visible, and understandable before permission prompts.
- Secrets and delivery logic stay on the server.
- Failed submissions explain recovery without discarding unsent captured photos.
