Okay, I'll perform an end-to-end check of your WebRTC streaming setup based on the files you've indicated and common WebRTC principles.

**Overall Goal:** Ensure that the client (`WebRTCStreamManager.tsx` and `page.tsx`) and server (`server.js`, `socketHandler.ts`) correctly perform the WebRTC signaling dance using Socket.IO, and that MediaSoup is configured and used properly for media transport. Environment and deployment configurations (`.env`, `docker-compose-prod.yaml`) are also critical.

Let's break this down:

**1. `server.js` (Custom Next.js Server)**

- **Purpose**: Initializes the Next.js app, the HTTP server, and integrates the Socket.IO server.
- **Review (based on previously provided code)**:
  - Correctly handles different environments (dev/prod) for loading `socketHandler`.
  - `initSocketIO` function creates a Socket.IO server instance. This instance is then passed to `initializeSocketIOServer` from `socketHandler.ts`. This is a valid approach, ensuring the main server file controls the initial Socket.IO server setup (like CORS, path) which is then augmented by `socketHandler.ts` with WebRTC specific logic.
  - The `httpServer.on('upgrade', ...)` logic correctly defers Socket.IO upgrade requests to Socket.IO itself and handles non-Socket.IO upgrades by closing them. This is good.
  - Graceful shutdown is implemented.
- **Key Checks**:
  - Ensure `process.env.PORT`, `process.env.HOST` are correctly used.
  - The debug logging for file structure is helpful; ensure the paths for `socketHandler` and `logger` resolve correctly in both development (ts-node) and production (dist).

**2. `socketHandler.ts` (Server-Side Socket Logic & MediaSoup)**

- **Purpose**: Manages all Socket.IO communication, WebRTC signaling, and MediaSoup anagement (workers, routers, transports, producers, consumers).
- **Review (based on previously provided code)**:
  - **MediaSoup Configuration**: `mediasoupAppConfig` uses environment variables. `MEDIASOUP_LISTEN_IP`, `MEDIASOUP_ANNOUNCED_IP`, and the port range (`MEDIASOUP_MIN_PORT`, `MEDIASOUP_MAX_PORT`) are critical.
    - `MEDIASOUP_ANNOUNCED_IP` _must_ be the public IP of your server if clients are external, or the appropriate local/docker IP if clients are on the same network/host. If this is misconfigured, ICE negotiation will fail.
  - **`initializeSocketIOServer`**: Correctly uses an existing Socket.IO instance if passed, or creates a new one. Initializes the MediaSoup worker.
  - **Connection Handling (`io.on("connection", ...)`):**
    - Client identification via `socket.handshake.query` looks standard.
  - **WebRTC Signaling Events:**
    - `getRouterRtpCapabilities`: Server provides its router's RTP capabilities. Client sends its own, which are stored on the `peer` object. This is correct.
    - `createProducerTransport` / `createConsumerTransport`: Server creates MediaSoup WebRTC transports. Parameters are sent back to the client.
    - `connectTransport`: Client provides DTLS parameters; server connects the transport.
    - `produce`: Client indicates it wants to send media. Server creates a MediaSoup producer. If it's a streamer, a `new-producer` event is emitted to the room.
    - `consume`: Client indicates it wants to receive media from a specific producer. Server creates a MediaSoup consumer.
    - `broadcaster_ready`:
      - When a broadcaster emits this, the server updates the peer's `isStreamer` status.
      - It then emits `broadcaster_ready` _to the room_ (line 738 `io.to(\`stream:\${streamId}\`).emit("broadcaster_ready", ...)`), including a list of `activeProducers` from that broadcaster.
      - **Potential Issue/Clarification**: The `activeProducers` are derived from `peer.producers` (lines 707-716). This map is populated when the client successfully calls the `produce` event. If the client emits `broadcaster_ready` _before_ its `produce` calls have successfully completed on the server, this list might be empty initially. The client-side logic in `WebRTCStreamManager.tsx` must ensure `produce` calls are made (and ideally acknowledged) before signaling `broadcaster_ready`, or there needs to be a robust way for viewers to fetch current producers (e.g., using the `getProducers` event which is present).
    - `viewer_ready`: Server responds to the viewer with information about the current streamer and their active producers.
  - **Room/Peer Management**: Logic for creating rooms, managing peers, and cleaning up inactive sessions/empty rooms is present. `ensureOnlyOneStreamerInRoom` enforces a single streamer.
  - **Error Handling**: Seems fairly comprehensive with `formatError` and emitting error events.
