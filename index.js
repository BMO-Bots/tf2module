'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
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
// Nessun ruolo richiesto

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot loggato come ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd] = message.content.slice(PREFIX.length).trim().split(/\s+/);

  if (cmd.toLowerCase() === 'torneor6') {
    try {
      if (!message.inGuild?.() && !message.guild) return;

      const openBtn = new ButtonBuilder()
        .setCustomId('open_r6_form')
        .setStyle(ButtonStyle.Success)
        .setLabel('Apri il form R6');      const row = new ActionRowBuilder().addComponents(openBtn);

      await message.channel.send({ content: '-# <:Pepolove:828227022903705611> Jesgran.ovh', components: [row] });
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
  try {    if (interaction.isButton() && interaction.customId === 'open_r6_form') {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Questo comando può essere usato solo nel server.', ephemeral: true });
        return;
      }

      // Prima selezione della piattaforma
      const platformSelect = new StringSelectMenuBuilder()
        .setCustomId('platform_select')
        .setPlaceholder('Seleziona la tua piattaforma')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Personal Computer')
            .setValue('pc')
            .setEmoji('🤓'),
          new StringSelectMenuOptionBuilder()
            .setLabel('PlayStation')
            .setValue('ps')
            .setEmoji('📡'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Xbox')
            .setValue('xbox')
            .setEmoji('📦')
        );

      const row = new ActionRowBuilder().addComponents(platformSelect);

      await interaction.reply({
        content: 'Seleziona la tua piattaforma per continuare con l\'iscrizione:',
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'platform_select') {
      const selectedPlatform = interaction.values[0];
      
      const modal = new ModalBuilder()
        .setCustomId(`r6_form_modal_${selectedPlatform}`)
        .setTitle('Iscrizione Torneo R6');

      const r6Name = new TextInputBuilder()
        .setCustomId('r6_name')
        .setLabel('Nickname (Ubisoft)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Il tuo nickname in gioco')
        .setRequired(true);      const hours = new TextInputBuilder()
        .setCustomId('hours_played')
        .setLabel('Ore giocate (stima)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es. 1200')
        .setRequired(true);

      const favOp = new TextInputBuilder()
        .setCustomId('fav_op')
        .setLabel('Operatore preferito')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es. Iana / Jäger / Smoke')
        .setRequired(true);      const row1 = new ActionRowBuilder().addComponents(r6Name);
      const row2 = new ActionRowBuilder().addComponents(hours);
      const row3 = new ActionRowBuilder().addComponents(favOp);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
      return;
    }    if (interaction.isModalSubmit() && interaction.customId.startsWith('r6_form_modal_')) {
      const platform = interaction.customId.split('_').pop(); // Estrai piattaforma dal customId
      const r6Name = interaction.fields.getTextInputValue('r6_name');
      const hours = interaction.fields.getTextInputValue('hours_played');
      const favOp = interaction.fields.getTextInputValue('fav_op');

      // Risposta immediata
      await interaction.reply({ content: 'Elaboro la tua iscrizione... ⏳', ephemeral: true });

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

      // Converti nome piattaforma per display
      const platformDisplay = platform === 'pc' ? 'PC (Uplay)' : 
                            platform === 'ps' ? 'PlayStation' : 
                            platform === 'xbox' ? 'Xbox' : platform;      
        
        const embed = new EmbedBuilder()
        .setColor(0x0f4c81)
        .addFields(
          { name: 'Nickname', value: r6Name, inline: true },
          { name: 'Piattaforma', value: platformDisplay, inline: true },
          { name: 'Ore (stima)', value: hours, inline: true },
          { name: 'Operatore Preferito', value: favOp, inline: true }
        )
        .setTimestamp(new Date());

      await submitChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

      await interaction.editReply({ content: 'Iscrizione R6 inviata! ✅' });
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