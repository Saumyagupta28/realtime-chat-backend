# Real-Time Chat Backend

A backend service for real-time one-to-one messaging, built with Node.js, Express, MongoDB, and WebSockets.

The application provides secure user authentication, conversation management, persistent message storage, real-time message delivery, delivery acknowledgements, typing indicators, and online/offline presence tracking.

## Tech Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** MongoDB Atlas with Mongoose
- **Authentication:** JWT and bcryptjs
- **Real-time Communication:** WebSockets (`ws`)
- **Validation:** Joi
- **API Documentation:** Swagger / OpenAPI
- **Security:** Helmet, express-rate-limit
- **Testing:** Jest and Supertest

## Features

- User registration and login with password hashing and JWT authentication
- Protected REST APIs
- One-to-one conversation creation and listing
- Persistent message storage and message history
- Cursor-based message pagination and synchronization
- Real-time messaging using WebSockets
- Message delivery acknowledgements
- Typing indicators
- Online/offline presence tracking
- Request validation and centralized error handling
- Rate limiting and security headers
- Swagger API documentation
- Automated authentication, conversation, message, and WebSocket tests

## Installation and Setup

### Prerequisites

- Node.js (v18 or later)
- npm
- MongoDB Atlas account or local MongoDB instance
- Git

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd realtime-chat-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

Configure the following variables:

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `NODE_ENV` | Application environment |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_TEST_URI` | Separate test database connection string |
| `JWT_SECRET` | Secret used to sign JWT tokens (minimum 32 characters) |
| `JWT_EXPIRES_IN` | JWT expiration duration |

**Important:** Never commit your actual `.env` file or expose your database credentials and JWT secret.

### 4. Start the development server

```bash
npm run dev
```

The backend runs at:

```text
http://localhost:3000
```

WebSocket endpoint:

```text
ws://localhost:3000/ws
```

### 5. Run automated tests

```bash
npm test
```

## REST API Documentation

Interactive API documentation is available through Swagger UI:

```text
http://localhost:3000/api-docs
```

### Health Check

| Method | Endpoint | Authentication |
|---|---|---|
| GET | `/health` | Not required |

### Authentication

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user | Not required |
| POST | `/api/auth/login` | Authenticate a user and generate JWT | Not required |
| GET | `/api/auth/me` | Retrieve the authenticated user's profile | Required |

### Conversations

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/conversations` | Create or retrieve an existing one-to-one conversation | Required |
| GET | `/api/conversations` | Retrieve the user's conversations | Required |

### Messages

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/messages/:conversationId` | Send a message | Required |
| GET | `/api/messages/:conversationId` | Retrieve paginated conversation history | Required |
| GET | `/api/messages/:conversationId/sync?after=MESSAGE_ID` | Retrieve messages created after a given message | Required |

### Authentication Header

Protected REST endpoints require a JWT access token:

```http
Authorization: Bearer <JWT_TOKEN>
```

## WebSocket API Documentation

### 1. Connection

The application uses WebSockets for real-time communication.

**Endpoint:**

```text
ws://localhost:3000/ws
```

**Authentication:**

WebSocket connections require a valid JWT.

Pass the token in the HTTP upgrade request:

```http
Authorization: Bearer <JWT_TOKEN>
```

If the token is missing or invalid, the server responds with `401 Unauthorized` and closes the connection.

#### Successful Connection

Server sends:

```json
{
  "type": "connection:success",
  "message": "WebSocket connected successfully"
}
```

### 2. Sending Messages

#### Client → Server: `message:send`

Send a message to a conversation.

```json
{
  "type": "message:send",
  "payload": {
    "conversationId": "507f1f77bcf86cd799439011",
    "content": "Hello!"
  }
}
```

**Validation:**

- Conversation ID must be valid.
- Sender must belong to the conversation.
- Message content must contain 1–5000 characters.

The message is saved in MongoDB before being delivered.

#### Server → Sender: `message:sent`

Confirms that the message was successfully saved.

```json
{
  "type": "message:sent",
  "data": {
    "_id": "MESSAGE_ID",
    "conversation": "CONVERSATION_ID",
    "sender": "USER_ID",
    "content": "Hello!",
    "createdAt": "TIMESTAMP"
  }
}
```

#### Server → Recipient: `message:new`

Delivers the new message to connected participants.

```json
{
  "type": "message:new",
  "data": {
    "_id": "MESSAGE_ID",
    "conversation": "CONVERSATION_ID",
    "sender": "USER_ID",
    "content": "Hello!",
    "createdAt": "TIMESTAMP"
  }
}
```

### 3. Message Delivery Acknowledgement

#### Client → Server: `message:ack`

The receiving client acknowledges a message using its ID.

```json
{
  "type": "message:ack",
  "payload": {
    "messageId": "MESSAGE_ID"
  }
}
```

The server verifies that:

- The message exists.
- The message was sent by another user.
- The acknowledging user belongs to the conversation.

The server records the delivery timestamp in MongoDB.

#### Server → Original Sender: `message:delivered`

```json
{
  "type": "message:delivered",
  "data": {
    "messageId": "MESSAGE_ID",
    "deliveredAt": "TIMESTAMP"
  }
}
```

### 4. Typing Indicators

#### Client → Server: `typing:start`

```json
{
  "type": "typing:start",
  "payload": {
    "conversationId": "CONVERSATION_ID"
  }
}
```

#### Client → Server: `typing:stop`

```json
{
  "type": "typing:stop",
  "payload": {
    "conversationId": "CONVERSATION_ID"
  }
}
```

The server verifies conversation membership and forwards the corresponding event to the other connected participants.

#### Server → Recipient

Typing started:

```json
{
  "type": "typing:start",
  "data": {
    "conversationId": "CONVERSATION_ID",
    "userId": "USER_ID"
  }
}
```

Typing stopped:

```json
{
  "type": "typing:stop",
  "data": {
    "conversationId": "CONVERSATION_ID",
    "userId": "USER_ID"
  }
}
```

### 5. Online / Offline Presence

The server tracks active WebSocket connections for each user.

When a user's first connection opens, the server notifies other participants in their conversations.

When their last connection closes, the server notifies those participants that the user is offline.

#### Server → Client: `presence:update`

Online:

```json
{
  "type": "presence:update",
  "data": {
    "userId": "USER_ID",
    "status": "online"
  }
}
```

Offline:

```json
{
  "type": "presence:update",
  "data": {
    "userId": "USER_ID",
    "status": "offline"
  }
}
```

### 6. Error Handling

The server sends `message:error` when an incoming event cannot be processed.

Example:

```json
{
  "type": "message:error",
  "message": "Invalid conversation ID"
}
```

Other possible error messages include:

- Invalid message ID
- Message not found
- Access denied
- Conversation not found or access denied
- Message must contain 1–5000 characters
- Unsupported event type
- Unable to process message

### 7. Connection Health

The server implements a heartbeat mechanism using WebSocket ping/pong frames.

- A heartbeat is sent every 30 seconds.
- Clients respond with pong frames.
- Unresponsive connections are terminated.

This helps detect inactive or disconnected clients.

---

## License

This project is currently available for learning and demonstration purposes.