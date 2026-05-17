# Music Bingo — Project Map

Spotify-powered party music bingo. Host picks a playlist in their browser, players join via room code, and play on randomly-generated 5×5 boards. Host plays songs via the Spotify Web Playback SDK; players mark squares manually (no auto-detect). Single Node service deploys to Render's free tier.

## Stack (pinned)
- **Server**: Express 4 + Socket.IO 4 + `dotenv` (Node ≥20, ESM, plain JS)
- **Client**: React 18 + Vite 8 + TypeScript 6 + Tailwind CSS 4 (with `@tailwindcss/vite`)
- **Real-time**: Socket.IO
- **State**: in-memory `Map` on the server, GC'd 10 min after last activity
- **Auth**: Spotify OAuth Authorization Code flow (host only)

Versions live in [package.json](package.json), [server/package.json](server/package.json), [client/package.json](client/package.json). All versions are intentionally pinned — keep them pinned and >7 days old.

## Repo layout

```
/
  package.json               # workspaces (client, server); root scripts via concurrently
  .env                       # secrets (gitignored). Copy from .env.example
  CLAUDE.md                  # ← you are here
  server/src/
    index.js                 # Express bootstrap, OAuth routes, prod static serving
    spotify.js               # OAuth helpers, /me, fetchMyPlaylists, fetchPlaylistTracks
    rooms.js                 # in-memory Room store + GC, snapshot serializers
    bingo.js                 # board generation, line detection, validation
    socket.js                # ALL Socket.IO event handlers (host:* and player:*)
    ids.js                   # 6-char room codes (ambiguity-free alphabet), tokens
  client/
    vite.config.ts           # binds Vite to 127.0.0.1 (NOT localhost) — see "Gotchas"
    index.html
    src/
      main.tsx               # entry, applies theme on boot
      App.tsx                # router + header (Theme toggle + brand)
      routes/
        Landing.tsx          # Create / Join entry
        CreateGame.tsx       # Spotify connect → playlist picker → create room
        HostRoom.tsx         # lobby + in-game host UI (NowPlaying, claim modal)
        JoinGame.tsx         # room code + name form
        PlayerRoom.tsx       # board, square cycling, sticky BINGO! button
      components/
        BingoBoard.tsx       # 5×5 grid
        Square.tsx           # 3-state cycle: empty → possible → marked → empty
        ThemeToggle.tsx
        GoalBadge.tsx
        PlayerList.tsx
        NowPlaying.tsx       # host playback controls
        PlaylistPicker.tsx
        GlassCard.tsx
      lib/
        socket.ts            # Socket.IO singleton + emitAck helper
        spotifyPlayer.ts     # Web Playback SDK lifecycle + transfer/play helpers
        api.ts               # fetch wrappers, ensures fresh Spotify token
        storage.ts           # localStorage for resume tokens + Spotify creds
        theme.ts             # data-theme attribute + persistence
        types.ts             # shared TS types (mirrors server types)
        vite-env.d.ts        # ambient types for window.Spotify SDK
      styles/
        themes.css           # CSS vars for `glass` and `neon` themes
        globals.css          # Tailwind @import + @theme inline (Tailwind 4)
```

## Where features live

| Feature | File(s) |
|---|---|
| Room creation / room code | [server/src/socket.js](server/src/socket.js) `host:create` |
| Bingo board generation | [server/src/bingo.js](server/src/bingo.js) `generateBoard` |
| Validating a BINGO claim | [server/src/bingo.js](server/src/bingo.js) `findValidBingoLines` + `isFullBoardValid` |
| Goal progression (1→2→3→4→full) | [server/src/socket.js](server/src/socket.js) `maybeAdvanceGoal`, `nextGoal` |
| Spotify Web Playback SDK | [client/src/lib/spotifyPlayer.ts](client/src/lib/spotifyPlayer.ts) |
| Track-change broadcast | [client/src/routes/HostRoom.tsx](client/src/routes/HostRoom.tsx) → `host:track-changed` socket event |
| Reconnect/resume | `host:resume` / `player:resume` in [server/src/socket.js](server/src/socket.js); client emits on `connect` event |
| Theme switching | [client/src/lib/theme.ts](client/src/lib/theme.ts) + [client/src/styles/themes.css](client/src/styles/themes.css) |
| Tailwind 4 CSS-var color tokens | [client/src/styles/globals.css](client/src/styles/globals.css) `@theme inline` block |

## Running it

From the project root:

```
npm install
npm run dev          # starts Express on :3000 AND Vite on :5173
```

**Always access the app at `http://127.0.0.1:5173`** (not `localhost`) — the Spotify callback redirects via `CLIENT_ORIGIN` to `127.0.0.1`, and `localhost` may resolve to IPv6 only on Windows.

Production build/start:
```
npm run build        # builds client/dist
npm start            # node server/src/index.js, serves built client + API
```

## Environment

`.env` at repo root (gitignored). See [.env.example](.env.example):

