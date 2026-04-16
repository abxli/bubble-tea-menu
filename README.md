# Bubble Tea Chinese 🧋

A Duolingo-style app to help me (and hopefully you as well) to learn to read Chinese bubble tea menus.  
All vocab lives in a Postgres database — edit it any time without touching the app.

---

## Quick start

### 1. Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### 2. Run
```bash
docker compose up --build
```
Open **http://localhost:3000** in your browser (or phone on the same network via your machine's IP).

### 3. Stop
```bash
docker compose down          # keep data
docker compose down -v       # wipe database too
```

---

## Editing vocab (add / remove / change words)

Connect to the database with any GUI tool (DBeaver, TablePlus, pgAdmin, etc.):

| Field      | Value         |
|------------|---------------|
| Host       | localhost     |
| Port       | 5432          |
| Database   | bubbletea     |
| Username   | bt_user       |
| Password   | bt_pass       |

Or via the command line:
```bash
docker compose exec db psql -U bt_user bubbletea
```

### Add a new word
```sql
INSERT INTO items (id, zh, py, en, tier, sort_order)
VALUES ('xinxian', '新鲜', 'xīnxiān', 'fresh', 2, 305);
```

### Edit an existing word
```sql
UPDATE items SET en = 'black / red' WHERE id = 'hong';
```

### Remove a word
```sql
DELETE FROM items WHERE id = 'xiancao';
```

### Change the sort order / tier
```sql
UPDATE items SET tier = 1, sort_order = 85 WHERE id = 'heitang';
```

Changes appear **immediately** — just refresh the app. No rebuild needed.

---

## Project structure

```
bubbletea/
├── docker-compose.yml      # Postgres + Node services
├── init.sql                # DB schema + seed data (runs once on first start)
└── backend/
    ├── Dockerfile
    ├── package.json
    ├── server.js           # Express API (auth, items, progress)
    └── public/
        └── index.html      # Frontend (served by Express)
```

---

## API endpoints

| Method | Path                  | Auth | Description                     |
|--------|-----------------------|------|---------------------------------|
| POST   | /api/auth/register    | No   | Create account                  |
| POST   | /api/auth/login       | No   | Log in, returns JWT             |
| GET    | /api/items            | No   | All vocab items                 |
| GET    | /api/progress         | JWT  | User's progress + streak + xp   |
| POST   | /api/progress         | JWT  | Submit lesson results           |
| GET    | /api/health           | No   | Health check                    |

---

## Production tips

1. **Change the JWT secret** in `docker-compose.yml`:
   ```yaml
   JWT_SECRET: some_long_random_string_here
   ```

2. **Change the DB password** (update both `POSTGRES_PASSWORD` and `DATABASE_URL`).

3. To expose the app on the internet, put it behind a reverse proxy (nginx, Caddy)
   and add HTTPS.
