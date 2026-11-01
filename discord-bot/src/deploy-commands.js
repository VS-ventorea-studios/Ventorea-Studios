import "dotenv/config";
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency."),
  new SlashCommandBuilder().setName("help").setDescription("Show all commands by category."),
  new SlashCommandBuilder().setName("rules").setDescription("Display community rules."),
  new SlashCommandBuilder().setName("website").setDescription("Show the official website."),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server information."),
  new SlashCommandBuilder().setName("userinfo").setDescription("Show member information.")
    .addUserOption(o => o.setName("member").setDescription("Member to inspect").setRequired(false)),
  new SlashCommandBuilder().setName("membercount").setDescription("Show the member count."),
  new SlashCommandBuilder().setName("botinfo").setDescription("Show bot uptime and version."),
  new SlashCommandBuilder().setName("gameinfo").setDescription("Show information about RSL."),
  new SlashCommandBuilder().setName("devlog").setDescription("Post a development update.")
    .addStringOption(o => o.setName("title").setDescription("Update title").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("details").setDescription("Update details").setRequired(true).setMaxLength(3500)),
  new SlashCommandBuilder().setName("announce").setDescription("Post an announcement.")
    .addStringOption(o => o.setName("title").setDescription("Announcement title").setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true).setMaxLength(3500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName("poll").setDescription("Create a reaction poll.")
    .addStringOption(o => o.setName("question").setDescription("Poll question").setRequired(true).setMaxLength(250))
    .addStringOption(o => o.setName("option1").setDescription("First option").setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName("option2").setDescription("Second option").setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName("option3").setDescription("Optional third option").setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName("option4").setDescription("Optional fourth option").setRequired(false).setMaxLength(80)),
  new SlashCommandBuilder().setName("suggest").setDescription("Submit a suggestion.")
    .addStringOption(o => o.setName("idea").setDescription("Your idea").setRequired(true).setMaxLength(1800)),
  new SlashCommandBuilder().setName("reportbug").setDescription("Report a bug.")
    .addStringOption(o => o.setName("title").setDescription("Bug title").setRequired(true).setMaxLength(120))
    .addStringOption(o => o.setName("details").setDescription("Bug details").setRequired(true).setMaxLength(1800)),
  new SlashCommandBuilder().setName("feedback").setDescription("Send feedback.")
    .addStringOption(o => o.setName("message").setDescription("Feedback").setRequired(true).setMaxLength(1800)),
  new SlashCommandBuilder().setName("ask").setDescription("Ask about Ventorea or RSL.")
    .addStringOption(o => o.setName("question").setDescription("Your question").setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName("countdown").setDescription("Show time remaining until a date.")
    .addStringOption(o => o.setName("target").setDescription("ISO date, e.g. 2027-01-01T00:00:00+02:00").setRequired(false)),
  new SlashCommandBuilder().setName("setup").setDescription("Create Ventorea categories and channels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member.")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member.")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member for up to 28 days.")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName("clear").setDescription("Delete 1 to 100 recent messages.")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages").setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member.")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName("warnings").setDescription("View warnings recorded this session.")
    .addUserOption(o => o.setName("member").setDescription("Member").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
].map(command => command.toJSON());

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  throw new Error("Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID in .env.");
}
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
console.log("Registered " + commands.length + " Ventorea slash commands.");
