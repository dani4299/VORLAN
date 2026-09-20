const BUCKETS = [
  {
    id: 'late-night',
    startHour: 0,
    endHour: 5,
    phrases: [
      'Still up, {name}?',
      'Burning the midnight oil, {name}?',
      'What brings you at this time of the night?',
      'The house is quiet. You’re not.',
      'Late night, {name}. Everything alright?',
    ],
  },
  {
    id: 'early-morning',
    startHour: 5,
    endHour: 8,
    phrases: [
      'Up with the sun, {name}.',
      'Early start today, {name}?',
      'Good morning, {name}.',
      'Rise and shine, {name}.',
      'The day’s still fresh. Make it count.',
    ],
  },
  {
    id: 'morning',
    startHour: 8,
    endHour: 12,
    phrases: [
      'Good morning, {name}.',
      'Morning, {name}. Ready for the day?',
      'Hope your morning’s off to a good start.',
      'Another day, {name}. Let’s get into it.',
      'Good morning. Coffee’s optional, focus isn’t.',
    ],
  },
  {
    id: 'afternoon',
    startHour: 12,
    endHour: 17,
    phrases: [
      'Good afternoon, {name}.',
      'Having a good afternoon?',
      'Halfway through the day, {name}.',
      'Afternoon check-in, {name}.',
      'Hope the day’s treating you well.',
    ],
  },
  {
    id: 'evening',
    startHour: 17,
    endHour: 21,
    phrases: [
      'Good evening, {name}.',
      'Winding down, {name}?',
      'Evening, {name}. How was the day?',
      'The day’s almost done, {name}.',
      'Good evening. Time to unwind.',
    ],
  },
  {
    id: 'night',
    startHour: 21,
    endHour: 24,
    phrases: [
      'Good night, {name}.',
      'Settling in for the night, {name}?',
      'Late one tonight, {name}?',
      'Night owl mode activated, {name}.',
      'Still going, {name}? Don’t stay up too late.',
    ],
  },
];

/** Picks a random greeting from the bucket matching the current hour, once per call. */
export const pickGreeting = (name, date = new Date()) => {
  const hour = date.getHours();
  const bucket = BUCKETS.find((b) => hour >= b.startHour && hour < b.endHour) || BUCKETS[0];
  const phrase = bucket.phrases[Math.floor(Math.random() * bucket.phrases.length)];
  return phrase.replaceAll('{name}', name);
};
