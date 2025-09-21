import { seedInitialData } from "../server/db-storage";

async function main() {
  try {
    console.log("Seeding initial data...");
    await seedInitialData();
    console.log("Database migration and seeding complete!");
  } catch (error) {
    console.error("Error during database migration and seeding:", error);
    process.exit(1);
  }
}

main();