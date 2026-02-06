'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReportContentType, ReportReason } from '@prisma/client';
import BottomSheet, { BottomSheetMenuItem } from './BottomSheet';
import { getToken } from '@/lib/frontend-auth';

// ReportModal Component extracted to prevent re-renders and focus loss
interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  reason: ReportReason;
  setReason: (reason: ReportReason) => void;
  description: string;
  setDescription: (desc: string) => void;
  isSubmitting: boolean;
  submitStatus: 'idle' | 'success' | 'error';
  errorMessage: string;
}

const ReportModal = ({
  isOpen,
  onClose,
  onSubmit,
  reason,
  setReason,
  description,
  setDescription,
  isSubmitting,
  submitStatus,
  errorMessage,
}: ReportModalProps) => {
  if (!isOpen) return null;

  // Use portal to render at document.body level to avoid stacking context issues
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">İçerik Şikayeti</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1.5">
              Şikayet Nedeni <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-base rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 pr-10"
                required
              >
                <option value="SPAM">İstenmeyen İçerik (Spam)</option>
                <option value="HARASSMENT">Taciz</option>
                <option value="HATE_SPEECH">Nefret Söylemi</option>
                <option value="VIOLENCE">Şiddet</option>
                <option value="ILLEGAL_CONTENT">Yasadışı İçerik</option>
                <option value="FRAUD">Dolandırıcılık</option>
                <option value="INAPPROPRIATE">Uygunsuz İçerik</option>
                <option value="COPYRIGHT">Telif Hakkı İhlali</option>
                <option value="OTHER">Diğer</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
              Ek Açıklama
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="block p-3 w-full text-base text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Lütfen şikayetinizle ilgili detayları belirtin..."
              maxLength={500}
            />
            <div className="text-right mt-1">
              <span className="text-xs text-gray-500">{description.length}/500</span>
            </div>
          </div>

          {submitStatus === 'success' && (
            <div className="p-4 mb-2 text-sm text-green-800 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Şikayetiniz başarıyla iletildi. Teşekkür ederiz.</span>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 mb-2 text-sm text-red-800 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage || 'Bir hata oluştu. Lütfen tekrar deneyin.'}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-5 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-4 focus:outline-none focus:ring-gray-100 font-medium rounded-lg text-sm text-center transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-5 py-3 text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm text-center transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gönderiliyor...
                </>
              ) : 'Şikayet Et'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

interface ContentMenuProps {
  contentType: ReportContentType;
  contentId: string;
  showShare?: boolean;
  showCopy?: boolean;
  onCopy?: () => void;
  onShare?: () => void;
  className?: string;
  trigger?: React.ReactNode; // Custom trigger button
}

export default function ContentMenu({
  contentType,
  contentId,
  showShare = false,
  showCopy = false,
  onCopy,
  onShare,
  className = '',
  trigger,
}: ContentMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Report modal state
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    // Lock body scroll when modal is open
    if (showReportModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showReportModal]);

  const handleMenuClick = () => {
    if (isMobile) {
      setShowMobileSheet(true);
    } else {
      setShowMenu(!showMenu);
    }
  };

  const handleReport = () => {
    setShowMenu(false);
    setShowMobileSheet(false);
    setShowReportModal(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const token = getToken();

      const response = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          contentType,
          contentId,
          reason,
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit report');

      setSubmitStatus('success');
      setTimeout(() => {
        setShowReportModal(false);
        setDescription('');
        setReason('SPAM');
        setSubmitStatus('idle');
      }, 2000);
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const DefaultTrigger = () => (
    <button
      type="button"
      onClick={handleMenuClick}
      className={`p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors ${className}`}
      aria-label="Daha fazla seçenek"
      style={{ minWidth: '44px', minHeight: '44px' }} // Touch target
    >
      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  );

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      {trigger || <DefaultTrigger />}

      {/* Desktop Dropdown Menu */}
      {showMenu && !isMobile && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {showShare && (
            <button
              type="button"
              onClick={() => {
                onShare?.();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📤</span>
              <span>Paylaş</span>
            </button>
          )}
          {showCopy && (
            <button
              type="button"
              onClick={() => {
                onCopy?.();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📋</span>
              <span>Kopyala</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReport}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
          >
            <span>🚩</span>
            <span>Şikayet Et</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      <BottomSheet isOpen={showMobileSheet} onClose={() => setShowMobileSheet(false)}>
        {showShare && (
          <BottomSheetMenuItem
            icon="📤"
            label="Paylaş"
            onClick={() => {
              onShare?.();
              setShowMobileSheet(false);
            }}
          />
        )}
        {showCopy && (
          <BottomSheetMenuItem
            icon="📋"
            label="Kopyala"
            onClick={() => {
              onCopy?.();
              setShowMobileSheet(false);
            }}
          />
        )}
        <BottomSheetMenuItem
          icon="🚩"
          label="Şikayet Et"
          onClick={handleReport}
          variant="danger"
        />
      </BottomSheet>

      {/* Report Modal rendered via Portal */}
      {mounted && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleSubmitReport}
          reason={reason}
          setReason={setReason}
          description={description}
          setDescription={setDescription}
          isSubmitting={isSubmitting}
          submitStatus={submitStatus}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
}
