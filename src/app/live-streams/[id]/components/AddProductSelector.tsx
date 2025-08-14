"use client";

import React, { useState } from "react";
import { PlusCircle, Clock, Package } from "lucide-react";
import AddProductAuction from "./AddProductAuction";
import AddProductStockSale from "./AddProductStockSale";

interface AddProductSelectorProps {
  streamId: string;
  onSuccess: () => void;
  socket?: any;
  className?: string;
}

const AddProductSelector: React.FC<AddProductSelectorProps> = ({
  streamId,
  onSuccess,
  socket,
  className = "",
}) => {
  const [showSelector, setShowSelector] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"auction" | "stock" | null>(null);

  const handleModeSelect = (mode: "auction" | "stock") => {
    setSelectedMode(mode);
  };

  const handleBack = () => {
    setSelectedMode(null);
  };

  const handleSuccess = () => {
    setSelectedMode(null);
    setShowSelector(false);
    onSuccess();
  };

  const toggleSelector = () => {
    setShowSelector(!showSelector);
    if (!showSelector) {
      setSelectedMode(null);
    }
  };

  if (!showSelector) {
    return (
      <button
        onClick={toggleSelector}
        className={`flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/10 text-white rounded-lg hover:bg-black/70 transition-colors ${className}`}
      >
        <PlusCircle className="w-4 h-4" />
        <span className="text-sm">Ürün Ekle</span>
      </button>
    );
  }

  // If mode is selected, show the appropriate form
  if (selectedMode === "auction") {
    return (
      <div className={className}>
        <AddProductAuction
          streamId={streamId}
          onSuccess={handleSuccess}
          socket={socket}
        />
        <button
          onClick={handleBack}
          className="mt-2 text-white/60 text-xs hover:text-white/80 transition-colors"
        >
          ← Geri Dön
        </button>
      </div>
    );
  }

  if (selectedMode === "stock") {
    return (
      <div className={className}>
        <AddProductStockSale
          streamId={streamId}
          onSuccess={handleSuccess}
          socket={socket}
        />
        <button
          onClick={handleBack}
          className="mt-2 text-white/60 text-xs hover:text-white/80 transition-colors"
        >
          ← Geri Dön
        </button>
      </div>
    );
  }

  // Show mode selection
  return (
    <div className={`bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-sm font-medium">Ürün Ekleme Seçenekleri</h3>
        <button onClick={toggleSelector} className="text-white/70 hover:text-white">
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Auction Option */}
        <button
          onClick={() => handleModeSelect("auction")}
          className="w-full p-3 bg-green-600/20 border border-green-500/30 rounded-lg text-left hover:bg-green-600/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-300" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium text-sm">Açık Arttırma</h4>
              <p className="text-white/60 text-xs mt-1">
                60 saniye süreyle teklif toplama
              </p>
            </div>
          </div>
        </button>

        {/* Stock Sale Option */}
        <button
          onClick={() => handleModeSelect("stock")}
          className="w-full p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg text-left hover:bg-blue-600/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/30 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-300" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium text-sm">Stoklu Satış</h4>
              <p className="text-white/60 text-xs mt-1">
                Sabit fiyatla stoklu satış
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-white/40 text-xs">
          Hangi türde ürün eklemek istiyorsunuz?
        </p>
      </div>
    </div>
  );
};

export default AddProductSelector; 