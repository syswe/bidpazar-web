import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const streamId = params.id;
  console.log(`[API][/api/live-streams/${streamId}/create-listing] POST request received`);
  
  try {
    // Parse the request body
    const body = await request.json();
    console.log(`[API][/api/live-streams/${streamId}/create-listing] Request body:`, body);
    
    // Normally we'd interact with a database here
    // For now, create a mock successful response
    const createdProduct = {
      id: `product-${Date.now()}`,
      streamId,
      name: body.product?.name || 'Unknown Product',
      startingBid: body.product?.startingBid || 0,
      currentBid: body.product?.startingBid || 0,
      duration: body.duration || 60,
      active: true,
      createdAt: new Date().toISOString()
    };
    
    console.log(`[API][/api/live-streams/${streamId}/create-listing] Created product:`, createdProduct);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Product created successfully',
      product: createdProduct
    }, { status: 201 });
  } catch (error) {
    console.error(`[API][/api/live-streams/${streamId}/create-listing] Error:`, error);
    return NextResponse.json({ 
      success: false, 
      message: `Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
} 