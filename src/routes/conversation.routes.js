const express = require("express");

const validate = require("../middleware/validate.middleware");

const {
  createConversationSchema
} = require("../validators/conversation.validator");

const {
  createConversation,
  getMyConversations
} = require("../controllers/conversation.controller");

const authenticateUser = require("../middleware/auth.middleware");

const router = express.Router();
/**
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags:
 *       - Conversations
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantId
 *             properties:
 *               participantId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       201:
 *         description: Conversation created successfully
 *       400:
 *         description: Invalid participant ID or self-conversation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Participant not found
 */
router.post(
  "/",
  authenticateUser,
  validate(createConversationSchema),
  createConversation
);

/**
 * @swagger
 * /api/conversations:
 *   get:
 *     summary: Get all conversations of the logged-in user
 *     tags:
 *       - Conversations
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.get("/", authenticateUser, getMyConversations);

module.exports = router;