'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const http = require('http');
const PORT = process.env.PORT || 3000;

// Server HTTP per uptime checks
http.createServer((req, res) => {
  const ok = 'ok';
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  if (req.url === '/health') return res.end(ok);
  return res.end('bot ' + ok);
}).listen(PORT, () => console.log(`Uptime HTTP server listening on :${PORT}`));

// Setup client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

// Simple command prefix
const PREFIX = '?';

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot loggato come ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd] = message.content.slice(PREFIX.length).trim().split(/\s+/);

  if (cmd.toLowerCase() === 'torneotf2') {
    try {
      const openBtn = new ButtonBuilder()
        .setCustomId('open_tf2_form')
        .setStyle(ButtonStyle.Success)
        .setLabel('Apri il form TF2');

      const row = new ActionRowBuilder().addComponents(openBtn);

      // Invia solo il tasto con il testo richiesto
      await message.channel.send({ content: '-# <:ChillPoldo:1311760332695408640>  jesgran.ovh', components: [row] });

      await message.react('✅');
    } catch (err) {
      console.error(err);
      await message.reply('Errore durante l\'invio del messaggio.');
    }
  }
});

// Handle button -> open modal
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === 'open_tf2_form') {
      const modal = new ModalBuilder()
        .setCustomId('tf2_form_modal')
        .setTitle('Iscrizione Torneo TF2');

      const steamName = new TextInputBuilder()
        .setCustomId('steam_name')
        .setLabel('Nome Steam')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Il tuo nome su Steam')
        .setRequired(true);

      const hours = new TextInputBuilder()
        .setCustomId('hours_played')
        .setLabel('Ore giocate in TF2')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es. 500')
        .setRequired(true);

      const mainClass = new TextInputBuilder()
        .setCustomId('main_class')
        .setLabel('Main (classe principale)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Scout, Soldier, Pyro, ...')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(steamName);
      const row2 = new ActionRowBuilder().addComponents(hours);
      const row3 = new ActionRowBuilder().addComponents(mainClass);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'tf2_form_modal') {
      const steamName = interaction.fields.getTextInputValue('steam_name');
      const hours = interaction.fields.getTextInputValue('hours_played');
      const mainClass = interaction.fields.getTextInputValue('main_class');

      const channelId = process.env.SUBMIT_CHANNEL_ID;
      if (!channelId) {
        await interaction.reply({ content: 'SUBMIT_CHANNEL_ID non configurato.', ephemeral: true });
        return;
      }

      const submitChannel = await client.channels.fetch(channelId).catch(() => null);
      if (!submitChannel || !submitChannel.isTextBased()) {
        await interaction.reply({ content: 'Canale di submit non valido.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Nuova iscrizione TF2')
        .setColor(0x2b2d31)
        .addFields(
          { name: 'Utente', value: `<@${interaction.user.id}>`, inline: false },
          { name: 'Nome Steam', value: steamName, inline: true },
          { name: 'Ore giocate', value: hours, inline: true },
          { name: 'Main', value: mainClass, inline: true },
        )
        .setTimestamp(new Date());

      await submitChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

      await interaction.reply({ content: 'Iscrizione inviata! ✅', ephemeral: true });
      return;
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      try { await interaction.reply({ content: 'Si è verificato un errore.', ephemeral: true }); } catch {}
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
