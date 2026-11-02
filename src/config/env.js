
function validateEnv() {
  const requiredVariables = [
    "MONGODB_URI",
    "JWT_SECRET"
  ];

  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing environment variables: ${missingVariables.join(", ")}`
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters"
    );
  }

  const port = Number(process.env.PORT || 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid port number");
  }

  process.env.PORT = String(port);

  const allowedEnvironments = [
    "development",
    "production",
    "test"
  ];

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  if (!allowedEnvironments.includes(process.env.NODE_ENV)) {
    throw new Error("NODE_ENV must be development, production, or test");
  }

  console.log(
    `Environment configuration validated (${process.env.NODE_ENV})`
  );
}

module.exports = validateEnv;
