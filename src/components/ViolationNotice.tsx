'use client';

import { useState } from 'react';

interface ViolationNoticeProps {
  actionType: string;
  reason: string;
  expiresAt?: string | null;
  moderationActionId: string;
  onAppeal?: () => void;
}

export default function ViolationNotice({
  actionType,
  reason,
  expiresAt,
  moderationActionId,
  onAppeal,
}: ViolationNoticeProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const getSeverityInfo = () => {
    switch (actionType) {
      case 'WARN_USER':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: '⚠️',
          title: 'Warning',
          color: 'text-yellow-800',
        };
      case 'SUSPEND_USER':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          icon: '🚫',
          title: 'Account Suspended',
          color: 'text-orange-800',
        };
      case 'BAN_USER':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: '⛔',
          title: 'Account Banned',
          color: 'text-red-800',
        };
      case 'REMOVE_CONTENT':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: '🗑️',
          title: 'Content Removed',
          color: 'text-gray-800',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'ℹ️',
          title: 'Moderation Notice',
          color: 'text-blue-800',
        };
    }
  };

  const info = getSeverityInfo();

  return (
    <div
      className={`${info.bg} ${info.border} border rounded-lg p-4 mb-4 ${info.color}`}
      role="alert"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl" aria-hidden="true">
            {info.icon}
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{info.title}</h3>
            <p className="text-sm mb-2">{reason}</p>

            {expiresAt && (
              <p className="text-sm font-medium">
                Expires: {new Date(expiresAt).toLocaleString()}
              </p>
            )}

            {!expiresAt && actionType === 'BAN_USER' && (
              <p className="text-sm font-medium">This is a permanent ban.</p>
            )}

            {onAppeal && (
              <button
                onClick={onAppeal}
                className="mt-3 text-sm underline hover:no-underline"
              >
                Appeal this decision
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-gray-500 hover:text-gray-700 ml-2"
          aria-label="Dismiss notice"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
