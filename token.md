# License Keys

Human-readable mirror of the key format enforced by `src/lib/license.ts`.
The app cannot read this file at runtime — **the code is the source of truth**;
update both when the format changes.

## Format

```
PREFIX-XXXX-XXXX-XXXX-XXXX[-XXXX]
```

- Case-insensitive (the app trims and upper-cases before validating).
- Four **or** five groups of four characters after the prefix; each character
  is `A–Z` or `0–9`.
- Examples: `M-A1B2-C3D4-E5F6-G7H8` (4 groups) and
  `M-AGR6-HGRW-ZS43-MVVG-YB5D` (5 groups).

## Terms

| Prefix | Plan       | Days added from activation |
| ------ | ---------- | -------------------------- |
| `M-`   | 1 Month    | 30                         |
| `3-`   | 3 Months   | 90                         |
| `Y-`   | 1 Year     | 365                        |

Anything else is rejected before it reaches the database, with the message in
`INVALID_LICENSE_KEY_MESSAGE` ("Invalid license key. Use M- (1 month), 3- (3
months) or Y- (1 year) followed by four or five groups of four characters…").

## Activation

`activateLicenseKey()` (`src/lib/licenseStore.ts`) validates the key, computes
`license_expires_at = now + plan.days`, then writes only these columns on
`public.center_settings` row `id = 1` (`saveLicenseActivation()` in
`src/lib/api.ts`):

| Column               | Value                                   |
| -------------------- | --------------------------------------- |
| `license_key`        | the normalized key                      |
| `license_plan`       | `1 Month` \| `3 Months` \| `1 Year`     |
| `license_status`     | `Active`                                |
| `license_expires_at` | ISO timestamp of the computed expiry    |

Everything else is derived from `license_expires_at`:

```ts
Math.max(0, Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)));
```

`daysRemaining <= 0` (or a missing/unreadable expiry) locks the app behind
`src/components/LicenseLockScreen.tsx`; activating a valid key there unlocks it
immediately, without a reload.

## Sample keys (development)

These are structurally valid and grant real terms — they are only samples for
testing the flow, not issued licenses:

```
M-A1B2-C3D4-E5F6-G7H8
M-AGR6-HGRW-ZS43-MVVG-YB5D
3-A1B2-C3D4-E5F6-G7H8
3-AGR6-HGRW-ZS43-MVVG-YB5D
Y-A1B2-C3D4-E5F6-G7H8
Y-AGR6-HGRW-ZS43-MVVG-YB5D
```
