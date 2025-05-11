# BidPazar Streaming Architecture - TO-DO List

This document outlines identified areas for improvement, clarification, and potential issues within the BidPazar live streaming architecture as described in `STREAM.md`.

## High Priority

### 1. Stream State Synchronization and Single Source of Truth
- **Issue:** Potential for race conditions and inconsistent states due to multiple paths for updating stream status (API direct update vs. WebRTC event-triggered update).
- **To-Do:**
    - [ ] Clearly define the authoritative flow for stream state transitions (e.g., `SCHEDULED` -> `LIVE` -> `ENDED`).
    - [ ] Establish a single source of truth for stream state. For instance, API calls initiate state changes, WebRTC layer confirms operational success/failure which might then finalize or revert a state.
    - [ ] Refine the interaction between the `/api/live-streams/[id]/start` (and other state-changing API routes) and the `broadcaster_ready` socket event processing in `socketHandler.ts`. Avoid scenarios where both attempt to be the primary updater of the database status for the same transition.
    - [ ] Consider using intermediate states (e.g., `STARTING`, `ENDING`) in the database to reflect ongoing transitions and prevent conflicts.

### 2. Robust Error Handling and Recovery
- **Issue:** `STREAM.md` mentions error handling conceptually but lacks detail on specific scenarios and recovery paths.
- **To-Do:**
    - [ ] Document specific error handling for:
        - User media access denial (camera/mic).
        - Network interruptions during signaling or media transport.
        - MediaSoup worker or router errors.
        - API request failures during critical operations (start, end stream).
        - WebSocket connection failures or abrupt disconnections.
    - [ ] Define how errors are communicated to the user (broadcaster and viewer).
    - [ ] Specify system recovery mechanisms (e.g., retry logic, graceful degradation).

### 3. Graceful Disconnection Handling
- **Issue:** The flow for handling unexpected broadcaster disconnections (e.g., browser crash, network loss) needs to be detailed.
- **To-Do:**
    - [ ] Implement and document server-side detection of abrupt broadcaster disconnections (e.g., socket disconnect without an "end stream" signal, heartbeat timeouts).
    - [ ] Define the process for automatic cleanup of MediaSoup resources (transports, producers, consumers, room) associated with the disconnected stream.
    - [ ] Specify how the stream status in the database is updated (e.g., to `INTERRUPTED`, `ENDED`, or a new specific status).
    - [ ] Clarify how viewers are notified or handled when a stream they are watching disconnects abruptly.

## Medium Priority

### 4. Stream Pause/Resume Functionality
- **Issue:** The API lists a pause endpoint (`POST /api/live-streams/[id]/pause`), but the detailed flow is missing.
- **To-Do:**
    - [ ] Document the complete user and system flow for pausing a live stream.
    - [ ] Specify API interactions, WebSocket signaling involved.
    - [ ] Detail how MediaSoup transports, producers, and consumers are affected/managed (e.g., are tracks paused, transports closed and reopened?).
    - [ ] Define the flow for resuming a paused stream.
    - [ ] Ensure database status accurately reflects `PAUSED` state and transitions.

### 5. Bidirectional State Update Logic Clarification
- **Issue:** The interaction "WebRTC state changes update database" and "API operations notify WebRTC layer" can be complex.
- **To-Do:**
    - [ ] Create a state diagram illustrating all possible stream states, the triggers for transitions (API calls, socket events, internal logic), and which system component is responsible.
    - [ ] Clarify the purpose and usage of `validateStreamState` from `socketEvents.ts`. When is it called and how are discrepancies handled?
    - [ ] Analyze the `updateDatabaseStreamState` in `socketEvents.ts`:
        - Ensure its internal API calls don't create unintended circular dependencies or redundant updates with the primary API-driven state changes.
        - Complete the `switch (state)` to correctly map all `StreamState` values (e.g., `PAUSED`, `CANCELLED`) to appropriate API calls or actions. Current default behavior for non-LIVE/ENDED states might be too generic.
        - Ensure endpoint consistency (e.g. uses `/end` or `/stop` consistently with API definitions).

### 6. Viewer Count Synchronization
- **Issue:** Mechanism for `viewerCount` update needs to be robust.
- **To-Do:**
    - [ ] Detail how `viewerCount` is incremented on viewer join and decremented on viewer leave.
    - [ ] Address potential race conditions or inaccuracies, possibly using atomic database operations or a reliable distributed counter if scaling.

### 7. API Endpoint and `socketEvents.ts` Consistency
- **Issue:** Minor inconsistencies in API endpoint naming (e.g., `/end` vs. `/stop`).
- **To-Do:**
    - [ ] Standardize API endpoint names across the documentation and implementation. Specifically, confirm if stream termination is `/api/live-streams/[id]/end` or `/api/live-streams/[id]/stop` and use it consistently.
    - [ ] Ensure `socketEvents.ts` (`updateDatabaseStreamState`) uses the finalized correct API endpoints.

## Low Priority / Clarifications

### 8. Detailed `socketHandler.ts` Event Handling
- **Issue:** `STREAM.md` focuses on `broadcaster_ready` but client-side snippets show other requests like `createProducerTransport`, `connectProducerTransport`, `produce`.
- **To-Do:**
    - [ ] Explicitly list and briefly describe all critical socket events handled by `socketHandler.ts` related to the WebRTC and MediaSoup lifecycle for both broadcasters and viewers.

### 9. Chat Integration Details
- **Issue:** API for chat is mentioned, but implementation details are sparse.
- **To-Do:**
    - [ ] Briefly document the WebSocket message flow for chat messages.
    - [ ] Clarify how chat messages are persisted (if at all) and relayed to clients in a room.

### 10. Security of Internal API Calls
- **Issue:** `Authorization: Bearer server-internal-\${userId}` for internal API calls.
- **To-Do:**
    - [ ] Briefly note the validation mechanism for this internal authorization to ensure it's secure and cannot be spoofed.

### 11. Frontend Stream Details Fetching
- **Issue:** `isCurrentUserStreamer = userId === streamDetails?.creatorId;` in `LiveStreamPage` relies on `streamDetails`.
- **To-Do:**
    - [ ] Ensure `streamDetails` (presumably fetched from `GET /api/live-streams/[id]`) is reliably available before being accessed to avoid runtime errors. Confirm loading states are handled.

## Documentation Enhancements

- [ ] **Overall State Diagram:** Consider adding a comprehensive state diagram for a `LiveStream` object, showing all states, transitions, and the events/actions that cause them. This would greatly clarify overall system behavior.
- [ ] **Sequence Diagrams:** For complex interactions like "Start Stream" or "Viewer Join," detailed sequence diagrams showing interactions between Client, API, `socketHandler`, and MediaSoup would be beneficial. 