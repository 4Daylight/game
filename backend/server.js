require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
// 只允许你的 GitHub Pages 游戏网页调用，别改成 '*'，否则谁都能调你的库
app.use(cors({ origin: 'https://4daylight.github.io' }));

const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

let pool;
if (dbUrl) {
  pool = mysql.createPool(dbUrl);
} else {
  pool = mysql.createPool({
    host:     process.env.MYSQLHOST || process.env.DB_HOST,
    port:     process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    user:     process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  });
}


// 启动时自动建表（如果不存在）
(async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS saves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id VARCHAR(64) NOT NULL,
        slot TINYINT NOT NULL DEFAULT 1,
        data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_player_slot (player_id, slot)
      )
    `);
    console.log('数据库表已就绪');
  } catch (e) {
    console.error('建表失败：', e.message);
  }
})();

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'game backend is running' });
});

// 存 / 覆盖存档
app.post('/api/save', async (req, res) => {
  const { playerId, slot = 1, data } = req.body;
  if (!playerId || !data) return res.status(400).json({ ok: false, error: '缺少 playerId 或 data' });
  try {
    await pool.execute(
      `INSERT INTO saves (player_id, slot, data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
      [playerId, slot, JSON.stringify(data)]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 读取存档
app.get('/api/save', async (req, res) => {
  const { playerId, slot = 1 } = req.query;
  if (!playerId) return res.status(400).json({ ok: false, error: '缺少 playerId' });
  try {
    const [rows] = await pool.execute(
      'SELECT data FROM saves WHERE player_id = ? AND slot = ?',
      [playerId, slot]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: '存档不存在' });
    res.json({ ok: true, data: JSON.parse(rows[0].data) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 列出该玩家所有档位
app.get('/api/saves', async (req, res) => {
  const { playerId } = req.query;
  if (!playerId) return res.status(400).json({ ok: false, error: '缺少 playerId' });
  try {
    const [rows] = await pool.execute(
      'SELECT slot, updated_at FROM saves WHERE player_id = ? ORDER BY slot',
      [playerId]
    );
    res.json({ ok: true, slots: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`后端运行在端口 ${PORT}`);
});
