import React from 'react';
import { Loader2, TriangleAlert, Tv } from 'lucide-react';

interface StreamBaseStateProps {
  onBackToHome: () => void;
}

export const StreamLoadingState: React.FC = () => {
  return (
    <div className="vertical-stream-container">
      <div className="stream-content-wrapper">
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[var(--primary)]" />
            <h2 className="text-lg font-medium">Yayın Yükleniyor</h2>
            <p className="text-[var(--muted-foreground)] mt-2">Canlı bağlantı kuruluyor...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StreamErrorState: React.FC<StreamBaseStateProps & { errorMessage: string }> = ({ 
  errorMessage, 
  onBackToHome 
}) => {
  return (
    <div className="vertical-stream-container">
      <div className="stream-content-wrapper">
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--destructive)] flex items-center justify-center">
              <TriangleAlert className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-medium">Yayın Yüklenemedi</h2>
            <p className="text-[var(--muted-foreground)] mt-2">{errorMessage}</p>
            <button
              onClick={onBackToHome}
              className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StreamNotFoundState: React.FC<StreamBaseStateProps> = ({ onBackToHome }) => {
  return (
    <div className="vertical-stream-container">
      <div className="stream-content-wrapper">
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--muted)] flex items-center justify-center">
              <Tv className="h-8 w-8 text-[var(--muted-foreground)]" />
            </div>
            <h2 className="text-lg font-medium">Yayın Bulunamadı</h2>
            <p className="text-[var(--muted-foreground)] mt-2">
              Bu yayın artık mevcut değil veya henüz başlamamış olabilir.
            </p>
            <button
              onClick={onBackToHome}
              className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 