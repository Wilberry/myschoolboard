export function includesSource(source, expected) {
  return source.replace(/\s/g, "").includes(expected.replace(/\s/g, ""));
}
