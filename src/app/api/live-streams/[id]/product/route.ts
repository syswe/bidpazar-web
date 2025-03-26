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

    // Fetch the product information from the backend
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/live-streams/${streamId}/active-listing`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: 30 }, // Revalidate every 30 seconds
      }
    );

    if (!response.ok) {
      // If the backend request fails, fall back to mock data
      const mockProduct = {
        id: "123",
        liveStreamId: streamId,
        name: "Vintage Watch",
        description:
          "A beautiful vintage watch from the 1950s. This is a rare collectible item in excellent condition.",
        imageUrl:
          "https://images.unsplash.com/photo-1584208124232-36c365e5da90?q=80&w=500",
        currentBid: 250,
        startingBid: 100,
      };

      return NextResponse.json(mockProduct);
    }

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
  } catch (error) {
    console.error("Error fetching product data:", error);
    return NextResponse.json(
      { error: "Failed to fetch product data" },
      { status: 500 }
    );
  }
}
