# SkillSwap MVP

A mobile app that lets young users exchange skills peer-to-peer using a time-credit system.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo |
| API | Node.js + Express |
| Database | PostgreSQL 16 |
| Real-time | Socket.io |
| Auth | JWT (access + refresh rotation) |

## Repo structure

```
skillswap/
├── backend/
│   ├── src/
│   │   ├── controllers/   auth, profile, skills, availabilities, search
│   │   ├── database/      schema.sql, migrate.js, seed.js, db.js
│   │   ├── middlewares/   auth, validate, rateLimiter
│   │   ├── routes/        one file per resource
│   │   ├── socket/        Socket.io bootstrap
│   │   └── utils/         logger, jwt, response
│   ├── Dockerfile
│   └── package.json
├── mobile/              (Sprint 1+)
├── docker-compose.yml
└── README.md
```

## Quick start (Docker)

```bash
git clone https://github.com/ostrolawzyy-beep/skillswap.git
cd skillswap
cp backend/.env.example backend/.env   # then set JWT_SECRET
docker compose up -d
docker compose exec backend npm run migrate
docker compose exec backend npm run seed   # loads 20 default skills
```

## API endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/v1/auth/register | — | Create account |
| POST | /api/v1/auth/login | — | Get tokens |
| POST | /api/v1/auth/refresh | — | Rotate refresh token |
| POST | /api/v1/auth/logout | — | Revoke refresh token |

### Profile
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/profile/me | ✅ | Own profile |
| GET | /api/v1/profile/:userId | ✅ | Public profile |
| PUT | /api/v1/profile/me | ✅ | Update profile + photo |

### Skills (Sprint 2)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/skills | ✅ | All skills (?category= ?q=) |
| GET | /api/v1/skills/me | ✅ | My skills |
| POST | /api/v1/skills/me | ✅ | Add/update a skill |
| DELETE | /api/v1/skills/me/:id | ✅ | Remove a skill |
| GET | /api/v1/skills/user/:userId | ✅ | Any user's skills |

### Availabilities (Sprint 2)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/availabilities/me | ✅ | My slots |
| PUT | /api/v1/availabilities/me | ✅ | Replace all slots |
| GET | /api/v1/availabilities/:userId | ✅ | Any user's slots |

### Search (Sprint 2)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/v1/search/users | ✅ | Find users by skill |

## Response format

All responses follow the **senior-backend** standard:

```json
// Success
{ "data": { ... }, "meta": { "requestId": "uuid", "pagination": { ... } } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }, "meta": { "requestId": "uuid" } }
```

## Sprint roadmap

- [x] **Sprint 1** — Setup, Auth, Profile
- [x] **Sprint 2** — Skills, Availabilities, Search
- [ ] **Sprint 3** — Matching score, Exchanges, Chat
- [ ] **Sprint 4** — Credit system, Reviews, History
