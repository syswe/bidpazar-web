import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  console.log('[API][/api/live-streams/[id]/active-bid] GET request received');
  
  const streamId = params.id;
  console.log('[API][/api/live-streams/[id]/active-bid] Extracted streamId:', streamId);
  
  // Get authorization header
  const authHeader = request.headers.get('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
  
  console.log('[API][/api/live-streams/[id]/active-bid] Token found in header:', !!token);
  
  try {
    // Get backend API URL from environment - ensure we don't have duplicate /api
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    
    // Only add /api if it's not already included in the backendUrl
    const apiPrefix = backendUrl.endsWith('/api') ? '' : '/api';
    
    // Construct the final endpoint URL carefully to avoid duplication
    const activeBidEndpoint = `${backendUrl}${apiPrefix}/live-streams/${streamId}/active-bid`;
    
    console.log('[API][/api/live-streams/[id]/active-bid] Fetching active bid from backend:', activeBidEndpoint);
    
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
    console.log('[API][/api/live-streams/[id]/active-bid] Backend response status:', response.status);
    
    // Handle non-200 responses
    if (!response.ok) {
      if (response.status === 401) {
        const errorText = await response.text();
        console.log('[API][/api/live-streams/[id]/active-bid] Backend fetch failed (401):', errorText);
        console.log('[API][/api/live-streams/[id]/active-bid] Backend returned authorization error. Cannot proceed.');
        
        // Return proper JSON response
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required for this action' },
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // For other errors
      const errorText = await response.text();
      console.log(`[API][/api/live-streams/[id]/active-bid] Backend fetch failed (${response.status}):`, errorText);
      
      try {
        // Try to parse as JSON if possible
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(errorJson, { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        // If can't parse as JSON, return as simple error
        return NextResponse.json(
          { error: 'Backend Error', message: errorText || 'Unknown error from backend' },
          { status: response.status, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Ensure we're receiving JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // If not JSON, try to read text and return as error
      const text = await response.text();
      console.log('[API][/api/live-streams/[id]/active-bid] Non-JSON response from backend:', text.substring(0, 100));
      
      // Check if it's HTML (error page)
      if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
        return NextResponse.json(
          { error: 'Backend returned HTML instead of JSON', message: 'The backend service may be experiencing issues' },
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid response format', message: 'Backend did not return valid JSON' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Forward the response from backend
    const data = await response.json();
    return NextResponse.json(data, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[API][/api/live-streams/[id]/active-bid] Error:', error);
    
    // Return proper JSON error response
    return NextResponse.json(
      { error: 'Server Error', message: error.message || 'An unknown error occurred' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  console.log('[API][/api/live-streams/[id]/active-bid] POST request received');
  
  const streamId = params.id;
  console.log('[API][/api/live-streams/[id]/active-bid] Extracted streamId for POST:', streamId);
  
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
    
    // Handle responses
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // If not JSON, try to read text and return as error
        const text = await response.text();
        console.log('[API][/api/live-streams/[id]/active-bid] Non-JSON response from backend:', text.substring(0, 100));
        
        return NextResponse.json(
          { error: 'Invalid response format', message: 'Backend did not return valid JSON' },
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Forward the success response
      const data = await response.json();
      return NextResponse.json(data, { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } else {
      // Handle error response
      let errorMessage = "Failed to place bid";
      try {
        const text = await response.text();
        console.log(`[API][/api/live-streams/[id]/active-bid] Backend error (${response.status}):`, text);
        
        if (text) {
          try {
            // Try to parse as JSON if possible
            const errorData = JSON.parse(text);
            errorMessage = errorData.message || errorData.error || errorMessage;
            
            return NextResponse.json(
              errorData,
              { 
                status: response.status,
                headers: { 'Content-Type': 'application/json' } 
              }
            );
          } catch (e) {
            // Not valid JSON, use text as message
          }
        }
      } catch (e) {
        console.error("[API][/api/live-streams/[id]/active-bid] Error reading error response:", e);
      }
      
      // Return a fallback error if parsing failed
      return NextResponse.json(
        { error: errorMessage },
        { 
          status: response.status,
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error: any) {
    console.error('[API][/api/live-streams/[id]/active-bid] Error in POST handler:', error);
    
    return NextResponse.json(
      { error: 'Server Error', message: error.message || 'An unknown error occurred' },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
} 