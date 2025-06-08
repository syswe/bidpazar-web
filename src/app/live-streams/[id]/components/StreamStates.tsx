import React from 'react';
import { Loader2, AlertTriangle, XCircle } from 'lucide-react';

interface StreamStateProps {
  onBackToHome?: () => void;
}

interface StreamErrorStateProps extends StreamStateProps {
  errorMessage: string;
}

export const StreamLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="flex flex-col items-center p-8 rounded-xl">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)]" />
        <p className="mt-4 text-[var(--foreground)] text-lg font-medium">Yayın bilgileri yükleniyor...</p>
      </div>
    </div>
  );
};

export const StreamErrorState: React.FC<StreamErrorStateProps> = ({ errorMessage, onBackToHome }) => {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="flex flex-col items-center max-w-md p-8 rounded-xl bg-[var(--background)] shadow-lg border border-[var(--border)]">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Yayın Yüklenemedi</h2>
        <p className="text-[var(--foreground)]/70 text-center mb-6">{errorMessage}</p>
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
          >
            Yayın Listesine Dön
          </button>
        )}
      </div>
    </div>
  );
};

export const StreamNotFoundState: React.FC<StreamStateProps> = ({ onBackToHome }) => {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="flex flex-col items-center max-w-md p-8 rounded-xl bg-[var(--background)] shadow-lg border border-[var(--border)]">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Yayın Bulunamadı</h2>
        <p className="text-[var(--foreground)]/70 text-center mb-6">
          Aradığınız yayın bulunamadı veya yayıncı tarafından kaldırılmış olabilir.
        </p>
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
          >
            Yayın Listesine Dön
          </button>
        )}
      </div>
    </div>
  );
}; 