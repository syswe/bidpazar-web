'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, verifyCode, resendVerificationCode } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

export default function SignIn() {
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
  const { login: setAuth, isAuthenticated } = useAuth();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('Giriş yapılıyor:', { emailOrUsername, password });
      const response = await login(emailOrUsername, password);
      console.log('Giriş cevabı:', response);
      setDebugInfo(response);

      // Check if verification is required
      if (response.requireVerification) {
        // Make sure we have a userId, either from response.user.id or response.userId
        const userIdToUse = response.userId || (response.user && response.user.id);

        if (!userIdToUse) {
          throw new Error('Kullanıcı ID bulunamadı. Doğrulama işlemi yapılamaz.');
        }

        setUserId(userIdToUse);
        setShowVerification(true);
      } else {
        setAuth(response.token, response.user);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Giriş hatası:', err);
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('Doğrulama yapılıyor:', { verificationCode, userId });
      // Verify the code
      const response = await verifyCode(verificationCode, userId);
      console.log('Doğrulama cevabı:', response);
      setDebugInfo(response);

      setAuth(response.token, response.user);
      router.push('/dashboard');
    } catch (err) {
      console.error('Doğrulama hatası:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsResending(true);
    setDebugInfo(null);

    try {
      console.log('Doğrulama kodu tekrar gönderiliyor. Kullanıcı ID:', userId);
      const response = await resendVerificationCode(userId);
      console.log('Tekrar gönderim cevabı:', response);
      setDebugInfo(response);

      setError('Doğrulama kodu tekrar gönderildi');
    } catch (err) {
      console.error('Tekrar gönderim hatası:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama kodu gönderilemedi');
    } finally {
      setIsResending(false);
    }
  };

  // If already authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--foreground)]">Yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  if (showVerification) {
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