# Admin API — SkillSwap

All admin endpoints require:
1. A valid **JWT access token** in the `Authorization: Bearer <token>` header.
2. The authenticated user must have `role = 'admin'` in the database.

Responses follow the standard `{ data, meta }` / `{ error, meta }` envelope.

---

## Authentication & role promotion

To promote a user to admin, run the following SQL directly on the database (no public endpoint is intentionally exposed for this):

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

---

## Analytics endpoints

All analytics endpoints accept the optional query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `from` | `YYYY-MM-DD` | Inclusive lower date bound |
| `to` | `YYYY-MM-DD` | Inclusive upper date bound |

---

### `GET /api/v1/admin/analytics/overview`

High-level platform snapshot.

**Response `data`:**
```json
{
  "totalUsers": 1024,
  "exchangesByStatus": {
    "pending": 42,
    "accepted": 18,
    "completed": 310,
    "cancelled": 25
  },
  "totalReviews": 280,
  "averageRating": 4.31,
  "activeUsers7d": 87
}
```

---

### `GET /api/v1/admin/analytics/exchange-volume`

Daily exchange counts grouped by status.

**Example request:**
```
GET /api/v1/admin/analytics/exchange-volume?from=2026-01-01&to=2026-04-15
```

**Response `data`:** array of
```json
{ "day": "2026-04-15T00:00:00.000Z", "status": "completed", "count": "12" }
```

---

### `GET /api/v1/admin/analytics/popular-skills`

Top 20 skills ranked by total exchange requests.

**Response `data`:** array of
```json
{
  "id": "uuid",
  "name": "Guitar",
  "category": "Music",
  "request_count": "47"
}
```

---

### `GET /api/v1/admin/analytics/user-retention`

Weekly new-user signup cohorts.

**Response `data`:** array of
```json
{ "week": "2026-04-13T00:00:00.000Z", "new_users": "34" }
```

---

## Error responses

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Valid JWT but user is not an admin |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
