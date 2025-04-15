// Mock Next.js Image component for testing
const React = require('react');

// Create a simple Image component that renders an img tag
const Image = ({ src, alt, width, height, ...props }) => {
  return React.createElement('img', { src, alt, width, height, ...props });
};

// Also export the loader
Image.defaultProps = {
  loader: ({ src }) => src,
};

module.exports = Image; 