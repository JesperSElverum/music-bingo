import { randomBytes } from 'node:crypto';

// Ambiguity-free: no 0/O, 1/I/L
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(existingCodes) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
    }
    if (!existingCodes.has(code)) return code;
  }
  throw new Error('Could not generate unique room code');
}

export function generateToken() {
  return randomBytes(24).toString('base64url');
}

export function generatePlayerId() {
  return 'p_' + randomBytes(8).toString('base64url');
}
