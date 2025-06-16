import React, { useState } from 'react';

interface StreamTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function StreamTermsModal({ 
  isOpen, 
  onClose, 
  onConfirm 
}: StreamTermsModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem('streamTermsAccepted', 'true');
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] p-6 max-w-lg w-full shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 text-blue-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
              />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-[var(--foreground)] text-center mb-6">
          Yayın Koşulları
        </h3>

        <div className="space-y-4 mb-6 text-[var(--foreground)]">
          <div className="flex items-start">
            <span className="text-[var(--accent)] mr-2 mt-1">•</span>
            <p className="text-sm leading-relaxed">
              Canlı yayınlarınızda <span className="font-medium">Bidpazar kullanıcı sözleşmesindeki maddelere uymanız</span> gerektiğini unutmayınız.
            </p>
          </div>
          
          <div className="flex items-start">
            <span className="text-[var(--accent)] mr-2 mt-1">•</span>
            <p className="text-sm leading-relaxed">
              <span className="font-medium">Satışa sunduğunuz ürünlerle ilgili doğru bilgiler veriniz.</span>
            </p>
          </div>
          
          <div className="flex items-start">
            <span className="text-[var(--accent)] mr-2 mt-1">•</span>
            <p className="text-sm leading-relaxed">
              <span className="font-medium">Müzayede (Mezat) süreci satıcılar ve teklif verenler arasındadır</span> Bidpazar sadece platform hizmeti sunmaktadır.
            </p>
          </div>
          
          <div className="flex items-start">
            <span className="text-[var(--accent)] mr-2 mt-1">•</span>
            <p className="text-sm leading-relaxed">
              <span className="font-medium">Bidpazar satılan ürünlerle ilgili herhangi bir komisyon talep etmez</span>
            </p>
          </div>
          
          <div className="flex items-start">
            <span className="text-[var(--accent)] mr-2 mt-1">•</span>
            <p className="text-sm leading-relaxed">
              Bu şartları yerine getirmediğiniz takdirde <span className="font-medium text-red-600">Bidpazar hesabınızı askıya alma yetkisini elinde tutar.</span>
            </p>
          </div>
        </div>

        <div className="text-center mb-6">
          <p className="text-[var(--accent)] font-medium">İyi Yayınlar!</p>
        </div>

        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="mr-3 h-4 w-4 text-[var(--accent)] border-[var(--border)] rounded focus:ring-[var(--accent)]"
            />
            <span className="text-sm text-[var(--foreground)] opacity-70">
              Tekrar gösterme
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--secondary)] transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all"
          >
            Kabul Ediyorum
          </button>
        </div>
      </div>
    </div>
  );
} 