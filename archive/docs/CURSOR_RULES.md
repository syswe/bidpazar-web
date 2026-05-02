# BidPazar Cursor Rules Update

## Overview
This document outlines the updated cursor rules for the BidPazar full-stack application, including both frontend and backend components.

## File Structure Rules

### 1. Frontend Structure
```
src/
├── app/                    # Next.js 15 App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   ├── ui/               # UI components
│   ├── forms/            # Form components
│   └── shared/           # Shared components
├── lib/                  # Utility functions
│   ├── auth.ts          # Authentication utilities
│   ├── prisma.ts        # Prisma client
│   └── utils.ts         # General utilities
└── types/               # TypeScript types
```

### 2. Backend Structure
```
src/
├── app/
│   └── api/             # API routes
│       ├── auth/        # Authentication endpoints
│       ├── products/    # Product endpoints
│       ├── users/       # User endpoints
│       └── rtc/         # WebRTC endpoints
├── lib/
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   └── utils/           # Utility functions
└── types/              # TypeScript types
```

## Naming Conventions

### 1. Files and Directories
- Use kebab-case for file and directory names
- Use PascalCase for React components
- Use camelCase for utility functions
- Use UPPER_SNAKE_CASE for constants

### 2. Components
```typescript
// Good
UserProfile.tsx
product-card.tsx
useAuth.ts

// Bad
userProfile.tsx
ProductCard.tsx
UseAuth.ts
```

### 3. API Routes
```typescript
// Good
GET /api/users/:id
POST /api/auth/login
PUT /api/products/:id

// Bad
GET /api/getUser/:id
POST /api/userLogin
PUT /api/updateProduct/:id
```

## Code Style Rules

### 1. TypeScript
- Always use TypeScript
- Avoid `any` type
- Use interfaces for object types
- Use type aliases for union types
- Use enums for constants

### 2. React Components
```typescript
// Good
interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate }) => {
  // Component logic
};

// Bad
const UserProfile = ({ user, onUpdate }) => {
  // Component logic
};
```

### 3. API Routes
```typescript
// Good
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Route logic
}

// Bad
export default async function handler(req, res) {
  // Route logic
}
```

## Testing Rules

### 1. Test Files
- Place test files next to the component/function being tested
- Use `.test.ts` or `.test.tsx` extension
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Naming
```typescript
// Good
describe('UserProfile', () => {
  it('should render user information', () => {
    // Test logic
  });
});

// Bad
describe('Test UserProfile', () => {
  it('test render', () => {
    // Test logic
  });
});
```

## Documentation Rules

### 1. Comments
- Use JSDoc for function documentation
- Add comments for complex logic
- Document API endpoints
- Document component props

### 2. README Files
- Include setup instructions
- Document environment variables
- List dependencies
- Provide usage examples

## Git Rules

### 1. Branch Naming
```
feature/feature-name
bugfix/bug-name
hotfix/issue-name
release/version
```

### 2. Commit Messages
```
feat: add user profile
fix: resolve login issue
docs: update API documentation
chore: update dependencies
```

## Security Rules

### 1. Authentication
- Use JWT for authentication
- Implement refresh tokens
- Use secure cookies
- Validate all inputs

### 2. API Security
- Rate limit all endpoints
- Validate request bodies
- Sanitize inputs
- Use HTTPS only

## Performance Rules

### 1. Frontend
- Use React.memo for expensive components
- Implement code splitting
- Optimize images
- Use proper caching

### 2. Backend
- Implement proper indexing
- Use connection pooling
- Cache frequently accessed data
- Optimize database queries

## Error Handling

### 1. Frontend
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API error
  } else {
    // Handle unexpected error
  }
}
```

### 2. Backend
```typescript
export async function GET(req: NextRequest) {
  try {
    // Operation
  } catch (error) {
    if (error instanceof PrismaError) {
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## WebRTC Rules

### 1. MediaSoup Configuration
```typescript
const mediaSoupConfig = {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
    logLevel: 'warn',
  },
  router: {
    mediaCodecs: [
      // Codec configuration
    ],
  },
};
```

### 2. WebSocket Events
```typescript
// Client events
socket.emit('join-room', { roomId });
socket.emit('leave-room', { roomId });

// Server events
socket.on('join-room', handleJoinRoom);
socket.on('leave-room', handleLeaveRoom);
```

## Database Rules

### 1. Prisma Schema
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2. Queries
```typescript
// Good
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true },
});

// Bad
const user = await prisma.user.findUnique({ where: { id } });
``` 