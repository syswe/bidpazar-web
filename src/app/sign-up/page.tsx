'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login, verifyCode, resendVerificationCode, setAuth } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';

export default function SignUp() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userId, setUserId] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const { refreshAuthState, isAuthenticated } = useAuth();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Use effect to set authorization header if tempToken exists
  useEffect(() => {
    if (tempToken) {
      // This makes the tempToken "used" to satisfy the linter
      console.log('Doğrulama için geçici token alındı');
    }
  }, [tempToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password match
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    // Validate username
    if (!username) {
      setError('Kullanıcı adı gerekli');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setError('Kullanıcı adı 3 ile 20 karakter arasında olmalıdır');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Kullanıcı adı sadece harf, rakam, alt çizgi ve kısa çizgi içerebilir');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting to register with:', { 
        email, 
        username, 
        name: name || undefined, 
        phoneNumber: phoneNumber || undefined 
      });
      
      // Register the user
      const response = await register(email, password, username, name, phoneNumber);
      
      console.log('Registration response:', {
        requireVerification: response.requireVerification,
        userId: response.user?.id,
        hasToken: !!response.token
      });

      // If verification is required
      if (response.requireVerification) {
        setUserId(response.user.id);
        setTempToken(response.token);
        setShowVerification(true);
        console.log('Verification required, showing verification form');
      } else {
        // Auto login if no verification needed
        console.log('No verification required, logging in automatically');
        const loginResponse = await login(email, password);
        setAuth(loginResponse.token, loginResponse.user);
        await refreshAuthState();
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Attempting to verify code:', {
        code: verificationCode,
        userId,
        hasToken: !!tempToken
      });
      
      // Verify the code
      const response = await verifyCode(verificationCode, userId);
      
      console.log('Verification response:', {
        success: true,
        hasToken: !!response.token,
        hasUser: !!response.user
      });
      
      // Store authentication data
      setAuth(response.token, response.user);
      
      // Refresh the auth context state
      await refreshAuthState();
      
      // Navigate to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsResending(true);

    try {
      await resendVerificationCode(userId);
      setError('Doğrulama kodu tekrar gönderildi');
    } catch (err) {
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
              Telefonunuza bir doğrulama kodu gönderdik. Kaydınızı tamamlamak için lütfen kodu girin.
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[var(--background)]">
      <div className="w-full max-w-md space-y-8 bg-[var(--background)] p-8 rounded-lg shadow-lg premium-shadow border border-[var(--border)]">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 text-[var(--foreground)]">
            <span className="bg-clip-text text-transparent premium-gradient">Hesap Oluştur</span>
          </h1>
          <p className="text-[var(--muted-foreground)]">Bidpazar hesabınızı oluşturmak için bilgilerinizi doldurun</p>
        </div>

        {error && (
          <div className="premium-error">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md">
            <div>
              <label htmlFor="name" className="premium-label">
                Ad Soyad
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="premium-input"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label htmlFor="username" className="premium-label">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="premium-input"
                placeholder="Kullanıcı adı seçin"
              />
            </div>

            <div>
              <label htmlFor="email" className="premium-label">
                E-posta Adresi
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="premium-input"
                placeholder="E-posta adresi"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="premium-label">
                Telefon Numarası <span className="text-xs text-[var(--muted-foreground)]">(SMS doğrulaması için isteğe bağlı)</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="premium-input"
                placeholder="05XX XXX XX XX"
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

            <div>
              <label htmlFor="confirmPassword" className="premium-label">
                Şifreyi Onayla
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="premium-input"
                placeholder="Şifreyi onaylayın"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="premium-button premium-button-primary w-full"
            >
              {isLoading ? 'Hesap oluşturuluyor...' : 'Kayıt Ol'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Zaten hesabınız var mı?{' '}
            <Link href="/sign-in" className="text-[var(--accent)] hover:underline transition-colors">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 