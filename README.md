# SkillSwap — Prototype MVP

SkillSwap est une application mobile permettant à des utilisateurs jeunes d'échanger des compétences entre pairs selon un système de crédits-temps. Chaque échange est valorisé par une unité de crédit : l'enseignant en reçoit une, l'apprenant en cède une.

## Architecture technique

| Couche | Technologie |
|---|---|
| Application mobile | React Native + Expo |
| API REST | Node.js + Express |
| Base de données | PostgreSQL 16 |
| Temps réel | Socket.io (authentification JWT) |
| Authentification | JWT avec rotation des jetons de rafraîchissement |

## Mise en route

```bash
git clone https://github.com/ostrolawzyy-beep/skillswap.git
cd skillswap
cp backend/.env.example backend/.env   # renseigner JWT_SECRET et DB_PASSWORD
docker compose up -d
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

## Référence de l'API

### Authentification

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/auth/register | Inscription (âge minimum 15 ans, acceptation des CGU requise) |
| POST | /api/v1/auth/login | Connexion |
| POST | /api/v1/auth/refresh | Rotation du jeton de rafraîchissement |
| POST | /api/v1/auth/logout | Révocation du jeton de rafraîchissement |

### Profil

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/profile/me | Consultation du profil personnel |
| GET | /api/v1/profile/:userId | Consultation du profil public d'un utilisateur |
| PUT | /api/v1/profile/me | Modification du profil et téléversement de la photo |

### Compétences

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/skills | Liste des compétences référentielles (paramètres : q, category) |
| GET | /api/v1/skills/me | Compétences de l'utilisateur connecté |
| POST | /api/v1/skills/me | Ajout ou mise à jour d'une compétence |
| DELETE | /api/v1/skills/me/:id | Suppression d'une compétence |
| GET | /api/v1/skills/user/:userId | Compétences d'un utilisateur quelconque |

### Disponibilités

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/availabilities/me | Créneaux de l'utilisateur connecté |
| PUT | /api/v1/availabilities/me | Remplacement complet des créneaux |
| GET | /api/v1/availabilities/:userId | Créneaux d'un utilisateur quelconque |

### Recherche

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/search/users | Recherche d'utilisateurs par compétence, avec pagination |

### Échanges

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/exchanges | Création d'une demande d'échange |
| GET | /api/v1/exchanges | Liste des échanges (paramètres : status, role) |
| GET | /api/v1/exchanges/:id | Consultation d'un échange |
| PATCH | /api/v1/exchanges/:id/respond | Acceptation ou annulation (action : accept, cancel) |
| PATCH | /api/v1/exchanges/:id/confirm | Confirmation de réalisation (les deux parties requises) |

### Messagerie

| Méthode | Chemin | Description |
|---|---|---|
| GET | /api/v1/exchanges/:id/messages | Historique des messages (pagination par curseur) |
| POST | /api/v1/exchanges/:id/messages | Envoi d'un message (point de repli REST) |

### Évaluations

| Méthode | Chemin | Description |
|---|---|---|
| POST | /api/v1/exchanges/:id/reviews | Soumission d'une évaluation (uniquement après complétion) |
| GET | /api/v1/users/:userId/reviews | Liste des évaluations reçues par un utilisateur |

## Événements Socket.io

```
Connexion : { auth: { token: "<jeton d'accès JWT>" } }

Client vers serveur :
  join_exchange   { exchangeId }           — rejoindre la salle de discussion
  send_message    { exchangeId, content }  — envoyer un message
  typing          { exchangeId }           — diffuser un indicateur de saisie

Serveur vers client :
  joined_exchange { exchangeId }
  new_message     { id, content, created_at, sender: { id, pseudo } }
  partner_typing  { userId, pseudo }
  error           { message }
```

## Logique métier

### Score de compatibilité (0 à 100)

| Dimension | Points max | Règle de calcul |
|---|---|---|
| Adéquation des niveaux | 40 | Identique = 40, écart de 1 = 30, écart de 2 = 15, écart de 3 ou plus = 5 |
| Disponibilités communes | 30 | 3 points par jour commun, plafonné à 10 jours |
| Note du partenaire | 20 | Normalisation de 1-5 vers 0-20 |
| Expérience du partenaire | 10 | 1 point par échange réalisé, plafonné à 10 |

### Système de crédits

- Chaque utilisateur dispose à l'inscription d'un solde initial de 2 crédits.
- La création d'une demande d'échange requiert un solde d'au moins 1 crédit.
- À la complétion d'un échange : l'enseignant reçoit 1 crédit, l'apprenant en cède 1 (plancher à 0).

### Cycle de vie d'un échange

```
en_attente → accepté → [confirmation des deux parties] → complété
          └→ annulé (l'une ou l'autre partie)
```

## Avancement par sprint

- [x] Sprint 1 — Authentification et profil
- [x] Sprint 2 — Compétences, disponibilités et recherche
- [x] Sprint 3 — Échanges, score de compatibilité et messagerie temps réel
- [x] Sprint 4 — Crédits, évaluations et historique
