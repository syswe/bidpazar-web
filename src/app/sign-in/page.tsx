'use client';

import { useState } from 'react';
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
  const { login: setAuth } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setDebugInfo(null);

    try {
      console.log('Attempting login with:', { emailOrUsername, password });
      const response = await login(emailOrUsername, password);
      console.log('Login response:', response);
      setDebugInfo(response);

      // Check if verification is required
      if (response.requireVerification) {
        // Make sure we have a userId, either from response.user.id or response.userId
        const userIdToUse = response.userId || (response.user && response.user.id);

        if (!userIdToUse) {
          throw new Error('User ID not found in response. Cannot proceed with verification.');
        }

        setUserId(userIdToUse);
        setShowVerification(true);
      } else {
        setAuth(response.token, response.user);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
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
      console.log('Attempting verification with:', { verificationCode, userId });
      // Verify the code
      const response = await verifyCode(verificationCode, userId);
      console.log('Verification response:', response);
      setDebugInfo(response);

      setAuth(response.token, response.user);
      router.push('/dashboard');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsResending(true);
    setDebugInfo(null);

    try {
      console.log('Attempting to resend code for userId:', userId);
      const response = await resendVerificationCode(userId);
      console.log('Resend response:', response);
      setDebugInfo(response);

      setError('Verification code has been resent');
    } catch (err) {
      console.error('Resend error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  if (showVerification) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Verify Your Phone</h1>
            <p className="text-gray-600">
              We&apos;ve sent a verification code to your phone. Please enter it below to complete your login.
            </p>
          </div>

          {error && (
            <div className={`p-4 rounded-md text-sm ${error.includes('resent') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {error}
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter verification code"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>

          <div className="text-center mt-4">
            <button
              onClick={handleResendCode}
              disabled={isResending}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {isResending ? 'Sending...' : 'Resend verification code'}
            </button>
          </div>

          {debugInfo && (
            <div className="mt-8 p-4 bg-gray-100 rounded-md">
              <h3 className="font-medium text-sm mb-2">Debug Info:</h3>
              <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Sign in to Bidpazar</h1>
          <p className="text-gray-600">Enter your credentials to access your account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-700 mb-1">
                Email or Username
              </label>
              <input
                id="emailOrUsername"
                name="emailOrUsername"
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email or username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" className="text-blue-600 hover:text-blue-800">
              Sign up
            </Link>
          </p>
        </div>

        {debugInfo && (
          <div className="mt-8 p-4 bg-gray-100 rounded-md">
            <h3 className="font-medium text-sm mb-2">Debug Info:</h3>
            <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 