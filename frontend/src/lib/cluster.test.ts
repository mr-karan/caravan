import * as getBaseUrl from '../helpers/getBaseUrl';
import { 
  decodeClusterName, 
  encodeClusterName, 
  formatClusterPathParam, 
  getCluster, 
  getClusterPrefixedPath,
  getSelectedClusters 
} from './cluster';

vi.mock('../helpers/getBaseUrl', () => ({
  getBaseUrl: vi.fn(),
}));

describe('encodeClusterName', () => {
  it('should encode spaces in cluster names', () => {
    expect(encodeClusterName('nomad dev eng')).toBe('nomad%20dev%20eng');
  });

  it('should encode special characters', () => {
    expect(encodeClusterName('cluster/with/slashes')).toBe('cluster%2Fwith%2Fslashes');
    expect(encodeClusterName('cluster+plus')).toBe('cluster%2Bplus');
  });

  it('should leave alphanumeric and safe characters unchanged', () => {
    expect(encodeClusterName('test-cluster_123')).toBe('test-cluster_123');
  });
});

describe('decodeClusterName', () => {
  it('should decode URL-encoded cluster names', () => {
    expect(decodeClusterName('nomad%20dev%20eng')).toBe('nomad dev eng');
  });

  it('should decode special characters', () => {
    expect(decodeClusterName('cluster%2Fwith%2Fslashes')).toBe('cluster/with/slashes');
  });

  it('should return original string if decoding fails', () => {
    expect(decodeClusterName('invalid%')).toBe('invalid%');
  });

  it('should leave already decoded strings unchanged', () => {
    expect(decodeClusterName('test-cluster')).toBe('test-cluster');
  });
});

describe('formatClusterPathParam', () => {
  it('should encode cluster names with spaces', () => {
    expect(formatClusterPathParam(['nomad dev eng'])).toBe('nomad%20dev%20eng');
  });

  it('should join multiple clusters with +', () => {
    expect(formatClusterPathParam(['cluster1', 'cluster2'])).toBe('cluster1+cluster2');
  });

  it('should encode each cluster name when joining', () => {
    expect(formatClusterPathParam(['nomad dev', 'cluster 2'])).toBe('nomad%20dev+cluster%202');
  });

  it('should put current cluster first', () => {
    expect(formatClusterPathParam(['cluster1', 'cluster2'], 'cluster2')).toBe('cluster2+cluster1');
  });
});

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

  it('should decode URL-encoded cluster names with spaces', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/c/nomad%20dev%20eng/workloads';

    expect(getCluster()).toBe('nomad dev eng');
  });
});

describe('getSelectedClusters', () => {
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

  it('should decode multiple URL-encoded cluster names', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/c/nomad%20dev+cluster%202/workloads';

    expect(getSelectedClusters()).toEqual(['nomad dev', 'cluster 2']);
  });

  it('should return default value when no clusters in URL', () => {
    vi.mocked(getBaseUrl.getBaseUrl).mockReturnValue('');
    window.location.pathname = '/workloads';

    expect(getSelectedClusters(['default'])).toEqual(['default']);
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
