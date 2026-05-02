# BidPazar API Documentation

## Overview
This document provides detailed information about the BidPazar API endpoints, authentication, and usage guidelines.

## Authentication

### JWT Authentication
All API endpoints (except public ones) require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Endpoints

#### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout current session
- `POST /api/auth/verify` - Verify user account
- `POST /api/auth/resend-verification` - Resend verification code

#### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

#### Users
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Messages
- `GET /api/messages` - Get messages
- `POST /api/messages` - Send message
- `GET /api/messages/:id` - Get message details

#### Live Streams
- `GET /api/live-streams` - List active streams
- `POST /api/live-streams` - Start new stream
- `GET /api/live-streams/:id` - Get stream details
- `PUT /api/live-streams/:id` - Update stream
- `DELETE /api/live-streams/:id` - End stream

#### WebRTC
- `GET /api/rtc/socket` - WebSocket connection
- `GET /api/rtc/mediasoup` - MediaSoup configuration

## Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Rate Limiting
- Authentication endpoints: 5 requests per minute
- API endpoints: 100 requests per minute
- WebSocket connections: 10 per IP

## Security
- All endpoints use HTTPS
- JWT tokens expire after 24 hours
- Refresh tokens available for extended sessions
- Rate limiting implemented
- CORS configured for specific origins 