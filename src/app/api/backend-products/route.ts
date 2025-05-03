import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:5001/backend';

export async function GET() {
  try {
    console.log(`[API Route] Calling backend products at: ${BACKEND_URL}/products`);
    
    const response = await fetch(`${BACKEND_URL}/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });
    
    console.log(`[API Route] Backend response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[API Route] Backend error: ${response.status}`);
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Route] Failed to fetch from backend:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend API' },
      { status: 500 }
    );
  }
} 