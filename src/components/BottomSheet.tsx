'use client';

import { useEffect, useState } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300); // Match animation duration
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${isAnimating ? 'opacity-50' : 'opacity-0'
          }`}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 transition-transform duration-300 max-h-[80vh] overflow-hidden ${isAnimating ? 'translate-y-0' : 'translate-y-full'
          }`}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-6 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>
      </div>
    </>
  );
}

interface BottomSheetMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export function BottomSheetMenuItem({
  icon,
  label,
  onClick,
  variant = 'default',
}: BottomSheetMenuItemProps) {
  const textColor = variant === 'danger' ? 'text-red-600' : 'text-gray-900';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors ${textColor}`}
      style={{ minHeight: '44px' }} // Touch target size
    >
      {icon && <span className="text-xl">{icon}</span>}
      <span className="text-base font-medium">{label}</span>
    </button>
  );
}
