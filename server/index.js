const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); // For generating pairing codes

const app = express();
app.use(cors({
  origin: [
    "https://our-love-k1qf.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Setup uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://our-love-k1qf.vercel.app",
      process.env.CLIENT_URL
    ].filter(Boolean),
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8 // 100MB for largish payloads
});

// JSON DB setup
const dbMessagesFile = path.join(__dirname, 'messages.json');
const dbUsersFile = path.join(__dirname, 'users.json');
const dbPairsFile = path.join(__dirname, 'pairs.json');

let messages = [];
let users = {}; // { userId: { username, passwordHash, avatar } }
let pairs = {}; // { pairId: { user1, user2 } }
// Also map inviteCode -> userId
let activeInvites = {}; // { code: userId }

// Load databases
function loadDb(file, defaultData) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`Error reading ${file}`, err);
    }
  }
  return defaultData;
}
function saveDb(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

messages = loadDb(dbMessagesFile, []);
users = loadDb(dbUsersFile, {});
pairs = loadDb(dbPairsFile, {});

// Auth Routes
app.post('/api/signup', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  // Check if username exists
  const existingUsername = Object.values(users).find(u => u.username === username);
  if (existingUsername) return res.status(400).json({ error: 'Username taken' });

  // Check if email exists
  const existingEmail = Object.values(users).find(u => u.email === email);
  if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  users[userId] = {
    id: userId,
    username,
    email,
    passwordHash,
    avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`
  };
  saveDb(dbUsersFile, users);

  res.json({ success: true, userId, user: { id: userId, username, email, avatar: users[userId].avatar } });
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email
  const user = Object.values(users).find(u => u.username === identifier || u.email === identifier);

  if (user && await bcrypt.compare(password, user.passwordHash)) {
    // Find if user is in a pair
    const pairId = Object.keys(pairs).find(pId => pairs[pId].user1 === user.id || pairs[pId].user2 === user.id);
    let partnerId = null;
    let partner = null;
    if (pairId) {
      partnerId = pairs[pairId].user1 === user.id ? pairs[pairId].user2 : pairs[pairId].user1;
      if (partnerId) partner = { id: partnerId, username: users[partnerId]?.username, avatar: users[partnerId]?.avatar };
    }

    res.json({
      success: true,
      userId: user.id,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
      pairId,
      partner
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/generate-invite', (req, res) => {
  const { userId } = req.body;
  if (!users[userId]) return res.status(404).json({ error: 'User not found' });

  const existingPair = Object.keys(pairs).find(pId => pairs[pId].user1 === userId || pairs[pId].user2 === userId);
  if (existingPair) return res.status(400).json({ error: 'User already paired' });

  const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
  activeInvites[code] = userId;
  res.json({ success: true, code });
});

app.post('/api/pair', (req, res) => {
  const { userId, code } = req.body; // userId is the person accepting
  if (!users[userId]) return res.status(404).json({ error: 'User not found' });

  const partnerId = activeInvites[code];
  if (!partnerId) return res.status(404).json({ error: 'Invalid or expired code' });
  if (partnerId === userId) return res.status(400).json({ error: 'Cannot pair with yourself' });

  const existingPair = Object.keys(pairs).find(pId => pairs[pId].user1 === userId || pairs[pId].user2 === userId);
  if (existingPair) return res.status(400).json({ error: 'User already paired' });

  const pairId = crypto.randomUUID();
  pairs[pairId] = { user1: partnerId, user2: userId };
  saveDb(dbPairsFile, pairs);

  delete activeInvites[code]; // consume code

  const partner = users[partnerId];
  res.json({
    success: true,
    pairId,
    partner: { id: partnerId, username: partner.username, avatar: partner.avatar }
  });
});

app.get('/api/messages', (req, res) => {
  const { pairId } = req.query;
  if (!pairId) return res.json([]);
  // Filter messages for this pair only
  const pairMessages = messages.filter(m => m.pairId === pairId).slice(-300);
  res.json(pairMessages);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

// Socket & WebRTC Signaling
const onlineUsers = new Map(); // socketId -> userId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // For standard user joining
  socket.on('user_joined', ({ userId, pairId }) => {
    socket.userId = userId;
    socket.pairId = pairId;
    onlineUsers.set(socket.id, userId);

    if (pairId) {
      socket.join(pairId);
      // Notify partner
      io.to(pairId).emit('online_status', Array.from(new Set(onlineUsers.values())));
    }
  });

  // MESSAGING
  socket.on('send_message', (msgData) => {
    const pairId = socket.pairId;
    if (!pairId) return;

    const newMsg = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      pairId,
      senderId: msgData.senderId,
      text: msgData.text || null,
      mediaUrl: msgData.mediaUrl || null,
      mediaType: msgData.mediaType || null,
      voiceUrl: msgData.voiceUrl || null,
      replyTo: msgData.replyTo || null, // ID of message replied to
      timestamp: new Date().toISOString(),
      status: 'sent',
      reactions: {}, // { emoji: [userIds] }
      isEdited: false,
      isDeleted: false,
      isPinned: false
    };
    messages.push(newMsg);
    saveDb(dbMessagesFile, messages);
    io.to(pairId).emit('receive_message', newMsg);
  });

  socket.on('edit_message', ({ messageId, text }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.isDeleted && msg.pairId === socket.pairId) {
      msg.text = text; // If E2EE, this text is base64 ciphertext
      msg.isEdited = true;
      saveDb(dbMessagesFile, messages);
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('delete_message_everyone', ({ messageId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.pairId === socket.pairId) {
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = null;
      msg.voiceUrl = null;
      saveDb(dbMessagesFile, messages);
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('react_message', ({ messageId, emoji, userId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.pairId === socket.pairId) {
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      if (msg.reactions[emoji].includes(userId)) {
        msg.reactions[emoji] = msg.reactions[emoji].filter(id => id !== userId);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
      } else {
        msg.reactions[emoji].push(userId);
      }
      saveDb(dbMessagesFile, messages);
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('pin_message', ({ messageId, isPinned }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.pairId === socket.pairId) {
      msg.isPinned = isPinned;
      saveDb(dbMessagesFile, messages);
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('mark_read', ({ messageId, userId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.senderId !== userId && msg.status !== 'read' && msg.pairId === socket.pairId) {
      msg.status = 'read';
      saveDb(dbMessagesFile, messages);
      io.to(socket.pairId).emit('message_status_update', { messageId, status: 'read' });
    }
  });

  socket.on('typing', ({ userId, isTyping }) => {
    if (socket.pairId) {
      socket.to(socket.pairId).emit('user_typing', { userId, isTyping });
    }
  });

  // WEBRTC SIGNALING
  socket.on('call_user', (data) => {
    if (socket.pairId) socket.to(socket.pairId).emit('incoming_call', data);
  });

  socket.on('answer_call', (data) => {
    if (socket.pairId) socket.to(socket.pairId).emit('call_answered', data);
  });

  socket.on('ice_candidate', (data) => {
    if (socket.pairId) socket.to(socket.pairId).emit('ice_candidate', data);
  });

  socket.on('end_call', () => {
    if (socket.pairId) socket.to(socket.pairId).emit('call_ended');
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.id);
      if (socket.pairId) {
        io.to(socket.pairId).emit('online_status', Array.from(new Set(onlineUsers.values())));
        socket.to(socket.pairId).emit('peer_disconnected');
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Couple Chat Server is running' }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Couple Chat Server v3 running on port ${PORT}`);
});