- **Key Checks**:
  - The sequence of events expected from the client (especially the broadcaster) must align with how the server processes them. (e.g., `getRouterRtpCapabilities` -> `createProducerTransport` -> `connectTransport` -> `produce` (for each track) -> `broadcaster_ready`).
  - Ensure `mediasoupWorker` creation is robust and worker `died` events are handled (attempting restart is good).

**3. `page.tsx` (Frontend Live Stream Page)**

- **Purpose**: Renders the stream UI, fetches stream details, and hosts the `WebRTCStreamManager` component.
- **Review (based on previously provided code)**:
  - Correctly fetches stream details and determines if the current user is the streamer.
  - Passes necessary props like `streamId`, `userId`, `username`, `isStreamer`, `isCameraOn`, `isMicrophoneOn`, `isAnonymous` to `WebRTCStreamManager`.
  - Handles UI for starting/ending streams (via API calls), toggling camera/mic (updates local state passed as props).
  - `handleReconnect` works by changing the `key` prop of `WebRTCStreamManager`, forcing a remount, which is a valid strategy for a hard reset of the WebRTC component.
  - Provides good logging and an error display mechanism.
- **Key Checks**:
  - The `isCameraOn` and `isMicrophoneOn` states are managed here and passed as props. `WebRTCStreamManager` will need to react to changes in these props to (un)publish tracks.
  - Anonymous user handling (`effectiveUserId`, `effectiveUsername`, `isAnonymous` prop) seems correct.

Given the user's problem description (stalling after `broadcaster_ready`, no `getRouterRtpCapabilities` completion or transport creation logs from the client, no media device logs), the primary area of concern will be `WebRTCStreamManager.tsx` and the environment configuration.

I will now request the content of `WebRTCStreamManager.tsx`, `.env`, `.env.prod`, and `docker-compose-prod.yaml` to continue the end-to-end check.

First, let's look at `WebRTCStreamManager.tsx`. I'll use the `read_file` tool for this.

Read file: src/app/(streams)/live-streams/[id]/components/WebRTCStreamManager.tsx
I have the content of `WebRTCStreamManager.tsx`. It's a very large file, so I'll focus on the key areas relevant to the user's problem: initialization, Socket.IO event handling, MediaSoup device loading, transport and producer/consumer creation, and media acquisition.

**4. `WebRTCStreamManager.tsx` (Client-Side WebRTC Logic)**

- **Purpose**: Handles all client-side WebRTC operations: connects to Socket.IO, manages the MediaSoup device, creates transports, producers, and consumers, and handles media streams.
- **Initial Review of Structure and Key Parts (based on outline and initial lines):**

  - **Logging**: Extensive custom logging system (`log`, `logError`, `logInfo`, etc.) is present. `CURRENT_LOG_LEVEL` is set to `TRACE`, which is good for debugging. It also includes `setupWebRTCDebugLogging` to capture native WebRTC logs.
  - **State**: Uses `useState` and `useRef` for managing state like `socket`, `device` (mediasoup-client Device), `producerTransport`, `consumerTransport`, `videoProducer`, `audioProducer`, `consumers`, `localStream`, `remoteStreams`, `connectionState`, `selectedVideoDevice`, `selectedAudioDevice`, etc.
  - **Props**: Receives `streamId`, `userId`, `username`, `isStreamer`, `isCameraOn`, `isMicrophoneOn`, `isAnonymous`, and callbacks like `onConnectionError`, `onMediaError`.
  - **`useRuntimeConfig`**: Used to get `socketUrl`, `stunServerUrl`, `turnServerUrl`. This is crucial for connecting to the correct Socket.IO server and for ICE negotiation.
  - **`useEffect` for Initialization (`attemptConnection`)**: This is likely the main effect hook that kicks off the connection process. It probably sets up the socket and then proceeds with WebRTC setup.
  - **Socket Connection (`connectSocket` function, likely called by `attemptConnection`):**
    - Establishes a Socket.IO connection. The URL should be derived from `runtimeConfig.socketUrl`.
    - Passes `streamId`, `userId`, `username`, `isStreamer`, `isAnonymous` in `socket.io.opts.query`. This matches what `socketHandler.ts` expects.
    - Sets up listeners for various socket events (`connect`, `disconnect`, `error`, `connection_established`, `broadcaster_ready`, `new-producer`, `consumerClosed`, etc.).
  - **MediaSoup Device Initialization (`loadDevice` function):**
    - After socket connection, it should emit `getRouterRtpCapabilities` to the server.
    - On receiving the router's RTP capabilities, it calls `device.load({ routerRtpCapabilities })`. This is a critical step. **The user's log indicates this might not be completing.**
  - **Transport Creation (`setupProducerTransport`, `setupConsumerTransport`):**
    - For `producerTransport`: Emits `createProducerTransport` to the server. Gets params, creates local transport using `device.createSendTransport(params)`.
    - Sets up `connect` and `produce` event listeners on the transport.
  - **Producing Media (`publish` or similar function, often called after `producerTransport` is ready):**
    - Acquires local media (`getUserMedia`). **The user's log indicates no camera/mic access logs.** This step needs to be checked carefully for permissions and errors.
    - For each track (audio, video), calls `producerTransport.produce({ track, ... })`.
    - The `appData` in `produce` can be used to pass metadata.
  - **`broadcaster_ready` Emission**: After producers are set up, if `isStreamer`, it should emit `broadcaster_ready` to the server. The timing of this relative to `transport.produce()` calls is important.
  - **Consuming Media (for viewers, or for broadcaster to see their own stream if loopback is implemented):**
    - Listens for `new-producer` from the server (or gets producers from `broadcaster_ready` event).
    - For each new producer, calls `setupConsumerTransport` (if not already done).
    - Emits `consume` to the server with its `rtpCapabilities` and the `producerId`.
    - Gets consumer params, calls `consumerTransport.consume(params)`.
    - Gets the track from the consumer and adds it to a remote stream.
    - Emits `resumeConsumer` to the server.
  - **Error Handling**: Uses `onConnectionError` and `onMediaError` props. Internal retries and state updates.
  - **`DeviceSelector` Component**: Allows users to choose camera/microphone. Changes here should trigger re-acquiring media and potentially re-publishing.
  - **`getIceServers` function**: (lines 322+) Constructs ICE server configuration using `stunServerUrl` and `turnServerUrl` from `runtimeConfig`. Includes TURN credentials if available.

