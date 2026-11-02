
const { WebSocketServer, WebSocket } = require("ws");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

function initChatSocket(server) {
  const wss = new WebSocketServer({ noServer: true });
  const userSockets = new Map();
  const pendingPresenceNotifications = new Set();


const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    // Previous ping wasn't answered
    if (ws.isAlive === false) {
      console.log(`Terminating inactive connection: ${ws.userId}`);
      return ws.terminate();
    }

    // Wait for the next pong response
    ws.isAlive = false;

    // Send heartbeat ping
    ws.ping();
  });
}, 30000);

// Don't keep Node.js running only because of this timer
heartbeatInterval.unref();

// Clean up heartbeat timer when the HTTP server closes
server.on("close", () => {
  clearInterval(heartbeatInterval);
});


  // Notify conversation participants when a user comes online/offline
  async function notifyPresence(userId, status) {
    try {
      const conversations = await Conversation.find({
        participants: userId
      }).select("participants");

      const otherUserIds = new Set();

      for (const conversation of conversations) {
        for (const participantId of conversation.participants) {
          const otherUserId = participantId.toString();

          if (otherUserId !== userId) {
            otherUserIds.add(otherUserId);
          }
        }
      }

      for (const otherUserId of otherUserIds) {
        const sockets = userSockets.get(otherUserId);

        if (!sockets) continue;

        for (const client of sockets) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "presence:update",
              data: {
                userId,
                status
              }
            }));
          }
        }
      }
    } catch (error) {
      console.error("Presence notification error:", error.message);
    }
  }

  function trackPresenceNotification(userId, status) {
  const task = notifyPresence(userId, status);

  pendingPresenceNotifications.add(task);

  task.finally(() => {
    pendingPresenceNotifications.delete(task);
  });
}

  // Authenticate WebSocket connections using JWT
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.destroy();
      return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.userId = decoded.sub;
        wss.emit("connection", ws, req);
      });
    } catch (error) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  // Handle a successful WebSocket connection
  wss.on("connection", (ws) => {
    const userId = ws.userId;

    ws.isAlive = true;

// Mark connection healthy whenever the client responds
ws.on("pong", () => {
  ws.isAlive = true;
});

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }

    userSockets.get(userId).add(ws);

    // Notify others only when the user's first connection opens
    if (userSockets.get(userId).size === 1) {
      trackPresenceNotification(userId, "online");
    }

    console.log(`User connected: ${userId}`);

    ws.send(JSON.stringify({
      type: "connection:success",
      message: "WebSocket connected successfully"
    }));

    // Handle incoming WebSocket messages
    ws.on("message", async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        // ---------------------------------
        // 1. Handle typing indicators
        // ---------------------------------
        if (
          data.type === "typing:start" ||
          data.type === "typing:stop"
        ) {
          const { conversationId } = data.payload || {};

          if (!mongoose.isValidObjectId(conversationId)) {
            ws.send(JSON.stringify({
              type: "message:error",
              message: "Invalid conversation ID"
            }));
            return;
          }

          const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: ws.userId
          }).select("participants");

          if (!conversation) {
            ws.send(JSON.stringify({
              type: "message:error",
              message: "Conversation not found or access denied"
            }));
            return;
          }

          const eventType =
            data.type === "typing:start"
              ? "typing:start"
              : "typing:stop";

          for (const participantId of conversation.participants) {
            const recipientId = participantId.toString();

            if (recipientId === ws.userId) continue;

            const recipientSockets = userSockets.get(recipientId);

            if (!recipientSockets) continue;

            for (const recipientSocket of recipientSockets) {
              if (recipientSocket.readyState === WebSocket.OPEN) {
                recipientSocket.send(JSON.stringify({
                  type: eventType,
                  data: {
                    conversationId,
                    userId: ws.userId
                  }
                }));
              }
            }
          }

          return;
        }

        // ---------------------------------
        // 2. Handle message delivery acknowledgement
        // ---------------------------------
        if (data.type === "message:ack") {
          const { messageId } = data.payload || {};

          if (!mongoose.isValidObjectId(messageId)) {
            ws.send(JSON.stringify({
              type: "message:error",
              message: "Invalid message ID"
            }));
            return;
          }

          // Find a message sent by another participant
          const message = await Message.findOne({
            _id: messageId,
            sender: { $ne: ws.userId }
          });

          if (!message) {
            ws.send(JSON.stringify({
              type: "message:error",
              message: "Message not found"
            }));
            return;
          }

          // Verify that the current user belongs to the conversation
          const conversation = await Conversation.findOne({
            _id: message.conversation,
            participants: ws.userId
          }).select("participants");

          if (!conversation) {
            ws.send(JSON.stringify({
              type: "message:error",
              message: "Access denied"
            }));
            return;
          }

          // Record delivery time only once
          const updatedMessage = await Message.findOneAndUpdate(
            {
              _id: messageId,
              deliveredAt: null
            },
            {
              $set: { deliveredAt: new Date() }
            },
            { new: true }
          );

          // Notify the original sender
          const senderId = message.sender.toString();
          const senderSockets = userSockets.get(senderId);

          if (updatedMessage && senderSockets) {
            for (const senderSocket of senderSockets) {
              if (senderSocket.readyState === WebSocket.OPEN) {
                senderSocket.send(JSON.stringify({
                  type: "message:delivered",
                  data: {
                    messageId: updatedMessage._id,
                    deliveredAt: updatedMessage.deliveredAt
                  }
                }));
              }
            }
          }

          return;
        }

        // ---------------------------------
        // 3. Validate message sending event
        // ---------------------------------
        if (data.type !== "message:send") {
          ws.send(JSON.stringify({
            type: "message:error",
            message: "Unsupported event type"
          }));
          return;
        }

        const { conversationId, content } = data.payload || {};

        // Validate message content
        if (
          typeof content !== "string" ||
          content.trim().length === 0 ||
          content.trim().length > 5000
        ) {
          ws.send(JSON.stringify({
            type: "message:error",
            message: "Message must contain 1–5000 characters"
          }));
          return;
        }

        // Validate conversation ID
        if (!mongoose.isValidObjectId(conversationId)) {
          ws.send(JSON.stringify({
            type: "message:error",
            message: "Invalid conversation ID"
          }));
          return;
        }

        // Verify sender belongs to the conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: ws.userId
        });

        if (!conversation) {
          ws.send(JSON.stringify({
            type: "message:error",
            message: "Conversation not found or access denied"
          }));
          return;
        }

        // Save message in MongoDB
        const message = await Message.create({
          conversation: conversationId,
          sender: ws.userId,
          content: content.trim()
        });

        // Update conversation activity time
        await Conversation.updateOne(
          { _id: conversationId },
          { $set: { updatedAt: new Date() } }
        );

        const messageData = {
          _id: message._id,
          conversation: message.conversation,
          sender: ws.userId,
          content: message.content,
          createdAt: message.createdAt
        };

        // Confirm successful message creation to sender
        ws.send(JSON.stringify({
          type: "message:sent",
          data: messageData
        }));

        // Deliver message to other participants
        for (const participantId of conversation.participants) {
          const recipientId = participantId.toString();

          if (recipientId === ws.userId) continue;

          const recipientSockets = userSockets.get(recipientId);

          if (!recipientSockets) continue;

          for (const recipientSocket of recipientSockets) {
            if (recipientSocket.readyState === WebSocket.OPEN) {
              recipientSocket.send(JSON.stringify({
                type: "message:new",
                data: messageData
              }));
            }
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error.message);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "message:error",
            message: "Unable to process message"
          }));
        }
      }
    });

    // Handle WebSocket disconnection
    ws.on("close", () => {
      const sockets = userSockets.get(userId);

      if (sockets) {
        sockets.delete(ws);

        if (sockets.size === 0) {
         trackPresenceNotification(userId, "offline");
        }
      }

      console.log(`User disconnected: ${userId}`);
    });

    // Handle WebSocket errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });
  });
async function waitForPresenceNotifications() {
  await Promise.allSettled([...pendingPresenceNotifications]);
}
  return { wss, userSockets, waitForPresenceNotifications };
}

module.exports = initChatSocket;
