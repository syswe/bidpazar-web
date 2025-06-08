"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { X, User, ShoppingBag, LogIn, UserPlus, Store } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const { isAuthenticated, user, logout } = useAuth();
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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transition: 'all 300ms ease-in-out',
  };

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    width: isTablet ? '320px' : '280px',
    backgroundColor: 'var(--background)',
    borderRight: '1px solid var(--border)',
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 300ms ease-in-out',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isOpen ? '4px 0 12px rgba(0, 0, 0, 0.15)' : 'none',
  };

  const headerStyle: React.CSSProperties = {
    padding: isTablet ? '24px' : '20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--background)',
  };

  const logoStyle: React.CSSProperties = {
    fontSize: isTablet ? '24px' : '20px',
    fontWeight: 'bold',
    color: 'var(--accent)',
    textDecoration: 'none',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--foreground)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 200ms ease',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: isTablet ? '24px' : '20px',
    display: 'flex',
    flexDirection: 'column',
  };

  const userSectionStyle: React.CSSProperties = {
    marginBottom: '24px',
    padding: '16px',
    borderRadius: '12px',
    background: 'var(--secondary)',
    border: '1px solid var(--border)',
  };

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--primary))',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '12px',
  };

  const userNameStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--foreground)',
    marginBottom: '4px',
  };

  const userEmailStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--muted-foreground)',
    marginBottom: '12px',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 200ms ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    marginBottom: '8px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--secondary)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
  };

  const logoutButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    marginTop: 'auto',
  };

  const guestSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const guestTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--foreground)',
    marginBottom: '16px',
    textAlign: 'center',
  };

  const guestSubtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--muted-foreground)',
    textAlign: 'center',
    marginBottom: '20px',
    lineHeight: '1.5',
  };

  // Don't render on desktop or when not open
  if (!isOpen || isDesktop) return null;

  return (
    <>
      {/* Overlay */}
      <div style={overlayStyle} onClick={onClose} />
      
      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <Link href="/" style={logoStyle} onClick={onClose}>
            BidPazar
          </Link>
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {isAuthenticated && user ? (
            <>
              {/* User Info Section */}
              <div style={userSectionStyle}>
                <div style={avatarStyle}>
                  {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={userNameStyle}>
                  {user.name || user.username || 'Kullanıcı'}
                </div>
                <div style={userEmailStyle}>
                  {user.email || 'E-posta bulunamadı'}
                </div>
                
                {/* Profile Button */}
                <Link href="/dashboard" style={primaryButtonStyle} onClick={onClose}>
                  <User size={16} />
                  Profilim
                </Link>
              </div>

              {/* Seller Button */}
              <Link href="/become-seller" style={secondaryButtonStyle} onClick={onClose}>
                <Store size={16} />
                Satıcı Ol
              </Link>

              {/* My Products Button */}
              <Link href="/dashboard/products" style={secondaryButtonStyle} onClick={onClose}>
                <ShoppingBag size={16} />
                Ürünlerim
              </Link>

              {/* Logout Button */}
              <button onClick={() => { logout(); onClose(); }} style={logoutButtonStyle}>
                <LogIn size={16} />
                Çıkış Yap
              </button>
            </>
          ) : (
            <>
              {/* Guest Section */}
              <div style={guestSectionStyle}>
                <h3 style={guestTitleStyle}>Hoş Geldiniz!</h3>
                <p style={guestSubtitleStyle}>
                  BidPazar'da canlı müzayedelere katılmak ve benzersiz ürünler bulmak için giriş yapın.
                </p>
                
                <Link href="/login" style={primaryButtonStyle} onClick={onClose}>
                  <LogIn size={16} />
                  Giriş Yap
                </Link>
                
                <Link href="/register" style={secondaryButtonStyle} onClick={onClose}>
                  <UserPlus size={16} />
                  Kayıt Ol
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileSidebar; 