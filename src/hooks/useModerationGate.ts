import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface ModerationStatus {
  isBanned: boolean;
  isSuspended: boolean;
  violationPoints: number;
  canStream: boolean;
  canPost: boolean;
  canMessage: boolean;
  suspensionEndsAt?: Date;
  reason?: string;
}

interface ModerationGateResult {
  allowed: boolean;
  status: ModerationStatus;
  showNotice: boolean;
  message?: string;
}

/**
 * Custom hook for checking user moderation status before allowing actions
 * Provides a gating mechanism to prevent banned/suspended users from performing actions
 */
export function useModerationGate() {
  const { user } = useAuth();
  const [moderationStatus, setModerationStatus] = useState<ModerationStatus>({
    isBanned: false,
    isSuspended: false,
    violationPoints: 0,
    canStream: true,
    canPost: true,
    canMessage: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch moderation status from API
  const fetchModerationStatus = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/moderation/violations');
      
      if (!response.ok) {
        throw new Error('Failed to fetch moderation status');
      }

      const data = await response.json();
      
      // Calculate status based on current violations
      const activeViolations = data.violations?.filter((v: any) => {
        if (!v.expiresAt) return false;
        return new Date(v.expiresAt) > new Date();
      }) || [];

      const totalPoints = data.activePoints || 0;
      const isBanned = activeViolations.some((v: any) => v.action.actionType === 'BAN');
      const isSuspended = activeViolations.some((v: any) => 
        v.action.actionType === 'SUSPEND' || v.action.actionType === 'TEMP_BAN'
      );

      // Find suspension end date
      const suspensionViolation = activeViolations.find((v: any) => 
        v.action.actionType === 'SUSPEND' || v.action.actionType === 'TEMP_BAN'
      );

      setModerationStatus({
        isBanned,
        isSuspended,
        violationPoints: totalPoints,
        canStream: !isBanned && !isSuspended,
        canPost: !isBanned && !isSuspended,
        canMessage: !isBanned && (totalPoints < 15), // Can message unless banned or very high points
        suspensionEndsAt: suspensionViolation?.expiresAt 
          ? new Date(suspensionViolation.expiresAt) 
          : undefined,
        reason: activeViolations[0]?.action?.reason,
      });
    } catch (error) {
      console.error('Error fetching moderation status:', error);
      // On error, allow actions (fail open for better UX)
      setModerationStatus({
        isBanned: false,
        isSuspended: false,
        violationPoints: 0,
        canStream: true,
        canPost: true,
        canMessage: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch status on mount and when user changes
  useEffect(() => {
    fetchModerationStatus();
  }, [fetchModerationStatus]);

  /**
   * Check if user can perform a specific action
   * @param action - The action to check: 'stream', 'post', 'message'
   * @returns ModerationGateResult with allowed status and details
   */
  const checkAccess = useCallback((action: 'stream' | 'post' | 'message'): ModerationGateResult => {
    // If not logged in, don't allow
    if (!user) {
      return {
        allowed: false,
        status: moderationStatus,
        showNotice: true,
        message: 'Bu işlemi yapmak için giriş yapmalısınız.',
      };
    }

    // Check if banned
    if (moderationStatus.isBanned) {
      return {
        allowed: false,
        status: moderationStatus,
        showNotice: true,
        message: 'Hesabınız kalıcı olarak yasaklanmış. Bu işlemi yapamazsınız.',
      };
    }

    // Check if suspended
    if (moderationStatus.isSuspended) {
      const endDate = moderationStatus.suspensionEndsAt 
        ? new Date(moderationStatus.suspensionEndsAt).toLocaleString('tr-TR')
        : 'bilinmeyen bir süre';
      
      return {
        allowed: false,
        status: moderationStatus,
        showNotice: true,
        message: `Hesabınız ${endDate} tarihine kadar askıya alındı. Bu işlemi yapamazsınız.`,
      };
    }

    // Check action-specific permissions
    switch (action) {
      case 'stream':
        if (!moderationStatus.canStream) {
          return {
            allowed: false,
            status: moderationStatus,
            showNotice: true,
            message: 'Yayın başlatma yetkiniz kısıtlanmış.',
          };
        }
        break;
      case 'post':
        if (!moderationStatus.canPost) {
          return {
            allowed: false,
            status: moderationStatus,
            showNotice: true,
            message: 'İçerik paylaşma yetkiniz kısıtlanmış.',
          };
        }
        break;
      case 'message':
        if (!moderationStatus.canMessage) {
          return {
            allowed: false,
            status: moderationStatus,
            showNotice: true,
            message: 'Mesaj gönderme yetkiniz kısıtlanmış.',
          };
        }
        break;
    }

    return {
      allowed: true,
      status: moderationStatus,
      showNotice: false,
    };
  }, [user, moderationStatus]);

  /**
   * Refresh moderation status (call this after user appeals or time passes)
   */
  const refresh = useCallback(() => {
    fetchModerationStatus();
  }, [fetchModerationStatus]);

  return {
    moderationStatus,
    isLoading,
    checkAccess,
    refresh,
  };
}
