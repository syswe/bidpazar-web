import { NextApiRequest, NextApiResponse } from 'next';

declare module 'next' {
  interface NextApiRequest {
    user?: {
      id: string;
      email: string;
      username: string;
      name: string;
      phoneNumber: string;
      isVerified: boolean;
      isAdmin: boolean;
    };
  }
}

declare module 'next/server' {
  interface NextRequest {
    user?: {
      id: string;
      email: string;
      username: string;
      name: string;
      phoneNumber: string;
      isVerified: boolean;
      isAdmin: boolean;
    };
  }
} 