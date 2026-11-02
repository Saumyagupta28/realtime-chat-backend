
const Joi = require("joi");

const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().trim().email().required(),
    password: Joi.string().min(8).max(128).required()
  }).required(),

  params: Joi.object().unknown(true),
  query: Joi.object().unknown(true)
});

const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().required()
  }).required(),

  params: Joi.object().unknown(true),
  query: Joi.object().unknown(true)
});

module.exports = {
  registerSchema,
  loginSchema
};
