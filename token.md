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

The renewal dialog in `src/pages/settings/LicenseRenewDialog.tsx` currently only
checks that a token is non-blank; it does **not** validate it against this list.
To wire the list in, move the tokens into `src/lib/license.ts` as
`LICENSE_TOKENS` and check membership in the renewal handler before stamping the
new term.
