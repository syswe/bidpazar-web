// Mock Next.js Link component for testing
const React = require('react');

// Create a simple Link component that renders an anchor tag
const Link = ({ href, children, ...props }) => {
  return React.createElement('a', { href, ...props }, children);
};

module.exports = Link; 