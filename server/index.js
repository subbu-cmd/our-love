const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: [
    "https://our-love-k1qf.vercel.app",
    process.env.CLIENT_URL
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in environment variables.");
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB connection error:', err));
}

// ── Models ──────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatar: String
});
const User = mongoose.model('User', userSchema);

const pairSchema = new mongoose.Schema({
  pairId: { type: String, required: true, unique: true },
  user1: String,
  user2: String
});
const Pair = mongoose.model('Pair', pairSchema);

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  pairId: String,
  senderId: String,
  text: String,
  mediaUrl: String,
  mediaType: String,
  voiceUrl: String,
  replyTo: String,
  timestamp: String,
  status: { type: String, default: 'sent' },
  reactions: { type: mongoose.Schema.Types.Mixed, default: {} },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

// In-memory invite codes
const activeInvites = {};

// Setup uploads directory 
const uploadsDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
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
  maxHttpBufferSize: 1e8
});

// ── Auth Routes ───────────────────────────────────────────────────────────────

app.post('/api/signup', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!username || !email || !password || !confirmPassword)
    return res.status(400).json({ error: 'All fields are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ error: 'Passwords do not match' });

  try {
    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ error: 'Username taken' });

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;

    await User.create({ id: userId, username, email, passwordHash, avatar });
    res.json({ success: true, userId, user: { id: userId, username, email, avatar } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again later.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const pair = await Pair.findOne({ $or: [{ user1: user.id }, { user2: user.id }] });
      let partner = null;
      if (pair) {
        const partnerId = pair.user1 === user.id ? pair.user2 : pair.user1;
        const partnerUser = await User.findOne({ id: partnerId });
        if (partnerUser) partner = { id: partnerUser.id, username: partnerUser.username, avatar: partnerUser.avatar };
      }
      res.json({
        success: true,
        userId: user.id,
        user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar },
        pairId: pair?.pairId || null,
        partner
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/generate-invite', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findOne({ id: userId });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existingPair = await Pair.findOne({ $or: [{ user1: userId }, { user2: userId }] });
  if (existingPair) return res.status(400).json({ error: 'User already paired' });

  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  activeInvites[code] = userId;
  res.json({ success: true, code });
});

app.post('/api/pair', async (req, res) => {
  const { userId, code } = req.body;
  const user = await User.findOne({ id: userId });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const partnerId = activeInvites[code];
  if (!partnerId) return res.status(404).json({ error: 'Invalid or expired code' });
  if (partnerId === userId) return res.status(400).json({ error: 'Cannot pair with yourself' });

  const existingPair = await Pair.findOne({ $or: [{ user1: userId }, { user2: userId }] });
  if (existingPair) return res.status(400).json({ error: 'User already paired' });

  const pairId = crypto.randomUUID();
  await Pair.create({ pairId, user1: partnerId, user2: userId });
  delete activeInvites[code];

  const partnerUser = await User.findOne({ id: partnerId });
  res.json({
    success: true,
    pairId,
    partner: { id: partnerId, username: partnerUser.username, avatar: partnerUser.avatar }
  });
});

app.get('/api/messages', async (req, res) => {
  const { pairId } = req.query;
  if (!pairId) return res.json([]);
  const msgs = await Message.find({ pairId }).sort({ timestamp: 1 }).limit(300);
  res.json(msgs);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

// ── Socket & WebRTC Signaling ─────────────────────────────────────────────────

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('user_joined', ({ userId, pairId }) => {
    socket.userId = userId;
    socket.pairId = pairId;
    onlineUsers.set(socket.id, userId);
    if (pairId) {
      socket.join(pairId);
      io.to(pairId).emit('online_status', Array.from(new Set(onlineUsers.values())));
    }
  });

  socket.on('send_message', async (msgData) => {
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
      replyTo: msgData.replyTo || null,
      timestamp: new Date().toISOString(),
      status: 'sent',
      reactions: {},
      isEdited: false,
      isDeleted: false,
      isPinned: false
    };
    await Message.create(newMsg);
    io.to(pairId).emit('receive_message', newMsg);
  });

  socket.on('edit_message', async ({ messageId, text }) => {
    const msg = await Message.findOne({ id: messageId, pairId: socket.pairId });
    if (msg && !msg.isDeleted) {
      msg.text = text;
      msg.isEdited = true;
      await msg.save();
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('delete_message_everyone', async ({ messageId }) => {
    const msg = await Message.findOne({ id: messageId, pairId: socket.pairId });
    if (msg) {
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = null;
      msg.voiceUrl = null;
      await msg.save();
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('react_message', async ({ messageId, emoji, userId }) => {
    const msg = await Message.findOne({ id: messageId, pairId: socket.pairId });
    if (msg) {
      const reactions = msg.reactions || {};
      if (!reactions[emoji]) reactions[emoji] = [];
      if (reactions[emoji].includes(userId)) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji].push(userId);
      }
      msg.reactions = reactions;
      msg.markModified('reactions');
      await msg.save();
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('pin_message', async ({ messageId, isPinned }) => {
    const msg = await Message.findOne({ id: messageId, pairId: socket.pairId });
    if (msg) {
      msg.isPinned = isPinned;
      await msg.save();
      io.to(socket.pairId).emit('message_updated', msg);
    }
  });

  socket.on('mark_read', async ({ messageId, userId }) => {
    const msg = await Message.findOne({ id: messageId, pairId: socket.pairId });
    if (msg && msg.senderId !== userId && msg.status !== 'read') {
      msg.status = 'read';
      await msg.save();
      io.to(socket.pairId).emit('message_status_update', { messageId, status: 'read' });
    }
  });

  socket.on('typing', ({ userId, isTyping }) => {
    if (socket.pairId) socket.to(socket.pairId).emit('user_typing', { userId, isTyping });
  });

  socket.on('call_user', (data) => { if (socket.pairId) socket.to(socket.pairId).emit('incoming_call', data); });
  socket.on('answer_call', (data) => { if (socket.pairId) socket.to(socket.pairId).emit('call_answered', data); });
  socket.on('ice_candidate', (data) => { if (socket.pairId) socket.to(socket.pairId).emit('ice_candidate', data); });
  socket.on('end_call', () => { if (socket.pairId) socket.to(socket.pairId).emit('call_ended'); });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.id);
      if (socket.pairId) {
        io.to(socket.pairId).emit('online_status', Array.from(new Set(onlineUsers.values())));
        socket.to(socket.pairId).emit('peer_disconnected');
      }
    }
  });
});

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Couple Chat Server running with MongoDB' }));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Couple Chat Server running on port ${PORT}`));
