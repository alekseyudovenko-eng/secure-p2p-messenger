/**
 * Сигнальный сервер для P2P-коммуникаций.
 * Обеспечивает обмен SDP и ICE-кандидатами для установления прямого соединения.
 * Контент сообщений и медиапотоки через сервер НЕ передаются.
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: "*", // Разрешаем подключения с любых доменов (для GitHub Pages)
        methods: ["GET", "POST"] 
    }
});

// Хранилище активных пользователей в памяти: { userId: socketId }
const users = new Map();

io.on('connection', (socket) => {
    console.log(`[Signaling] Подключен клиент: ${socket.id}`);

    // 1. Регистрация пользователя в сети
    socket.on('register', (userId) => {
        // Если такой ID уже есть, удаляем старую сессию
        if (users.has(userId)) {
            const oldSocketId = users.get(userId);
            // Можно отправить событие 'force-disconnect' старому сокету, если нужно
        }
        
        users.set(userId, socket.id);
        console.log(`[Signaling] Пользователь ${userId} зарегистрирован.`);
        
        // Рассылаем всем обновленный список пользователей
        io.emit('user-list', Array.from(users.keys()));
    });

    // 2. Инициирование звонка (отправка Offer)
    socket.on('call-user', (data) => {
        const { userToCall, signalData, from } = data;
        const targetSocketId = users.get(userToCall);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming-call', { signal: signalData, from });
        } else {
            socket.emit('error', { message: 'Пользователь не в сети или неверный ID' });
        }
    });

    // 3. Принятие звонка (отправка Answer)
    socket.on('answer-call', (data) => {
        const { to, signal } = data;
        const targetSocketId = users.get(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-accepted', signal);
        }
    });

    // 4. Обмен ICE-кандидатами (для пробития NAT)
    socket.on('ice-candidate', (data) => {
        const { to, candidate } = data;
        const targetSocketId = users.get(to);
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', candidate);
        }
    });

    // 5. Отработка отключения
    socket.on('disconnect', () => {
        let disconnectedUserId = null;
        for (let [userId, sockId] of users.entries()) {
            if (sockId === socket.id) {
                users.delete(userId);
                disconnectedUserId = userId;
                console.log(`[Signaling] Пользователь ${userId} отключился.`);
                break;
            }
        }
        // Обновляем список у всех остальных
        io.emit('user-list', Array.from(users.keys()));
    });
});

// Запуск сервера на порту, указанном в переменных окружения, или 3000 по умолчанию
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[Signaling] Сервер запущен и слушает порт ${PORT}`);
});
