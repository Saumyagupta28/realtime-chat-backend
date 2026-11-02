/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check backend health
 *     description: Verifies that the chat backend is running.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Backend is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: chat backend is running
 */
const express= require("express");

const {getHealth}=require("../controllers/health.controller");

const router= express.Router();

//router.get("/",getHealth);

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "chat backend is running"
  });
});

module.exports = router;