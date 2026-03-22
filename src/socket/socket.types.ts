// all socket.io event names and their payload types
// keeping them here means both gateways and the android client have one source of truth

// ─── events the SERVER emits to clients ───────────────────────────────────────

export interface ServerToClientEvents {
  // room membership events
  "room:member_joined": (payload: MemberJoinedPayload) => void;
  "room:member_left": (payload: MemberLeftPayload) => void;
  "room:closed": (payload: { roomId: string; reason: string }) => void;

  // chat events
  "chat:message": (payload: ChatMessagePayload) => void;

  // subtitle events (voice → transcribed text → translated text)
  "subtitle:line": (payload: SubtitleLinePayload) => void;

  // webrtc signaling
  "webrtc:offer": (payload: WebRtcSignalPayload) => void;
  "webrtc:answer": (payload: WebRtcSignalPayload) => void;
  "webrtc:ice_candidate": (payload: IceCandidatePayload) => void;

  // voice state
  "voice:mute_state": (payload: MuteStatePayload) => void;

  // error (for socket-level errors, not http errors)
  "error": (payload: { message: string; code: string }) => void;
}

// ─── events the CLIENT emits to the server ────────────────────────────────────

export interface ClientToServerEvents {
  // join a room's socket channel after http join succeeds
  "room:join": (payload: { roomId: string }, ack: AckCallback) => void;
  "room:leave": (payload: { roomId: string }, ack: AckCallback) => void;

  // chat
  "chat:send": (payload: SendChatPayload, ack: AckCallback) => void;

  // subtitles: client sends a transcribed line (vosk output) for broadcasting
  "subtitle:send": (payload: SendSubtitlePayload, ack: AckCallback) => void;

  // webrtc signaling - relayed server-side, not processed
  "webrtc:offer": (payload: WebRtcSignalPayload, ack: AckCallback) => void;
  "webrtc:answer": (payload: WebRtcSignalPayload, ack: AckCallback) => void;
  "webrtc:ice_candidate": (payload: IceCandidatePayload, ack: AckCallback) => void;

  // voice state changes
  "voice:set_mute": (payload: { roomId: string; isMuted: boolean }, ack: AckCallback) => void;
}

// ─── payload types ─────────────────────────────────────────────────────────────

export interface MemberJoinedPayload {
  userId: string;
  username: string;
  languageCode: string;
}

export interface MemberLeftPayload {
  userId: string;
  username: string;
}

export interface ChatMessagePayload {
  id: string;
  type: "TEXT" | "QUICK_CMD" | "SUBTITLE";
  content: string;
  translatedContent: string | null;
  originalLang: string | null;
  createdAt: string;
  sender: { id: string; username: string };
}

export interface SubtitleLinePayload {
  messageId: string;
  senderId: string;
  senderUsername: string;
  originalText: string;
  translatedText: string | null;
  originalLang: string;
  timestamp: string;
}

export interface SendChatPayload {
  roomId: string;
  content: string;
  type: "TEXT" | "QUICK_CMD";
}

export interface SendSubtitlePayload {
  roomId: string;
  originalText: string;
  originalLang: string;
}

export interface WebRtcSignalPayload {
  roomId: string;
  targetUserId: string;  // who this signal is for
  fromUserId: string;
  sdp?: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  roomId: string;
  targetUserId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface MuteStatePayload {
  roomId: string;
  userId: string;
  isMuted: boolean;
}

// socket acknowledgement callback - client waits for this to confirm delivery
export type AckCallback<T = void> = (response: { ok: true; data?: T } | { ok: false; error: string }) => void;

// data attached to each connected socket after auth
export interface SocketData {
  userId: string;
  username: string;
  languageCode: string;
}
