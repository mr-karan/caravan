import * as getAppUrl from './getAppUrl';
import * as isDevMode from './isDevMode';

describe('getAppUrl', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  const windowSpy = vi.spyOn<any, any>(window, 'window', 'get');

  test('dev mode', () => {
    vi.spyOn(isDevMode, 'isDevMode').mockImplementation(() => true);
    expect(getAppUrl.getAppUrl()).toBe('http://localhost:4466/');
  });

  test('base-url is set through caravanBaseUrl variable', () => {
    vi.spyOn(isDevMode, 'isDevMode').mockImplementation(() => true);

    windowSpy.mockImplementation(() => ({
      caravanBaseUrl: '/caravan',
    }));
    expect(getAppUrl.getAppUrl()).toBe('http://localhost:4466/caravan/');
  });

  test('base-url uses window.location.origin when not in dev mode', () => {
    vi.spyOn(isDevMode, 'isDevMode').mockImplementation(() => false);

    windowSpy.mockImplementation(() => ({
      caravanBaseUrl: '/caravan',
      location: {
        origin: 'http://example.com:4466',
      },
    }));
    expect(getAppUrl.getAppUrl()).toBe('http://example.com:4466/caravan/');
  });

  test('When caravanBaseUrl is set to "." it uses no base-url', () => {
    // This can happen with the Create React App build process which optimizes the "./" to "."
    vi.spyOn(isDevMode, 'isDevMode').mockImplementation(() => false);

    windowSpy.mockImplementation(() => ({
      caravanBaseUrl: '.',
      location: {
        origin: 'http://example.com:4466',
      },
    }));
    expect(getAppUrl.getAppUrl()).toBe('http://example.com:4466/');
  });
});
