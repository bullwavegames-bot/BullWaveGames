# Implementation notes

## Configured business facts

- Brand: Bullwave Games
- Legal entity: BULL WAVE CLUB
- Domain: bullwavegames.com
- Audience: India-first, English, INR, all ages (no 18+ gate)
- Plans: Wave ₹399, Surge ₹799, Tide ₹1499 with the benefit lists in `frontend/src/config/product.ts`
- Timezone for daily rotation: Asia/Kolkata
- Sound muted by default
- No live payment provider is connected

## Prototype assumptions (not contractual)

Marked in the UI with notices where players would otherwise think they are live:

- `freeSessionAllowance = 3` and continue caps (Wave 1 / Surge 3 / Tide 5) are configurable placeholders
- Access period of 30 days after simulated activation
- Automatic renewal is **disabled**. Cancellation UI is hidden for non-renewing periods
- Displayed INR prices are treated as tax-inclusive; no verified tax breakdown exists
- Payment is a labeled prototype hosted-checkout chooser. It is **not** a real purchase
- Activation happens only from stored order status. Repeating the same succeeded callback cannot grant twice (`activated` flag)
- Admin user is seeded locally: `operations@bullwavegames.com` / `studio-ops-prototype`
- Passwords are stored in localStorage for this frontend prototype only. Production must hash server-side
- Policy pages are drafts
- Contact address and phone are unpublished placeholders
- Leaderboard names are sample data
- Popular sort is sample ordering
- Journal authors/dates are labeled as pending approval
- Guest session keys are anonymous cookies/local IDs, not verified identity
- Take-a-break reminders are local-browser only

## Production must

- Enforce membership perk entitlements on the server; published games remain free to launch
- Verify payment webhooks and keep secrets off the client
- Allowlist return URLs (already mirrored in `frontend/src/lib/access.ts`)
- Keep admin authorization on the server, not only the UI guard