- **Addressing User's Specific Problem Points (Stalling after `broadcaster_ready`, no `getRouterRtpCapabilities` client logs, no media device logs):**
  1.  **`getRouterRtpCapabilities` not completing**:
      - Search for `socket.emit("getRouterRtpCapabilities", ...)` or a `socketPromise` wrapper around it.
      - Check the callback/promise resolution. Are there logs _before_ this emit and _after_ its response?
      - Is `device.load()` called immediately after? Are there logs around `device.load()`?
      - A failure here (e.g., socket not truly connected, server not responding, or `device.load()` throwing an error) would halt the entire WebRTC setup.
  2.  **No media device initialization logs**:
      - Look for `navigator.mediaDevices.getUserMedia(...)`.
      - Check `try...catch` blocks around it. Is `onMediaError` called?
      - This usually happens _before_ `producerTransport.produce()`. If `getUserMedia` fails (permissions, no devices), producers cannot be created.
  3.  **Incomplete signaling after `broadcaster_ready`**:
      - If `getRouterRtpCapabilities` or `device.load()` fails, then `createProducerTransport` and subsequent steps won't happen.
      - If `getUserMedia` fails, `produce` won't happen.
      - The client-side `broadcaster_ready` emission should ideally occur _after_ local tracks are successfully produced and acknowledged by the server. If it's emitted too early, the server won't know about the producers.

Let's proceed to get the environment files and Docker configuration to check STUN/TURN and MediaSoup IP/port settings.

Read file: docker-compose-prod.yaml
Okay, I have the `docker-compose-prod.yaml`.

**5. `docker-compose-prod.yaml` (Production Deployment)**

- **`web` service (Your Next.js/MediaSoup App):**
  - `image: arcanteus/bidpazar-web:0.2`
  - `ports`:
    - `"3000:3000"`: Standard HTTP port, looks correct.
    - `"40000-40100:40000-40100/udp"`: This maps the UDP port range for MediaSoup WebRTC transports. This range must match `MEDIASOUP_MIN_PORT` and `MEDIASOUP_MAX_PORT` in your environment variables and be open on the host machine's firewall. The current range (101 ports) is reasonable.
  - `env_file: - ./bidpazar-web/.env.docker`: Critical! The contents of this file will define `MEDIASOUP_ANNOUNCED_IP`, STUN/TURN URLs, etc., for the production container.
  - `volumes: - ./uploads:/app/public/uploads`: For file uploads, not directly related to WebRTC.
  - `depends_on: - coturn`: Ensures CoTURN starts before your app.
