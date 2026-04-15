# Soft-Delete Guards — Implementation Notes

Migration `008_moderation.sql` adds `deleted_at TIMESTAMPTZ` to `users`, `exchanges`, and `messages`.

All existing queries that fetch or list these entities **must** include `WHERE deleted_at IS NULL`.
Below is a checklist of every query location that needs guarding.

## Required guards per controller

### `auth.controller.js`
- `SELECT … FROM users WHERE email = $1` → add `AND deleted_at IS NULL`
  - Soft-deleted users receive a 404 (not 401/403) at login to avoid account enumeration.

### `profile.controller.js`
- `SELECT … FROM users WHERE id = $1` → add `AND deleted_at IS NULL` (return 404 if missing)

### `exchanges.controller.js`
- `SELECT … FROM exchanges WHERE id = $1` → add `AND deleted_at IS NULL`
- List queries → add `AND e.deleted_at IS NULL`

### `search.controller.js`
- User search → add `AND u.deleted_at IS NULL`

### `messages` (socket / REST)
- Fetch room messages → add `AND m.deleted_at IS NULL`

### `reviews.controller.js`
- Reviews join users → add `AND u.deleted_at IS NULL` on the joined user

## Enumeration protection

Per the issue spec: users hitting a soft-deleted account **must receive 404**, never 403.
This applies to:
- `GET /api/v1/profile/:id`
- `GET /api/v1/users/:id` (reviews)
- `POST /api/v1/auth/login` (return generic 401, not "account suspended")

## Testing the guards

```sql
-- Manually soft-delete a test user
UPDATE users SET deleted_at = NOW() WHERE email = 'test@example.com';

-- Verify login blocked
POST /api/v1/auth/login { email: 'test@example.com', password: '...' }
-- Expected: 401 INVALID_CREDENTIALS (same as wrong password — no enumeration)

-- Verify profile 404
GET /api/v1/profile/<id>
-- Expected: 404 NOT_FOUND
```
