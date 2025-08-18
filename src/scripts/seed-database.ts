import { seedAllMockData } from '../utils/seed-data';

/**
 * Script to seed the database with mock data
 */
async function seedDatabase() {
  console.log('🌱 Starting database seeding process...');
  
  try {
    await seedAllMockData();
    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function if this script is executed directly
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Unhandled error during seeding:', error);
    process.exit(1);
  });
}
