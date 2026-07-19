# Stitch Design Export — Nexera AI Fitness Platform

Exported from Google Stitch project `projects/7421920922413726312` ("Nexera AI Fitness Platform") on 2026-07-19 via the Stitch MCP API.

## Contents

- `design.md` — Master design specification (Red-Luxury visual direction, Stitch prompts, translated from the NEXERA_BUILD doc library). Source of truth for visual design.
- `design-system.md` — Design tokens in Stitch's design-system markdown format (colors, fonts).
- `theme.json` — Full project theme: Material-style named colors, fonts (Playfair Display headlines, Inter body, JetBrains Mono labels), dark color mode, roundness.
- `screens/` — 35 generated screen designs as standalone HTML files (mobile, 780px wide). Each file is self-contained Tailwind-based markup usable as implementation reference.
- `screenshots/` — Rendered PNG of each screen, same basename as its HTML file.
- `manifest.json` — Maps each exported slug to its Stitch screen title, screen ID, and dimensions.

Screens with a `-v2` suffix are alternate variants of the same screen in Stitch.

Not exported: ~30 user-uploaded iPhone reference photos that live in the Stitch project (raw inspiration images, not designs).

## Screen inventory

Member app: home, onboarding, my-program, generate-ai-program, accept-program, scan-machine, machine-screen, set-logger, rest-timer, session-summary, pr-celebration, gamification-celebrations, daily-check-in, weekly-check-in, readiness, muscle-map, performance-dna, profile, social-feed, leaderboard, challenges-list, challenge-detail, messages.

Staff/owner: trainer-roster, floor-health.

## Regenerating this export

The Stitch MCP server is configured user-scoped in Claude Code (`stitch`, HTTP, `https://stitch.googleapis.com/mcp`, API-key auth). Use `list_screens` with projectId `7421920922413726312`, then download each screen's `htmlCode.downloadUrl` and `screenshot.downloadUrl`.
