'use client';

import { useState, useEffect } from 'react';

export default function ApiTestPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || '/api');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Function to convert container hostnames to localhost
  const getLocalUrl = (url: string): string => {
    return url
      .replace(/http:\/\/api:/, 'http://localhost:')
      .replace(/http:\/\/backend:/, 'http://localhost:');
  };

  // Check for potential hostname issues and suggest alternatives
  useEffect(() => {
    const newSuggestions: string[] = [];
    
    if (apiUrl.includes('http://api:') || apiUrl.includes('http://backend:')) {
      newSuggestions.push(
        `Browser may not resolve container hostname. Try: ${getLocalUrl(apiUrl)}`
      );
    }
    
    setSuggestions(newSuggestions);
  }, [apiUrl]);

  const testFetch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Attempting to fetch from: ${apiUrl}/products`);
      
      // Determine credentials mode based on environment
      const credentialsMode = process.env.NODE_ENV === 'development' 
        ? 'include' 
        : 'same-origin';
      
      const response = await fetch(`${apiUrl}/products`, {
        mode: 'cors',
        credentials: credentialsMode,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      console.log(`Response headers:`, response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      setResult(data);
    } catch (err) {
      console.error('Error during fetch:', err);
      
      // Check if this might be a hostname resolution error
      if (apiUrl.includes('http://api:') || apiUrl.includes('http://backend:')) {
        setError(`${err instanceof Error ? err.message : String(err)}\n\nThis may be a hostname resolution issue. Try using localhost instead of container names.`);
        
        // Try with localhost automatically
        try {
          const localUrl = getLocalUrl(apiUrl);
          console.log(`Attempting automatic retry with: ${localUrl}/products`);
          
          const response = await fetch(`${localUrl}/products`, {
            mode: 'cors',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Automatic retry succeeded:', data);
            setResult(data);
            setError(`Original request failed, but retry with localhost succeeded.\nSuggestion: Use ${localUrl} instead of ${apiUrl}`);
          }
        } catch (retryErr) {
          console.error('Auto-retry also failed:', retryErr);
          // Keep the original error
        }
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const testDirectFetch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const directUrl = 'http://localhost:3000/api/products';
      console.log(`Attempting direct fetch from: ${directUrl}`);
      
      // Determine credentials mode based on environment
      const credentialsMode = process.env.NODE_ENV === 'development' 
        ? 'include' 
        : 'same-origin';
      
      const response = await fetch(directUrl, {
        mode: 'cors',
        credentials: credentialsMode,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Direct response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Direct API request failed: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      const data = await response.json();
      console.log('Direct response data:', data);
      setResult(data);
    } catch (err) {
      console.error('Error during direct fetch:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const useLocalhost = () => {
    const localhostUrl = getLocalUrl(apiUrl);
    setApiUrl(localhostUrl);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Connection Test</h1>
      
      <div className="mb-6">
        <h3>Environment Variables (Client-Side):</h3>
        <pre>
          {JSON.stringify(
            {
              NODE_ENV: process.env.NODE_ENV,
              // Display environment variables
              NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
              NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
              NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
            },
            null,
            2
          )}
        </pre>
      </div>
      
      <div className="mb-6">
        <label className="block mb-2">
          Custom API URL:
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="ml-2 border p-1 w-96"
          />
        </label>
        
        {suggestions.length > 0 && (
          <div className="mt-2 text-amber-600">
            <p className="font-semibold">Suggestions:</p>
            <ul className="list-disc pl-5">
              {suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
            <button 
              onClick={useLocalhost}
              className="mt-2 bg-amber-500 text-white px-3 py-1 rounded text-sm"
            >
              Use localhost instead
            </button>
          </div>
        )}
      </div>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={testFetch}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >
          {loading ? 'Testing...' : 'Test API (from env)'}
        </button>
        
        <button
          onClick={testDirectFetch}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-green-300"
        >
          {loading ? 'Testing...' : 'Test API (direct URL)'}
        </button>
      </div>
      
      {error && (
        <div className="mb-6">
          <h2 className="text-xl text-red-600 font-semibold mb-2">Error:</h2>
          <pre className="bg-red-50 border border-red-200 p-3 rounded whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      )}
      
      {result && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Result:</h2>
          <pre className="bg-green-50 border border-green-200 p-3 rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 