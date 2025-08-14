"use client";

import React, { useState } from "react";
import { Package, X, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { getAuth } from "@/lib/frontend-auth";

interface AddProductStockSaleProps {
  streamId: string;
  onSuccess: () => void;
  socket?: any;
  className?: string;
}

const AddProductStockSale: React.FC<AddProductStockSaleProps> = ({
  streamId,
  onSuccess,
  socket,
  className = "",
}) => {
  const { token } = getAuth();
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setProductName("");
    setProductDesc("");
    setPrice("");
    setStock("1");
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName || !price || !stock) {
      toast.error("Ürün adı, fiyat ve stok adedi gereklidir");
      return;
    }

    const priceValue = parseFloat(price);
    const stockValue = parseInt(stock);
    
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error("Geçerli bir fiyat giriniz");
      return;
    }

    if (isNaN(stockValue) || stockValue <= 0) {
      toast.error("Geçerli bir stok adedi giriniz");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: productName,
          description: productDesc,
          startingPrice: priceValue,
          stock: stockValue,
          isAuctionMode: false, // This is a stock sale, not auction
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Ürün eklenirken bir hata oluştu");
      }

      const data = await response.json();

      if (socket) {
        socket.emit("new-stock-sale", {
          streamId,
          productId: data.id,
          productName: productName,
          price: priceValue,
          stock: stockValue,
        });
      }

      toast.success("Ürün stoklu satışa eklendi!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Failed to add stock sale product:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Ürün eklenirken bir hata oluştu"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleForm = () => {
    setShowForm(!showForm);
  };

  if (!showForm) {
    return (
      <button
        onClick={toggleForm}
        className={`flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/10 text-white rounded-lg hover:bg-black/70 transition-colors ${className}`}
      >
        <Package className="w-4 h-4" />
        <span className="text-sm">Stoklu Satış Ekle</span>
      </button>
    );
  }

  return (
    <div
      className={`bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-4 ${className}`}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white text-sm font-medium flex items-center gap-1.5">
          <Package className="w-4 h-4" />
          <span>Yeni Stoklu Satış Ekle</span>
        </h3>
        <button onClick={toggleForm} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="productName"
            className="block text-white/80 text-xs mb-1"
          >
            Ürün Adı*
          </label>
          <input
            id="productName"
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full p-2 text-xs border border-white/10 rounded bg-black/30 text-white"
            placeholder="Ürün adını girin"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label
            htmlFor="productDescription"
            className="block text-white/80 text-xs mb-1"
          >
            Açıklama
          </label>
          <textarea
            id="productDescription"
            value={productDesc}
            onChange={(e) => setProductDesc(e.target.value)}
            className="w-full p-2 text-xs border border-white/10 rounded bg-black/30 text-white"
            placeholder="Ürün açıklaması (isteğe bağlı)"
            rows={2}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label
            htmlFor="price"
            className="block text-white/80 text-xs mb-1"
          >
            Satış Fiyatı (₺)*
          </label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60">
              ₺
            </span>
            <input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-2 pl-5 text-xs border border-white/10 rounded bg-black/30 text-white"
              placeholder="100"
              min="1"
              step="0.01"
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="stock"
            className="block text-white/80 text-xs mb-1"
          >
            Stok Adedi*
          </label>
          <input
            id="stock"
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full p-2 text-xs border border-white/10 rounded bg-black/30 text-white"
            placeholder="1"
            min="1"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={toggleForm}
            className="flex-1 py-2 border border-white/20 rounded text-white/80 text-xs hover:bg-black/30 transition-colors"
            disabled={isSubmitting}
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2 bg-blue-600 text-white text-xs rounded flex items-center justify-center gap-1 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "Stoklu Satış Ekle"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductStockSale; 