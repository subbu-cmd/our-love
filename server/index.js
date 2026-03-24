const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors());
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
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e8 // 100MB for largish payloads if sent via socket
});

// JSON DB setup
const dbFile = path.join(__dirname, 'messages.json');
let messages = [];
if (fs.existsSync(dbFile)) {
  try {
    messages = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch (err) {
    console.error('Error reading DB', err);
  }
}

function saveDb() {
  fs.writeFileSync(dbFile, JSON.stringify(messages, null, 2), 'utf8');
}

// 2 Users
const ALLOWED_USERS = {
  'user1': { id: 'user1', name: 'Me', pass: 'love123', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Me' },
  'user2': { id: 'user2', name: 'Lover', pass: 'love123', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lover' }
};

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (ALLOWED_USERS[username] && ALLOWED_USERS[username].pass === password) {
    res.json({ success: true, userId: username, user: ALLOWED_USERS[username] });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/messages', (req, res) => {
  res.json(messages.slice(-300));
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

// Socket & WebRTC Signaling
const onlineUsers = new Map(); // socketId -> userId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  const broadcastOnline = () => {
    io.emit('online_status', Array.from(new Set(onlineUsers.values())));
  };

  socket.on('user_joined', (userId) => {
    socket.userId = userId;
    onlineUsers.set(socket.id, userId);
    broadcastOnline();
  });

  // MESSAGING
  socket.on('send_message', (msgData) => {
    const newMsg = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
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
    saveDb();
    io.emit('receive_message', newMsg);
  });
  
  socket.on('edit_message', ({ messageId, text }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && !msg.isDeleted) {
      msg.text = text;
      msg.isEdited = true;
      saveDb();
      io.emit('message_updated', msg);
    }
  });

  socket.on('delete_message_everyone', ({ messageId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.isDeleted = true;
      msg.text = 'This message was deleted';
      msg.mediaUrl = null;
      msg.voiceUrl = null;
      saveDb();
      io.emit('message_updated', msg);
    }
  });

  socket.on('react_message', ({ messageId, emoji, userId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      // Toggle logic
      if (msg.reactions[emoji].includes(userId)) {
        msg.reactions[emoji] = msg.reactions[emoji].filter(id => id !== userId);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
      } else {
        msg.reactions[emoji].push(userId);
      }
      saveDb();
      io.emit('message_updated', msg);
    }
  });

  socket.on('pin_message', ({ messageId, isPinned }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.isPinned = isPinned;
      saveDb();
      io.emit('message_updated', msg);
    }
  });

  socket.on('mark_read', ({ messageId, userId }) => {
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg.senderId !== userId && msg.status !== 'read') {
      msg.status = 'read';
      saveDb();
      io.emit('message_status_update', { messageId, status: 'read' });
    }
  });

  socket.on('typing', ({ userId, isTyping }) => {
    socket.broadcast.emit('user_typing', { userId, isTyping });
  });

  // WEBRTC SIGNALING
  // Using broadcast so the other user receives it (since there's only 2 users)
  socket.on('call_user', (data) => {
    socket.broadcast.emit('incoming_call', data);
  });
  
  socket.on('answer_call', (data) => {
    socket.broadcast.emit('call_answered', data);
  });

  socket.on('ice_candidate', (data) => {
    socket.broadcast.emit('ice_candidate', data);
  });

  socket.on('end_call', () => {
    socket.broadcast.emit('call_ended');
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.id);
      broadcastOnline();
      // Notify about potential call drop if they disconnect
      socket.broadcast.emit('peer_disconnected');
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Couple Chat Server v2 running on port ${PORT}`);
});