- **`coturn` service (TURN Server):**
  - `image: coturn/coturn:latest`
  - `ports`:
    - `"3478:3478"` and `"3478:3478/udp"`: Standard STUN/TURN port.
    - `"5349:5349"` and `"5349:5349/udp"`: Standard STUN/TURN over TLS/DTLS (though your command disables TLS/DTLS).
    - `"49160-49200:49160-49200/udp"`: Relay ports for TURN. This range should be sufficient for a moderate number of concurrent users.
  - `environment`:
    - `TURN_USERNAME=bidpazar`
    - `TURN_PASSWORD=bidpazarpass`
    - `TURN_REALM=bidpazar.com`
    - `EXTERNAL_IP=45.147.46.183`: **This is extremely important.** This IP _must_ be the public, static IP address of the host machine where Docker is running. If it's incorrect, TURN will not work. The user previously mentioned `turn:45.147.46.183:3478`, so this IP seems consistent.
  - `command`:
    - `--no-tls --no-dtls`: You are running TURN without encryption (TLS for TCP, DTLS for UDP). This is simpler to set up but less secure. For production, enabling TLS/DTLS with proper certificates is recommended. If you use `turn:` (not `turns:`) in your client, this is fine.
    - `--realm=bidpazar.com`
    - `--user=bidpazar:bidpazarpass`
- **Key Checks**:
  - The MediaSoup UDP port range `40000-40100` on the `web` service must align with the `MEDIASOUP_MIN_PORT` and `MEDIASOUP_MAX_PORT` environment variables set in `.env.docker`.
  - The host machine running Docker must have UDP ports `40000-40100` (for MediaSoup) and `3478`, `49160-49200` (for CoTURN) open in its firewall.
  - The `EXTERNAL_IP` for CoTURN is correctly set to the public IP of the server.

Now, let's get the environment variable files. I'll start with `.env` (typically for development) and then `.env.prod` (which might be a template, as `.env.docker` is used by Docker Compose).

Read file: .env.prod
Okay, I have `.env.prod`.

**6. `.env.prod` (Production Environment Variables)**

- **URLs**:
  - `NEXT_PUBLIC_APP_URL=https://bidpazar.com`
  - `NEXT_PUBLIC_API_URL=https://bidpazar.com/api`
  - These are client-side.