```
SPOTIFY_CLIENT_ID=…
SPOTIFY_CLIENT_SECRET=…
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
PORT=3000
CLIENT_ORIGIN=http://127.0.0.1:5173
```

Dotenv is loaded from the repo root regardless of `cwd` — see top of [server/src/index.js](server/src/index.js).

### Spotify dev app

- Dashboard: https://developer.spotify.com/dashboard
- Redirect URI in dashboard must EXACTLY match `SPOTIFY_REDIRECT_URI` (byte-for-byte: no trailing slash, no comma, `127.0.0.1` not `localhost`).
- Scopes requested (defined in [server/src/spotify.js](server/src/spotify.js)): `streaming`, `user-modify-playback-state`, `playlist-read-private`, `playlist-read-collaborative`.
- **Host needs Spotify Premium** — the Web Playback SDK fires `account_error` otherwise (surfaced in `HostRoom` as a banner).
- Dev mode allowlists max 25 users — add your test accounts under app → User Management. Editorial/Spotify-curated playlists are NOT readable in dev mode; tell users to pick playlists they created themselves.

## Gotchas we've hit (don't re-debug these)

1. **Vite must bind to `127.0.0.1`, not `localhost`.** On Windows `localhost` often resolves to IPv6 only, while the Spotify callback redirects to IPv4. Fixed by `server.host: '127.0.0.1'` + `strictPort: true` in [client/vite.config.ts](client/vite.config.ts).
2. **Spotify deprecated `/playlists/{id}/tracks` in March 2026.** Use `/playlists/{id}/items` — response renames `items[].track` → `items[].item`. Handled in [server/src/spotify.js](server/src/spotify.js) `fetchPlaylistTracks` (falls back to `.track` if present).
3. **`/me/playlists` returns `tracks.total: 0` unreliably.** Don't gate the picker on that count — [client/src/components/PlaylistPicker.tsx](client/src/components/PlaylistPicker.tsx) lets users pick anything, and the ≥24-track check runs after fetching the real tracks in [client/src/routes/CreateGame.tsx](client/src/routes/CreateGame.tsx).
4. **"Device not found" 404 on first play.** Spotify's SDK reports `ready` with `device_id` before the device is *active*. [client/src/lib/spotifyPlayer.ts](client/src/lib/spotifyPlayer.ts) `startPlayback` retries up to 4 times (~2.7 s total), re-transferring between attempts.
5. **Spotify minimum scope still exposes basic profile.** Removing `user-read-private` only drops email/country/subscription from the consent screen — the user's `id`/`display_name`/picture/followers line is always present once any token is granted.
6. **Render free tier spins down on idle.** Reconnect/resume is built in via `localStorage` tokens + `host:resume`/`player:resume` socket events. Once the server restarts, in-flight room state is GONE — clients land on `/` with a "room no longer exists" path.

## Socket event surface (cheat sheet)

**Client → server** (see [server/src/socket.js](server/src/socket.js) for handlers):
- `host:create`, `host:resume`, `host:start`, `host:track-changed`, `host:validate-claim`, `host:advance-goal`, `host:end-game`, `host:get-track-uris`, `host:track-meta`
- `player:join`, `player:resume`, `player:mark-square`, `player:claim-bingo`, `player:track-meta`

**Server → client** (broadcast to room):
- `room:player-joined`, `room:players`, `room:goal-changed`, `room:track-changed`, `room:claim` (host-only), `room:bingo-confirmed`, `room:claim-rejected`, `room:started`, `room:ended`, `room:host-connected`, `room:host-disconnected`
- `player:board` (per-player, when boards are dealt)

## Bingo game rules

- 5×5 board, center cell is "FREE" (pre-marked).
- Each player gets 24 random tracks from the playlist (boards differ between players).
- Square states cycle on tap: `empty` → `possible` → `marked` → `empty`. Only `marked` counts toward a bingo.
- Goals advance in order: 1 line → 2 lines → 3 lines → 4 lines → full board.
- Server auto-validates BINGO claims: every marked cell in the claimed line(s) must correspond to a song the server has seen play. Host sees a modal with the player's board, the valid line(s) highlighted, and Accept/Reject buttons. Accepting auto-advances the goal if the threshold is met.
- Game ends when someone accepts a full-board claim; results screen shows winners by bingo count.

## Coding conventions

- Server is plain JS (ESM). Don't add TypeScript to the server.
- Client is TypeScript everywhere. Prefer existing types in [client/src/lib/types.ts](client/src/lib/types.ts).
- Tailwind 4 means colors are `@theme inline` CSS variables — `bg-accent`, `text-muted`, etc. resolve at runtime to whatever `data-theme="glass"` / `"neon"` defines in [client/src/styles/themes.css](client/src/styles/themes.css). To add a color, add it to BOTH theme blocks AND the `@theme inline` mapping in `globals.css`.
- Pinned package versions: never use carets in `devDependencies`. Pinned versions must be >7 days old before being adopted.
