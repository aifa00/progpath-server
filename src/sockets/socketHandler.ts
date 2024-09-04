import { Server as SocketIOServer } from "socket.io";

const handleSocketIO = (server: any) => {
  const io = new SocketIOServer(server, {
    pingTimeout: 60000,
    cors: {
      origin: process.env.REACT_APP_BASE_URL,
    },
  });

  io.on("connection", (socket) => {
    socket.on("setup", (userId) => {
      socket.join(userId);
      socket.emit("connected");
    });

    socket.on("join chat", (room) => {
      socket.join(room);
    });

    socket.on("new message", (newMessage, recipientId) => {
      if (!recipientId) return;
      socket.in(recipientId).emit("message recieved", newMessage);
    });

    socket.on("delete message", (message, recipientId) => {
      if (!message || !recipientId) return;
      socket.in(recipientId).emit("message deleted", message);
    });

    socket.on("disconnect me", () => {
      socket.disconnect();
    });
  });
};

export default handleSocketIO;
