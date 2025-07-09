import { writeFile } from 'fs';
import yargs from 'yargs';
import { config } from 'dotenv';

config();

(async () => {
  const argv = await yargs(process.argv.slice(2)).argv;
  const environment = argv['environment'];
  const isProduction = environment === 'prod';

  const targetPath = isProduction
    ? `./src/environments/environment.prod.ts`
    : `./src/environments/environment.ts`;

  // Create environment file content
  const envConfigFile = `
export const environment = {
  production: ${isProduction},
  API_URL: '${process.env['API_URL']}',
  PUSHER_APP_KEY: '${process.env['PUSHER_APP_KEY']}',
  PUSHER_APP_CLUSTER: '${process.env['PUSHER_APP_CLUSTER']}',
};
`;

  // Write content to an environment file
  writeFile(targetPath, envConfigFile, (err) => {
    if (err) {
      console.error(err);
      throw err;
    } else {
      console.log(`Output generated at ${targetPath}`);
    }
  });
})();
