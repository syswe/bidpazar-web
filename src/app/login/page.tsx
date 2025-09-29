'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { login, verifyCode, resendVerificationCode } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';
import { analytics } from '@/components/GoogleTagManager';

// Create a separate component to handle the params to avoid the error
function LoginContent() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userId, setUserId] = useState('');
  const [isResending, setIsResending] = useState(false);
  // Using 'any' type is acceptable here as this is for debugging purposes only
  // and the structure may vary based on API responses
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  const isSellerRedirect = searchParams.get('redirect') === 'seller';
  const { setUser, isLoggedIn, isLoading: authLoading } = useAuth();

  // Log initial state and props
  useEffect(() => {
    console.log('[LoginContent] Initializing - isLoggedIn:', isLoggedIn, 'authLoading:', authLoading, 'redirectPath:', redirectPath);
  }, []); // Run only once on mount

  // Redirect if user is already authenticated
  useEffect(() => {
    console.log('[LoginContent] Auth state check - isLoggedIn:', isLoggedIn, 'authLoading:', authLoading);
    if (isLoggedIn && !authLoading) {
      console.log('[LoginContent] Already logged in, redirecting to:', redirectPath);
      // Use window.location.href instead of router.push for a full page reload
      window.location.href = redirectPath;
    }
  }, [isLoggedIn, authLoading, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[LoginContent] handleSubmit started');
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('[LoginContent] Calling login API with:', { emailOrUsername, password });
      const response = await login(emailOrUsername, password);
      console.log('[LoginContent] Login API response:', response);
      setDebugInfo(response); // Keep debug info

      // Check if verification is required
      if (response.requireVerification) {
        console.log('[LoginContent] Verification required');
        // Make sure we have a userId, either from response.user.id or response.userId
        const userIdToUse = response.userId || (response.user && response.user.id);
        console.log('[LoginContent] User ID for verification:', userIdToUse);

        if (!userIdToUse) {
          console.error('[LoginContent] User ID missing in verification response');
          throw new Error('Kullanıcı ID bulunamadı. Doğrulama işlemi yapılamaz.');
        }

        setUserId(userIdToUse);
        setShowVerification(true);
        console.log('[LoginContent] State updated: showVerification = true, userId =', userIdToUse);
      } else {
        console.log('[LoginContent] Login successful, no verification needed');
        // No verification needed, set the user in context
        setUser(response.user);
        console.log('[LoginContent] User set in AuthContext:', response.user);

        // Track successful login
        analytics.trackLogin('email', response.user?.id);

        // Handle seller redirect
        const finalRedirectPath = isSellerRedirect ? '/dashboard/seller-request' : redirectPath;
        console.log('[LoginContent] Redirecting via window.location.href to:', finalRedirectPath);
        // Use window.location.href for a full page reload
        window.location.href = finalRedirectPath;
      }
    } catch (err) {
      console.error('[LoginContent] Login API error:', err);
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      console.log('[LoginContent] handleSubmit finished');
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[LoginContent] handleVerifyCode started');
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('[LoginContent] Calling verifyCode API with:', { verificationCode, userId });
      // Verify the code
      const response = await verifyCode(verificationCode, userId);
      console.log('[LoginContent] verifyCode API response:', response);
      setDebugInfo(response); // Keep debug info

      // Set the user in context directly
      setUser(response.user);
      console.log('[LoginContent] User set in AuthContext after verification:', response.user);

      // Handle seller redirect
      const finalRedirectPath = isSellerRedirect ? '/dashboard/seller-request' : redirectPath;
      console.log('[LoginContent] Redirecting via window.location.href to:', finalRedirectPath);
      // Use window.location.href for a full page reload
      window.location.href = finalRedirectPath;
    } catch (err) {
      console.error('[LoginContent] verifyCode API error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      console.log('[LoginContent] handleVerifyCode finished');
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    console.log('[LoginContent] handleResendCode started');
    setError('');
    setIsResending(true);
    setDebugInfo(null);

    try {
      console.log('[LoginContent] Calling resendVerificationCode API for userId:', userId);
      const response = await resendVerificationCode(userId);
      console.log('[LoginContent] resendVerificationCode API response:', response);
      setDebugInfo(response); // Keep debug info

      setError('Doğrulama kodu tekrar gönderildi'); // Using setError to display success message as per original logic
      console.log('[LoginContent] Resend successful message set');
    } catch (err) {
      console.error('[LoginContent] resendVerificationCode API error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama kodu gönderilemedi');
    } finally {
      console.log('[LoginContent] handleResendCode finished');
      setIsResending(false);
    }
  };

  // If already authenticated, show loading while redirecting
  if (isLoggedIn) {
    console.log('[LoginContent] Rendering loading state (already logged in)');
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--foreground)]">Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  if (showVerification) {
    console.log('[LoginContent] Rendering verification form');
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="w-full max-w-md space-y-8 bg-[var(--background)] p-8 rounded-lg shadow-lg premium-shadow border border-[var(--border)]">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 text-[var(--foreground)]">
              <span className="bg-clip-text text-transparent premium-gradient">Telefonunuzu Doğrulayın</span>
            </h1>
            <p className="text-[var(--muted-foreground)]">
              Telefonunuza bir doğrulama kodu gönderdik. Giriş işlemini tamamlamak için lütfen kodu girin.
            </p>
          </div>

          {error && (
            <div className={`p-4 rounded-md text-sm ${error.includes('gönderildi') ? 'premium-success' : 'premium-error'}`}>
              {error}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div className="space-y-4 rounded-md">
              <div>
                <label htmlFor="verificationCode" className="premium-label">
                  Doğrulama Kodu
                </label>
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="premium-input"
                  placeholder="Doğrulama kodunu girin"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="premium-button premium-button-primary w-full"
              >
                {isLoading ? 'Doğrulanıyor...' : 'Kodu Doğrula'}
              </button>
            </div>
          </form>

          <div className="text-center mt-4">
            <button
              onClick={handleResendCode}
              disabled={isResending}
              className="text-sm text-[var(--primary)] hover:text-[var(--accent)] transition-colors"
            >
              {isResending ? 'Gönderiliyor...' : 'Doğrulama kodunu tekrar gönder'}
            </button>
          </div>

          {debugInfo && (
            <div className="mt-8 p-4 bg-[var(--secondary)] rounded-md">
              <h3 className="font-medium text-sm mb-2 text-[var(--secondary-foreground)]">Hata Ayıklama Bilgisi:</h3>
              <pre className="text-xs overflow-auto max-h-40 text-[var(--secondary-foreground)]">{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log('[LoginContent] Rendering login form');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-md space-y-8 bg-[var(--background)] p-8 rounded-lg shadow-lg premium-shadow border border-[var(--border)]">
        {/* Seller redirect message */}
        {isSellerRedirect && (
          <div className="bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] p-4 rounded-lg text-white text-center mb-6">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-semibold">Satıcı Olmak İçin</span>
            </div>
            <p className="text-sm opacity-90">
              Giriş yaparak satıcı başvurunuzu yapabilirsiniz. Koleksiyonunuzdaki nadir eşyaları satışa sunun!
            </p>
          </div>
        )}

        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-[var(--foreground)]">
            <span className="bg-clip-text accent-inherit">
              {isSellerRedirect ? 'Satıcı Olmak İçin Giriş Yapın' : 'Bidpazar\'a Giriş Yap'}
            </span>
          </h1>
          <p className="text-[var(--muted-foreground)]">
            {isSellerRedirect
              ? 'Satıcı başvurunuz için hesabınıza giriş yapın'
              : 'Hesabınıza erişmek için bilgilerinizi girin'
            }
          </p>
        </div>

        {error && (
          <div className="premium-error">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="emailOrUsername" className="premium-label">
                E-posta veya Kullanıcı Adı
              </label>
              <input
                id="emailOrUsername"
                name="emailOrUsername"
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="premium-input"
                placeholder="E-posta veya kullanıcı adı"
              />
            </div>
            <div>
              <label htmlFor="password" className="premium-label">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="premium-input"
                placeholder="Şifre"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="premium-button premium-button-primary w-full"
            >
              {isLoading ? 'Giriş yapılıyor...' : (isSellerRedirect ? 'Giriş Yap ve Satıcı Başvurusuna Git' : 'Giriş Yap')}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Hesabınız yok mu?{' '}
            <Link
              href={isSellerRedirect ? "/register?redirect=seller" : "/register"}
              className="text-[var(--accent)] hover:underline transition-all"
            >
              {isSellerRedirect ? 'Hesap Oluştur ve Satıcı Ol' : 'Kayıt Ol'}
            </Link>
          </p>
        </div>

        {/* Additional seller info */}
        {isSellerRedirect && (
          <div className="mt-6 p-4 bg-[var(--muted)] rounded-lg border border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)] mb-2 text-sm">Satıcı Olmanın Avantajları:</h3>
            <ul className="text-xs text-[var(--muted-foreground)] space-y-1">
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full mr-2"></span>
                Canlı yayın müzayedeleri yapın
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full mr-2"></span>
                Yüksek kazanç potansiyeli
              </li>
              <li className="flex items-center">
                <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full mr-2"></span>
                Geniş koleksiyoncu kitlesine ulaşın
              </li>
            </ul>
          </div>
        )}

        {debugInfo && (
          <div className="mt-8 p-4 bg-[var(--secondary)] rounded-md">
            <h3 className="font-medium text-sm mb-2 text-[var(--secondary-foreground)]">Hata Ayıklama Bilgisi:</h3>
            <pre className="text-xs overflow-auto max-h-40 text-[var(--secondary-foreground)]">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Main component that uses Suspense
export default function Login() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]">Yükleniyor...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
} 