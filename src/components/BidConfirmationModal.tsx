import React from 'react';

interface BidConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  actionType: 'bid' | 'buy';
}

export default function BidConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  actionType 
}: BidConfirmationModalProps) {
  if (!isOpen) return null;

  const getMessage = () => {
    if (actionType === 'bid') {
      return 'Verdiğiniz teklif geri alınamaz. Teklif vermek istediğinize emin misiniz?';
    } else {
      return 'Bu ürünü satın aldığınızda geri dönüş olmayacaktır. Satın almak istediğinize emin misiniz?';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--background)] rounded-2xl border border-[var(--border)] p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 text-amber-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-[var(--foreground)] text-center mb-2">
          Onay Gerekiyor
        </h3>

        <p className="text-[var(--foreground)] text-center mb-2 font-medium">
          {title}
        </p>

        <p className="text-[var(--foreground)] opacity-70 text-center mb-6 text-sm">
          {getMessage()}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--secondary)] transition-colors"
          >
            Hayır
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-lg hover:shadow-lg transition-all"
          >
            Evet, {actionType === 'bid' ? 'Teklif Ver' : 'Satın Al'}
          </button>
        </div>
      </div>
    </div>
  );
} 