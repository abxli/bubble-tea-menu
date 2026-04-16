const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Pool } = require('pg');
const path    = require('path');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ────────────────────────────────────────────────────────────

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Auth routes ────────────────────────────────────────────────────────────────

// POST /api/auth/register  { username, password }
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (username.length < 3)    return res.status(400).json({ error: 'username must be at least 3 characters' });
  if (password.length < 6)    return res.status(400).json({ error: 'password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username.trim(), hash]
    );
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, SECRET, { expiresIn: '30d' });
    res.json({ token, username: rows[0].username });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login  { username, password }
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid username or password' });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, SECRET, { expiresIn: '30d' });
    res.json({ token, username: rows[0].username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Vocab items ────────────────────────────────────────────────────────────────

// GET /api/items  — public, no auth needed
app.get('/api/items', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY sort_order, tier, id');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Progress ───────────────────────────────────────────────────────────────────

// GET /api/progress  — returns { item_id: { correct, attempts }, streak, xp }
app.get('/api/progress', auth, async (req, res) => {
  try {
    const [progResult, metaResult] = await Promise.all([
      pool.query('SELECT item_id, correct, attempts FROM progress WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT streak, streak_date, xp FROM users WHERE id = $1', [req.user.id]),
    ]);

    const progress = {};
    progResult.rows.forEach(r => { progress[r.item_id] = { correct: r.correct, attempts: r.attempts }; });

    const meta   = metaResult.rows[0] || {};
    const today  = new Date().toDateString();
    const yest   = new Date(Date.now() - 86400000).toDateString();
    const sDate  = meta.streak_date ? new Date(meta.streak_date).toDateString() : '';
    const streak = (sDate === today || sDate === yest) ? (meta.streak || 0) : 0;

    res.json({ progress, streak, xp: meta.xp || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/progress  { updates: [{item_id, correct_delta, attempts_delta}], lessonXp, streakDate }
app.post('/api/progress', auth, async (req, res) => {
  const { updates = [], lessonXp = 0, streakDate } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of updates) {
      await client.query(`
        INSERT INTO progress (user_id, item_id, correct, attempts, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, item_id) DO UPDATE
          SET correct   = progress.correct   + EXCLUDED.correct,
              attempts  = progress.attempts  + EXCLUDED.attempts,
              updated_at = NOW()
      `, [req.user.id, u.item_id, u.correct_delta, u.attempts_delta]);
    }

    // Update streak + XP
    if (streakDate) {
      const { rows } = await client.query('SELECT streak, streak_date FROM users WHERE id = $1', [req.user.id]);
      const meta  = rows[0] || {};
      const today = new Date().toDateString();
      const yest  = new Date(Date.now() - 86400000).toDateString();
      const sDate = meta.streak_date ? new Date(meta.streak_date).toDateString() : '';
      let newStreak;
      if (sDate === today)  newStreak = meta.streak || 1;
      else if (sDate === yest) newStreak = (meta.streak || 0) + 1;
      else newStreak = 1;

      await client.query(
        'UPDATE users SET streak = $1, streak_date = $2, xp = COALESCE(xp,0) + $3 WHERE id = $4',
        [newStreak, new Date(), lessonXp, req.user.id]
      );
    }

    await client.query('COMMIT');

    // Return fresh state
    const [progResult, metaResult] = await Promise.all([
      client.query('SELECT item_id, correct, attempts FROM progress WHERE user_id = $1', [req.user.id]),
      client.query('SELECT streak, xp FROM users WHERE id = $1', [req.user.id]),
    ]);
    const progress = {};
    progResult.rows.forEach(r => { progress[r.item_id] = { correct: r.correct, attempts: r.attempts }; });
    const m = metaResult.rows[0] || {};
    res.json({ progress, streak: m.streak || 0, xp: m.xp || 0 });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Fallback: serve index.html for any non-API route ─────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Bubble Tea API running on :${PORT}`));
