// generates short human-readable room codes like "RUSH4821"
// avoids confusing characters: 0/O and 1/I/L

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

// generates a random room code e.g. "XKCD48"
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// validates that a code matches the expected format before hitting the db
export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}
