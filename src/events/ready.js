import { Events } from 'discord.js';
import chalk from 'chalk';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(chalk.green.bold('╔══════════════════════════════════╗'));
    console.log(chalk.green.bold('║       DM-Overlord Online         ║'));
    console.log(chalk.green.bold('╚══════════════════════════════════╝'));
    console.log(chalk.cyan(`Logged in as ${chalk.bold(client.user.tag)}`));
    console.log(chalk.cyan(`Serving ${chalk.bold(client.guilds.cache.size)} guilds`));
    console.log(chalk.cyan(`Commands: ${chalk.bold(client.commands.size)} loaded`));
    client.user.setActivity('Dungeons & Dragons', { type: 3 });
  },
};
