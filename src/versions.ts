export function versionToString(version: number): string {
  return version === Infinity
    ? 'inf'
    : version === -Infinity
    ? '-inf'
    : version.toString();
}

export function versionFromString(version: string): number {
  return version === 'inf'
    ? Infinity
    : version === '-inf'
    ? -Infinity
    : +version;
}
