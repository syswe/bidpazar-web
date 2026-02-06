'use client';

import { useState } from 'react';
import { getToken } from '@/lib/frontend-auth';

interface AppealFormProps {
  moderationActionId: string;
  actionType: string;
  reason: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AppealForm({
  moderationActionId,
  actionType,
  reason,
  onSuccess,
  onCancel,
}: AppealFormProps) {
  const [appealReason, setAppealReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (appealReason.length < 10) {
      setErrorMessage('Appeal reason must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    // ... inside handleSubmit ...
    try {
      const token = getToken();
      const response = await fetch('/api/moderation/appeal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          moderationActionId,
          reason: appealReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit appeal');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
      <h2 className="text-2xl font-bold mb-4">Appeal Moderation Decision</h2>

      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <h3 className="font-semibold mb-2">Original Action</h3>
        <p className="text-sm mb-1">
          <span className="font-medium">Type:</span> {actionType.replace(/_/g, ' ')}
        </p>
        <p className="text-sm">
          <span className="font-medium">Reason:</span> {reason}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why do you believe this decision should be reversed? *
          </label>
          <textarea
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={6}
            placeholder="Please provide a detailed explanation of why you believe this moderation action was incorrect or unfair. Include any relevant context or evidence."
            required
            minLength={10}
            maxLength={1000}
          />
          <p className="text-xs text-gray-500 mt-1">
            {appealReason.length}/1000 characters (minimum 10)
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Appeals are reviewed by our moderation team within 24-48
            hours. You can only submit one appeal per moderation action, and appeals must be
            submitted within 30 days of the action.
          </p>
        </div>

        {submitStatus === 'success' && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md">
            Appeal submitted successfully. You will be notified of the decision via email.
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
            {errorMessage || 'Failed to submit appeal. Please try again.'}
          </div>
        )}

        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={isSubmitting || appealReason.length < 10}
          >
            {isSubmitting ? 'Submitting Appeal...' : 'Submit Appeal'}
          </button>
        </div>
      </form>
    </div>
  );
}
