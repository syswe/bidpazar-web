'use client';

interface VerifiedSellerBadgeProps {
  userType?: string;
  variant?: 'inline' | 'badge';
  className?: string;
}

export default function VerifiedSellerBadge({ 
  userType, 
  variant = 'inline', 
  className = '' 
}: VerifiedSellerBadgeProps) {
  if (userType !== 'SELLER') {
    return null;
  }

  if (variant === 'inline') {
    return (
      <span className={`verified-icon ${className}`} title="Onaylı Satıcı">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }

  return (
    <div className={`verified-seller-badge ${className}`}>
      <svg fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      ONAYLI SATICI
    </div>
  );
} 