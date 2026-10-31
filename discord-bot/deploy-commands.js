import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  new SlashCommandBuilder().setName('help').setDescription('Show bot commands'),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member and apply warning thresholds')
    .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setMaxLength(500)),
  new SlashCommandBuilder().setName('warnings').setDescription('View a member warning history')
    .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
    .addUserOption(o => o.setName('member').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Timeout duration in minutes, up to 40320').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .addUserOption(o => o.setName('member').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
    .addUserOption(o => o.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setMaxLength(500)),
  new SlashCommandBuilder().setName('clear').setDescription('Delete recent messages')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages, 1 to 100').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('ticket-panel').setDescription('Post the support ticket panel'),
  new SlashCommandBuilder().setName('close-ticket').setDescription('Close the current support ticket'),
  new SlashCommandBuilder().setName('verify').setDescription('Assign the configured verified role'),
  new SlashCommandBuilder().setName('announce').setDescription('Publish a server announcement')
    .addStringOption(o => o.setName('title').setDescription('Announcement title').setMaxLength(256).setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Announcement message').setMaxLength(3500).setRequired(true)),
  new SlashCommandBuilder().setName('embed').setDescription('Post a custom embed')
    .addStringOption(o => o.setName('title').setDescription('Embed title').setMaxLength(256).setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Embed description').setMaxLength(3500).setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('Ask the Ventorea AI assistant')
    .addStringOption(o => o.setName('question').setDescription('Your question').setMaxLength(1500).setRequired(true))
].map(command => command.toJSON());

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
  console.error('Set DISCORD_TOKEN, CLIENT_ID, and GUILD_ID before registering commands.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
try {
  console.log('Registering Ventorea Studios Bot slash commands...');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log(`Registered ${commands.length} guild commands.`);
} catch (error) {
  console.error('Could not register commands:', error);
  process.exit(1);
}
