const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ТОЛЬКО ПАМЯТЬ. Никаких баз, никаких файлов.
const online = new Map();

io.on('connection', (socket) => {
  socket.on('register', (id) => {
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanId.length < 3) return;
    
    online.set(cleanId, socket.id);
    io.emit('user-list', Array.from(online.keys())); // Все видят всех
  });

  socket.on('disconnect', () => {
    for (let [id, sid] of online.entries()) {
      if (sid === socket.id) {
        online.delete(id);
        io.emit('user-list', Array.from(online.keys())); // Все видят, что ушёл
        break;
      }
    }
  });

  // Сигналинг для звонков (WebRTC)
  socket.on('call-user', d => { const t = online.get(d.to); if(t) io.to(t).emit('incoming-call', d); });
  socket.on('answer-call', d => { const t = online.get(d.to); if(t) io.to(t).emit('call-accepted', d.signal); });
  socket.on('ice-candidate', d => { const t = online.get(d.to); if(t) io.to(t).emit('ice-candidate', d.candidate); });
});

server.listen(process.env.PORT || 3000, () => console.log('🟢 Server ready'));
