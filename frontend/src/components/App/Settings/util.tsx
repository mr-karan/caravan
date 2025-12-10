export function isValidNamespaceFormat(namespace: string) {
  // We allow empty strings just because that's the default value in our case.
  if (!namespace) {
    return true;
  }

  // Validates that the namespace is a valid DNS-1123 label and returns a boolean.
  // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names
  const regex = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$');
  return regex.test(namespace);
}

export function isValidClusterNameFormat(name: string) {
  // We allow empty cluster names as that's the default value in our case.
  if (!name) {
    return true;
  }

  // Cluster name validation rules:
  // - Must start and end with an alphanumeric character
  // - May contain alphanumeric characters (a-z, A-Z, 0-9)
  // - May contain spaces, hyphens (-), and underscores (_)
  // - No leading/trailing spaces
  // - No consecutive spaces
  // - Maximum length of 63 characters (common limit for identifiers)
  
  // Check for leading/trailing spaces
  if (name !== name.trim()) {
    return false;
  }
  
  // Check for consecutive spaces
  if (/\s{2,}/.test(name)) {
    return false;
  }
  
  // Check length
  if (name.length > 63) {
    return false;
  }

  // Must start with alphanumeric, may contain alphanumeric, spaces, hyphens, underscores,
  // and must end with alphanumeric
  const regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9 _-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$');
  return regex.test(name);
}