- **Socket.IO**:
  - `NEXT_PUBLIC_SOCKET_URL=wss://bidpazar.com`: This is the URL the client will use to connect to Socket.IO. `wss://` implies secure WebSockets, so your server (likely via a reverse proxy like Nginx/Caddy/Cloudflare) must be configured for SSL/TLS termination for this path.
  - `SOCKET_URL=wss://bidpazar.com/`: Server-side, likely not directly used by `socket.io-client` if `NEXT_PUBLIC_SOCKET_URL` is primary.
  - `NEXT_PUBLIC_WS_URL=/socket.io/`: This should be the _path_ for Socket.IO, not a full URL. `WebRTCStreamManager` will likely combine `NEXT_PUBLIC_SOCKET_URL` and this path. If `NEXT_PUBLIC_SOCKET_URL` already includes the path (it doesn't here), then this might be redundant or used differently. The `socket.io-client` typically takes a URL and an optional `path` option. It seems like `NEXT_PUBLIC_SOCKET_URL` is the base, and `/socket.io/` is the path.
- **MediaSoup Server Config**:
  - `MEDIASOUP_LISTEN_IP=0.0.0.0`: Correct for Docker.
  - `MEDIASOUP_ANNOUNCED_IP=45.147.46.183`: This is the public IP. **Crucial, and it matches the CoTURN `EXTERNAL_IP` and user's provided TURN URI.** This is good.
  - `MEDIASOUP_MIN_PORT=40000`
  - `MEDIASOUP_MAX_PORT=40100`: These match the `docker-compose-prod.yaml` port mapping. This is good.
- **STUN/TURN Configuration**:

  - `NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302`: Standard Google STUN server.
  - `NEXT_PUBLIC_TURN_SERVER_URL=turn:global.turn.twilio.com:3478`: This points to Twilio's TURN server.
  - `NEXT_PUBLIC_TURN_USERNAME=bidpazar`
  - `NEXT_PUBLIC_TURN_PASSWORD=bidpazarpass`
  - Then, there's a server-side section:
    - `STUN_SERVER_URL=stun:stun.l.google.com:19302`
    - `TURN_SERVER_URL=turn:45.147.46.183:3478`: **This is important.** This `TURN_SERVER_URL` is configured to use your own CoTURN server (`45.147.46.183:3478`), which is good. The `docker-compose-prod.yaml` sets up this CoTURN server.
    - `TURN_USERNAME=bidpazar`
    - `TURN_PASSWORD=bidpazarpass`: These credentials must match those in the `coturn` service command in `docker-compose-prod.yaml`. They do (`--user=bidpazar:bidpazarpass`).

- **Discrepancy/Clarification**:
  - The client-facing TURN configuration (`NEXT_PUBLIC_TURN_SERVER_URL`) points to Twilio's TURN (`turn:global.turn.twilio.com:3478`).
  - The server-side (and presumably the one intended for actual use by clients via `WebRTCStreamManager` if it uses the `NEXT_PUBLIC_` vars) `TURN_SERVER_URL` in the _latter half_ of the STUN/TURN section correctly points to your self-hosted CoTURN server (`turn:45.147.46.183:3478`).
  - **It's crucial that `WebRTCStreamManager.tsx` uses `turn:45.147.46.183:3478` (your CoTURN server) and the associated credentials (`bidpazar`/`bidpazarpass`) for production.** Using Twilio's TURN servers with generic credentials might not be reliable or intended for direct production use without a proper Twilio account and specific credentials generated by Twilio.
  - **Recommendation**: Ensure `WebRTCStreamManager` (via `useRuntimeConfig`) picks up `NEXT_PUBLIC_STUN_SERVER_URL=stun:stun.l.google.com:19302` and for TURN, it should use values that point to your `45.147.46.183:3478` server with `bidpazar`/`bidpazarpass`. If `NEXT_PUBLIC_TURN_SERVER_URL` is indeed `turn:global.turn.twilio.com:3478`, this might be an issue if you intend to use your self-hosted TURN. If the `WebRTCStreamManager` is using the `NEXT_PUBLIC_TURN_SERVER_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD` that point to Twilio, it won't be using your self-hosted CoTURN server correctly unless those credentials are valid Twilio credentials.
  - Given the `coturn` service setup in `docker-compose-prod.yaml` and the server-side `TURN_SERVER_URL=turn:45.147.46.183:3478`, it's highly probable the intent is to use the self-hosted CoTURN.
  - The `getIceServers` function in `WebRTCStreamManager.tsx` (line 322 of its outline) will be constructing the `iceServers` array. We need to see exactly which environment variables it uses for STUN/TURN.

This file `.env.prod` seems like it _could_ be the source for `.env.docker` or used directly if not in Docker for production. The critical part is what `WebRTCStreamManager.tsx` consumes via `useRuntimeConfig`.

Let's get `.env` for development settings.

Read file: .env
Okay, I have the `.env` file for development.

**7. `.env` (Development Environment Variables)**

- **URLs**: All point to `http://localhost:3000`.
- **Socket.IO**:
  - `NEXT_PUBLIC_SOCKET_URL=ws://localhost:3000`: Correct for local development (`ws://` for non-secure).
  - `NEXT_PUBLIC_WS_URL=/socket.io/`: Correct path.
- **MediaSoup Server Config**:
  - `MEDIASOUP_LISTEN_IP=0.0.0.0`: Correct.
  - `MEDIASOUP_ANNOUNCED_IP=127.0.0.1`: **This is a common point of failure for local development if your client is on a different device or a virtual machine/emulator.** If the client is on the _same machine_ and accesses via `localhost` or `127.0.0.1`, this _might_ work. However, if the client is on another device on the same LAN, `MEDIASOUP_ANNOUNCED_IP` should be your machine's LAN IP (e.g., `192.168.1.x`). If the client is on an emulator or a different network setup, this IP needs to be reachable by that client. The comment `# ⚠️ IMPORTANT: Replace with your actual local machine IP address` is good, but the value is still `127.0.0.1`.
  - `MEDIASOUP_MIN_PORT=40000`, `MEDIASOUP_MAX_PORT=40100`: Standard.
- **STUN/TURN Configuration (Development)**:
  - `NEXT_PUBLIC_STUN_SERVER_URL=stun:45.147.46.183:3478`
  - `NEXT_PUBLIC_TURN_SERVER_URL=turn:45.147.46.183:3478`
  - `NEXT_PUBLIC_TURN_USERNAME=bidpazar`
  - `NEXT_PUBLIC_TURN_PASSWORD=bidpazarpass`
  - **Observation**: In development, you are configured to use the _production_ STUN/TURN server (`45.147.46.183:3478`). This is generally fine for testing connectivity, assuming that server is reachable from your development environment. It means your local development setup relies on the deployed CoTURN server. If that server is down or not reachable, NAT traversal might fail even in development. Using a public STUN server like `stun:stun.l.google.com:19302` as a primary or fallback STUN for development is also common if you don't have a local TURN server.
- **Key Check for Development**:
  - The `MEDIASOUP_ANNOUNCED_IP=127.0.0.1` is the most likely source of issues if testing from a device that isn't the server machine itself or isn't resolving `127.0.0.1` as the server machine (e.g., mobile device on same Wi-Fi).

Now I'll review `api.ts` and `middleware.ts`. Since they were listed by the user but are less likely to be the _direct_ cause of WebRTC negotiation failure (which is usually signaling, ICE, or DTLS related), I'll do a quicker check for obvious interferences.

Read file: src/middleware.ts
**8. `middleware.ts`**

- **Purpose**: Handles authentication and authorization for Next.js routes.
- **Review**:

  - It correctly identifies public paths and exempts them from auth checks.
  - **Crucially, it has logic to skip middleware processing for WebSocket and Socket.IO paths**:

    ```javascript
    const isSocketPath =
      path.includes("/socket.io") ||
      path.startsWith("/api/socket") || // ...

    const isWebSocketRequest =
      request.headers.get("upgrade")?.toLowerCase() === "websocket" || // ...
      request.nextUrl.searchParams.has("EIO") || // ...

    if (isSocketPath || isWebSocketRequest) {
      console.log(
        `[Middleware] Skipping middleware for Socket/WebSocket path: ${path}`
      );
      return NextResponse.next();
    }
    ```

  - The `config.matcher` also attempts to exclude `socket.io` paths and websocket upgrade requests.

- **Conclusion**: The middleware seems correctly configured to _avoid interfering_ with Socket.IO connections, which is essential. It should not be the cause of the WebRTC issues.

Now, I'll request `api.ts`.

Read file: src/lib/api.ts
**9. `api.ts` (Client-Side API Utility)**

- **Purpose**: Provides functions to interact with the backend API.
- **Review**:
  - Defines various interfaces for data models (`LiveStream`, `Product`, `User`, etc.).
  - Includes a `fetcher` function for making API calls.
  - Exports functions like `getLiveStreamById`, `startLiveStream`, `endLiveStream`. These are used by `page.tsx` to manage the stream's lifecycle in the database.
  - At the top, it has code to enable `socket.io-client` and `mediasoup-client` debug logs in development by setting `localStorage.debug`. This is a good practice for client-side debugging.
  - `apiBaseUrl` is set to `"/api"`, which is standard for Next.js API routes.
- **Relevance to WebRTC Issue**: Unlikely to be a direct cause of WebRTC connection failures, as these are standard REST API calls. However, if `getLiveStreamById` failed, `page.tsx` might not render `WebRTCStreamManager` or pass correct props. The user's log implies the page and initial socket connection happen, so this is probably not the root cause of the WebRTC stall.

**Summary of Findings So Far & Next Steps:**

1.  **`server.js`**: Appears largely correct.
2.  **`socketHandler.ts`**: Core signaling logic is present. The timing of `broadcaster_ready` emission by the client relative to its `produce` calls could be a factor. The server-side logic for handling these events seems plausible.
3.  **`page.tsx`**: Correctly passes props to `WebRTCStreamManager`. Handles UI and stream lifecycle API calls.
4.  **`WebRTCStreamManager.tsx`**: **This is the most critical file to examine in detail now.** The user's description (stalling after `broadcaster_ready`, no client-side logs for `getRouterRtpCapabilities` or media device access) strongly points to an issue within this component's initialization or early-stage WebRTC setup logic.
5.  **`docker-compose-prod.yaml`**: Looks reasonable. MediaSoup UDP ports are mapped. CoTURN is configured. `EXTERNAL_IP` for CoTURN matches other configs.
6.  **`.env.prod`**:
    - `MEDIASOUP_ANNOUNCED_IP` is correctly set to the public IP.
    - STUN/TURN: There's a mix-up. `NEXT_PUBLIC_TURN_SERVER_URL` points to Twilio, while `TURN_SERVER_URL` points to the self-hosted CoTURN. **It's vital that `WebRTCStreamManager.tsx` uses the self-hosted CoTURN (45.147.46.183:3478) with credentials `bidpazar`/`bidpazarpass` in production.** This needs to be verified in `WebRTCStreamManager.tsx`'s `getIceServers` or equivalent logic.
7.  **`.env` (Development)**:
    - `MEDIASOUP_ANNOUNCED_IP=127.0.0.1`: Potential issue if client isn't on the same host or can't resolve it correctly.
    - STUN/TURN points to the production CoTURN server, which is acceptable for dev testing if the server is up.
8.  **`middleware.ts`**: Correctly skips Socket.IO paths. Not a likely cause.
9.  **`api.ts`**: Standard API client. Not a likely cause of WebRTC negotiation failure.

**Deep Dive into `WebRTCStreamManager.tsx` is required.**

Based on the provided outline of `WebRTCStreamManager.tsx` and the user's problem description:

- **Focus on `attemptConnection` (or similar initial connection function):**
  - Trace the logic: `connectSocket` -> `socket.on('connect', ...)` -> `loadDevice`.
- **Focus on `loadDevice`:**
  - It should emit `getRouterRtpCapabilities`. Are there logs immediately before this emit?
  - In the callback/promise resolution for `getRouterRtpCapabilities`, does it call `device.load({ routerRtpCapabilities })`? Are there logs immediately before and after this? Any `try...catch`?
  - The user mentioned "no logs showing getRouterRtpCapabilities completion". This is a major red flag.
- **Focus on `getUserMedia` (likely in a `publish` or `startLocalMedia` function):**
  - This is called _before_ `producerTransport.produce()`.
  - Are there logs before attempting `getUserMedia`?
  - How are errors from `getUserMedia` (e.g., `NotFoundError`, `NotAllowedError`) handled? Is `onMediaError` called?
  - The user mentioned "No media device initialization". This is another major red flag.

Let's now formulate the detailed check and advice for `WebRTCStreamManager.tsx`.

---

**End-to-End Analysis and Recommendations:**

Based on the review of the provided files and your description of the problem (WebRTC connection stalling after `broadcaster_ready`, missing client-side logs for `getRouterRtpCapabilities` completion and media device initialization), here's an analysis:

**Server-Side (`server.js`, `socketHandler.ts`):**

- **Generally Sound**: The server-side setup for Socket.IO and MediaSoup seems robust. Event handlers for the WebRTC lifecycle are present.
- **`broadcaster_ready` Timing**: As noted, the client (`WebRTCStreamManager.tsx`) should ensure it has successfully created producers (i.e., called `socket.emit('produce', ...)` and ideally received an acknowledgment) _before_ it emits `broadcaster_ready`. If `broadcaster_ready` is sent too early, viewers might not get the initial list of active producers. However, `socketHandler.ts` does have a `getProducers` event that viewers can call.

**Environment and Deployment (`.env`, `.env.prod`, `docker-compose-prod.yaml`):**

- **Production (`.env.prod`, `docker-compose-prod.yaml`):**
  - `MEDIASOUP_ANNOUNCED_IP` (`45.147.46.183`) is correctly set and matches CoTURN's `EXTERNAL_IP`.
  - MediaSoup UDP port range (`40000-40100`) matches between `.env.prod` and `docker-compose-prod.yaml`. Ensure these are open on the host firewall.
  - CoTURN UDP ports (`3478`, `49160-49200`) need to be open on the host firewall.
  - **STUN/TURN Configuration Mismatch**:
    - `NEXT_PUBLIC_TURN_SERVER_URL` in `.env.prod` is `turn:global.turn.twilio.com:3478`.
    - Your CoTURN server is `turn:45.147.46.183:3478` with user `bidpazar` and password `bidpazarpass`.
    - **Crucial**: `WebRTCStreamManager.tsx` (via `useRuntimeConfig`) **must use your self-hosted CoTURN server details in production.** Verify that `NEXT_PUBLIC_TURN_SERVER_URL`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_PASSWORD` in the `.env.docker` file (which `docker-compose-prod.yaml` uses) are set to `turn:45.147.46.183:3478`, `bidpazar`, and `bidpazarpass` respectively. If `WebRTCStreamManager.tsx` uses the Twilio URL, it won't be leveraging your CoTURN setup.
- **Development (`.env`):**
  - `MEDIASOUP_ANNOUNCED_IP=127.0.0.1`: This will only work if your client device (browser, mobile app) is running on the exact same machine as the server AND accesses the server via `127.0.0.1` or `localhost`. If testing from another device on your LAN (e.g., a phone), this IP needs to be your computer's LAN IP (e.g., `192.168.x.x`).
  - STUN/TURN in dev uses the production CoTURN server (`45.147.46.183:3478`). This is fine for testing if it's reachable.

**Frontend (`page.tsx`, `WebRTCStreamManager.tsx`):**

This is where the primary issues likely lie, given your log description.

- **`page.tsx`**: Seems fine in how it sets up and passes props to `WebRTCStreamManager`.
- **`WebRTCStreamManager.tsx` (Hypothesized Issues based on symptoms and outline):**
  1.  **Failure in `getRouterRtpCapabilities` or `device.load()`:**
      - **Symptom**: User reports "no logs showing getRouterRtpCapabilities completion."
      - **Likely Cause**: The call to `socket.emit('getRouterRtpCapabilities', ...)` might be failing (network, server error), the promise/callback might not be handled correctly, or `device.load({ routerRtpCapabilities })` might be throwing an unhandled error. Without `device.load()` succeeding, no transports can be created.
      - **Action**:
        - Ensure robust logging around `socket.emit("getRouterRtpCapabilities", ...)`: log before sending, log the raw response from the server, log any errors.
        - Ensure robust logging around `device.load(...)`: log before calling, log success, log any errors in a `try...catch`.
        - Check the browser's network tab to see if the `getRouterRtpCapabilities` message is actually sent and if a response is received over the WebSocket.
  2.  **Failure in Media Device Acquisition (`getUserMedia`):**
      - **Symptom**: User reports "No media device initialization logs" and "no logs showing camera/microphone access success or failure."
      - **Likely Cause**: `navigator.mediaDevices.getUserMedia(...)` is failing silently or its errors are not being propagated/logged correctly. This could be due to browser permissions (user denied access, or no prompt appeared), no camera/microphone available, or other hardware issues.
      - **Action**:
        - Ensure `getUserMedia` is wrapped in a `try...catch`.
        - Log the success (with stream object) or error (with error object) explicitly.
        - Call the `onMediaError` prop callback with detailed error information.
        - This step must succeed before `producerTransport.produce()` can be called.
  3.  **Incorrect Signaling Order or Missing Steps for Broadcaster:**
      - The typical broadcaster flow is:
        1.  Connect socket.
        2.  `getRouterRtpCapabilities` -> `device.load()`.
        3.  `createProducerTransport` -> `transport.on('connect')`, `transport.on('produce')`.
        4.  `getUserMedia` to get local media tracks.
        5.  `producerTransport.produce({ track })` for each track. This involves the client signaling `produce` to the server via the transport's event.
        6.  _After_ producers are successfully created and acknowledged by the server, emit `broadcaster_ready` to the server.
      - **If `broadcaster_ready` is emitted before server-side producers are established, viewers (and the server's `broadcaster_ready` event to the room) won't know about the media tracks.**
  4.  **Client-Side STUN/TURN Configuration:**
      - The `getIceServers` function (outlined at line 322) needs to correctly use the STUN/TURN URLs and credentials from `useRuntimeConfig`. **Verify it's using your self-hosted CoTURN server details in production.**

**Recommendations for `WebRTCStreamManager.tsx`:**

1.  **Aggressively Log Critical Path**: Add detailed logs (using your `logTrace`, `logDebug`, `logError` functions) at every step of the connection and media setup process:
    - Socket connection attempt, success, error.
    - Emitting `getRouterRtpCapabilities`, receiving response, any errors.
    - Calling `device.load()`, success, any errors.
    - Attempting `getUserMedia()`, success (log the stream/tracks), any errors (log the error object).
    - Emitting `createProducerTransport`, receiving response, any errors.
    - Producer transport `connect` event: emitting DTLS params, server acknowledgment.
    - Producer transport `produce` event: for each track, parameters sent, server acknowledgment (producer ID).
    - Emitting `broadcaster_ready`.
2.  **Robust Error Handling for `getUserMedia`**:
    - Wrap `navigator.mediaDevices.getUserMedia(...)` in a `try...catch`.
    - In the `catch` block, log the error type and message. Call `onMediaError` with specific details. Inform the user via UI if permissions are denied or no devices are found.
3.  **Verify STUN/TURN Usage**:
    - Inside your `getIceServers` function (or wherever you configure `iceServers` for `device.createSendTransport` / `device.createRecvTransport`), log the exact STUN and TURN server URLs and credentials being used. Ensure these match your `.env.docker` (for production) or `.env` (for development) and that they point to your CoTURN server for TURN.
4.  **Sequential Flow**: Ensure operations are chained correctly using promises or async/await:
    - Socket must be connected before `getRouterRtpCapabilities`.
    - `device.load()` must succeed before creating transports.
    - `getUserMedia()` must succeed before calling `producerTransport.produce()`.
    - `producerTransport.produce()` should ideally be acknowledged by the server before the client emits `broadcaster_ready`.

By adding these logs and checks, you should be able to pinpoint where the process is stalling in `WebRTCStreamManager.tsx`. The most likely culprits, given your description, are an early failure in the `device.load()` sequence or an issue with `getUserMedia()`. The STUN/TURN configuration, especially for production, also needs careful verification.
