// `plural` defaults to `${singular}s` for regular nouns; pass it explicitly
// for irregular ones (pluralize(count, 'entry', 'entries')).
export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;
