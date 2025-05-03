'use client';

import React, { useState, useEffect } from 'react';
import { getAuth, validateToken } from '@/lib/frontend-auth';
import { useAuth } from '@/components/AuthProvider';
import { env } from "@/lib/env";

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

  const handleTestApi = async () => {
    setIsTesting(true);
    try {
      const { token } = getAuth();
      
      if (!token) {
        setApiTestResult('No token available');
        return;
      }
      
      // Test the API URL construction
      const baseUrl = env.BACKEND_API_URL;
      const apiUrl = baseUrl.endsWith('/api') 
        ? `${baseUrl}/messages/conversations`
        : `${baseUrl}/api/messages/conversations`;
      
      setApiTestResult(`Testing API URL: ${apiUrl}\n`);
      
      // Test the conversations API
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.text();
      setApiTestResult(prev => `${prev}Status: ${response.status}, Response: ${data}`);
    } catch (error) {
      setApiTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleContextTest = () => {
    refreshAuthState();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Authentication Debugging</h1>
      
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Auth Context State</h2>
        <pre className="bg-white dark:bg-slate-900 p-4 rounded overflow-auto max-h-[300px]">
          {JSON.stringify({
            isAuthenticated,
            isLoading,
            user,
            tokenExists: !!token,
            tokenFirstChars: token ? `${token.substring(0, 10)}...` : null
          }, null, 2)}
        </pre>
        <button 
          onClick={handleContextTest}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Refresh Token in Context
        </button>
      </div>
      
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">localStorage Auth Data</h2>
        <pre className="bg-white dark:bg-slate-900 p-4 rounded overflow-auto max-h-[300px]">
          {JSON.stringify({
            tokenExists: !!authData.token,
            tokenFirstChars: authData.token ? `${authData.token.substring(0, 10)}...` : null,
            user: authData.user
          }, null, 2)}
        </pre>
        <button 
          onClick={handleRefreshData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Refresh Data
        </button>
      </div>
      
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Token Validation</h2>
        <p className="mb-4">{validationResult}</p>
        <button 
          onClick={handleValidateToken}
          disabled={isValidating}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
        >
          {isValidating ? 'Validating...' : 'Validate Token'}
        </button>
      </div>
      
      <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">API Test</h2>
        <pre className="bg-white dark:bg-slate-900 p-4 rounded mb-4 overflow-auto max-h-[300px]">
          {apiTestResult || 'No test run yet'}
        </pre>
        <button 
          onClick={handleTestApi}
          disabled={isTesting}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-400"
        >
          {isTesting ? 'Testing...' : 'Test Conversations API'}
        </button>
      </div>
    </div>
  );
} 