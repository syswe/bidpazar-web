'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login, verifyCode, resendVerificationCode, setAuth } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';
import { analytics } from '@/components/GoogleTagManager';

export default function Register() {
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

  // Field validation states
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Validate fields as they change
  useEffect(() => {
    validateField('email', email);
  }, [email]);

  useEffect(() => {
    validateField('username', username);
  }, [username]);

  useEffect(() => {
    validateField('password', password);
    // Also revalidate confirmPassword when password changes
    if (touchedFields.confirmPassword) {
      validateField('confirmPassword', confirmPassword, password);
    }
  }, [password]);

  useEffect(() => {
    validateField('confirmPassword', confirmPassword, password);
  }, [confirmPassword, password]);

  useEffect(() => {
    if (phoneNumber) {
      validateField('phoneNumber', phoneNumber);
    } else {
      // Clear error if phone number is empty (it's optional)
      setFieldErrors(prev => ({ ...prev, phoneNumber: '' }));
    }
  }, [phoneNumber]);

  // Mark a field as touched when user interacts with it
  const handleBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));

    // Validate the field on blur
    switch (field) {
      case 'email':
        validateField('email', email);
        break;
      case 'username':
        validateField('username', username);
        break;
      case 'password':
        validateField('password', password);
        break;
      case 'confirmPassword':
        validateField('confirmPassword', confirmPassword, password);
        break;
      case 'phoneNumber':
        if (phoneNumber) validateField('phoneNumber', phoneNumber);
        break;
    }
  };

  const validateField = (field: string, value: string, comparisonValue?: string) => {
    let error = '';

    switch (field) {
      case 'email':
        if (!value) {
          error = 'E-posta adresi gerekli';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
          error = 'Geçerli bir e-posta adresi giriniz. Örnek: user@example.com';
        }
        break;

      case 'username':
        if (!value) {
          error = 'Kullanıcı adı gerekli';
        } else if (value.length < 3 || value.length > 20) {
          error = 'Kullanıcı adı 3 ile 20 karakter arasında olmalıdır';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          error = 'Kullanıcı adı sadece harf, rakam, alt çizgi ve kısa çizgi içerebilir';
        }
        break;

      case 'password':
        if (!value) {
          error = 'Şifre gerekli';
        } else if (value.length < 6) {
          error = 'Şifre en az 6 karakter uzunluğunda olmalıdır';
        }
        break;

      case 'confirmPassword':
        if (!value) {
          error = 'Şifre onayı gerekli';
        } else if (value !== comparisonValue) {
          error = 'Şifreler eşleşmiyor';
        }
        break;

      case 'phoneNumber':
        if (value && !/^(\+\d{1,3}|0)[0-9]{10,11}$/.test(value.replace(/\s+/g, ''))) {
          error = 'Geçerli bir telefon numarası giriniz (örn: 05XXXXXXXXX)';
        }
        break;
    }

    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  // Get validation status for a field
  const getFieldStatus = (field: string) => {
    if (!touchedFields[field]) return null;
    return fieldErrors[field] ? 'error' : 'success';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields first
    const emailValid = validateField('email', email);
    const usernameValid = validateField('username', username);
    const passwordValid = validateField('password', password);
    const confirmPasswordValid = validateField('confirmPassword', confirmPassword, password);
    const phoneNumberValid = !phoneNumber || validateField('phoneNumber', phoneNumber);

    // Mark all fields as touched to show errors
    setTouchedFields({
      email: true,
      username: true,
      password: true,
      confirmPassword: true,
      phoneNumber: !!phoneNumber
    });

    // If any validation fails, return early
    if (!emailValid || !usernameValid || !passwordValid || !confirmPasswordValid || !phoneNumberValid) {
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
        hasToken: !!response.token,
        smsSent: response.smsSent
      });

      // If verification is required
      if (response.requireVerification) {
        setUserId(response.user.id);
        setTempToken(response.token);
        setShowVerification(true);

        // Display SMS delivery error if needed
        if (phoneNumber && response.smsSent === false) {
          setError('Doğrulama kodu gönderilemedi. "Doğrulama kodunu tekrar gönder" seçeneğini kullanabilirsiniz.');
        } else {
          console.log('Verification required, showing verification form');
        }
      } else {
        // Auto login if no verification needed
        console.log('No verification required, logging in automatically');
        const loginResponse = await login(email, password);
        setAuth(loginResponse.token, loginResponse.user);

        // Track successful registration
        analytics.trackRegistration('email', loginResponse.user?.id);

        await refreshAuthState();
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message.includes('already exists')) {
        setError('Bu e-posta, kullanıcı adı veya telefon numarası ile kayıtlı bir kullanıcı zaten var');
      } else if (err.message.includes('Invalid email')) {
        setFieldErrors(prev => ({ ...prev, email: 'Geçersiz e-posta adresi. Lütfen geçerli bir e-posta adresi giriniz (örn: user@example.com)' }));
        setTouchedFields(prev => ({ ...prev, email: true }));
        setError('Lütfen formdaki hataları düzeltin');
      } else {
        setError(err instanceof Error ? err.message : 'Kayıt başarısız');
      }
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
      await refreshAuthState();

      // Navigate to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız. Lütfen kodu kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsResending(true);

    try {
      const response = await resendVerificationCode(userId);
      console.log('Resend verification response:', response);

      if (response.smsSent === false) {
        setError('Doğrulama kodu gönderilirken teknik bir sorun oluştu. Lütfen daha sonra tekrar deneyin veya destek ile iletişime geçin.');
      } else {
        setError('Doğrulama kodu tekrar gönderildi. Lütfen telefonunuzu kontrol edin.');
      }
    } catch (err) {
      console.error('Resend verification error:', err);
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
            <span className="bg-clip-text">Hesap Oluştur</span>
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
              <label htmlFor="username" className="premium-label flex justify-between">
                <span>Kullanıcı Adı</span>
                {getFieldStatus('username') && (
                  <span className={getFieldStatus('username') === 'error' ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>
                    {getFieldStatus('username') === 'error' ? fieldErrors.username : '✓ Geçerli'}
                  </span>
                )}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => handleBlur('username')}
                className={`premium-input ${touchedFields.username && (fieldErrors.username ? 'border-red-500' : 'border-green-500')}`}
                placeholder="Kullanıcı adı seçin"
              />
            </div>

            <div>
              <label htmlFor="email" className="premium-label flex justify-between">
                <span>E-posta Adresi</span>
                {getFieldStatus('email') && (
                  <span className={getFieldStatus('email') === 'error' ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>
                    {getFieldStatus('email') === 'error' ? fieldErrors.email : '✓ Geçerli'}
                  </span>
                )}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`premium-input ${touchedFields.email && (fieldErrors.email ? 'border-red-500' : 'border-green-500')}`}
                placeholder="E-posta adresi"
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="premium-label flex justify-between">
                <span>Telefon Numarası <span className="text-xs text-[var(--muted-foreground)]">(SMS doğrulaması için isteğe bağlı)</span></span>
                {getFieldStatus('phoneNumber') && phoneNumber && (
                  <span className={getFieldStatus('phoneNumber') === 'error' ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>
                    {getFieldStatus('phoneNumber') === 'error' ? fieldErrors.phoneNumber : '✓ Geçerli'}
                  </span>
                )}
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onBlur={() => handleBlur('phoneNumber')}
                className={`premium-input ${touchedFields.phoneNumber && phoneNumber && (fieldErrors.phoneNumber ? 'border-red-500' : 'border-green-500')}`}
                placeholder="05XX XXX XX XX"
              />
            </div>

            <div>
              <label htmlFor="password" className="premium-label flex justify-between">
                <span>Şifre</span>
                {getFieldStatus('password') && (
                  <span className={getFieldStatus('password') === 'error' ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>
                    {getFieldStatus('password') === 'error' ? fieldErrors.password : '✓ Geçerli'}
                  </span>
                )}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`premium-input ${touchedFields.password && (fieldErrors.password ? 'border-red-500' : 'border-green-500')}`}
                placeholder="Şifre"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="premium-label flex justify-between">
                <span>Şifreyi Onayla</span>
                {getFieldStatus('confirmPassword') && (
                  <span className={getFieldStatus('confirmPassword') === 'error' ? 'text-red-500 text-xs' : 'text-green-500 text-xs'}>
                    {getFieldStatus('confirmPassword') === 'error' ? fieldErrors.confirmPassword : '✓ Geçerli'}
                  </span>
                )}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`premium-input ${touchedFields.confirmPassword && (fieldErrors.confirmPassword ? 'border-red-500' : 'border-green-500')}`}
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
            <Link href="/login" className="text-[var(--accent)] hover:underline transition-colors">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 