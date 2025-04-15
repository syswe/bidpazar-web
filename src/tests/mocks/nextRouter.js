// Mock Next.js router for testing
module.exports = {
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    pathname: '/',
    asPath: '/',
    locale: 'en',
    route: '/',
    basePath: '',
    isReady: true,
    isFallback: false,
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    push: jest.fn(() => Promise.resolve(true)),
    replace: jest.fn(() => Promise.resolve(true)),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(() => Promise.resolve()),
    beforePopState: jest.fn(() => null),
  })),
}; 