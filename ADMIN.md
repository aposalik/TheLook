# TheLook Control Room

The administration panel is available at `/admin`. It is a privileged operational surface, not a normal customer route.

## Security model

Admin access is enforced by server routes, not by hidden navigation or client state.

1. The browser must have a valid Supabase session.
2. The server loads the user with `auth.getUser()`.
3. The user ID or normalized email must be present in a server-only allowlist.
4. Data is loaded with the service-role client only after authorization.
5. Every privileged mutation requires a reason and explicit confirmation.
6. Mutations append an event to `admin_audit_logs` before changing production state.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, or `ADMIN_EMAILS` through `NEXT_PUBLIC_*` variables.

## Setup

Add one or both allowlists to `web/.env.local` and to the protected production environment:

```dotenv
# Prefer immutable IDs in production.
ADMIN_USER_IDS=00000000-0000-0000-0000-000000000000

# Useful for initial bootstrap; comma-separated.
ADMIN_EMAILS=owner@example.com
```

Apply the migration:

```bash
supabase db push
```

Required migration:

```text
supabase/migrations/20261125231500_admin_control_room.sql
```

The panel remains read-only if the audit migration is missing: overview data can load with a warning, but mutations fail safely because no unaudited action is permitted.

## Current capabilities

- Live account totals and recent authenticated users
- Permanent/anonymous account breakdown
- Suspend and restore accounts, with self-suspension prevention
- Wardrobe, saved-look, feedback, render-job, and usage totals
- Recent wardrobe metadata and confirmed admin deletion
- Render status, item count, error code, units, and completion state
- Gemini, YouCam, Supabase, and Open-Meteo configuration readiness
- YouCam unit consumption and global budget progress
- Real-render kill switch
- Verified-account requirement
- Per-user, global daily, total-unit, and IP observation limits
- Append-only privileged-action audit feed
- Access-denied, loading, degraded-data, mutation, and confirmation states

## Destructive-action rules

- User suspension/restoration requires an operational reason and typed `SUSPEND`/`RESTORE` confirmation.
- Wardrobe deletion requires a reason and the exact item UUID.
- Disabling real rendering requires a reason and `STOP REAL RENDERS`.
- The active administrator cannot suspend their own account.
- User deletion is intentionally not exposed yet; account/data deletion needs a separate retention-safe workflow.

## Verification

Run from `web/`:

```bash
npx tsc --noEmit
npm run lint
npm run test:recommend
npm run eval:recommend
npm run build
```

For production acceptance, test with two accounts: one allowlisted administrator and one normal user. Confirm the normal user receives HTTP 403 from every `/api/admin/*` endpoint.
