"use client";

import React, { useState } from "react";
import { useRuntimeConfig } from '@/context/RuntimeConfigContext';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/frontend-auth";

interface CreateProductFormProps {
  streamId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

interface ProductFormData {
  name: string;
  description: string;
  startingBid: number;
}

export default function CreateProductForm({ streamId, onCancel, onSuccess }: CreateProductFormProps) {
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    startingBid: 100
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "startingBid" ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!streamId || isConfigLoading || !runtimeConfig) {
      toast.error("Configuration not loaded. Cannot create product.");
      return;
    }

    const token = getToken();
    if (!token) {
      toast.error("Giriş yapmanız gerekiyor. Lütfen giriş yapın ve tekrar deneyin.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/live-streams/${streamId}/product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: formData.startingBid
        })
      });

      if (response.ok) {
        toast.success("Ürün oluşturuldu ve açık artırma başladı!");
        onSuccess();
      } else {
        // Try to parse error response, but handle cases where it might not be valid JSON
        let errorMessage = "Ürün oluşturulamadı";
        try {
          // Only try to parse if response has content
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            if (text) {
              const errorData = JSON.parse(text);
              errorMessage = errorData.message || errorMessage;
            }
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          // Use HTTP status for more informative error message when JSON parsing fails
          errorMessage = `Ürün oluşturulamadı (${response.status}: ${response.statusText})`;
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Ürün oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[var(--card)] p-4 rounded-lg shadow-md pointer-events-auto">
      <h3 className="text-lg font-medium mb-4">Yeni Açık Artırma Ürünü</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Ürün Adı
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
            placeholder="Antika Saat"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Ürün Açıklaması
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
            placeholder="Ürün hakkında kısa açıklama..."
            rows={2}
          />
        </div>

        <div>
          <label htmlFor="startingBid" className="block text-sm font-medium mb-1">
            Başlangıç Fiyatı (₺)
          </label>
          <input
            type="number"
            id="startingBid"
            name="startingBid"
            min="1"
            value={formData.startingBid}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md"
          />
        </div>

        <div className="text-xs text-[var(--muted-foreground)] mb-2">
          Açık artırma süresi: 60 saniye (standart)
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--border)] rounded-md"
            disabled={isSubmitting}
          >
            İptal
          </button>
          <button 
            type="submit"
            className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md flex items-center"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              "Açık Artırmayı Başlat"
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 