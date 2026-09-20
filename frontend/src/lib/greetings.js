// A plain greeting for the time of day. One line, no jokes: it sits next to the clock, not on top of it.
const BUCKETS = [
  { startHour: 0, endHour: 5, phrase: 'Good night, {name}.' },
  { startHour: 5, endHour: 12, phrase: 'Good morning, {name}.' },
  { startHour: 12, endHour: 17, phrase: 'Good afternoon, {name}.' },
  { startHour: 17, endHour: 21, phrase: 'Good evening, {name}.' },
  { startHour: 21, endHour: 24, phrase: 'Good night, {name}.' },
];

export const pickGreeting = (name, date = new Date()) => {
  const hour = date.getHours();
  const bucket = BUCKETS.find((b) => hour >= b.startHour && hour < b.endHour) || BUCKETS[0];
  return bucket.phrase.replaceAll('{name}', name);
};
