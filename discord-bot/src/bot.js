import "dotenv/config";
import {
  Client, GatewayIntentBits, Events, EmbedBuilder, PermissionFlagsBits,
  ChannelType, version as discordJsVersion
} from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const startedAt = Date.now();
const warnings = new Map(); // Starter only: records clear on restart. Add a database for production.
const website = process.env.WEBSITE_URL || "https://www.ventoreastudios.online";
const rules = [
  "Treat everyone with respect. No harassment or hate speech.",
  "No spam, scams, flooding, or unsolicited advertising.",
  "Use the correct channels for each topic.",
  "Do not share private information or impersonate others.",
  "Follow Discord's Terms of Service and Community Guidelines.",
  "Respect staff instructions and appeal decisions calmly.",
  "Use the proper channels for suggestions, bug reports, and support."
];
const categories = [
  { name: "📌・START HERE", channels: [["📢・announcements","Official Ventorea news"],["📜・rules","Read the community rules"],["👋・welcome","Welcome new members"],["ℹ️・server-info","Server information"]] },
  { name: "🌍・COMMUNITY", channels: [["💬・general-chat","Community chat"],["💡・suggestions","Share ideas"],["🐛・bug-reports","Report bugs"],["🎫・support","Ask for help"],["📸・screenshots-and-media","Share media"]] },
  { name: "🎮・VENTOREA DEVELOPMENT", channels: [["🏙️・rsl-development","Discuss RSL"],["🛠️・development-updates","Development updates"],["🗺️・world-building","Cities and world design"],["✈️・airports","Airport development"]] },
  { name: "🔒・STAFF ONLY", channels: [["🛡️・staff-chat","Private staff chat"],["📋・mod-logs","Moderation logs"],["⚙️・bot-commands","Staff bot commands"]] }
];

function makeEmbed(title, description, color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description)
    .setFooter({ text: "Ventorea Studios • Real life, reimagined." }).setTimestamp();
}
function safeText(value) {
  return value.replace(/@everyone/g, "@\u200beveryone").replace(/@here/g, "@\u200bhere");
}
function duration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
}
function hasPermission(interaction, permission) {
  return interaction.memberPermissions?.has(permission) ?? false;
}
async function deliver(interaction, envName, messageEmbed) {
  const id = process.env[envName];
  if (id) {
    const channel = await interaction.guild?.channels.fetch(id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [messageEmbed] });
      return interaction.reply({ content: "Sent successfully.", ephemeral: true });
    }
  }
  return interaction.reply({ embeds: [messageEmbed], ephemeral: true });
}

