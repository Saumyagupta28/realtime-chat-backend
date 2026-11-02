const mongoose = require("mongoose");

const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

async function sendMessage(req, res) {
  try {
    const { content } = req.body;
    const { conversationId } = req.params;
    const currentUserId = req.userId;

    // 1. Validate message content
    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.trim().length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 1 to 5000 characters"
      });
    }

    // 2. Validate conversation ID
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    // 3. Check whether conversation exists
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    // 4. Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: currentUserId,
      content: content.trim()
    });

    // 5. Update conversation timestamp
    conversation.updatedAt = new Date();
    await conversation.save();

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message
    });

  } catch (error) {
    console.error("Send message error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}



async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { cursor } = req.query;
    const currentUserId = req.userId;

    // Validate conversation ID
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    // Check conversation membership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to access this conversation"
      });
    }

    const PAGE_SIZE = 50;

    let query = {
      conversation: conversationId
    };

    // If a cursor is provided, find the cursor message
    if (cursor) {
      if (!mongoose.isValidObjectId(cursor)) {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor"
        });
      }

      const cursorMessage = await Message.findOne({
        _id: cursor,
        conversation: conversationId
      });

      if (!cursorMessage) {
        return res.status(400).json({
          success: false,
          message: "Cursor message not found"
        });
      }

      // Fetch messages older than the cursor
      query.$or = [
        { createdAt: { $lt: cursorMessage.createdAt } },
        {
          createdAt: cursorMessage.createdAt,
          _id: { $lt: cursorMessage._id }
        }
      ];
    }

    // Fetch one extra message to check if more messages exist
    let messages = await Message.find(query)
      .populate("sender", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .limit(PAGE_SIZE + 1);

    const hasMore = messages.length > PAGE_SIZE;

    if (hasMore) {
      messages = messages.slice(0, PAGE_SIZE);
    }

    // Reverse to return messages in chronological order
    messages.reverse();

    const nextCursor = hasMore
      ? messages[0]._id
      : null;

    return res.status(200).json({
      success: true,
      count: messages.length,
      hasMore,
      nextCursor,
      messages
    });

  } catch (error) {
    console.error("Get messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve messages"
    });
  }
}



async function syncMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const { after } = req.query;
    const currentUserId = req.userId;

    // Validate conversation ID
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    // Verify conversation membership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: currentUserId
    });

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const PAGE_SIZE = 100;

    let query = {
      conversation: conversationId
    };

    // Find messages created after the last synced message
    if (after) {
      if (!mongoose.isValidObjectId(after)) {
        return res.status(400).json({
          success: false,
          message: "Invalid sync cursor"
        });
      }

      const lastMessage = await Message.findOne({
        _id: after,
        conversation: conversationId
      });

      if (!lastMessage) {
        return res.status(400).json({
          success: false,
          message: "Sync cursor not found"
        });
      }

      query.$or = [
        { createdAt: { $gt: lastMessage.createdAt } },
        {
          createdAt: lastMessage.createdAt,
          _id: { $gt: lastMessage._id }
        }
      ];
    }

    // Fetch messages newer than the cursor
    let messages = await Message.find(query)
      .populate("sender", "name email")
      .sort({ createdAt: 1, _id: 1 })
      .limit(PAGE_SIZE + 1);

    const hasMore = messages.length > PAGE_SIZE;

    if (hasMore) {
      messages = messages.slice(0, PAGE_SIZE);
    }

    const nextCursor = hasMore
      ? messages[messages.length - 1]._id
      : null;

    return res.status(200).json({
      success: true,
      count: messages.length,
      hasMore,
      nextCursor,
      messages
    });

  } catch (error) {
    console.error("Sync messages error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synchronize messages"
    });
  }
}



module.exports = {
  sendMessage,
  getMessages,
  syncMessages
};