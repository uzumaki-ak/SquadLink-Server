# squadlink-server

real-time voice + chat backend for the squadlink gaming overlay app.

---

## stack

- **runtime**: node.js 20+
- **framework**: express + socket.io
- **db**: postgresql via supabase + prisma orm
- **auth**: supabase jwt (server verifies, never issues)
- **language**: typescript strict mode

---

## setup

```bash
pnpm install
cp .env.example .env        # fill in your values
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

server starts at `http://localhost:4000`

---

## commands

| command | what it does |
|---|---|
| `pnpm dev` | start with hot reload |
| `pnpm build` | compile ts to dist/ |
| `pnpm start` | run compiled build |
| `pnpm prisma:generate` | regenerate prisma client after schema changes |
| `pnpm prisma:migrate` | apply schema to db |
| `pnpm prisma:studio` | visual db explorer |

---

## testing apis — thunder client / postman

### base url
```
http://localhost:4000
```

### get a token first

hit supabase auth directly to get a jwt:
```
POST https://your-project.supabase.co/auth/v1/token?grant_type=password
Content-Type: application/json

{ "email": "test@example.com", "password": "yourpassword" }
```
copy `access_token` from the response. add it as `Authorization: Bearer <token>` on every request below.

---

### health

```
GET /health
```
no auth. returns `{ status: "ok" }` if the server is running.

---

### auth

```
POST /api/auth/profile                     create profile (once after signup)
Body: { "username": "playerone", "languageCode": "hi" }

GET  /api/auth/profile                     get your own profile

PATCH /api/auth/profile/language           update language
Body: { "languageCode": "en" }
```

---

### users

```
PATCH /api/users/me                        update username or avatar
Body: { "username": "newname" }

GET  /api/users/me/rooms                   last 10 rooms you joined
```

---

### rooms

```
POST /api/rooms                            create a room
Body: { "maxMembers": 4 }
→ response has "code" e.g. "XKCD48" — share with teammates

POST /api/rooms/join                       join by code
Body: { "code": "XKCD48" }

GET  /api/rooms/:roomId                    room details + active members

DELETE /api/rooms/:roomId/leave            leave the room

DELETE /api/rooms/:roomId                  close room (host only)
```

---

### chat (http — history only, live messages go via socket)

```
GET /api/chat/:roomId/history              paginated message history
Query: ?limit=50&beforeId=<messageId>      beforeId for loading older messages
```

---

### translate

```
POST /api/translate
Body: {
  "text": "rush now enemy left",
  "sourceLang": "en",          use "autodetect" to let mymemory guess
  "targetLang": "hi"
}
```

uses mymemory free api — no key needed, 50k chars/day with email in .env.

---

## socket.io

connect to `ws://localhost:4000` and pass the jwt in auth:
```js
io.connect("ws://localhost:4000", { auth: { token: "<jwt>" } })
```

### typical flow after http join

```
1. http POST /api/rooms/join           → get roomId
2. socket emit "room:join"             → { roomId }
3. socket emit "chat:send"             → { roomId, content, type: "TEXT" }
4. socket emit "subtitle:send"         → { roomId, originalText, originalLang }
5. socket emit "voice:set_mute"        → { roomId, isMuted: true }
6. socket emit "room:leave"            → { roomId }
```

### events you send

| event | payload |
|---|---|
| `room:join` | `{ roomId }` |
| `room:leave` | `{ roomId }` |
| `chat:send` | `{ roomId, content, type: "TEXT" or "QUICK_CMD" }` |
| `subtitle:send` | `{ roomId, originalText, originalLang }` |
| `voice:set_mute` | `{ roomId, isMuted }` |
| `webrtc:offer` | `{ roomId, targetUserId, fromUserId, sdp }` |
| `webrtc:answer` | `{ roomId, targetUserId, fromUserId, sdp }` |
| `webrtc:ice_candidate` | `{ roomId, targetUserId, fromUserId, candidate }` |

### events you receive

| event | when it fires |
|---|---|
| `room:member_joined` | someone joined your room |
| `room:member_left` | someone left or disconnected |
| `room:closed` | host closed the room |
| `chat:message` | new chat message or quick command |
| `subtitle:line` | teammate's transcribed voice (translate it client-side via /api/translate) |
| `voice:mute_state` | a teammate muted or unmuted |
| `webrtc:offer` | incoming offer from a peer |
| `webrtc:answer` | incoming answer from a peer |
| `webrtc:ice_candidate` | incoming ice candidate |
| `error` | socket-level error |

all emits support an ack callback:
```js
socket.emit("chat:send", payload, (res) => {
  if (res.ok) { /* delivered */ }
  else console.error(res.error)
})
```

---

## error shape

every error returns the same shape so android always knows how to parse it:
```json
{
  "success": false,
  "error": {
    "message": "room is full",
    "code": "ROOM_FULL"
  }
}
```

common error codes: `UNAUTHORIZED` `TOKEN_INVALID` `PROFILE_NOT_FOUND` `ROOM_NOT_FOUND` `ROOM_FULL` `ROOM_CLOSED` `ROOM_EXPIRED` `USERNAME_TAKEN` `RATE_LIMITED` `VALIDATION_ERROR` `NOT_IN_ROOM` `FORBIDDEN` `TRANSLATE_QUOTA_EXCEEDED`
