# Ventorea Studios Discord Bot

Node.js 20+ and discord.js v14 starter bot.

## Commands
- General: /ping, /help, /website, /rules, /serverinfo, /userinfo, /membercount, /botinfo
- Community: /poll, /suggest, /reportbug, /feedback, /ask, /countdown
- Ventorea and RSL: /gameinfo, /devlog
- Staff: /setup, /announce, /kick, /ban, /timeout, /clear, /warn, /warnings

## Install and run
1. Install Node.js 20 or newer.
2. Create an application and bot in the Discord Developer Portal.
3. Invite the bot with bot and applications.commands scopes.
4. Copy .env.example to .env and fill in the token, application ID, and test server ID. Never commit or share .env.
5. From this folder, run npm install.
6. Register commands with npm run register.
7. Start the bot with npm start.

Grant only required permissions: View Channels, Send Messages, Embed Links, Add Reactions, Read Message History, Manage Channels, Kick Members, Ban Members, Moderate Members, and Manage Messages.

## Notes
- Run as a persistent Node.js process. A normal Vercel serverless website function is not a persistent Discord Gateway process.
- /setup creates categories/channels and skips matching existing channels. It hides STAFF ONLY from @everyone. Grant your staff role access to that category in Discord after setup.
- Moderation commands check Discord permissions and role hierarchy.
- /warn and /warnings use in-memory storage in this starter version. Warnings disappear after restart. Add Supabase/Postgres before relying on warning history.
- Set optional channel IDs in .env to route announcements, suggestions, bug reports, feedback, and devlogs. Without a configured channel, submissions are returned privately to the command user.
- /ask uses a built-in FAQ, not an AI model.
- Test in a private Discord server before using in your main community.
