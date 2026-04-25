const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const APPLICATION_FORUM_CHANNEL_ID = process.env.APPLICATION_FORUM_CHANNEL_ID;

const WHITELIST_ROLE_ID = process.env.WHITELIST_ROLE_ID;
const PRE_WHITELIST_ROLE_ID = process.env.PRE_WHITELIST_ROLE_ID;
const STAFF_PING_ROLE_ID = process.env.STAFF_PING_ROLE_ID;

// 👇 RESPONSE CHANNEL DISABLED SAFELY
const RESPONSE_CHANNEL_ID = process.env.RESPONSE_CHANNEL_ID || null;

const TAGS = {
  whitelist: process.env.WHITELIST_TAG_ID,
  staff: process.env.STAFF_TAG_ID,
  review: process.env.NEEDS_REVIEW_TAG_ID
};

const counterFile = path.join(__dirname, 'application-counter.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

function getNextApplicationId() {
  let current = { lastId: 1000 };

  if (fs.existsSync(counterFile)) {
    current = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
  }

  current.lastId += 1;
  fs.writeFileSync(counterFile, JSON.stringify(current, null, 2));
  return current.lastId;
}

function clean(value) {
  return String(value || 'N/A').slice(0, 1000);
}

function makeButtons(appId, discordId, isStaff) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mh_accept:${appId}:${discordId}:${isStaff ? 'staff' : 'wl'}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mh_deny:${appId}:${discordId}:${isStaff ? 'staff' : 'wl'}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
  );
}

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [actionRaw, appId, discordId, type] = interaction.customId.split(':');
  const action = actionRaw.replace('mh_', '');
  const isStaff = type === 'staff';

  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId).catch(() => null);

    if (action === 'accept') {
      if (member && !isStaff) {
        await member.roles.add(WHITELIST_ROLE_ID).catch(() => {});
        if (PRE_WHITELIST_ROLE_ID) {
          await member.roles.remove(PRE_WHITELIST_ROLE_ID).catch(() => {});
        }
      }

      await interaction.editReply(`✅ Accepted application #${appId}`);
    }

    if (action === 'deny') {
      await interaction.editReply(`❌ Denied application #${appId}`);
    }

    // Disable buttons
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('done1').setLabel('Done').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    await interaction.message.edit({ components: [disabledRow] });

  } catch (err) {
    console.error(err);
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.post('/api/apply', async (req, res) => {
  try {
    const isStaff = req.body.applicationType === 'staff';
    const appId = getNextApplicationId();

    const forum = await client.channels.fetch(APPLICATION_FORUM_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle(`${isStaff ? '👥 Staff' : '📋 WL'} Application #${appId}`)
      .setColor(isStaff ? 0xf59e0b : 0x3b82f6)
      .setDescription('New application submitted')
      .addFields([
        { name: 'Discord', value: clean(req.body.discordName), inline: true },
        { name: 'ID', value: clean(req.body.discordId), inline: true },
        { name: 'Age', value: clean(req.body.age), inline: true }
      ]);

    await forum.threads.create({
      name: `Application #${appId}`,
      appliedTags: [
        isStaff ? TAGS.staff : TAGS.whitelist,
        TAGS.review
      ],
      message: {
        content: `<@&${STAFF_PING_ROLE_ID}> New application`,
        embeds: [embed],
        components: [makeButtons(appId, req.body.discordId, isStaff)]
      }
    });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  client.login(TOKEN);
  console.log(`MileHighV2 running: http://localhost:${PORT}`);
});