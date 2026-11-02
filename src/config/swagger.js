const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    components: {
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
},
    openapi: "3.0.0",
    info: {
      title: "Real-Time Chat Backend API",
      version: "1.0.0",
      description: "API documentation for the real-time chat application",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;