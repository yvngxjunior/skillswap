# SkillSwap MVP

A mobile app that lets young users exchange skills peer-to-peer using a time-credit system.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo (Sprint 1+) |
| API | Node.js + Express |
| Database | PostgreSQL 16 |
| Real-time | Socket.io (JWT-authenticated) |
| Auth | JWT (access + refresh rotation) |

## Quick start

```bash
git clone https://github.com/ostrolawzyy-beep/skillswap.git
cd skillswap
cp backend/.env.example backend/.env   # set JWT_SECRET + DB_PASSWORD
docker compose up -d
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

## Full API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | /api/v1/auth/register | Register (age ≥15, CGU required) |
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/refresh | Rotate refresh token |
| POST | /api/v1/auth/logout | Revoke refresh token |

### Profile
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/profile/me | Own profile |
| GET | /api/v1/profile/:userId | Public profile |
| PUT | /api/v1/profile/me | Update profile + photo upload |

### Skills
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/skills | All skills (?q= ?category=) |
| GET | /api/v1/skills/me | My skills |
| POST | /api/v1/skills/me | Add / update a skill |
| DELETE | /api/v1/skills/me/:id | Remove a skill |
| GET | /api/v1/skills/user/:userId | Any user’s skills |

### Availabilities
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/availabilities/me | My time slots |
| PUT | /api/v1/availabilities/me | Replace all slots |
| GET | /api/v1/availabilities/:userId | Any user’s slots |

### Search
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/search/users | Find by skill + pagination |

### Exchanges
| Method | Path | Description |
|---|---|---|
| POST | /api/v1/exchanges | Create exchange request |
| GET | /api/v1/exchanges | List my exchanges (?status= ?role=) |
| GET | /api/v1/exchanges/:id | Get one exchange |
| PATCH | /api/v1/exchanges/:id/respond | Accept or cancel (action: accept|cancel) |
| PATCH | /api/v1/exchanges/:id/confirm | Confirm completion (both sides needed) |

### Messages
| Method | Path | Description |
|---|---|---|
| GET | /api/v1/exchanges/:id/messages | Get message history (cursor-based) |
| POST | /api/v1/exchanges/:id/messages | Send message (REST fallback) |

### Reviews
| Method | Path | Description |
|---|---|---|
| POST | /api/v1/exchanges/:id/reviews | Submit review (post-completion only) |
| GET | /api/v1/users/:userId/reviews | Get all reviews for a user |

## Socket.io Events

```
Connect:  { auth: { token: "<JWT access token>" } }

Client → Server:
  join_exchange   { exchangeId }           — join a chat room
  send_message    { exchangeId, content }  — send a message
  typing          { exchangeId }           — broadcast typing indicator

Server → Client:
  joined_exchange { exchangeId }
  new_message     { id, content, created_at, sender: { id, pseudo } }
  partner_typing  { userId, pseudo }
  error           { message }
```

## Business Logic

### Compatibility Score (0–100)
| Dimension | Max pts | Rule |
|---|---|---|
| Skill level match | 40 | Exact=40, ±1 level=30, ±2=15, ±3+=5 |
| Shared availability | 30 | 3 pts/shared day, capped at 10 days |
| Partner rating | 20 | Normalised 1–5 → 0–20 |
| Partner experience | 10 | 1 pt/exchange, capped at 10 |

### Credit System
- Every user starts with **2 credits**
- Requesting an exchange requires ≥1 credit
- On completion: teacher **+1**, learner **-1** (floor at 0)

### Exchange Lifecycle
```
pending → accepted → [both confirm] → completed
       └→ cancelled (either side)
```

## Sprint Roadmap

- [x] Sprint 1 — Auth, Profile
- [x] Sprint 2 — Skills, Availabilities, Search
- [x] Sprint 3 — Exchanges, Matching score, Real-time chat
- [x] Sprint 4 — Credit system, Reviews, History
