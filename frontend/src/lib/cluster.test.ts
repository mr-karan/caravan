import * as getBaseUrl from '../helpers/getBaseUrl';
import { getCluster, getClusterPrefixedPath } from './cluster';

vi.mock('../helpers/getBaseUrl', () => ({
  getBaseUrl: vi.fn(),
}));

describe('getCluster', () => {
  const originalWindow = { ...window };

  beforeEach(() => {
    vi.clearAllMocks();

    window.location = {
      ...originalWindow.location,
      pathname: '',
      hash: '',
    } as Window['location'] & string;
  });

  afterEach(() => {
    window = { ...originalWindow };
  });

  it('should extract cluster name from pathname without base URL', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/c/test-cluster/workloads';

    expect(getCluster()).toBe('test-cluster');
  });

  it('should extract cluster name from pathname with base URL', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('/base');
    window.location.pathname = '/base/c/test-cluster/workloads';

    expect(getCluster()).toBe('test-cluster');
  });

  it('should return null for non-cluster path', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/workloads';

    expect(getCluster()).toBeNull();
  });

  it('should handle trailing slashes correctly', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/c/test-cluster/';

    expect(getCluster()).toBe('test-cluster');
  });
});

describe('getClusterPrefixedPath', () => {
  it('should handle null path', () => {
    expect(getClusterPrefixedPath()).toBe('/c/:cluster');
  });

  it('should handle path without leading slash', () => {
    expect(getClusterPrefixedPath('path')).toBe('/c/:cluster/path');
  });

  it('should handle path with leading slash', () => {
    expect(getClusterPrefixedPath('/path')).toBe('/c/:cluster/path');
  });
});
