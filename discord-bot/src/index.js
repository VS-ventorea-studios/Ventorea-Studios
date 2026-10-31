import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder,
  GatewayIntentBits, PermissionFlagsBits, Events
} from 'discord.js';

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tickets (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    opener_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const staffRoleId = process.env.STAFF_ROLE_ID;
const isStaff = (member) =>
  member?.permissions?.has(PermissionFlagsBits.Administrator) ||
  member?.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
  (staffRoleId && member?.roles?.cache?.has(staffRoleId));

async function logAction(guild, title, description, color = 0x5865F2) {
  const channelId = process.env.LOG_CHANNEL_ID;
  if (!channelId || !guild) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

function targetMember(interaction) {
  return interaction.options.getMember('member');
}

async function replyError(interaction, message) {
  const payload = { content: message, ephemeral: true };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  readyClient.user.setActivity('Ventorea Studios');
});

client.on(Events.GuildMemberAdd, async (member) => {
  const channelId = process.env.WELCOME_CHANNEL_ID;
  if (!channelId) return;
  const channel = await member.guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Welcome to Ventorea Studios!')
    .setDescription(`Welcome ${member} to **${member.guild.name}**. Please read the server rules and verify to get started.`)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
  await logAction(member.guild, 'Member joined', `${member.user.tag} (${member.id}) joined.`, 0x57F287);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await logAction(member.guild, 'Member left', `${member.user.tag} (${member.id}) left the server.`, 0xED4245);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'ventorea_open_ticket') {
        const existing = db.prepare("SELECT channel_id FROM tickets WHERE guild_id = ? AND opener_id = ? AND status = 'open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing) {
          const oldChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
          if (oldChannel) return interaction.reply({ content: `You already have a ticket: ${oldChannel}`, ephemeral: true });
          db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(existing.channel_id);
        }
        const permissionOverwrites = [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }
        ];
        if (staffRoleId) permissionOverwrites.push({ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
          type: ChannelType.GuildText,
          parent: process.env.TICKET_CATEGORY_ID || undefined,
          permissionOverwrites,
          topic: `Support ticket opened by ${interaction.user.tag} (${interaction.user.id})`
        });
        db.prepare('INSERT OR REPLACE INTO tickets (channel_id, guild_id, opener_id, status) VALUES (?, ?, ?, \'open\')')
          .run(channel.id, interaction.guildId, interaction.user.id);
        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ventorea_close_ticket').setLabel('Close ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );
        await channel.send({
          content: `Hi ${interaction.user}, support has received your ticket. Describe your issue here.${staffRoleId ? ` <@&${staffRoleId}>` : ''}`,
          components: [closeRow]
        });
        await interaction.reply({ content: `Your ticket is ready: ${channel}`, ephemeral: true });
        await logAction(interaction.guild, 'Ticket opened', `${interaction.user.tag} opened ${channel}.`);
        return;
      }
      if (interaction.customId === 'ventorea_close_ticket') {
        const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
        if (!ticket) return replyError(interaction, 'This channel is not an open ticket.');
        if (interaction.user.id !== ticket.opener_id && !isStaff(interaction.member)) {
          return replyError(interaction, 'Only the ticket opener or staff can close this ticket.');
        }
        db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);
        await interaction.reply({ content: 'Ticket closed. This channel will be deleted in 5 seconds.' });
        await logAction(interaction.guild, 'Ticket closed', `Ticket ${interaction.channel.name} closed by ${interaction.user.tag}.`);
        setTimeout(() => interaction.channel.delete('Support ticket closed').catch(() => {}), 5000);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName: command } = interaction;

    if (command === 'ping') {
      return interaction.reply({ content: `Pong! ${client.ws.ping}ms`, ephemeral: true });
    }
    if (command === 'help') {
      return interaction.reply({
        content: '**Ventorea Studios Bot**\nModeration: /warn, /warnings, /timeout, /kick, /ban, /clear\nSupport: /ticket-panel, /close-ticket\nCommunity: /verify, /announce, /embed\nAI: /ask\nHealth: /ping',
        ephemeral: true
      });
    }

    if (command === 'warn') {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const result = db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)')
        .run(interaction.guildId, user.id, interaction.user.id, reason);
      const count = db.prepare('SELECT COUNT(*) AS total FROM warnings WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, user.id).total;
      let punishment = 'No automatic timeout yet.';
      if (count >= 9) punishment = '24-hour timeout';
      else if (count >= 6) punishment = '5-hour timeout';
      else if (count >= 3) punishment = '1-hour timeout';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const timeoutMs = count >= 9 ? 24 * 60 * 60 * 1000 : count >= 6 ? 5 * 60 * 60 * 1000 : count >= 3 ? 60 * 60 * 1000 : 0;
      if (timeoutMs && member && member.moderatable) {
        await member.timeout(timeoutMs, `Automatic punishment at warning #${count}`).catch(() => {});
      }
      await interaction.reply({ content: `⚠️ Warned ${user.tag}. Total warnings: **${count}**. ${punishment}`, ephemeral: true });
      await logAction(interaction.guild, 'Member warned', `User: <@${user.id}>\nModerator: ${interaction.user}\nReason: ${reason}\nWarning count: ${count}\nAction: ${punishment}`, 0xFEE75C);
      return;
    }

    if (command === 'warnings') {
      const user = interaction.options.getUser('user');
      const rows = db.prepare('SELECT reason, moderator_id, created_at FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10')
        .all(interaction.guildId, user.id);
      return interaction.reply({
        content: rows.length ? `Warnings for ${user.tag}:\n${rows.map((w, i) => `${i + 1}. ${w.reason} (by <@${w.moderator_id}>, ${w.created_at})`).join('\n')}` : `${user.tag} has no recorded warnings.`,
        ephemeral: true
      });
    }

    if (['timeout', 'kick', 'ban'].includes(command)) {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const member = targetMember(interaction);
      const user = interaction.options.getUser('member');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      if (!member) return replyError(interaction, 'I could not find that member in this server.');
      if (member.id === interaction.user.id) return replyError(interaction, 'You cannot moderate yourself.');
      if (command === 'timeout') {
        const minutes = interaction.options.getInteger('minutes');
        if (!member.moderatable) return replyError(interaction, 'I cannot timeout this member. Check my role position and permissions.');
        await member.timeout(minutes * 60_000, reason);
        await interaction.reply({ content: `Timed out ${user.tag} for ${minutes} minutes. Reason: ${reason}`, ephemeral: true });
      } else if (command === 'kick') {
        if (!member.kickable) return replyError(interaction, 'I cannot kick this member. Check my role position and permissions.');
        await member.kick(reason);
        await interaction.reply({ content: `Kicked ${user.tag}. Reason: ${reason}`, ephemeral: true });
      } else {
        if (!member.bannable) return replyError(interaction, 'I cannot ban this member. Check my role position and permissions.');
        await member.ban({ reason });
        await interaction.reply({ content: `Banned ${user.tag}. Reason: ${reason}`, ephemeral: true });
      }
      await logAction(interaction.guild, `Moderation: ${command}`, `Target: ${user.tag} (${user.id})\nModerator: ${interaction.user.tag}\nReason: ${reason}`, 0xED4245);
      return;
    }

    if (command === 'clear') {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const amount = interaction.options.getInteger('amount');
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `Deleted ${deleted.size} messages.`, ephemeral: true });
      await logAction(interaction.guild, 'Messages cleared', `${interaction.user.tag} deleted ${deleted.size} messages in #${interaction.channel.name}.`);
      return;
    }

    if (command === 'ticket-panel') {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('Ventorea Studios Support')
        .setDescription('Press the button below to create a private support ticket. Please do not open duplicate tickets.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ventorea_open_ticket').setLabel('Open a ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: 'Support ticket panel posted.', ephemeral: true });
    }

    if (command === 'close-ticket') {
      const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
      if (!ticket) return replyError(interaction, 'This channel is not an open ticket.');
      if (interaction.user.id !== ticket.opener_id && !isStaff(interaction.member)) return replyError(interaction, 'Only the opener or staff can close this ticket.');
      db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);
      await interaction.reply({ content: 'Ticket closed. This channel will be deleted in 5 seconds.' });
      await logAction(interaction.guild, 'Ticket closed', `Ticket ${interaction.channel.name} closed by ${interaction.user.tag}.`);
      setTimeout(() => interaction.channel.delete('Support ticket closed').catch(() => {}), 5000);
      return;
    }

    if (command === 'verify') {
      const roleId = process.env.VERIFIED_ROLE_ID;
      if (!roleId) return replyError(interaction, 'Verification is not configured yet. Set VERIFIED_ROLE_ID in the host environment.');
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) return replyError(interaction, 'The configured verified role does not exist.');
      if (interaction.member.roles.cache.has(role.id)) return interaction.reply({ content: 'You are already verified.', ephemeral: true });
      await interaction.member.roles.add(role, 'Member completed the server verification command');
      await interaction.reply({ content: '✅ You are verified. Welcome to Ventorea Studios!', ephemeral: true });
      await logAction(interaction.guild, 'Member verified', `${interaction.user.tag} (${interaction.user.id}) verified.`, 0x57F287);
      return;
    }

    if (command === 'announce') {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(message)
        .setFooter({ text: 'Ventorea Studios' }).setTimestamp();
      await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return interaction.reply({ content: 'Announcement published.', ephemeral: true });
    }

    if (command === 'embed') {
      if (!isStaff(interaction.member)) return replyError(interaction, 'You need staff moderation permissions.');
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description)
        .setFooter({ text: `Posted by ${interaction.user.tag}` }).setTimestamp();
      await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return interaction.reply({ content: 'Embed posted.', ephemeral: true });
    }

    if (command === 'ask') {
      const prompt = interaction.options.getString('question');
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return replyError(interaction, 'AI chat is not configured. Add GEMINI_API_KEY in the hosting environment.');
      await interaction.deferReply();
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `You are Ventorea Studios Bot, a helpful and safe community assistant. Keep answers concise. User question: ${prompt.slice(0, 1500)}` }] }], generationConfig: { maxOutputTokens: 500, temperature: 0.7 } })
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('Gemini API error:', data?.error?.message || response.status);
        return interaction.editReply('The AI service failed to respond. Please try again later.');
      }
      const answer = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
      return interaction.editReply(answer ? answer.slice(0, 1900) : 'I could not generate a reply. Please try another question.');
    }
  } catch (error) {
    console.error('Interaction error:', error);
    await replyError(interaction, 'Something went wrong. Check the bot logs and permissions.').catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
