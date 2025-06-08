'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, validateToken } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';

export default function AuthDebugPage() {
  const [authData, setAuthData] = useState<{
    token: string | null;
    user: any | null;
  }>({ token: null, user: null });
  
  const [validationResult, setValidationResult] = useState<string>('Not validated');
  const [apiTestResult, setApiTestResult] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const { refreshAuthState, isAuthenticated, isLoading, user } = useAuth();
  const { token } = getAuth();

  useEffect(() => {
    const data = getAuth();
    setAuthData(data);
  }, []);

  const handleRefreshData = () => {
    const data = getAuth();
    setAuthData(data);
  };

  const handleValidateToken = async () => {
    setIsValidating(true);
    try {
      const result = await validateToken();
      setValidationResult(result ? 'Valid token' : 'Invalid token');
    } catch (error) {
      setValidationResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestProtectedApi = async () => {
    setIsTesting(true);
    try {
      // Use local API endpoint
      const response = await fetch('/api/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setApiTestResult(`API Test Success: ${JSON.stringify(data, null, 2)}`);
      } else {
        const errorText = await response.text();
        setApiTestResult(`API Test Failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      setApiTestResult(`API Test Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefreshAuth = async () => {
    await refreshAuthState();
    handleRefreshData();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>
      
      <div className="space-y-6">
        {/* Auth State from Context */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Auth Context State</h2>
          <div className="space-y-2">
            <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
            <p><strong>User:</strong> {user ? JSON.stringify(user, null, 2) : 'None'}</p>
          </div>
        </div>

        {/* Raw Auth Data */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Raw Auth Data</h2>
          <pre className="text-sm bg-gray-100 p-2 rounded">{JSON.stringify(authData, null, 2)}</pre>
          <button
            onClick={handleRefreshData}
            className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Refresh Raw Data
          </button>
        </div>

        {/* Token Validation */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Token Validation</h2>
          <p className="mb-2"><strong>Result:</strong> {validationResult}</p>
          <button
            onClick={handleValidateToken}
            disabled={isValidating}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Validate Token'}
          </button>
        </div>

        {/* API Test */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Protected API Test</h2>
          <div className="mb-2">
            <strong>Result:</strong>
            <pre className="text-sm bg-gray-100 p-2 rounded mt-1">{apiTestResult || 'Not tested yet'}</pre>
          </div>
          <button
            onClick={handleTestProtectedApi}
            disabled={isTesting}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test Protected API'}
          </button>
        </div>

        {/* Actions */}
        <div className="p-4 border rounded">
          <h2 className="text-lg font-semibold mb-3">Actions</h2>
          <button
            onClick={handleRefreshAuth}
            className="px-3 py-1 bg-orange-500 text-white rounded text-sm"
          >
            Refresh Auth State
          </button>
        </div>
      </div>
    </div>
  );
} 