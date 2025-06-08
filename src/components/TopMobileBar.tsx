"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, Bell, Menu } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface TopMobileBarProps {
  onMenuClick: () => void;
}

const TopMobileBar = ({ onMenuClick }: TopMobileBarProps) => {
  const { isAuthenticated, user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
      setIsDesktop(width >= 1024);
    };

    // Initial check
    checkScreenSize();

    // Add event listener
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fetch notification and message counts
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCounts();
      
      // Poll for updates every 30 seconds
      const intervalId = setInterval(fetchCounts, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, user]);

  const fetchCounts = async () => {
    try {
      const authData = localStorage.getItem("auth");
      if (!authData) return;

      const parsed = JSON.parse(authData);
      const token = parsed.token || "";

      // Fetch notifications count
      try {
        const notificationResponse = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (notificationResponse.ok) {
          const notificationData = await notificationResponse.json();
          setNotificationCount(notificationData.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }

      // Fetch messages count
      try {
        const messageResponse = await fetch("/api/messages?unreadOnly=true", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          setMessageCount(messageData.unreadCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    } catch (error) {
      console.error("Failed to parse auth data:", error);
    }
  };

  const barStyle: React.CSSProperties = {
    position: 'relative',
    height: isTablet ? '64px' : '56px',
    padding: isTablet ? '0 24px' : '0 16px',
    display: isDesktop ? 'none' : 'grid', // Hide on desktop (≥1024px)
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    zIndex: 999,
  };

  const actionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isTablet ? '48px' : '40px',
    minHeight: isTablet ? '48px' : '40px',
    borderRadius: '10px',
    textDecoration: 'none',
    color: 'var(--foreground)',
    transition: 'all 200ms ease-in-out',
    position: 'relative',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  const menuButtonStyle: React.CSSProperties = {
    ...actionStyle,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    justifySelf: 'start', // Align to the very left
    marginLeft: '-8px', // Compensate padding to get closer to edge
    outline: 'none',
  };

  const getFocusStyle = (): React.CSSProperties => ({
    outline: '2px solid var(--accent)',
    outlineOffset: '2px',
    borderRadius: '8px',
  });

  const logoStyle: React.CSSProperties = {
    fontSize: isTablet ? '24px' : '20px',
    fontWeight: 'bold',
    color: 'var(--accent)',
    textDecoration: 'none',
    textAlign: 'center',
    gridColumn: '2',
  };

  const iconContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    minWidth: '16px',
    height: '16px',
    background: 'var(--accent)',
    color: 'var(--accent-foreground)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    lineHeight: 1,
    padding: '0 4px',
    border: '2px solid var(--background)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)',
  };

  const rightActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifySelf: 'end',
    gridColumn: '3',
  };

  // Don't render on desktop
  if (isDesktop) return null;

  return (
    <div style={barStyle}>
      {/* Left side - Menu button */}
      <button 
        onClick={onMenuClick} 
        style={menuButtonStyle}
        aria-label="Menüyü aç"
        tabIndex={0}
        onFocus={(e) => {
          Object.assign((e.target as HTMLElement).style, getFocusStyle());
        }}
        onBlur={(e) => {
          (e.target as HTMLElement).style.outline = 'none';
          (e.target as HTMLElement).style.outlineOffset = '';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onMenuClick();
          }
        }}
      >
        <Menu size={isTablet ? 28 : 24} />
      </button>

      {/* Center - Logo */}
      <Link href="/" style={logoStyle}>
        BidPazar
      </Link>

      {/* Right side - Actions (only for authenticated users) */}
      {isAuthenticated && user ? (
        <div style={rightActionsStyle}>
          <Link href="/dashboard/messages" style={actionStyle}>
            <div style={iconContainerStyle}>
              <MessageCircle size={isTablet ? 24 : 20} />
              {messageCount > 0 && (
                <span style={badgeStyle}>
                  {messageCount > 99 ? "99+" : messageCount}
                </span>
              )}
            </div>
          </Link>
          
          <Link href="/dashboard/notifications" style={actionStyle}>
            <div style={iconContainerStyle}>
              <Bell size={isTablet ? 24 : 20} />
              {notificationCount > 0 && (
                <span style={badgeStyle}>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </div>
          </Link>
        </div>
      ) : (
        <div style={{ gridColumn: '3' }} /> // Placeholder to keep logo centered
      )}
    </div>
  );
};

export default TopMobileBar; 