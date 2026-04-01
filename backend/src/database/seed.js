require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('./db');
const logger = require('../utils/logger');

const SKILLS = [
  // Tech
  { name: 'JavaScript', category: 'Technology' },
  { name: 'Python', category: 'Technology' },
  { name: 'React Native', category: 'Technology' },
  { name: 'Node.js', category: 'Technology' },
  { name: 'SQL', category: 'Technology' },
  { name: 'UI/UX Design', category: 'Technology' },
  // Languages
  { name: 'English', category: 'Language' },
  { name: 'French', category: 'Language' },
  { name: 'Spanish', category: 'Language' },
  { name: 'Arabic', category: 'Language' },
  // Arts
  { name: 'Guitar', category: 'Music' },
  { name: 'Piano', category: 'Music' },
  { name: 'Drawing', category: 'Arts' },
  { name: 'Photography', category: 'Arts' },
  // Sports
  { name: 'Football', category: 'Sport' },
  { name: 'Tennis', category: 'Sport' },
  { name: 'Yoga', category: 'Sport' },
  // Other
  { name: 'Cooking', category: 'Lifestyle' },
  { name: 'Math Tutoring', category: 'Education' },
  { name: 'Public Speaking', category: 'Soft Skills' },
];

async function seed() {
  try {
    for (const skill of SKILLS) {
      await pool.query(
        `INSERT INTO skills (name, category)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [skill.name, skill.category]
      );
    }
    logger.info(`Seeded ${SKILLS.length} skills.`);
  } catch (err) {
    logger.error('Seed failed', { error: err.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
