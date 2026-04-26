const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 🔥 APPLICATION
app.post('/api/apply', async (req, res) => {
  try {
    const forum = await client.channels.fetch(process.env.APPLICATION_FORUM_CHANNEL_ID);

    const fields = Object.entries(req.body)
      .filter(([key, value]) => value && key !== 'applicationType')
      .map(([key, value]) => ({
        name: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        value: String(value),
        inline: false
      }));

    const embed = new EmbedBuilder()
      .setTitle(`Application from ${req.body.discordName}`)
      .setColor(0x3b82f6)
      .addFields(fields)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept:${req.body.discordId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny:${req.body.discordId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );

    await forum.send({
      content: `New application from <@${req.body.discordId}>`,
      embeds: [embed],
      components: [row]
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 BUTTON HANDLER
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, discordId] = interaction.customId.split(':');

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const member = await guild.members.fetch(discordId);

  if (action === 'accept') {
    await member.roles.add(process.env.WHITELIST_ROLE_ID);
    await member.roles.remove(process.env.PRE_WHITELIST_ROLE_ID);
    await interaction.reply({ content: 'Accepted ✅', ephemeral: true });
  }

  if (action === 'deny') {
    await interaction.reply({ content: 'Denied ❌', ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
});

app.listen(PORT, () => {
  client.login(process.env.DISCORD_TOKEN);
  console.log(`Server running on ${PORT}`);
});
