'use client';

import React, { useState, useEffect } from 'react';
import { getAuth } from '@/lib/frontend-auth';
import { env } from '@/lib/env'; // Import env config

const ApiDebug: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Use the BACKEND_API_URL for backend calls
  const url = env.BACKEND_API_URL;

  const testApi = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    const { token } = getAuth();
    
    try {
      const res = await fetch(`${url}/health`, { // Example: hitting backend health endpoint
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || `HTTP error! status: ${res.status}`);
      }
      
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testApi();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">API Debug</h2>
      <p className="mb-2">Testing API Endpoint: {url}/health</p>
      <button 
        onClick={testApi} 
        disabled={loading} 
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4 disabled:bg-blue-300"
      >
        {loading ? 'Testing...' : 'Test API Again'}
      </button>
      {loading && <p>Loading...</p>}
      {error && <div className="text-red-500">Error: {error}</div>}
      {response && (
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default ApiDebug; 