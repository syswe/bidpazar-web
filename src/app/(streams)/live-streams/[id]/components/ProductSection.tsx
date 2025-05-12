import React, { useState } from 'react';
import { Timer, PlusCircle, DollarSign, X, Loader2 } from 'lucide-react';
import { ProductBid } from '../hooks/useActiveBid';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getAuth } from '@/lib/frontend-auth';
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';

interface ProductSectionProps {
  streamId: string;
  isStreamer: boolean;
  activeProductBid: ProductBid | null;
  fetchActiveBid: () => void;
  user: any; // User object or null
}

const ProductSection: React.FC<ProductSectionProps> = ({
  streamId,
  isStreamer,
  activeProductBid,
  fetchActiveBid,
  user
}) => {
  const router = useRouter();
  const { config: runtimeConfig } = useRuntimeConfig();
  const { token } = getAuth();
  
  // New product form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format price with Turkish Lira
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Close form and reset values
  const closeForm = () => {
    setShowAddForm(false);
    setProductName("");
    setStartPrice("");
  };

  // Handle inline product creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!runtimeConfig) {
      toast.error("Configuration not loaded");
      return;
    }
    
    if (!token) {
      toast.error("You must be logged in to add products");
      return;
    }
    
    if (!productName.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    
    if (!startPrice.trim() || parseFloat(startPrice) <= 0) {
      toast.error("Please enter a valid starting price");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("Creating product with:", {
        streamId,
        productName: productName.trim(),
        startPrice: parseFloat(startPrice)
      });
      
      // Get a fresh token to ensure it's not expired
      const freshToken = getAuth().token || token;
      
      // First try sending request directly to the API
      console.log(`Using API URL: ${runtimeConfig.apiUrl}`);
      
      // Try the API endpoint - make sure to use correct path
      const response = await fetch(`${runtimeConfig.apiUrl}/live-streams/${streamId}/listings/simplified`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${freshToken}`
        },
        body: JSON.stringify({
          productId: "default", // This is needed for the API
          startPrice: parseFloat(startPrice),
          countdownTime: 30, // Add default countdown time
          productName: productName.trim() // Add product name for creation
        })
      });
      
      // Check the response status first
      if (!response.ok) {
        console.log(`Primary endpoint failed with status: ${response.status}`);
        
        // Try alternative endpoint if the first one fails
        if (response.status === 404 || response.status === 401) {
          console.log("Simplified endpoint failed, trying alternative endpoint");
          
          // Try the proxy endpoint instead, which might handle auth better
          const proxyResponse = await fetch(`/api/live-streams/${streamId}/listings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
              // No auth header - will use cookies instead
            },
            body: JSON.stringify({
              productId: "default", // This might be required by the API
              title: productName.trim(),
              startPrice: parseFloat(startPrice),
              countdownTime: 30 // Default countdown time
            })
          });
          
          if (!proxyResponse.ok) {
            console.error("Proxy endpoint also failed:", proxyResponse.status);
            
            // Last attempt - try direct API with alternative endpoint
            const altResponse = await fetch(`${runtimeConfig.apiUrl}/live-streams/${streamId}/listings`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${freshToken}`
              },
              body: JSON.stringify({
                productId: "default", // This might be required by the API
                title: productName.trim(),
                startPrice: parseFloat(startPrice),
                countdownTime: 30 // Default countdown time
              })
            });
            
            if (!altResponse.ok) {
              console.error("All endpoints failed. Alternative endpoint status:", altResponse.status);
              
              if (altResponse.status === 401) {
                toast.error("Authentication error. Please try logging out and back in.");
                throw new Error("Authentication failed. Please log in again.");
              } else {
                throw new Error(`Failed to create product: ${altResponse.status}`);
              }
            }
            
            // Success with alternative direct endpoint
            toast.success("Product added successfully");
            fetchActiveBid();
            closeForm();
            return;
          }
          
          // Success with proxy endpoint
          toast.success("Product added successfully");
          fetchActiveBid();
          closeForm();
          return;
        }
        
        // If not a 404 or alternative endpoint also failed
        if (response.status === 401) {
          toast.error("Authentication error. Please try logging out and back in.");
          throw new Error("Authentication failed. Please log in again.");
        } else {
          throw new Error(`Failed to create product: ${response.status}`);
        }
      }
      
      // Safely try to parse the response text if available
      let responseData = {};
      try {
        const responseText = await response.text();
        if (responseText && responseText.trim() && responseText.startsWith('{')) {
          responseData = JSON.parse(responseText);
        }
      } catch (error) {
        console.error("Error parsing response:", error);
        // Continue execution even if parsing fails
      }
      
      console.log("Product created successfully", responseData);
      toast.success("Product added successfully");
      fetchActiveBid();
      closeForm();
      
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no active product and not streamer, don't show anything
  if (!activeProductBid && !isStreamer) {
    return null;
  }

  // If streamer but no active product, show add product button/form
  if (!activeProductBid && isStreamer) {
    return showAddForm ? (
      <div className="p-3 rounded-lg bg-black/50 backdrop-blur-sm shadow max-w-[240px]">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-white font-medium text-sm">Add Product</h4>
          <button 
            onClick={closeForm}
            className="text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleCreateProduct} className="space-y-2">
          <div>
            <input
              type="text"
              placeholder="Product Name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full p-2 text-xs bg-black/50 text-white border border-white/20 rounded"
              required
            />
          </div>
          
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70">$</span>
            <input
              type="number"
              placeholder="Starting Price"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              className="w-full p-2 pl-6 text-xs bg-black/50 text-white border border-white/20 rounded"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center p-2 text-xs bg-[var(--accent)] text-white rounded"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            {isSubmitting ? "Adding..." : "Add Product"}
          </button>
        </form>
      </div>
    ) : (
      <button 
        onClick={() => setShowAddForm(true)}
        className="p-3 rounded-lg bg-black/50 backdrop-blur-sm shadow flex items-center space-x-2 hover:bg-black/70 transition-colors"
      >
        <PlusCircle className="w-5 h-5 text-[var(--accent)]" />
        <span className="text-white text-sm font-medium">Add Product</span>
      </button>
    );
  }

  // At this point, we know activeProductBid is not null since we've checked above
  // TypeScript doesn't always infer this correctly, so we'll use a non-null assertion
  // or we can use a type guard
  if (!activeProductBid) return null; // This is redundant but helps TypeScript understand

  const { product } = activeProductBid;
  
  return (
    <div className="p-3 rounded-lg bg-black/50 backdrop-blur-sm shadow flex items-center space-x-3 max-w-[240px]">
      {product.imageUrl && (
        <div className="w-12 h-12 rounded bg-gray-200 overflow-hidden flex-shrink-0">
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium text-sm truncate">{product.name}</h4>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center text-[var(--accent)] text-xs font-bold">
            <DollarSign className="w-3 h-3 mr-0.5" />
            {product.currentPrice}
          </div>
          <span className="text-white/70 text-xs flex items-center">
            <Timer className="w-3 h-3 mr-0.5" />
            {activeProductBid.bidCount} bids
          </span>
        </div>
        
        {/* Only show the bid button if user is authenticated and not the streamer */}
        {user && !isStreamer && (
          <button 
            onClick={() => router.push(`/live-streams/${streamId}?bid=true`)}
            className="mt-2 w-full py-1 text-xs bg-[var(--accent)] text-white rounded font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            Place Bid
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductSection; 