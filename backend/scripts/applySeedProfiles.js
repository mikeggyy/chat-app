import { loadEnv } from '../src/config/env.js';
import { seedAiRoles } from '../src/data/aiRolesSeed.js';
import { updateAiRole } from '../src/services/roleService.js';

loadEnv();

async function applySeedProfiles() {
  for (const role of seedAiRoles) {
    try {
      await updateAiRole(role.id, role);
      console.log(`Updated role ${role.id}`);
    } catch (error) {
      console.error(`Failed to update ${role.id}:`, error.message);
      throw error;
    }
  }
}

applySeedProfiles()
  .then(() => {
    console.log('Seed profiles applied successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to apply seed profiles:', error);
    process.exit(1);
  });
