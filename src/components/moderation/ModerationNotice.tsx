'use client';

import { AlertCircle, Shield, Eye, ShieldAlert } from 'lucide-react';
import type { ModerationActionType, ReportReason } from '@prisma/client';

interface ModerationNoticeProps {
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
  expiresAt?: Date | null;
  className?: string;
}

/**
 * İçerikte moderasyon uyarısı gösterir
 * Kaldırılmış, gizlenmiş veya uyarı almış içerikler için kullanılır
 */
export function ModerationNotice({
  actionType,
  reason,
  notes,
  expiresAt,
  className = '',
}: ModerationNoticeProps) {
  const getNoticeConfig = () => {
    switch (actionType) {
      case 'REMOVE_CONTENT':
        return {
          icon: Shield,
          title: 'İçerik Kaldırıldı',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'HIDE_CONTENT':
        return {
          icon: Eye,
          title: 'İçerik Gizlendi',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
        };
      case 'WARN_USER':
        return {
          icon: AlertCircle,
          title: 'Uyarı Verildi',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
        };
      default:
        return {
          icon: ShieldAlert,
          title: 'Moderasyon İşlemi',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const config = getNoticeConfig();
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border-2 p-4 ${config.bgColor} ${config.borderColor} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1">
          <h3 className={`font-semibold ${config.textColor}`}>
            {config.title}
          </h3>
          <p className={`mt-1 text-sm ${config.textColor}`}>
            Sebep: {getReason(reason)}
          </p>
          {notes && (
            <p className={`mt-2 text-sm ${config.textColor}`}>
              Not: {notes}
            </p>
          )}
          {expiresAt && (
            <p className={`mt-2 text-sm font-medium ${config.textColor}`}>
              Bitiş Tarihi: {new Date(expiresAt).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rapor sebebini Türkçe'ye çevirir
 */
function getReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    SPAM: 'Spam',
    HARASSMENT: 'Taciz',
    HATE_SPEECH: 'Nefret Söylemi',
    VIOLENCE: 'Şiddet',
    ILLEGAL_CONTENT: 'Yasadışı İçerik',
    FRAUD: 'Dolandırıcılık',
    INAPPROPRIATE: 'Uygunsuz İçerik',
    COPYRIGHT: 'Telif Hakkı İhlali',
    OTHER: 'Diğer',
  };
  return reasonMap[reason] || reason;
}
