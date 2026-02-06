import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReportContentType, ReportReason } from '@prisma/client';

interface ReportButtonProps {
  contentType: ReportContentType;
  contentId: string;
  className?: string;
  variant?: 'default' | 'icon' | 'menu-item';
  label?: string;
}

export default function ReportButton({
  contentType,
  contentId,
  className = '',
  variant = 'default',
  label = 'Bildir'
}: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle body scroll lock
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType,
          contentId,
          reason,
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bildirim gönderilemedi');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        setShowModal(false);
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

  const buttonContent = (
    <>
      <svg
        className={`w-4 h-4 ${variant === 'icon' ? '' : 'mr-1'} ${variant === 'menu-item' ? 'mr-2' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
      {variant !== 'icon' && label}
    </>
  );

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full relative">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-xl font-bold text-gray-900">İçeriği Bildir</h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bildirim Nedeni *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            >
              <option value="SPAM">Spam</option>
              <option value="HARASSMENT">Taciz / Zorbalık</option>
              <option value="HATE_SPEECH">Nefret Söylemi</option>
              <option value="VIOLENCE">Şiddet / Tehdit</option>
              <option value="ILLEGAL_CONTENT">Yasadışı İçerik</option>
              <option value="FRAUD">Dolandırıcılık / Sahtekarlık</option>
              <option value="INAPPROPRIATE">Uygunsuz İçerik</option>
              <option value="COPYRIGHT">Telif Hakkı İhlali</option>
              <option value="OTHER">Diğer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ek Açıklama (İsteğe Bağlı)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              rows={4}
              placeholder="Lütfen daha fazla detay verin..."
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/500</p>
          </div>

          {submitStatus === 'success' && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Bildiriminiz başarıyla alındı. Teşekkürler.
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center animate-in fade-in slide-in-from-top-2">
              <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {errorMessage || 'Bir hata oluştu. Lütfen tekrar deneyin.'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gönderiliyor...
                </>
              ) : (
                'Bildir'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
        className={`${variant === 'menu-item'
          ? 'w-full text-left px-2 py-1.5 text-sm flex items-center hover:bg-gray-100 rounded-sm'
          : variant === 'icon'
            ? `flex items-center justify-center ${className}`
            : `text-sm text-gray-600 hover:text-red-600 transition-colors flex items-center ${className}`
          } ${className}`}
        aria-label={label}
        title={label}
      >
        {buttonContent}
      </button>

      {showModal && mounted && createPortal(modalContent, document.body)}
    </>
  );
}
