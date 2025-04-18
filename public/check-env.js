// This script runs after the environment is loaded to verify values
(function() {
  console.log('====== ENVIRONMENT CHECK ======');
  
  // Check if window.__ENV__ exists
  if (!window.__ENV__) {
    console.error('ERROR: window.__ENV__ is not defined! Runtime environment injection failed.');
    return;
  }
  
  // Log all environment variables
  console.log('Runtime environment variables:');
  console.log('NEXT_PUBLIC_API_URL:', window.__ENV__.NEXT_PUBLIC_API_URL);
  console.log('NEXT_PUBLIC_SOCKET_URL:', window.__ENV__.NEXT_PUBLIC_SOCKET_URL);
  console.log('NEXT_PUBLIC_APP_URL:', window.__ENV__.NEXT_PUBLIC_APP_URL);
  console.log('NEXT_PUBLIC_WEBRTC_SERVER:', window.__ENV__.NEXT_PUBLIC_WEBRTC_SERVER);
  
  // Check for any undefined variables
  const undefinedVars = [];
  if (!window.__ENV__.NEXT_PUBLIC_API_URL) undefinedVars.push('NEXT_PUBLIC_API_URL');
  if (!window.__ENV__.NEXT_PUBLIC_SOCKET_URL) undefinedVars.push('NEXT_PUBLIC_SOCKET_URL');
  if (!window.__ENV__.NEXT_PUBLIC_APP_URL) undefinedVars.push('NEXT_PUBLIC_APP_URL');
  if (!window.__ENV__.NEXT_PUBLIC_WEBRTC_SERVER) undefinedVars.push('NEXT_PUBLIC_WEBRTC_SERVER');
  
  if (undefinedVars.length > 0) {
    console.warn('WARNING: The following environment variables are undefined:', undefinedVars.join(', '));
  } else {
    console.log('All environment variables are defined.');
  }
  
  // Check for placeholder values (not properly replaced)
  const placeholderVars = [];
  if (window.__ENV__.NEXT_PUBLIC_API_URL.includes('${')) placeholderVars.push('NEXT_PUBLIC_API_URL');
  if (window.__ENV__.NEXT_PUBLIC_SOCKET_URL.includes('${')) placeholderVars.push('NEXT_PUBLIC_SOCKET_URL');
  if (window.__ENV__.NEXT_PUBLIC_APP_URL.includes('${')) placeholderVars.push('NEXT_PUBLIC_APP_URL');
  if (window.__ENV__.NEXT_PUBLIC_WEBRTC_SERVER.includes('${')) placeholderVars.push('NEXT_PUBLIC_WEBRTC_SERVER');
  
  if (placeholderVars.length > 0) {
    console.error('ERROR: The following environment variables still have placeholder values:', placeholderVars.join(', '));
  } else {
    console.log('All environment variables are properly substituted.');
  }
  
  console.log('====== END ENVIRONMENT CHECK ======');
})(); 