// server.js
const express = require('express');
const http = require('http');
const ws = require('ws');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

const JWT_SECRET = 'REPLACE_WITH_A_STRONG_RANDOM_SECRET_IN_PRODUCTION';
const JWT_EXPIRES = '2h';

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// SIMPLE "DB" (in-memory). Replace with real DB in production.
const users = {}; // username -> { id, username, passwordHash }

// REGISTER
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username+password required' });
    if (users[username]) return res.status(409).json({ error: 'user exists' });
    const hash = await bcrypt.hash(password, 10);
    users[username] = { id: Object.keys(users).length + 1, username, passwordHash: hash };
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

// LOGIN -> sets HttpOnly cookie with JWT
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = users[username];
    if (!u) return res.status(401).json({ error: 'invalid' });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid' });
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie('token', token, { httpOnly: true }); // add 'secure: true' when using HTTPS
    return res.json({ ok: true, username });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

// LOGOUT
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Session info
app.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'unauth' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ username: payload.username });
  } catch (e) {
    res.status(401).json({ error: 'unauth' });
  }
});

const server = http.createServer(app);
const wss = new ws.Server({ server, path: '/ws' });

// Keep mapping username -> ws
const online = new Map();

wss.on('connection', (socket, req) => {
  // Simple auth: token must be provided as cookie during websocket upgrade.
  const cookies = req.headers.cookie || '';
  const cookieObj = Object.fromEntries(cookies.split(';').map(s => {
    const [k,v] = s.split('=').map(x=>x && x.trim());
    return [k, v];
  }));
  const token = cookieObj['token'];
  if (!token) {
    socket.send(JSON.stringify({ type: 'error', error: 'no auth token' }));
    socket.close();
    return;
  }
  let username;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    username = payload.username;
  } catch (e) {
    socket.send(JSON.stringify({ type: 'error', error: 'auth failed' }));
    socket.close();
    return;
  }

  socket.username = username;
  online.set(username, socket);
  console.log('ws connect:', username);

  // inform others of presence
  broadcastPresence();

  socket.on('message', (raw) => {
    try {
      const m = JSON.parse(raw);
      // Expected shapes:
      // { type: 'publicKey', to: 'bob', pub: '<base64>' }
      // { type: 'encrypted', to: 'bob', payload: {...} }
      const toSocket = online.get(m.to);
      if (!toSocket) {
        socket.send(JSON.stringify({ type: 'status', ok: false, message: `${m.to} offline` }));
        return;
      }
      m.from = username;
      toSocket.send(JSON.stringify(m));
    } catch (err) {
      console.error('invalid ws message', err);
    }
  });

  socket.on('close', () => {
    online.delete(username);
    console.log('ws disconnect:', username);
    broadcastPresence();
  });
});

function broadcastPresence() {
  const names = Array.from(online.keys());
  const msg = JSON.stringify({ type: 'presence', users: names });
  for (const s of online.values()) {
    s.send(msg);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server listening on', PORT);
  console.log('Open http://localhost:' + PORT);
});