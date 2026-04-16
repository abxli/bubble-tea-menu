-- ── Schema ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,          -- bcrypt hash
  streak       INT  NOT NULL DEFAULT 0,
  streak_date  TIMESTAMPTZ,
  xp           INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Vocab items — edit these freely to change what appears in the app
CREATE TABLE IF NOT EXISTS items (
  id   TEXT PRIMARY KEY,             -- short slug, e.g. 'cha'
  zh   TEXT NOT NULL,                -- Chinese characters
  py   TEXT NOT NULL,                -- pinyin
  en   TEXT NOT NULL,                -- English meaning
  tier INT  NOT NULL DEFAULT 1,      -- 1=must-know, 2=common, 3=toppings/extras
  sort_order INT NOT NULL DEFAULT 0  -- controls display order
);

CREATE TABLE IF NOT EXISTS progress (
  user_id    INT  REFERENCES users(id) ON DELETE CASCADE,
  item_id    TEXT REFERENCES items(id) ON DELETE CASCADE,
  correct    INT  NOT NULL DEFAULT 0,
  attempts   INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

-- ── Seed vocab data ───────────────────────────────────────────────────────────
-- To add/edit words: just UPDATE or INSERT here, then run:
--   docker compose exec db psql -U bt_user bubbletea
-- and paste your SQL, or use any DB GUI connected to localhost:5432.

INSERT INTO items (id, zh, py, en, tier, sort_order) VALUES
-- Tier 1 – absolute building blocks
('cha',      '茶',         'chá',                    'tea',                        1,  10),
('nai',      '奶',         'nǎi',                    'milk',                       1,  20),
('lv',       '绿',         'lǜ',                     'green',                      1,  30),
('hong',     '红',         'hóng',                   'red / black',                1,  40),
('wulong',   '乌龙',       'wūlóng',                 'oolong',                     1,  50),
('tang',     '糖',         'táng',                   'sugar',                      1,  60),
('bing',     '冰',         'bīng',                   'ice',                        1,  70),
('zhenzhu',  '珍珠',       'zhēnzhū',                'pearls',                     1,  80),

-- Tier 2 – common drink names & modifiers
('heitang',  '黑糖',       'hēi táng',               'brown sugar',                2, 100),
('moli',     '茉莉',       'mòlì',                   'jasmine',                    2, 110),
('ningmeng', '柠檬',       'níngméng',               'lemon',                      2, 120),
('naigai',   '奶盖',       'nǎi gài',                'cream top',                  2, 140),
('wutang',   '无糖',       'wú táng',                'no sugar',                   2, 150),
('shaotang', '少糖',       'shǎo táng',              'less sugar',                 2, 160),
('quantang', '全糖',       'quán táng',              'full sugar',                 2, 170),
('qubing',   '去冰',       'qù bīng',                'no ice',                     2, 180),
('shaobing', '少冰',       'shǎo bīng',              'less ice',                   2, 190),
('zcbing',   '正常冰',     'zhèngcháng bīng',        'normal ice',                 2, 200),
('dabei',    '大杯',       'dà bēi',                 'large cup',                  2, 210),
('zhongbei', '中杯',       'zhōng bēi',              'medium cup',                 2, 220),
('xiaobei',  '小杯',       'xiǎo bēi',               'small cup',                  2, 230),
('zznc',     '珍珠奶茶',   'zhēnzhū nǎi chá',        'pearl milk tea',             2, 240),
('hzznc',    '黑糖珍珠奶茶','hēi táng zhēnzhū nǎi chá','brown sugar pearl milk tea',2, 250),
('mknc',     '茉莉奶茶',   'mòlì nǎi chá',           'jasmine milk tea',           2, 260),
('wlnc',     '乌龙奶茶',   'wūlóng nǎi chá',         'oolong milk tea',            2, 270),
('sgc',      '水果茶',     'shuǐguǒ chá',            'fruit tea',                  2, 280),
('nmc',      '柠檬茶',     'níngméng chá',           'lemon tea',                  2, 290),
('htlt',     '红茶拿铁',   'hóng chá ná tiě',        'black tea latte',            2, 300),

-- Tier 3 – toppings
('biding',   '布丁',       'bùdīng',                 'pudding',                    3, 400),
('yeguo',    '椰果',       'yēguǒ',                  'coconut jelly',              3, 410),
('hongdou',  '红豆',       'hóngdòu',                'red bean',                   3, 420),
('xiancao',  '仙草',       'xiāncǎo',                'grass jelly',                3, 430)

ON CONFLICT (id) DO NOTHING;
