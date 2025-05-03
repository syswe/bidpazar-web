'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { login, verifyCode, resendVerificationCode } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';

// Create a separate component to handle the params to avoid the error
function SignInContent() {
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
  const { setUser, isLoggedIn, isLoading: authLoading } = useAuth();

  // Log initial state and props
  useEffect(() => {
    console.log('[SignInContent] Initializing - isLoggedIn:', isLoggedIn, 'authLoading:', authLoading, 'redirectPath:', redirectPath);
  }, []); // Run only once on mount

  // Redirect if user is already authenticated
  useEffect(() => {
    console.log('[SignInContent] Auth state check - isLoggedIn:', isLoggedIn, 'authLoading:', authLoading);
    if (isLoggedIn && !authLoading) {
      console.log('[SignInContent] Already logged in, redirecting to:', redirectPath);
      router.push(redirectPath);
    }
  }, [isLoggedIn, authLoading, router, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[SignInContent] handleSubmit started');
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('[SignInContent] Calling login API with:', { emailOrUsername, password });
      const response = await login(emailOrUsername, password);
      console.log('[SignInContent] Login API response:', response);
      setDebugInfo(response); // Keep debug info

      // Check if verification is required
      if (response.requireVerification) {
        console.log('[SignInContent] Verification required');
        // Make sure we have a userId, either from response.user.id or response.userId
        const userIdToUse = response.userId || (response.user && response.user.id);
        console.log('[SignInContent] User ID for verification:', userIdToUse);

        if (!userIdToUse) {
          console.error('[SignInContent] User ID missing in verification response');
          throw new Error('Kullanıcı ID bulunamadı. Doğrulama işlemi yapılamaz.');
        }

        setUserId(userIdToUse);
        setShowVerification(true);
        console.log('[SignInContent] State updated: showVerification = true, userId =', userIdToUse);
      } else {
        console.log('[SignInContent] Login successful, no verification needed');
        // No verification needed, set the user in context
        setUser(response.user);
        console.log('[SignInContent] User set in AuthContext:', response.user);
        console.log('[SignInContent] Redirecting to:', redirectPath);
        router.push(redirectPath);
      }
    } catch (err) {
      console.error('[SignInContent] Login API error:', err);
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      console.log('[SignInContent] handleSubmit finished');
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[SignInContent] handleVerifyCode started');
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('[SignInContent] Calling verifyCode API with:', { verificationCode, userId });
      // Verify the code
      const response = await verifyCode(verificationCode, userId);
      console.log('[SignInContent] verifyCode API response:', response);
      setDebugInfo(response); // Keep debug info

      // Set the user in context directly
      setUser(response.user);
      console.log('[SignInContent] User set in AuthContext after verification:', response.user);
      console.log('[SignInContent] Redirecting to:', redirectPath);
      router.push(redirectPath);
    } catch (err) {
      console.error('[SignInContent] verifyCode API error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      console.log('[SignInContent] handleVerifyCode finished');
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    console.log('[SignInContent] handleResendCode started');
    setError('');
    setIsResending(true);
    setDebugInfo(null);

    try {
      console.log('[SignInContent] Calling resendVerificationCode API for userId:', userId);
      const response = await resendVerificationCode(userId);
      console.log('[SignInContent] resendVerificationCode API response:', response);
      setDebugInfo(response); // Keep debug info

      setError('Doğrulama kodu tekrar gönderildi'); // Using setError to display success message as per original logic
      console.log('[SignInContent] Resend successful message set');
    } catch (err) {
      console.error('[SignInContent] resendVerificationCode API error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama kodu gönderilemedi');
    } finally {
      console.log('[SignInContent] handleResendCode finished');
      setIsResending(false);
    }
  };

  // If already authenticated, show loading while redirecting
  if (isLoggedIn) {
    console.log('[SignInContent] Rendering loading state (already logged in)');
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--foreground)]">Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  if (showVerification) {
    console.log('[SignInContent] Rendering verification form');
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

  console.log('[SignInContent] Rendering login form');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-md space-y-8 bg-[var(--background)] p-8 rounded-lg shadow-lg premium-shadow border border-[var(--border)]">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-[var(--foreground)]">
            <span className="bg-clip-text text-transparent premium-gradient">Bidpazar&apos;a Giriş Yap</span>
          </h1>
          <p className="text-[var(--muted-foreground)]">Hesabınıza erişmek için bilgilerinizi girin</p>
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
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Hesabınız yok mu?{' '}
            <Link href="/sign-up" className="text-[var(--accent)] hover:underline transition-all">
              Kayıt Ol
            </Link>
          </p>
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

// Main component that uses Suspense
export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-[var(--foreground)]">Yükleniyor...</p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 