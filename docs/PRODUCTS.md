# BidPazar Product Auction System

This document describes the product auction system in BidPazar, enabling users to list, bid, and manage second-hand products in a secure, real-time auction environment.

## Overview

- **Registered users** can add their own second-hand products as auctions, including uploading pictures and videos, setting a starting price, and providing descriptions.
- **Members** (logged-in users) can place bids on auctions.
- **Anonymous (non-member) users** can view current bids, product ads, and ad details, but cannot place bids.
- **Auction duration**: Auctioneers can choose 1, 3, 5, or 7 days for the auction. At the end of the period, the highest bidder wins.
- **Notifications & Messaging**: At auction end, only the auctioneer and the winner are notified and can message each other (integrated with the platform's messaging and notification system).
- **Admin controls**: Admins can view all auctions, moderate problematic products, and remove listings if necessary.
- **Bid privacy**: Only admins and the auction owner can view the full bid history for an auction.

## Auction Lifecycle

1. **Product Listing**
   - User fills out a form with product details, uploads images/videos, sets a starting price, and selects auction duration (1, 3, 5, or 7 days).
   - Product is listed and visible to all users.
   - Admins can review and moderate new listings.

2. **Bidding**
   - Only logged-in members can place bids.
   - Anonymous users can view product details and current highest bid but cannot bid.
   - Bids are visible in real-time on the product page.
   - Only the auction owner and admins can view the full bid history.

3. **Auction End**
   - At the end of the selected duration, the highest bidder wins.
   - The auctioneer and winner are notified and can message each other directly.
   - The product is marked as sold, and further bids are disabled.

4. **Moderation**
   - Admins can view all auctions and their statuses from the admin interface.
   - Problematic or inappropriate products can be removed by admins.

## User Experience

- **Auctioneer (Product Owner):**
  - Sees editing controls and product information on their product page.
  - Can edit product details and manage the auction while it is active.
  - Can view all bids placed on their auction.

- **Member (Logged-in User):**
  - Can view product details and place bids on active auctions.
  - Sees current highest bid and their own bid history.

- **Anonymous User:**
  - Can view product details, images, videos, and current highest bid.
  - Cannot place bids or view bid history.

- **Admin:**
  - Can view, moderate, and remove any auction.
  - Can view all bids and auction statuses.

## API Endpoints & Components

- **Product API:**
  - `GET /api/products` — List all products/auctions
  - `POST /api/products` — Create a new product auction
  - `GET /api/products/[id]` — Get product/auction details
  - `PATCH /api/products/[id]` — Edit product (owner or admin)
  - `DELETE /api/products/[id]` — Remove product (admin or owner)
  - `GET /api/products/[id]/bids` — Get bid history (admin/owner only)
  - `POST /api/products/[id]/bids` — Place a bid (member only)

- **Messaging & Notification:**
  - Integrated with `/api/messages` and `/api/notifications` for auction end events.

- **Frontend Components:**
  - `ProductForm.tsx` — Product creation/editing
  - `ProductPage.tsx` — Product/auction detail view
  - `BidList.tsx` — Bid history (restricted)
  - `BidForm.tsx` — Place a bid
  - `ProductGallery.tsx` — Images/videos display
  - `AdminProductList.tsx` — Admin moderation interface

## Feature Checklist

- [x] Product auction creation with images/videos
- [x] Auction duration selection (1, 3, 5, 7 days)
- [x] Real-time bidding for members
- [x] Anonymous user view-only access
- [x] Auction end logic and winner selection
- [x] Notification and messaging for auctioneer and winner
- [x] Admin moderation and removal of products
- [x] Bid privacy (only owner/admin can view all bids)
- [x] Product editing for auctioneer
- [x] Product/auction status tracking
- [ ] Accessibility and responsive design
- [ ] Automated moderation tools (planned)
- [ ] Auction analytics and reporting (planned)

---

*For more details on API and structure, see `docs/STRUCTURE.md`.*
