# BidPazar Streaming API Endpoint Standardization

## Overview

This document standardizes the API endpoint naming conventions for the BidPazar streaming system to ensure consistency across documentation, implementation, and client code.

## API Endpoint Structure

All streaming-related API endpoints follow the structure:

```
/api/live-streams/[action or ID/action]
```

## Standardized Endpoint Reference

### Stream Management Endpoints

| Operation                      | HTTP Method | Endpoint                                | Previous Variations        |
|--------------------------------|-------------|----------------------------------------|----------------------------|
| List all streams               | GET         | `/api/live-streams`                     | (No changes)               |
| Get stream details             | GET         | `/api/live-streams/[id]`                | (No changes)               |
| Create new stream              | POST        | `/api/live-streams`                     | (No changes)               |
| Update stream details          | PUT         | `/api/live-streams/[id]`                | (No changes)               |
| Delete stream                  | DELETE      | `/api/live-streams/[id]`                | (No changes)               |

### Stream State Management Endpoints

| Operation                      | HTTP Method | Endpoint                                | Previous Variations        |
|--------------------------------|-------------|----------------------------------------|----------------------------|
| Start stream                   | POST        | `/api/live-streams/[id]/start`          | (No changes)               |
| Pause stream                   | POST        | `/api/live-streams/[id]/pause`          | (No changes)               |
| Resume stream                  | POST        | `/api/live-streams/[id]/resume`         | (No changes)               |
| End stream                     | POST        | `/api/live-streams/[id]/end`            | `/stop`, `/terminate`      |
| Cancel scheduled stream        | POST        | `/api/live-streams/[id]/cancel`         | (No changes)               |
| Get stream status              | GET         | `/api/live-streams/[id]/status`         | (No changes)               |

### Stream Content Endpoints

| Operation                      | HTTP Method | Endpoint                                | Previous Variations        |
|--------------------------------|-------------|----------------------------------------|----------------------------|
| List stream chat messages      | GET         | `/api/live-streams/[id]/chat`           | (No changes)               |
| Send chat message              | POST        | `/api/live-streams/[id]/chat`           | (No changes)               |
| List stream auction listings   | GET         | `/api/live-streams/[id]/listings`       | (No changes)               |
| Create listing in stream       | POST        | `/api/live-streams/[id]/listings`       | `/create-listing`          |

### Stream Analytics Endpoints

| Operation                      | HTTP Method | Endpoint                                | Previous Variations        |
|--------------------------------|-------------|----------------------------------------|----------------------------|
| Get viewer count               | GET         | `/api/live-streams/[id]/viewers/count`  | `/viewer-count`            |
| Get viewer list                | GET         | `/api/live-streams/[id]/viewers`        | (No changes)               |
| Get stream analytics           | GET         | `/api/live-streams/[id]/analytics`      | (No changes)               |

## Implementation in Components

### API Routes Implementation

All API routes should use the standardized endpoints defined above. For example:

```typescript
// src/app/api/live-streams/[id]/end/route.ts
// NOT: src/app/api/live-streams/[id]/stop/route.ts or src/app/api/live-streams/[id]/terminate/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Implementation for ending a stream
}
```

### socketEvents.ts Integration

The `socketEvents.ts` file should not make direct API calls to avoid circular dependencies. Instead, it should update the database directly using Prisma. However, any documentation or comments should reference the standardized API endpoint names.

```typescript
// In socketEvents.ts
// Comment should reference standard endpoint name:
// "This function performs the same database update as the /api/live-streams/[id]/end endpoint"
// NOT: "This function performs the same database update as the /api/live-streams/[id]/stop endpoint"
export async function updateDatabaseStreamState(
  streamId: string, 
  state: StreamState,
  userId?: string
): Promise<boolean> {
  // Implementation
}
```

### Frontend Components

Frontend components that make API calls should use the standardized endpoints:

```typescript
// In useStreamControls.ts or similar
const endStream = async () => {
  // Correct:
  const response = await fetch(`/api/live-streams/${streamId}/end`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Incorrect:
  // const response = await fetch(`/api/live-streams/${streamId}/stop`, {...});
  // const response = await fetch(`/api/live-streams/${streamId}/terminate`, {...});
};
```

## Documentation Standards

All documentation should use the standardized endpoint names, including:

1. Code comments
2. API documentation
3. Frontend component documentation
4. User documentation
5. Logging messages

## Migration Plan for Inconsistent Endpoints

1. Identify all instances of non-standard endpoint usage
2. Update API route files to use standard naming
3. Update frontend code to use standard endpoints
4. Maintain temporary redirect routes for backward compatibility if needed
5. Update all documentation to reflect standard naming

## Standardized Socket Events

For consistency, socket events should also follow a standardized naming convention that aligns with API endpoints:

| Operation                      | Socket Event                     | Previous Variations               |
|--------------------------------|----------------------------------|-----------------------------------|
| Stream start                   | `stream_starting`                | (No changes)                      |
| Stream went live               | `stream_went_live`               | `stream_started`                  |
| Stream paused                  | `stream_paused`                  | (No changes)                      |
| Stream resumed                 | `stream_resumed`                 | (No changes)                      |
| Stream ending                  | `stream_ending`                  | (No changes)                      |
| Stream ended                   | `stream_ended`                   | `stream_stopped`, `stream_terminated` |
| Stream interrupted             | `stream_interrupted`             | `stream_disconnected`             |
| Stream state changed (generic) | `stream_state_changed`           | (No changes)                      | 