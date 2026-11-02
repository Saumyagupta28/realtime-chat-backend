const express = require("express");
const validate = require("../middleware/validate.middleware");

const {
  sendMessageSchema
} = require("../validators/message.validator");

const {
  sendMessage,
  getMessages,
  syncMessages
} = require("../controllers/message.controller");

const authenticateUser = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * /api/messages/{conversationId}:
 *   post:
 *     summary: Send a message in a conversation
 *     tags:
 *       - Messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Hello! How are you?
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid message or conversation ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not a conversation participant
 *       404:
 *         description: Conversation not found
 */
router.post(
  "/:conversationId",
  authenticateUser,
  validate(sendMessageSchema),
  sendMessage
);

/**
 * @swagger
 * /api/messages/{conversationId}:
 *   get:
 *     summary: Get messages from a conversation
 *     tags:
 *       - Messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Message ID used to fetch older messages
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       400:
 *         description: Invalid conversation ID or cursor
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not a conversation participant
 *       404:
 *         description: Conversation not found
 */
router.get(
  "/:conversationId/sync",
  authenticateUser,
  syncMessages
);

/**
 * @swagger
 * /api/messages/{conversationId}/sync:
 *   get:
 *     summary: Sync messages received after a specific message
 *     tags:
 *       - Messages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the conversation
 *       - in: query
 *         name: after
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID after which new messages should be fetched
 *     responses:
 *       200:
 *         description: Messages synced successfully
 *       400:
 *         description: Invalid conversation ID or message cursor
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not a conversation participant
 *       404:
 *         description: Conversation not found
 */
router.get(
  "/:conversationId",
  authenticateUser,
  getMessages
);

module.exports = router;