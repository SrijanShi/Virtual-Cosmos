require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const { registerHandlers } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3001'];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/session', require('./routes/session'));

// Serve React build when it exists (production)
const clientBuild = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuild));
app.use((req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/virtual-cosmos';
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.warn('MongoDB not connected (running without DB):', err.message));

// Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
