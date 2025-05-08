import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  
  const streamId = params.id;
  
  // Get authorization header
  const authHeader = request.headers.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  try {
    // FIXED: Return mock data to prevent infinite loops
    // Since the backend is actually this same route, we need to break the cycle
    
    // Return a mock response for now without logging
    return NextResponse.json({
      isActive: false,
      message: "This is a mock response - backend integration pending"
    }, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    /* COMMENTED OUT TO PREVENT INFINITE LOOP
    // Get backend API URL from environment - ensure we don't have duplicate /api
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    
    // Only add /api if it's not already included in the backendUrl
    const apiPrefix = backendUrl.endsWith('/api') ? '' : '/api';
    
    // Construct the final endpoint URL carefully to avoid duplication
    const activeBidEndpoint = `${backendUrl}${apiPrefix}/live-streams/${streamId}/active-bid`;
    
    // Make request to backend
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(activeBidEndpoint, { headers });
    */
    
  } catch (error: any) {
    // Removed console.error logging
    return NextResponse.json(
      { error: 'Server Error', message: error.message || 'An unknown error occurred' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  // Removed console.log
  
  const streamId = params.id;
  // Removed console.log
  
  try {
    // Get auth token - only from authorization header for simplicity
    const authHeader = request.headers.get('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (!token) {
      return NextResponse.json({ 
        error: "Unauthorized", 
        message: "You must be logged in to place a bid" 
      }, { 
        status: 401,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Parse the request body
    const body = await request.json();
    
    // Validate the request
    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json({ 
        error: "Invalid bid amount" 
      }, { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // FIXED: Return a mock successful response instead of calling the backend
    // This prevents the infinite loop while a proper backend integration is implemented
    // Removed console.log
    
    return NextResponse.json({
      success: true,
      message: "Bid placed successfully (mock response)",
      bid: {
        amount: body.amount,
        productId: body.productId,
        streamId: streamId,
        timestamp: new Date().toISOString()
      }
    }, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });
    
    /* COMMENTED OUT TO PREVENT INFINITE LOOP
    // Get backend API URL from environment - ensure we don't have duplicate /api
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    
    // Only add /api if it's not already included in the backendUrl
    const apiPrefix = backendUrl.endsWith('/api') ? '' : '/api';
    
    // Construct the final endpoint URL carefully to avoid duplication
    const placeBidEndpoint = `${backendUrl}${apiPrefix}/live-streams/${streamId}/place-bid`;
    
    console.log('[API][/api/live-streams/[id]/active-bid] Placing bid via backend:', placeBidEndpoint);
    
    // Forward the bid to the backend
    const response = await fetch(placeBidEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: body.amount,
        productId: body.productId
      })
    });
    */
  } catch (error: any) {
    // Removed console.error
    return NextResponse.json(
      { error: 'Server Error', message: error.message || 'An unknown error occurred' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
} 