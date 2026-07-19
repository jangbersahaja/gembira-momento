# Authentication & Authorization

The management portal uses real accounts (stored in Postgres/Neon) with
signed, httpOnly session cookies — no more shared password / localStorage.

## Roles

| Role         | Access                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| `ADMIN`      | Everything, plus staff & registration link management (`/admin/staff`)             |
| `MANAGEMENT` | All management pages (dashboard, reports, sales analytics, products, live monitor) |
| `SUPERVISOR` | Live monitor, sales analytics, products                                            |
| `STAFF`      | Live monitor only (`/dashboard/sales-dashboard`)                                   |

Route → role mapping lives in `lib/auth/roles.ts` (`ROUTE_ACCESS`).

## How it works

1. **`proxy.ts`** (root) runs on every request (Next.js 16 renamed
   Middleware → Proxy). It decodes the `gm_session` cookie (a JWT signed
   with `SESSION_SECRET`) and:
   - Redirects unauthenticated users hitting a protected route to `/login`.
   - Redirects authenticated users whose role isn't allowed for a route to
     their own default page.
   - Redirects already-logged-in users away from `/login`.
2. **`lib/auth/session.ts`** creates/reads/deletes the session cookie
   (`jose` JWT, 24h expiry, httpOnly + secure in production).
3. **`lib/auth/dal.ts`** exposes `verifySession()` / `requireRole()` for a
   secure, server-side check close to the data (used in `protected-layout.tsx`
   and the admin page), per Next.js's recommended Data Access Layer pattern.
4. **`app/actions/auth.ts`** contains the Server Actions: `login`,
   `logout`, `registerWithToken`, `generateRegistrationLink`,
   `removeRegistrationLink`, `removeStaffMember`.
5. **`lib/auth/users.ts`** talks to Postgres (`users`, `registration_tokens`
   tables — see `scripts/db/schema.sql`). Passwords are hashed with bcrypt.

## Staff management (ADMIN only)

`/admin/staff` combines invite link generation, staff account listing, and
unused link cleanup in one page:

- **Generate a link**: admins pick a role and create a **single-use** invite
  link (`/register/<token>`). Visiting it lets someone create their own
  username/email/password; once used, the token is marked `used_at` and can
  never be reused again.
- **Staff accounts**: lists every user with their role; admins can remove an
  account (except their own).
- **Unused registration links**: lists links not yet consumed; admins can
  revoke any of them before they're used. Used links are kept as an audit
  trail and cannot be removed.

## Seeding the initial admin account

```bash
npm run db:init         # creates users / registration_tokens tables
npm run db:seed-admin   # creates/updates the admin account
```

The seeded admin (edit `scripts/db/seedAdminUser.js` to change):

- username: `jangbersahaja`
- email: `mmuter4@gmail.com`
- password: `jang1234`

**Change this password** by re-running the seed script with a new value.

## Environment variables

```bash
# .env.local
SESSION_SECRET=<openssl rand -base64 32>
DATABASE_URL=postgresql://...
```

`NEXT_PUBLIC_ADMIN_PASSWORD` is no longer used and can be removed.
