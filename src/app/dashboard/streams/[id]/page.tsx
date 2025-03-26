"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  getLiveStreamById,
  LiveStream,
  AuctionListing,
  startLiveStream,
  endLiveStream,
  addListingToLiveStream,
  Product,
  getUserProducts
} from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { getToken } from "@/lib/auth";

export default function StreamDetailsPage() {
  // Use the useParams hook to get the id parameter
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddListing, setShowAddListing] = useState(false);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [startPrice, setStartPrice] = useState<string>("");
  const [countdownTime, setCountdownTime] = useState<string>("30");

  // Fetch stream details - use useCallback to memoize the function
  const fetchStreamDetails = useCallback(async () => {
    try {
      setLoading(true);
      const streamData = await getLiveStreamById(id);
      setStream(streamData);
      setError(null);
    } catch (err) {
      console.error("Error fetching stream:", err);
      setError("Failed to load stream details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch user products
  const fetchUserProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      // Assuming there's an API to get the current user's products
      const products = await getUserProducts();
      setUserProducts(products);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load your products. Please try again.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Use effect to fetch data
  useEffect(() => {
    if (id) {
      fetchStreamDetails();
    }
  }, [id, fetchStreamDetails]);

  // Start stream handler
  const handleStartStream = async () => {
    try {
      // Get token using helper function
      const token = getToken();
      if (!token) {
        throw new Error("Authentication required to start a stream");
      }

      await startLiveStream(id, token);
      // Redirect to the stream page
      router.push(`/live-streams/${id}`);
    } catch (err) {
      console.error("Error starting stream:", err);
      setError("Failed to start stream. Please try again.");
      // Refresh the stream details
      fetchStreamDetails();
    }
  };

  // End stream handler
  const handleEndStream = async () => {
    try {
      if (confirm("Are you sure you want to end this stream?")) {
        // Get token using helper function
        const token = getToken();
        if (!token) {
          throw new Error("Authentication required to end a stream");
        }

        await endLiveStream(id, token);
        // Refresh the stream details
        fetchStreamDetails();
      }
    } catch (err) {
      console.error("Error ending stream:", err);
      setError("Failed to end stream. Please try again.");
      // Refresh the stream details
      fetchStreamDetails();
    }
  };

  // Toggle Add Listing modal
  const toggleAddListing = useCallback(() => {
    setShowAddListing((prev) => {
      const newState = !prev;
      // Only fetch products when opening the modal and no products loaded yet
      if (newState && userProducts.length === 0) {
        fetchUserProducts();
      }
      return newState;
    });
  }, [userProducts.length, fetchUserProducts]);

  // Handle add listing form submission
  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!selectedProduct) {
        setError("Please select a product.");
        return;
      }

      if (!startPrice || isNaN(parseFloat(startPrice)) || parseFloat(startPrice) <= 0) {
        setError("Please enter a valid starting price.");
        return;
      }

      // Get token using helper function
      const token = getToken();
      if (!token) {
        throw new Error("Authentication required to add a product to stream");
      }

      const startPriceValue = parseFloat(startPrice);
      const countdownTimeValue = parseInt(countdownTime) || 30;

      await addListingToLiveStream(
        id,
        {
          productId: selectedProduct,
          startPrice: startPriceValue,
          countdownTime: countdownTimeValue
        },
        token
      );

      // Reset form
      setSelectedProduct("");
      setStartPrice("");
      setCountdownTime("30");

      // Hide modal
      setShowAddListing(false);

      // Refresh stream details
      fetchStreamDetails();
    } catch (err) {
      console.error("Error adding listing:", err);
      setError("Failed to add listing. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading stream details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => router.push("/dashboard/streams")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Back to My Streams
        </button>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Stream not found or you don&apos;t have permission to view it.
        </div>
        <button
          onClick={() => router.push("/dashboard/streams")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Back to My Streams
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <Link
            href="/dashboard/streams"
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to My Streams
          </Link>
          <h1 className="text-2xl font-bold">{stream.title}</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {stream.status === "SCHEDULED" && (
            <>
              <button
                onClick={handleStartStream}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Go Live Now
              </button>
            </>
          )}

          {stream.status === "LIVE" && (
            <>
              <button
                onClick={() => router.push(`/live-streams/${id}`)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                View Live Stream
              </button>
              <button
                onClick={handleEndStream}
                className="px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition"
              >
                End Stream
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stream details */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Left column - Stream info */}
            <div className="w-full md:w-1/3">
              <div className="aspect-video bg-gray-100 mb-4 rounded overflow-hidden">
                {stream.thumbnailUrl ? (
                  <img
                    src={stream.thumbnailUrl}
                    alt={stream.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <span className="text-gray-400">No thumbnail</span>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 mr-2">
                  Status: {stream.status}
                </span>
                {stream._count && (
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">
                    {stream._count.viewers} viewers
                  </span>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-gray-700">{stream.description || "No description"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Start Time</h3>
                  <p className="text-gray-700">
                    {stream.startTime ? formatDateTime(stream.startTime) : "Not started"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">End Time</h3>
                  <p className="text-gray-700">
                    {stream.endTime ? formatDateTime(stream.endTime) : "Not ended"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right column - Listings */}
            <div className="w-full md:w-2/3">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Products</h2>
                {(stream.status === "SCHEDULED" || stream.status === "LIVE") && (
                  <button
                    onClick={toggleAddListing}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Add Product
                  </button>
                )}
              </div>

              {stream.listings && stream.listings.length > 0 ? (
                <div className="space-y-4">
                  {stream.listings.map((listing: AuctionListing) => (
                    <div key={listing.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* Product image */}
                        <div className="w-full md:w-1/4">
                          {listing.product?.images && listing.product.images.length > 0 ? (
                            <img
                              src={listing.product.images[0].url}
                              alt={listing.product.title}
                              className="w-full aspect-square object-cover rounded"
                            />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center bg-gray-200 rounded">
                              <span className="text-gray-400">No image</span>
                            </div>
                          )}
                        </div>

                        {/* Product info */}
                        <div className="flex-1">
                          <div className="flex justify-between mb-2">
                            <h3 className="text-lg font-medium">{listing.product?.title}</h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              {listing.status}
                            </span>
                          </div>

                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {listing.product?.description}
                          </p>

                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Starting Price</p>
                              <p className="font-medium">{formatCurrency(listing.startPrice)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Current Highest Bid</p>
                              <p className="font-medium">
                                {listing.winningBid
                                  ? formatCurrency(listing.winningBid.amount)
                                  : "No bids yet"}
                              </p>
                            </div>
                          </div>

                          {/* Bids section - Ensure all bids are displayed clearly */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Bids History</h4>
                            {listing.bids && listing.bids.length > 0 ? (
                              <div className="space-y-1 max-h-40 overflow-y-auto">
                                {listing.bids.map((bid) => (
                                  <div
                                    key={bid.id}
                                    className={`flex justify-between items-center text-sm p-1 rounded ${bid.isWinning ? 'bg-green-50 font-medium' : ''
                                      }`}
                                  >
                                    <span>{bid.user?.username}</span>
                                    <div className="flex items-center">
                                      <span className={bid.isWinning ? 'font-bold' : ''}>{formatCurrency(bid.amount)}</span>
                                      {bid.isWinning && (
                                        <span className="ml-2 text-xs text-green-600">Current Winner</span>
                                      )}
                                      {bid.isBackup && (
                                        <span className="ml-2 text-xs text-orange-600">Backup</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No bids placed yet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-gray-600 mb-4">No products added to this stream yet.</p>
                  {(stream.status === "SCHEDULED" || stream.status === "LIVE") && (
                    <button
                      onClick={toggleAddListing}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                      Add Your First Product
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Listing Modal */}
      {showAddListing && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-xl font-semibold">Add Product to Stream</h3>
            </div>

            <form onSubmit={handleAddListing} className="p-6">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Product
                </label>
                {loadingProducts ? (
                  <p className="text-gray-500">Loading your products...</p>
                ) : userProducts.length === 0 ? (
                  <p className="text-red-500">
                    You don&apos;t have any products. Please create a product first.
                  </p>
                ) : (
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a product</option>
                    {userProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title} - {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting Price
                </label>
                <input
                  type="number"
                  value={startPrice}
                  onChange={(e) => setStartPrice(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Countdown Time (seconds)
                </label>
                <input
                  type="number"
                  value={countdownTime}
                  onChange={(e) => setCountdownTime(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="30"
                  min="10"
                  max="300"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={toggleAddListing}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  disabled={loadingProducts || userProducts.length === 0}
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 