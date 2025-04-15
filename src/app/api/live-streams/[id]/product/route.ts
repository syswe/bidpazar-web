import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Await params before accessing id
    const streamId = (await params).id;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    // Log API URL and streamId
    console.log(`Fetching product from: ${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/active-listing`);

    try {
      // Try to fetch the product information from the backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/active-listing`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          next: { revalidate: 30 }, // Revalidate every 30 seconds
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Format the data to match our frontend schema
        const product = {
          id: data.product?.id || "123",
          liveStreamId: streamId,
          name: data.product?.title || "Product Name",
          description: data.product?.description || "No description available",
          imageUrl:
            data.product?.images?.[0]?.url ||
            "https://images.unsplash.com/photo-1584208124232-36c365e5da90?q=80&w=500",
          currentBid: data.currentHighestBid || data.startPrice,
          startingBid: data.startPrice || 100,
        };

        return NextResponse.json(product);
      }
    } catch (backendError) {
      // Log backend error but continue to mock data
      console.error("Backend API error:", backendError);
    }

    // If the backend request fails, fall back to mock data
    console.log("Falling back to mock product data");
    const mockProduct = {
      id: "mock-123",
      liveStreamId: streamId,
      name: "Vintage Watch (Demo)",
      description:
        "This is mock product data shown because the backend is unavailable. In a real scenario, you would see the actual product details here.",
      imageUrl:
        "https://images.unsplash.com/photo-1584208124232-36c365e5da90?q=80&w=500",
      currentBid: 250,
      startingBid: 100,
    };

    return NextResponse.json(mockProduct);
  } catch (error) {
    console.error("Error in product API route:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch product data",
        mockProduct: {
          id: "error-fallback",
          name: "Demo Product",
          description: "This is a fallback product shown due to an error",
          currentBid: 100,
          startingBid: 50,
          liveStreamId: params?.id || "unknown-stream"
        }
      },
      { status: 500 }
    );
  }
}
