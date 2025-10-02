import { loadEnv } from '../src/config/env.js';
import { listAiRoles } from '../src/services/roleService.js';

loadEnv();

listAiRoles({ ensureSeed: false })
  .then((roles) => {
    for (const role of roles) {
      console.log(`${role.id} -> portrait: ${role.portraitImageUrl}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
