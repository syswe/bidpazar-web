// Mock Next.js headers API for testing
const headers = jest.fn().mockImplementation(() => new Map());
const cookies = jest.fn().mockImplementation(() => new Map());

module.exports = {
  headers,
  cookies,
}; 