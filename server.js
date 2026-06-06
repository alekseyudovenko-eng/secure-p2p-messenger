// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
// Разрешаем подключения с ЛЮБОГО домена (GitHub Pages, localhost, etc.)
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Хранилище в памяти: { userId: socketId }
const users = new Map();

io.on('connection', (socket) => {
  // 1. Регистрация пользователя для списка онлайн
  socket.on('register', (userId) => {
    const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanId.length < 3) return;
    
    users.set(cleanId, socket.id);
    // Рассылаем всем обновлённый список
    io.emit('user-list', Array.from(users.keys()));
    console.log(`[+] ${cleanId} online`);
  });

  // 2. Обработка отключения (удаляем из списка)
  socket.on('disconnect', () => {
    for (let [id, sid] of users.entries()) {
      if (sid === socket.id) {
        users.delete(id);
        io.emit('user-list', Array.from(users.keys()));
        console.log(`[-] ${id} offline`);
        break;
      }
    }
  });

  // 3. Простая сигнализация для звонков (резерв, если PeerJS упадёт)
  // Но в клиенте мы будем использовать PeerJS для надёжности
  socket.on('signal', (data) => {
    const target = users.get(data.to);
    if (target) io.to(target).emit('signal', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🟢 Server running on port ${PORT}`));
