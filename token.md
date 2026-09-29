# License Tokens

Pool of license tokens accepted by the Settings > License renewal dialog.

These are **base64** encoded. Decoded, each one is a `fake-token-...` placeholder,
so they carry no real entitlement — they exist for development and demo data only.

| # | Token | Decoded |
|---|---|---|
| 1 | `ZmFrZS10b2tlbi0yMGNhcnJldHNyLW5vdC1yZWFs` | `fake-token-20carretsr-not-real` |
| 2 | `ZmFrZS10b2tlbi0yMGNhcnJldHNyLXRlc3QtMDAx` | `fake-token-20carretsr-test-001` |
| 3 | `ZmFrZS10b2tlbi0yMGNhcnJldHNyLWRlbW8tYWJj` | `fake-token-20carretsr-demo-abc` |
| 4 | `ZmFrZS10b2tlbi0yMGNhcnJldHNyLWRldi1vbmx5` | `fake-token-20carretsr-dev-only` |
| 5 | `ZmFrZS10b2tlbi0yMGNhcnJldHNyLW1vY2steHl6` | `fake-token-20carretsr-mock-xyz` |

## Raw list

```
ZmFrZS10b2tlbi0yMGNhcnJldHNyLW5vdC1yZWFs
ZmFrZS10b2tlbi0yMGNhcnJldHNyLXRlc3QtMDAx
ZmFrZS10b2tlbi0yMGNhcnJldHNyLWRlbW8tYWJj
ZmFrZS10b2tlbi0yMGNhcnJldHNyLWRldi1vbmx5
ZmFrZS10b2tlbi0yMGNhcnJldHNyLW1vY2steHl6
```

## Status

These tokens **are** enforced. `LICENSE_TOKENS` in `src/lib/license.ts` holds
the pool and `isValidLicenseToken()` checks membership, called from
`handleRenew` in `src/pages/settings/SettingsPage.tsx`. A submitted token that
is not in the pool never reaches the database: the dialog stays open and shows
"License not valid, please add another, recheck, or contact support."

A valid token restarts the term from today, stores itself in the
`license_token` settings row (so the License card shows the key that is
actually active) and stamps `license_activated_at`, which drives the expiry date
and remaining-days count.

Because a browser bundle cannot read this file at runtime, **the array in
`src/lib/license.ts` is the source of truth** — update it whenever this list
changes. Matching is exact after trimming; base64 is case-sensitive, so the
comparison does not fold case.
