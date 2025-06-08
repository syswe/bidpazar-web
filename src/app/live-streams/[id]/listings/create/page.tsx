"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

import { getToken } from "@/lib/frontend-auth";

export default function CreateListingPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const { isAuthenticated } = useAuth();
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // We'll use a simplified direct input approach
  const [productName, setProductName] = useState("");
  const [startPrice, setStartPrice] = useState("");

  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated || !token) {
      toast.error("You must be logged in to add listings");
      router.push(`/live-streams/${id}`);
      return;
    }
    
    setLoading(false);
  }, [id, isAuthenticated, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const backendApiUrl = process.env.NEXT_PUBLIC_API_URL || "/api";

    if (!productName) {
      toast.error("Please enter a product name");
      return;
    }

    if (!startPrice || parseFloat(startPrice) <= 0) {
      toast.error("Please enter a valid starting price");
      return;
    }

    try {
      setSubmitting(true);
      console.log(`Attempting to create listing for stream ${id} with:`, {
        productName,
        startPrice: parseFloat(startPrice),
        apiUrl: backendApiUrl
      });

      // Create a minimal listing with just the necessary information
      const response = await fetch(`${backendApiUrl}/live-streams/${id}/listings/simplified`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          productName,
          startPrice: parseFloat(startPrice)
        })
      });

      const responseText = await response.text();
      console.log(`Simplified API response status: ${response.status}, body:`, responseText);
      
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("Error parsing API response:", parseError);
        responseData = { message: "Invalid server response" };
      }

      if (!response.ok) {
        // If the simplified endpoint fails, try the original endpoint with a fallback method
        console.log("Simplified API failed, trying fallback method");

        const fallbackResponse = await fetch(`${backendApiUrl}/live-streams/${id}/listings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            productId: "default", // This will be ignored, but helps with backward compatibility
            title: productName,
            startPrice: parseFloat(startPrice),
            countdownTime: 30
          })
        });

        const fallbackText = await fallbackResponse.text();
        console.log(`Fallback API response status: ${fallbackResponse.status}, body:`, fallbackText);
        
        let fallbackData;
        try {
          fallbackData = fallbackText ? JSON.parse(fallbackText) : {};
        } catch (parseError) {
          console.error("Error parsing fallback API response:", parseError);
          fallbackData = { message: "Invalid server response from fallback" };
        }

        if (!fallbackResponse.ok) {
          console.error("Fallback API error response:", fallbackData);
          throw new Error(fallbackData.message || "Failed to create listing");
        }

        console.log("Listing created with fallback method:", fallbackData);
        toast.success("Listing added to stream");
        router.push(`/live-streams/${id}`);
        return;
      }

      console.log("Listing created successfully:", responseData);
      toast.success("Listing added to stream");
      router.push(`/live-streams/${id}`);
    } catch (error) {
      console.error("Error creating listing:", error);
      toast.error("Failed to add listing to stream");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-xl mx-auto py-8 px-4 h-screen">
      <div className="flex items-center mb-6">
        <Link href={`/live-streams/${id}`} className="mr-4">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold">Add Item to Stream</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="productName" className="block text-sm font-medium">
            Ürün Adı (Product Name)
          </label>
          <input
            type="text"
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="startPrice" className="block text-sm font-medium">
            Açılış Fiyatı (Starting Price)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
            <input
              type="number"
              id="startPrice"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              className="w-full p-2 pl-8 border rounded-md bg-background"
              min="0.01"
              step="0.01"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground py-2 rounded-md flex items-center justify-center disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          {submitting ? "Adding..." : "Add to Stream"}
        </button>
      </form>
    </div>
  );
} 