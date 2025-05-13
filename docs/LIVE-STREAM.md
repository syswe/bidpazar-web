# BidPazar Live Streaming Auction System

This document details the live streaming auction system for Bidpazar.com, enabling real-time, interactive product auctions via live video broadcasts. The system is designed for a seamless, mobile-first, TikTok-style experience, supporting both sellers and buyers in a dynamic auction environment.

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Live Auction Workflow](#live-auction-workflow)
4. [Product & Auction Management](#product--auction-management)
5. [User Experience & UI](#user-experience--ui)
6. [Notifications & Messaging](#notifications--messaging)
7. [API Endpoints & Components](#api-endpoints--components)
8. [Technical Implementation](#technical-implementation)
9. [Stream Quality & Performance](#stream-quality--performance)
10. [Monitoring & Analytics](#monitoring--analytics)
11. [Security Considerations](#security-considerations)
12. [Implementation Checklist](#implementation-checklist)

## Feature Overview

- **Any member** can start a live broadcast to promote and auction their products.
- **Live product addition**: During the broadcast, the seller can add products, set a starting price, and create a countdown timer (1-59 seconds).
- **Bidding**: Buyers can place bids before and during the countdown. When the seller starts the counter, the top 3 bidders are matched (1 winner, 2 backups).
- **End-of-broadcast report**: Seller receives a summary of all products sold, buyers matched, and final prices.
- **Product cancellation**: Seller can cancel a product before starting the counter if bids are not close to their desired price.
- **Multiple products per stream**: Sellers can auction 7-8 products in a single broadcast, across different categories.
- **Separation of live and static auctions**: Auctions sold live and those added directly as products are managed and evaluated separately.
- **Anonymous viewers**: Can watch the broadcast, see products and messages, but cannot bid or chat.
- **Mobile-first, vertical UI**: 100% mobile compatible, TikTok-style vertical video, with chat and offer screens designed for this format. Web view is also vertical and centered.

## User Roles & Permissions

- **Seller (Member):**
  - Can start a live broadcast, add products, set prices, start/cancel countdowns, and receive end-of-broadcast reports.
  - Can see all bids and manage the auction process in real time.
- **Buyer (Member):**
  - Can join live broadcasts, view products, place bids, and chat during the stream.
  - Can be matched as winner or backup for products.
- **Anonymous Viewer:**
  - Can watch live broadcasts, see products and messages, but cannot bid or participate in chat.
- **Admin:**
  - Can moderate live streams, remove problematic products, and oversee auction integrity.

## Live Auction Workflow

1. **Start Broadcast**

   - Any member can start a live stream from the platform.
   - The seller interface includes controls for adding products, managing the broadcast, and viewing chat/bids.

2. **Add Product During Live**

   - Seller adds a product with images, video, description, and starting price.
   - Product appears in the live stream product list for all viewers.

3. **Bidding Phase**

   - Buyers can place bids as soon as a product is added, even before the countdown starts.
   - All bids are visible in real time to the seller and logged-in viewers.

4. **Countdown & Winner Selection**

   - Seller starts a countdown timer (1-59 seconds) when bids approach their desired price.
   - At the end of the countdown, the top 3 bidders are matched:
     - 1st: Winner
     - 2nd & 3rd: Backup buyers (in case the winner declines)
   - Seller can cancel the product before starting the countdown if bids are insufficient.

5. **End of Broadcast**

   - Seller ends the broadcast.
   - Seller receives a report summarizing all products sold, buyers matched, and final prices.
   - Notifications and messages are sent to the seller and all relevant buyers.

6. **Post-Broadcast**
   - Matched buyers and sellers can message each other via the platform's messaging system.
   - All transactions are logged for admin review.

## Product & Auction Management

- **Multiple Products**: Sellers can add and auction multiple products (typically 7-8) in a single live session.
- **Product Status**: Each product's auction status (active, sold, cancelled) is tracked and displayed.
- **Auction Separation**: Live-streamed auctions and static product auctions are managed and displayed separately in the platform.
- **Admin Moderation**: Admins can remove problematic products or streams in real time.

## User Experience & UI

- **Mobile-First, Vertical Layout**: The live stream interface is designed for vertical, TikTok-style viewing, fully responsive and mobile-optimized.
- **Interactive Live Stream Screen**:
  - Broadcast status and info
  - Product addition and management
  - Real-time chat and bidding (for logged-in users)
  - Product gallery and bid list
- **Anonymous Viewers**: See only the broadcast, products, and messages (read-only, no interaction).
- **Logged-In Viewers**: Can bid, chat, and interact with the seller and other buyers.
- **Web View**: Vertical, centered layout for desktop users, mirroring the mobile experience.

## Notifications & Messaging

- **End-of-broadcast notifications**: Sent to the seller and all matched buyers for each product sold.
- **Messaging integration**: Matched buyers and sellers can communicate directly after the auction.
- **Admin alerts**: For moderation actions or problematic streams/products.

## API Endpoints & Components

### HTTP API Endpoints

#### Live Stream Management

- `POST /api/live-streams` — Create a new live stream.
- `GET /api/live-streams` — Get a list of all live streams (filterable by status and userId).
- `GET /api/live-streams/[id]` — Get details for a specific stream (includes user, listings, products, bids, chat messages).
- `POST /api/live-streams/[id]/start` — Start a stream by marking it as 'LIVE' and setting its start time.
- `POST /api/live-streams/[id]/stop` — End a stream by marking it as 'ENDED' and setting its end time.
- `DELETE /api/live-streams/[id]` — Delete a live stream (restricted to stream owner).
- `GET /api/live-streams/[id]/status` — Get the current status of a stream.
- `GET /api/live-streams/[id]/analytics` — Get detailed analytics for a stream (restricted to stream owner).

#### Listing Management

- `POST /api/live-streams/[id]/listings` — Add a product listing to the live stream.
- `GET /api/live-streams/[id]/listings` — Get all listings for a specific stream.
- `PUT /api/live-streams/[id]/listings/[listingId]` — Update a listing's status (ACTIVE, COUNTDOWN, COMPLETED, CANCELLED) or countdown time.
- `POST /api/live-streams/[id]/listings/[listingId]/bids` — Place a bid on a specific listing.
- `GET /api/live-streams/[id]/listings/[listingId]/bids` — Get all bids for a specific listing.
- `GET /api/live-streams/[id]/product` — Get the currently active product in a stream.

### WebSocket Events (Socket.IO)

The WebSocket server is initialized in `server.js` and handles real-time communication for chat and bid updates.

#### Connection

- Clients connect to the Socket.IO server with query parameters: `streamId`, `userId`, `username`.

#### Chat Events

- `joinChatRoom`: Client joins a chat room.
- `sendChatMessage`: Client sends a chat message.
- `newChatMessage`: Server broadcasts a new chat message.
- `leaveChatRoom`: Client leaves a chat room.

#### Bid Events

- `placeBid`: Client places a bid on a product.
- `newBid`: Server broadcasts a new bid to all viewers.
- `startCountdown`: Seller starts the countdown timer.
- `countdownUpdate`: Server broadcasts countdown updates.
- `countdownComplete`: Server notifies when countdown is complete and winner is determined.

### Frontend Components

- `JitsiStreamManager.tsx` — Handles Jitsi Meet integration for live streaming.
- `ProductDisplay.tsx` — Shows product information and countdown timer.
- `BiddingInterface.tsx` — UI for placing bids.
- `StreamChat.tsx` — Real-time chat interface.
- `CreateProductForm.tsx` — Form for adding products during livestream.
- `StreamControls.tsx` — Controls for the streamer.

## Technical Implementation

### Jitsi Meet Streaming Architecture

BidPazar uses Jitsi Meet SDK for low-latency, high-quality streaming:

1. **Integration**:

   - Jitsi Meet SDK is integrated with Next.js using the React API
   - Socket.IO is used for non-video related real-time communication (chat, bidding)

2. **Media Flow**:

   ```
   STREAMER -> JITSI VIDEOBRIDGE -> VIEWERS
   ```

3. **Configuration Requirements**:

   - Basic Jitsi Meet configuration (domain, room name, user info)
   - Socket.IO server for handling chat and bidding
   - Proper CORS configuration for socket connections

4. **Key Features**:
   - Built-in device selection and handling
   - Screen sharing capabilities
   - Built-in chat (can be disabled in favor of custom chat)
   - Customizable UI with the Jitsi iframe API

For detailed technical setup, configuration, and troubleshooting:

- See [JITSI-SETUP.md](./JITSI-SETUP.md) for configuration details.
- See [JITSI-TROUBLESHOOTING.md](./JITSI-TROUBLESHOOTING.md) for troubleshooting steps.

## Stream Quality & Performance

### Video Quality Management

Jitsi Meet provides built-in adaptive bitrate handling:

1. **Resolution Tiers**:

   - High: 720p (1280x720)
   - Medium: 480p (854x480)
   - Low: 360p (640x360)
   - Mobile: 240p (426x240)

2. **Automatic Quality Adaptation**:

   - Jitsi automatically monitors available bandwidth and adjusts video quality in real-time
   - Quality switches are smooth and do not interrupt the stream
   - Initial quality is determined based on device capability and network speed

3. **Client-Side Controls**:
   - Viewers can manually select quality level through the Jitsi UI
   - Automatic quality selection is the default

### Audio Quality

- Audio is prioritized over video during constrained bandwidth
- Sample rate: 48 kHz for high-quality audio
- Echo cancellation and noise suppression enabled by default

### Latency Management

- Target end-to-end latency: 500ms - 2000ms
- Optimized for interactivity and real-time bidding

### Device Optimization

- Mobile-specific optimizations:
  - Battery usage management
  - Background mode handling
- Desktop optimizations:
  - Multi-core encoding/decoding where available
  - Hardware acceleration support

## Monitoring & Analytics

### Real-Time Monitoring

The system includes comprehensive monitoring for both streamer and admin use:

1. **Stream Health Dashboard**:

   - Jitsi-provided connection quality indicators
   - Connected viewer count
   - Participant list and roles

2. **Viewer Experience Metrics**:
   - Join success rate
   - Average quality level
   - Playback continuity score

### Stream Analytics

Post-stream analytics provide valuable insights:

1. **Viewer Engagement Metrics**:

   - Peak concurrent viewers
   - Average watch time
   - Viewer retention curve

2. **Bidding Analytics**:

   - Bids per minute
   - Bid value distribution
   - Conversion rate (viewers to bidders)

3. **Performance Reports**:
   - Stream stability score
   - Quality consistency rating
   - Network performance summary

### Logging

Comprehensive logging is implemented throughout the streaming system:

- Connection events
- Participant join/leave events
- Chat message distribution
- Bidding activity

For more information on logging, see [LOGGING.md](./LOGGING.md).

## Security Considerations

- JWT authentication for all live stream actions
- Role-based access for sellers, buyers, and admins
- Input validation for all product and bid submissions
- Real-time moderation tools for admins
- Secure WebSocket connections
- Rate limiting and abuse prevention

### Security Best Practices

1. **Authentication and Authorization**:

   - Validate session tokens for every WebSocket connection
   - Verify stream ownership for all streamer operations
   - Implement timeouts for inactive sessions

2. **Data Protection**:

   - Sanitize all user input for chat and product details
   - Validate bid amounts and prevent bid spoofing
   - Protect against cross-site WebSocket hijacking

3. **Infrastructure Security**:
   - Regular security audits of Jitsi implementation
   - DDoS protection for WebSocket and media endpoints

## Implementation Checklist

- [x] Member live broadcast creation
- [x] Product addition during live
- [x] Real-time bidding before and during countdown
- [x] Countdown timer and top 3 bidder matching
- [x] Product cancellation before countdown
- [x] End-of-broadcast report for seller
- [x] Notifications/messages to seller and buyers
- [x] Multiple products per broadcast
- [x] Anonymous viewer restrictions
- [x] Mobile-first, vertical UI (TikTok-style)
- [x] Web vertical/centered view
- [x] Admin moderation tools
- [x] Stream quality monitoring and analytics
- [x] Jitsi Meet integration
- [x] Socket.IO for chat and bidding
- [ ] Accessibility features (planned)
- [ ] Multi-language support (planned)
- [ ] Automated content moderation (planned)

---

_For more details on the platform structure, see `docs/STRUCTURE.md`._
_For technical configuration of Jitsi Meet, see `docs/JITSI-SETUP.md`._
_For logging standards, see `docs/LOGGING.md`._
