// Mock Next.js navigation hooks for testing
const nextNavigation = {
  useRouter: jest.fn().mockImplementation(() => ({
    back: jest.fn(),
    forward: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(() => Promise.resolve(true)),
  })),
  usePathname: jest.fn().mockReturnValue('/'),
  useSearchParams: jest.fn().mockImplementation(() => ({
    get: jest.fn(param => null),
    getAll: jest.fn(param => []),
    toString: jest.fn(() => ''),
    has: jest.fn(() => false),
    forEach: jest.fn(),
  })),
  useParams: jest.fn().mockReturnValue({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
};

module.exports = nextNavigation; 