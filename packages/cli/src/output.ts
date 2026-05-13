function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortJsonValue(nested)]),
  );
}

export function deterministicJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value ?? null));
}

export function writeJson(stdout: NodeJS.WriteStream, value: unknown): void {
  stdout.write(`${deterministicJson(value)}\n`);
}
