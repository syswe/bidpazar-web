'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Create context with default values to avoid the undefined check
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on client side only
  useEffect(() => {
    setMounted(true);
    try {
      // Check if we're in the browser
      const savedTheme = localStorage.getItem('theme') as Theme;
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

      // Set theme based on saved preference or system preference
      const initialTheme = savedTheme || systemTheme;
      setTheme(initialTheme);

      // Apply theme to document
      if (initialTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Add smooth transition for theme changes
      document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease';
    } catch (e) {
      console.error('Error setting theme:', e);
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';

      try {
        // Save to localStorage
        localStorage.setItem('theme', newTheme);

        // Apply theme to document
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        console.error('Error toggling theme:', e);
      }

      return newTheme;
    });
  };

  // Use a wrapper with opacity to prevent flashing during hydration
  if (!mounted) {
    // Return a placeholder with the same structure
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
} 