client.once(Events.ClientReady, ready => {
  console.log("Logged in as " + ready.user.tag);
  ready.user.setActivity("Ventorea Studios | /help");
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const name = interaction.commandName;
  try {
    if (name === "ping") return interaction.reply({ embeds: [makeEmbed("🏓 Pong!", "Gateway latency: " + client.ws.ping + " ms")] });
    if (name === "help") return interaction.reply({ embeds: [makeEmbed("📚 Ventorea Bot Commands",
      "**General**\n/ping • /help • /website • /rules • /serverinfo • /userinfo • /membercount • /botinfo\n\n" +
      "**Community**\n/poll • /suggest • /reportbug • /feedback • /ask • /countdown\n\n" +
      "**Ventorea & RSL**\n/gameinfo • /devlog\n\n**Staff**\n/setup • /announce • /kick • /ban • /timeout • /clear • /warn • /warnings\n\nStaff commands require the appropriate Discord permissions.")], ephemeral: true });
    if (name === "rules") return interaction.reply({ embeds: [makeEmbed("📜 Ventorea Studios Rules", rules.map((r, i) => "**" + (i + 1) + ".** " + r).join("\n\n"))] });
    if (name === "website") return interaction.reply({ embeds: [makeEmbed("🌐 Official Website", "[Visit Ventorea Studios](" + website + ")")] });
    if (name === "serverinfo") {
      const g = interaction.guild;
      return interaction.reply({ embeds: [makeEmbed("ℹ️ " + g.name, "**Members:** " + g.memberCount + "\n**Channels:** " + g.channels.cache.size + "\n**Created:** <t:" + Math.floor(g.createdTimestamp / 1000) + ":D>")] });
    }
    if (name === "userinfo") {
      const user = interaction.options.getUser("member") || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      return interaction.reply({ embeds: [makeEmbed("👤 User Information", "**User:** " + user.tag + "\n**ID:** " + user.id + "\n**Account created:** <t:" + Math.floor(user.createdTimestamp / 1000) + ":R>\n**Joined server:** " + (member ? "<t:" + Math.floor(member.joinedTimestamp / 1000) + ":R>" : "Not a member"))] });
    }
    if (name === "membercount") return interaction.reply({ embeds: [makeEmbed("👥 Member Count", "This server has **" + interaction.guild.memberCount + "** members.")] });
    if (name === "botinfo") return interaction.reply({ embeds: [makeEmbed("🤖 Ventorea Bot", "**Version:** 1.0.0\n**discord.js:** " + discordJsVersion + "\n**Uptime:** " + duration(Date.now() - startedAt) + "\n**Ping:** " + client.ws.ping + " ms")] });
    if (name === "gameinfo") return interaction.reply({ embeds: [makeEmbed("🎮 Realistic Simulation Life (RSL)", "RSL is Ventorea Studios' planned life-simulation game, focused on an open world, cities, jobs, businesses, transport, banking, and everyday systems. Features and release plans may change.")] });
    if (name === "devlog") {
      const e = makeEmbed("🛠️ Devlog: " + interaction.options.getString("title", true), safeText(interaction.options.getString("details", true)));
      return deliver(interaction, "DEVLOG_CHANNEL_ID", e);
    }
    if (name === "announce") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
      return deliver(interaction, "ANNOUNCEMENTS_CHANNEL_ID", makeEmbed("📢 " + interaction.options.getString("title", true), safeText(interaction.options.getString("message", true)), 0x57F287));
    }
    if (name === "poll") {
      const options = [1,2,3,4].map(i => interaction.options.getString("option" + i)).filter(Boolean);
      const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣"];
      const msg = await interaction.reply({ embeds: [makeEmbed("📊 " + interaction.options.getString("question", true), options.map((o,i) => emojis[i] + " " + o).join("\n\n"))], fetchReply: true });
      for (let i = 0; i < options.length; i++) await msg.react(emojis[i]);
      return;
    }
    if (["suggest","reportbug","feedback"].includes(name)) {
      let env, title, body;
      if (name === "suggest") { env = "SUGGESTIONS_CHANNEL_ID"; title = "💡 New Suggestion"; body = interaction.options.getString("idea", true); }
      if (name === "reportbug") { env = "BUG_REPORTS_CHANNEL_ID"; title = "🐛 Bug: " + interaction.options.getString("title", true); body = interaction.options.getString("details", true); }
      if (name === "feedback") { env = "FEEDBACK_CHANNEL_ID"; title = "📝 Community Feedback"; body = interaction.options.getString("message", true); }
      return deliver(interaction, env, makeEmbed(title, safeText(body) + "\n\n**Submitted by:** " + interaction.user.tag));
    }
    if (name === "ask") {
      const q = interaction.options.getString("question", true).toLowerCase();
      let answer = "I don't know that yet. Try /gameinfo, /website, or /rules, or ask a staff member.";
      if (q.includes("website") || q.includes("link")) answer = "Official website: " + website;
      else if (q.includes("rsl") || q.includes("game")) answer = "RSL is Ventorea Studios' planned life-simulation game. Use /gameinfo for details.";
      else if (q.includes("rule")) answer = "Use /rules to read the community rules.";
      else if (q.includes("ventorea") || q.includes("studio")) answer = "Ventorea Studios is developing RSL. Visit " + website + " for updates.";
      return interaction.reply({ embeds: [makeEmbed("❓ Ask Ventorea", answer)], ephemeral: true });
    }
    if (name === "countdown") {
      const input = interaction.options.getString("target") || process.env.COUNTDOWN_TARGET;
      if (!input) return interaction.reply({ content: "Provide an ISO date, or configure COUNTDOWN_TARGET. Example: /countdown target:2027-01-01T00:00:00+02:00", ephemeral: true });
      const target = new Date(input);
      if (Number.isNaN(target.getTime())) return interaction.reply({ content: "Invalid date. Use ISO format, e.g. 2027-01-01T00:00:00+02:00.", ephemeral: true });
      const diff = target.getTime() - Date.now();
      return interaction.reply({ embeds: [makeEmbed("⏳ Countdown", diff <= 0 ? "That date has passed." : "Time remaining: **" + duration(diff) + "**\nTarget: <t:" + Math.floor(target.getTime()/1000) + ":F>")] });
    }
    if (name === "setup") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: "You need Manage Channels permission.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      let created = 0, skipped = 0;
      const guild = interaction.guild;
      for (const group of categories) {
        let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === group.name);
        const staffOnly = group.name.includes("STAFF ONLY");
        if (!category) {
          category = await guild.channels.create({ name: group.name, type: ChannelType.GuildCategory,
            ...(staffOnly ? { permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ] } : {}) });
          created++;
        }
        for (const [channelName, topic] of group.channels) {
          if (guild.channels.cache.find(c => c.parentId === category.id && c.name === channelName)) { skipped++; continue; }
          await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: category.id, topic,
            ...(staffOnly ? { permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
            ] } : {}) });
          created++;
        }
      }
      return interaction.editReply("Setup complete. Created **" + created + "** categories/channels and skipped **" + skipped + "** existing channels. Give your staff role access to the STAFF ONLY category in Discord settings.");
    }
    if (["kick","ban","timeout","clear","warn","warnings"].includes(name)) {
      const required = { kick: PermissionFlagsBits.KickMembers, ban: PermissionFlagsBits.BanMembers, timeout: PermissionFlagsBits.ModerateMembers, clear: PermissionFlagsBits.ManageMessages, warn: PermissionFlagsBits.ModerateMembers, warnings: PermissionFlagsBits.ModerateMembers }[name];
      if (!hasPermission(interaction, required)) return interaction.reply({ content: "You lack the required staff permission.", ephemeral: true });
      if (name === "clear") {
        const amount = interaction.options.getInteger("amount", true);
        const deleted = await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: "Deleted " + deleted.size + " messages. Discord skips messages older than 14 days.", ephemeral: true });
      }
      const user = interaction.options.getUser("member", true);
      const reason = interaction.options.getString("reason") || "Moderation action by " + interaction.user.tag;
      if (user.id === interaction.user.id || user.id === client.user.id) return interaction.reply({ content: "You cannot target yourself or the bot.", ephemeral: true });
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (name !== "ban" && !member) return interaction.reply({ content: "That user is not a current member.", ephemeral: true });
      if (member && interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) return interaction.reply({ content: "Your highest role must be above the target's highest role.", ephemeral: true });
      if (name === "kick") { await member.kick(reason); return interaction.reply({ content: "Kicked " + user.tag + ". Reason: " + reason }); }
      if (name === "ban") { await interaction.guild.members.ban(user.id, { reason }); return interaction.reply({ content: "Banned " + user.tag + ". Reason: " + reason }); }
      if (name === "timeout") {
        const minutes = interaction.options.getInteger("minutes", true);
        await member.timeout(minutes * 60000, reason);
        return interaction.reply({ content: "Timed out " + user.tag + " for " + minutes + " minutes." });
      }
      if (name === "warn") {
        const list = warnings.get(user.id) || [];
        list.push({ reason, moderator: interaction.user.tag, date: new Date().toISOString() });
        warnings.set(user.id, list);
        return interaction.reply({ embeds: [makeEmbed("⚠️ Warning Issued", "**Member:** " + user.tag + "\n**Reason:** " + reason + "\n**Warnings this session:** " + list.length, 0xFEE75C)] });
      }
      if (name === "warnings") {
        const list = warnings.get(user.id) || [];
        return interaction.reply({ embeds: [makeEmbed("⚠️ Warnings: " + user.tag, list.length ? list.map((w,i) => (i+1) + ". " + w.reason + " • " + w.moderator + " • " + w.date).join("\n") : "No warnings recorded during this bot session.")], ephemeral: true });
      }
    }
  } catch (error) {
    console.error("Command /" + name + " failed:", error);
    const reply = { content: "Something went wrong. Check the bot logs and Discord permissions.", ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
