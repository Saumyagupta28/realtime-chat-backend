
const Joi = require("joi");

const sendMessageSchema = Joi.object({
  body: Joi.object({
    content: Joi.string()
      .trim()
      .min(1)
      .max(5000)
      .required()
  }).required(),

  params: Joi.object({
    conversationId: Joi.string()
      .hex()
      .length(24)
      .required()
  }).required(),

  query: Joi.object().unknown(true)
});

module.exports = {
  sendMessageSchema
};
