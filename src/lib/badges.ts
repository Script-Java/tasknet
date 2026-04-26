export type BadgeCategory = 'consistency' | 'progression' | 'social' | 'resilience';

export type BadgeTrigger =
  | 'task_complete'
  | 'habit_complete'
  | 'xp_change'
  | 'friend_add'
  | 'leaderboard_update'
  | 'manual';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  image: string;
  triggers: BadgeTrigger[];
}

export const BADGES: BadgeDef[] = [
  // Category 1: Consistency & Habit Badges (The "Grind")
  {
    id: 'first_light',
    name: 'First Light',
    description: 'The beginning of the journey. Complete your very first habit or to-do item.',
    category: 'consistency',
    image: '/badges/1.png',
    triggers: ['task_complete', 'habit_complete'],
  },
  {
    id: 'orbit_established',
    name: 'Orbit Established',
    description: "You're finding your rhythm. Complete all daily habits for 7 consecutive days.",
    category: 'consistency',
    image: '/badges/2.png',
    triggers: ['habit_complete', 'manual'],
  },
  {
    id: 'lunar_cycle',
    name: 'Lunar Cycle',
    description: 'A full month of dedication. Complete all daily habits for 30 consecutive days.',
    category: 'consistency',
    image: '/badges/3.png',
    triggers: ['habit_complete', 'manual'],
  },
  {
    id: 'solar_flare',
    name: 'Solar Flare',
    description: 'An explosion of productivity. Complete 10 to-do list items in a single day.',
    category: 'consistency',
    image: '/badges/4.png',
    triggers: ['task_complete'],
  },
  {
    id: 'unbroken_chain',
    name: 'Unbroken Chain',
    description: 'True discipline. Maintain a 100-day streak on at least one habit.',
    category: 'consistency',
    image: '/badges/5.png',
    triggers: ['habit_complete'],
  },
  {
    id: 'the_perfect_week',
    name: 'The Perfect Week',
    description: 'Flawless execution. Check off every single to-do item and habit on your list from Monday to Sunday.',
    category: 'consistency',
    image: '/badges/6.png',
    triggers: ['task_complete', 'habit_complete', 'manual'],
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'For the late-night grinders. Complete 50 tasks or habits between 10:00 PM and 2:00 AM.',
    category: 'consistency',
    image: '/badges/7.png',
    triggers: ['task_complete', 'habit_complete'],
  },
  {
    id: 'early_riser',
    name: 'Early Riser',
    description: 'Capturing the morning momentum. Complete your first habit of the day before 6:00 AM, 10 times.',
    category: 'consistency',
    image: '/badges/8.png',
    triggers: ['habit_complete'],
  },

  // Category 2: XP & Progression Badges (The "Level Up")
  {
    id: 'stardust',
    name: 'Stardust',
    description: 'Earning your stripes. Reach 1,000 total XP.',
    category: 'progression',
    image: '/badges/9.png',
    triggers: ['xp_change', 'task_complete', 'habit_complete'],
  },
  {
    id: 'nebula',
    name: 'Nebula',
    description: 'A growing force. Reach 10,000 total XP.',
    category: 'progression',
    image: '/badges/10.png',
    triggers: ['xp_change', 'task_complete', 'habit_complete'],
  },
  {
    id: 'supernova',
    name: 'Supernova',
    description: 'Elite status achieved. Reach 100,000 total XP.',
    category: 'progression',
    image: '/badges/11.png',
    triggers: ['xp_change', 'task_complete', 'habit_complete'],
  },
  {
    id: 'xp_multiplier',
    name: 'XP Multiplier',
    description: 'Riding the wave of efficiency. Earn over 500 XP in a single 24-hour period.',
    category: 'progression',
    image: '/badges/12.png',
    triggers: ['xp_change', 'task_complete', 'habit_complete'],
  },
  {
    id: 'taskmaster',
    name: 'Taskmaster',
    description: 'Focus on the granular details. Earn 5,000 XP exclusively from completing to-do list items, not habits.',
    category: 'progression',
    image: '/badges/13.png',
    triggers: ['task_complete', 'xp_change'],
  },

  // Category 3: Social & Leaderboard Badges (The "Competition")
  {
    id: 'constellation_connected',
    name: 'Constellation Connected',
    description: 'Building your network. Add your first 5 friends.',
    category: 'social',
    image: '/badges/14.png',
    triggers: ['friend_add', 'manual'],
  },
  {
    id: 'friendly_rivalry',
    name: 'Friendly Rivalry',
    description: 'The push we all need. Surpass a friend on the weekly leaderboard who was ranked above you the previous day.',
    category: 'social',
    image: '/badges/15.png',
    triggers: ['leaderboard_update'],
  },
  {
    id: 'apex_star',
    name: 'Apex Star',
    description: "Top of the class. Finish the week at #1 on your friends' leaderboard.",
    category: 'social',
    image: '/badges/16.png',
    triggers: ['leaderboard_update', 'manual'],
  },
  {
    id: 'podium_finish',
    name: 'Podium Finish',
    description: 'Consistent top performance. Finish in the Top 3 on the leaderboard for four consecutive weeks.',
    category: 'social',
    image: '/badges/17.png',
    triggers: ['leaderboard_update', 'manual'],
  },
  {
    id: 'the_pacesetter',
    name: 'The Pacesetter',
    description: 'Setting the standard. Be the first among your friends to reach a new XP milestone.',
    category: 'social',
    image: '/badges/18.png',
    triggers: ['xp_change', 'leaderboard_update'],
  },
  {
    id: 'accountability_partner',
    name: 'Accountability Partner',
    description: 'Mutual growth. You and a specific friend both complete all your daily habits for 7 days straight.',
    category: 'social',
    image: '/badges/19.png',
    triggers: ['habit_complete', 'manual'],
  },
  {
    id: 'underdog_victory',
    name: 'Underdog Victory',
    description: 'A massive comeback. Jump from the bottom half of the leaderboard to the Top 3 in a single week.',
    category: 'social',
    image: '/badges/20.png',
    triggers: ['leaderboard_update'],
  },

  // Category 4: Resilience & Milestones (The "Beyond")
  {
    id: 'eclipse_survivor',
    name: 'Eclipse Survivor',
    description: 'Resilience in the void. Re-establish a 7-day habit streak immediately after breaking a streak of 14 days or more.',
    category: 'resilience',
    image: '/badges/21.png',
    triggers: ['habit_complete'],
  },
  {
    id: 'meteor_shower',
    name: 'Meteor Shower',
    description: 'Weekend warrior. Complete 20 to-do list items or habits over a single weekend.',
    category: 'resilience',
    image: '/badges/22.png',
    triggers: ['task_complete', 'habit_complete'],
  },
  {
    id: 'cosmic_journey',
    name: 'Cosmic Journey',
    description: 'A universe of productivity. Complete a lifetime total of 1,000 habits or to-do items.',
    category: 'resilience',
    image: '/badges/23.png',
    triggers: ['task_complete', 'habit_complete'],
  },
];

export const BADGE_BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]));

export const CATEGORY_ORDER: BadgeCategory[] = ['consistency', 'progression', 'social', 'resilience'];

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  consistency: 'The Grind',
  progression: 'The Level Up',
  social: 'The Competition',
  resilience: 'The Beyond',
};