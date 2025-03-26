'use client';

import { useState, useEffect } from 'react';
import { getToken } from '../lib/auth';

export default function ApiDebugPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [testResults, setTestResults] = useState<{ endpoint: string, result: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    setApiUrl(url);
  }, []);

  const testEndpoint = async (endpoint: string) => {
    try {
      const token = getToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, { headers });
      const status = response.status;
      const contentType = response.headers.get('content-type');

      let data = 'Unable to read response';
      try {
        if (contentType && contentType.includes('application/json')) {
          data = JSON.stringify(await response.json(), null, 2);
        } else {
          data = await response.text();
        }
      } catch (e) {
        data = `Error parsing response: ${e instanceof Error ? e.message : String(e)}`;
      }

      return `Status: ${status}, Content-Type: ${contentType || 'none'}, Data: ${data}`;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  const runTests = async () => {
    setIsLoading(true);
    setTestResults([]);

    const endpoints = [
      '/health',
      '/live-streams',
      '/live-streams/nonexistent-id',
    ];

    const results = [];
    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint);
      results.push({ endpoint, result });
      setTestResults([...results]); // Update with each result
    }

    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">API Debug Tool</h1>

      <div className="mb-4">
        <p className="font-semibold">Current API URL:</p>
        <code className="block bg-gray-100 p-2 rounded">{apiUrl}</code>
      </div>

      <button
        onClick={runTests}
        disabled={isLoading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
      >
        {isLoading ? 'Testing...' : 'Test API Endpoints'}
      </button>

      {testResults.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Test Results</h2>

          {testResults.map((result, i) => (
            <div key={i} className="mb-4 border rounded p-3">
              <h3 className="font-semibold">{result.endpoint}</h3>
              <pre className="bg-gray-100 p-2 mt-2 overflow-x-auto rounded">
                {result.result}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 