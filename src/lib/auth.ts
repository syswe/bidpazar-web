import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { cookies } from 'next/headers';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';
import { jwtVerify, JWTPayload } from 'jose';

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      username: string;
    }
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    username: string;
  }
}

// Extend the built-in JWT types
declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  isAdmin: boolean;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        // Here you would verify the password
        // For now, we'll just return the user
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    }
  }
};

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  const secret = process.env.JWT_SECRET;
  console.log('[verifyToken] Attempting to verify token (using jose).');
  console.log('[verifyToken] Using JWT_SECRET:', secret ? 'Exists' : 'MISSING or undefined!');
  
  if (!secret) {
    console.error('[verifyToken] JWT_SECRET is not set in environment variables.');
    return null;
  }

  try {
    // Use jose.jwtVerify as it's Edge-compatible
    const secretKey = new TextEncoder().encode(secret);
    const { payload }: { payload: JWTPayload } = await jwtVerify(token, secretKey);
    console.log('[verifyToken] Token successfully decoded:', payload);
    
    // Explicitly check types after decoding
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;
    const username = payload.username as string | undefined;
    const isAdmin = payload.isAdmin as boolean | undefined;

    // Type guard: check required fields
    const isValidPayload = 
      typeof userId === 'string' &&
      typeof email === 'string' &&
      typeof username === 'string' &&
      typeof isAdmin === 'boolean';

    if (isValidPayload) {
      console.log('[verifyToken] Payload structure is valid.');
      // Now types are confirmed
      return {
        userId: userId,
        email: email,
        username: username,
        isAdmin: isAdmin,
      };
    } else {
      console.error('[verifyToken] Invalid JWT payload structure after type checks:', { userId, email, username, isAdmin });
      return null;
    }
  } catch (error: any) { 
    console.error('[verifyToken] Token verification failed (jose):', error.message || error);
    return null;
  }
}

export async function getUserFromToken(token: string) {
  try {
    const payload = await verifyToken(token);
    if (!payload) {
      console.log('[getUserFromToken] verifyToken returned null')
      return null;
    }

    console.log(`[getUserFromToken] Looking for user with ID: ${payload.userId}`);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        phoneNumber: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    console.log(`[getUserFromToken] Prisma found user: ${!!user}`);
    return user;
  } catch (error) {
    console.error('[getUserFromToken] Error fetching user from DB:', error);
    return null;
  }
}

// Function specifically for Edge runtime token verification (used by Middleware)
export async function verifyAuthSession(token: string): Promise<JWTPayload | null> {
  const secret = process.env.JWT_SECRET;
  console.log('[verifyAuthSession:Edge] Attempting to verify token (using jose).');
  console.log('[verifyAuthSession:Edge] Using JWT_SECRET:', secret ? 'Exists' : 'MISSING or undefined!');
  
  if (!secret || !token) { // Also check if token is provided
    console.error('[verifyAuthSession:Edge] JWT_SECRET or token is missing.');
    return null;
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload }: { payload: JWTPayload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'], // Specify expected algorithm
    });
    console.log('[verifyAuthSession:Edge] Token successfully decoded:', payload);

    // Basic structure check - does it have at least userId? More checks can be added if needed.
    if (typeof payload.userId === 'string') {
      console.log('[verifyAuthSession:Edge] Basic payload structure check passed (userId exists).');
      return payload; // Return the raw jose payload
    } else {
       console.error('[verifyAuthSession:Edge] Invalid payload structure: userId missing or not a string.', payload);
       return null;
    }

  } catch (error: any) { 
    console.error('[verifyAuthSession:Edge] Token verification failed (jose):', error.message || error);
    // Log specific errors like expiration
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.log('[verifyAuthSession:Edge] Token expired.');
    }
    return null;
  }
}

// Function for Node.js runtime: Verifies token AND fetches user data
// Used by API routes, Server Components etc.
export async function getUserFromTokenInNode(token: string) {
  console.log('[getUserFromTokenInNode:Node] Verifying token and fetching user.');
  if (!token) return null;

  try {
    // 1. Verify token using jsonwebtoken (works in Node.js)
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[getUserFromTokenInNode:Node] JWT_SECRET is missing.');
      return null;
    }
    const payload = jwt.verify(token, secret) as JwtPayload;

    // 2. Check payload structure (redundant check, but good practice)
     if (!(typeof payload === 'object' && typeof payload.userId === 'string')) {
        console.error('[getUserFromTokenInNode:Node] Invalid payload structure after verify.', payload);
        return null;
     }
     console.log(`[getUserFromTokenInNode:Node] Token verified, payload:`, payload);

    // 3. Fetch user from DB (this is safe in Node.js)
    console.log(`[getUserFromTokenInNode:Node] Looking for user with ID: ${payload.userId}`);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { // Select only needed fields
        id: true,
        email: true,
        username: true,
        name: true,
        phoneNumber: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    console.log(`[getUserFromTokenInNode:Node] Prisma found user: ${!!user}`);
    return user;

  } catch (error: any) {
    console.error('[getUserFromTokenInNode:Node] Failed:', error.message || error);
    if (error.name === 'JsonWebTokenError') {
       console.log('[getUserFromTokenInNode:Node] Invalid token signature or format.');
    } else if (error.name === 'TokenExpiredError') {
       console.log('[getUserFromTokenInNode:Node] Token expired.');
    } else {
       console.error('[getUserFromTokenInNode:Node] Error during verification or DB fetch:', error);
    }
    return null;
  }
} 