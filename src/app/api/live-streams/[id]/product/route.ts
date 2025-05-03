import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/env"; // Import env config

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const urlPath = requestUrl.pathname;
  console.log(`[API][${urlPath}] GET request received`);
  try {
    // Extract the ID from the URL path
    const pathParts = urlPath.split('/');
    // Example: /api/live-streams/stream123/product -> [ '', 'api', 'live-streams', 'stream123', 'product' ]
    const streamId = pathParts.length >= 3 ? pathParts[pathParts.length - 2] : null;
    console.log(`[API][${urlPath}] Extracted streamId: ${streamId}`);

    if (!streamId) {
      console.error(`[API][${urlPath}] Bad Request (400): Could not extract streamId from path.`);
      return NextResponse.json({ error: 'Missing stream ID' }, { status: 400 });
    }
    
    // Prefer Authorization header, fall back to cookie (though header is standard for APIs)
    const authHeader = request.headers.get("authorization");
    let token = authHeader ? authHeader.split(" ")[1] : null;
    console.log(`[API][${urlPath}] Token found in header: ${!!token}`);

    if (!token) {
      const cookieStore = await cookies(); // Await if necessary, check Next.js version docs
      token = cookieStore.get("token")?.value ?? null;
      console.log(`[API][${urlPath}] Token found in cookie: ${!!token}`);
    }
    
    if (!token) {
      console.warn(`[API][${urlPath}] Unauthorized (401): No token provided in header or cookie.`);
      // Returning mock data for unauthorized, but could return 401
      // Consider the implications of showing mock data vs. an error
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Construct backend URL
    const backendUrl = `${env.BACKEND_API_URL}/api/live-streams/${streamId}/active-listing`;
    console.log(`[API][${urlPath}] Fetching active listing from backend: ${backendUrl}`);

    try {
      // Try to fetch the product information from the backend
      const response = await fetch(backendUrl, {
        headers: {
          // Only include Authorization header if token exists
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        next: { revalidate: 30 }, // Revalidate every 30 seconds
      });
      console.log(`[API][${urlPath}] Backend response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`[API][${urlPath}] Successfully fetched data from backend:`, data);

        // Format the data to match our frontend schema
        const product = {
          id: data.product?.id || "123", // Use fallback IDs carefully
          liveStreamId: streamId,
          name: data.product?.title || "Product Name",
          description: data.product?.description || "No description available",
          imageUrl:
            data.product?.images?.[0]?.url ||
            "https://images.unsplash.com/photo-1584208124232-36c365e5da90?q=80&w=500", // Consistent fallback image
          currentBid: data.currentHighestBid || data.startPrice || 0, // Ensure fallback is a number
          startingBid: data.startPrice || 0, // Ensure fallback is a number
        };
        console.log(`[API][${urlPath}] Formatted product data:`, product);
        return NextResponse.json(product);
      } else {
        // Log non-OK response from backend
        const errorText = await response.text();
        console.warn(`[API][${urlPath}] Backend fetch failed (${response.status}): ${errorText}`);
        // Decide if fallback is appropriate based on status (e.g., not for 401/403)
        if (response.status === 401 || response.status === 403) {
          console.error(`[API][${urlPath}] Backend returned authorization error. Cannot proceed.`);
          return NextResponse.json({ error: "Unauthorized to view listing" }, { status: response.status });
        }
      }
    } catch (backendError) {
      // Log fetch error
      console.error(`[API][${urlPath}] Error fetching from backend:`, backendError);
      // Fall through to mock data on fetch error (consider if this is desired)
    }

    // If the backend request fails OR was unauthorized and fallback is allowed
    console.log(`[API][${urlPath}] Falling back to mock product data.`);
    const mockProduct = {
      id: "mock-123",
      liveStreamId: streamId,
      name: "Vintage Watch (Demo)",
      description:
        "This is mock product data shown because the backend is unavailable or unauthorized. In a real scenario, you would see the actual product details here.",
      imageUrl:
        "https://images.unsplash.com/photo-1584208124232-36c365e5da90?q=80&w=500",
      currentBid: 250,
      startingBid: 100,
    };

    console.log(`[API][${urlPath}] Returning mock product:`, mockProduct);
    return NextResponse.json(mockProduct);

  } catch (error) {
    console.error(`[API][${urlPath}] Unexpected error in GET handler:`, error);
    // Construct a more informative error response
    const mockErrorProduct = {
      id: "error-fallback",
      liveStreamId: "unknown-stream", // Use extracted ID if available, else unknown
      name: "Error Loading Product",
      description: "This is a fallback product shown due to an internal server error.",
      imageUrl: "", // Or a specific error image
      currentBid: 0,
      startingBid: 0,
    };
    console.log(`[API][${urlPath}] Returning error fallback product:`, mockErrorProduct);
    return NextResponse.json(
      { 
        error: "Failed to fetch product data",
        product: mockErrorProduct 
      },
      { status: 500 }
    );
  }
}
