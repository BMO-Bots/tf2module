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

  if (cmd.toLowerCase() === 'torneof3') {
    try {
      if (!message.inGuild?.() && !message.guild) return;

      const openBtn = new ButtonBuilder()
        .setCustomId('open_sf3_form')
        .setStyle(ButtonStyle.Success)
        .setLabel('Apri il form Street Fighter 3')
        .setEmoji('🥊');

      const row = new ActionRowBuilder().addComponents(openBtn);      await message.channel.send({ 
        content: 'Se non hai ore metti 0 e basta\n-# <:Pepolove:828227022903705611> Jesgran.ovh', 
        components: [row] 
      });
      await message.delete().catch(() => {});
    } catch (err) {
      console.error(err);
      try { await message.delete(); } catch {}
      try { await message.reply('Errore durante l\'invio del messaggio.'); } catch {}
    }
  }
});

// Handle button -> open modal
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === 'open_sf3_form') {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Questo comando può essere usato solo nel server.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('sf3_form_modal')
        .setTitle('Iscrizione Torneo Street Fighter 3');

      const playerName = new TextInputBuilder()
        .setCustomId('player_name')
        .setLabel('Nome giocatore')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Il tuo nome o nickname')
        .setRequired(true);

      const matchesPlayed = new TextInputBuilder()
        .setCustomId('matches_played')
        .setLabel('Quanti Match hai su Street Fighter 3?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es. 150, 300, 1000+')
        .setRequired(true);

      const fightcadeRank = new TextInputBuilder()
        .setCustomId('fightcade_rank')
        .setLabel('Che rango sei su Fightcade?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es. S, A, B, C, D, E')
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(playerName);
      const row2 = new ActionRowBuilder().addComponents(matchesPlayed);
      const row3 = new ActionRowBuilder().addComponents(fightcadeRank);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'sf3_form_modal') {
      const playerName = interaction.fields.getTextInputValue('player_name');
      const matchesPlayed = interaction.fields.getTextInputValue('matches_played');
      const fightcadeRank = interaction.fields.getTextInputValue('fightcade_rank');

      // Risposta immediata
      await interaction.reply({ content: 'Elaboro la tua iscrizione al torneo... ⏳', ephemeral: true });

      const channelId = process.env.SUBMIT_CHANNEL_ID;
      if (!channelId) {
        await interaction.editReply({ content: 'SUBMIT_CHANNEL_ID non configurato.' });
        return;
      }

      const submitChannel = await client.channels.fetch(channelId).catch(() => null);
      if (!submitChannel || !submitChannel.isTextBased()) {
        await interaction.editReply({ content: 'Canale di submit non valido.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF6B35) // Colore arancione per Street Fighter
        .setTitle('🥊 Nuova Iscrizione')
        .addFields(
          { name: '👤 Nome Giocatore', value: playerName, inline: true },
          { name: '🎮 Match Giocati', value: matchesPlayed, inline: true },
          { name: '🏆 Rango Fightcade', value: fightcadeRank, inline: true }
        )
        .setFooter({ text: 'puppa il culo' })
        .setTimestamp(new Date());

      await submitChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

      await interaction.editReply({ content: 'Iscrizione Street Fighter 3 inviata con successo! ✅🥊' });
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