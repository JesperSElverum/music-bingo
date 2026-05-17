import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

export function emitAck<TRes>(event: string, payload: unknown, timeoutMs = 8000): Promise<TRes> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    s.emit(event, payload, (res: TRes) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
