const Joi = require("joi");

const createConversationSchema = Joi.object({
  body: Joi.object({
    participantId: Joi.string()
      .hex()
      .length(24)
      .required()
  }).required(),

  params: Joi.object().unknown(true),
  query: Joi.object().unknown(true)
});

module.exports = {
  createConversationSchema
};