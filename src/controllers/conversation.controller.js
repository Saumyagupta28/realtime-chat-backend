const Conversation = require("../models/Conversation");
const User = require("../models/User");

async function createConversation(req, res) {
  try {
    const { participantId } = req.body;
    const currentUserId = req.userId;

    // Validate participant ID
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required"
      });
    }

    // Prevent chatting with yourself
    if (participantId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "You cannot create a conversation with yourself"
      });
    }

    // Check whether the other user exists
    const participant = await User.findById(participantId);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found"
      });
    }

    // Check whether conversation already exists
    let conversation = await Conversation.findOne({
      participants: {
        $all: [currentUserId, participantId],
        $size: 2
      }
    });

    // Create conversation if it doesn't exist
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, participantId]
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation retrieved successfully",
      conversation
    });

  } catch (error) {
    console.error("Create conversation error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid participant ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}


async function getMyConversations(req, res) {
  try {
    const currentUserId = req.userId;

    const conversations = await Conversation.find({
      participants: currentUserId
    })
      .populate("participants", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });

  } catch (error) {
    console.error("Get conversations error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

module.exports = {
  createConversation,
  getMyConversations
};