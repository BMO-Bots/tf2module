'use strict';
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const PORT = process.env.PORT || 3000;

// Percorso del database JSON
const DB_PATH = path.join(__dirname, 'database.json');

// Funzioni per gestire il database
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Errore lettura database:', err);
    return { votes: {}, votedUsers: {} };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Errore scrittura database:', err);
  }
}

// Variabile database (verrà ricaricata ogni volta)
let db = readDatabase();

// Funzione per ricaricare il database
function reloadDatabase() {
  db = readDatabase();
  return db;
}

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

// Oggetto per tracciare i messaggi di votazione attivi
const voteMessages = {};

// Funzione per normalizzare i voti (minuscole, senza accenti)
function normalizeVote(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Funzione per generare l'embed della classifica
function generateVoteEmbed() {
  reloadDatabase(); // Ricarica il database prima di generare l'embed
  const sortedVotes = Object.entries(db.votes)
    .map(([eventName, count]) => ({ eventName, count }))
    .sort((a, b) => b.count - a.count);

  let description = '**📊 Classifica Votazioni:**\n\n';

  if (sortedVotes.length === 0) {
    description += 'Nessun voto ancora. Inizia a votare!';
  } else {
    sortedVotes.forEach((vote, index) => {
      description += `${index + 1}. **${vote.eventName}** - ${vote.count} ${vote.count === 1 ? 'voto' : 'voti'}\n`;
    });
  }

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('🗳️ Votazione Prossimo Evento')
    .setDescription(description)
    .setTimestamp(new Date());
}

// Nessun ruolo richiesto

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot loggato come ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const [cmd] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (cmd.toLowerCase() === 'torneotf2') {
    try {
      // Consenti l'uso solo nel server
      if (!message.inGuild?.() && !message.guild) return;

      const openBtn = new ButtonBuilder()
        .setCustomId('open_tf2_form')
        .setStyle(ButtonStyle.Success)
        .setLabel('Apri il form TF2');

      const row = new ActionRowBuilder().addComponents(openBtn);

      // Invia solo il tasto con il testo richiesto
      await message.channel.send({ content: '-# <:ChillPoldo:1311760332695408640>  jesgran.ovh', components: [row] });

      // Cancella anche il messaggio del comando per evitare spam
      await message.delete().catch(() => {});

      await message.react('✅');
    } catch (err) {
      console.error(err);
      // Prova comunque a cancellare il comando se possibile
      try { await message.delete(); } catch {}
      try { await message.reply('Errore durante l\'invio del messaggio.'); } catch {}
    }
  }  if (cmd.toLowerCase() === 'votazione') {
    try {
      if (!message.inGuild?.() && !message.guild) return;

      const embed = generateVoteEmbed();

      const voteBtn = new ButtonBuilder()
        .setCustomId('open_vote_modal')
        .setStyle(ButtonStyle.Primary)
        .setLabel('🗳️ Vota');

      const row = new ActionRowBuilder().addComponents(voteBtn);

      const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });
      
      // Salva il messaggio per poterlo aggiornare
      voteMessages[sentMessage.id] = { channelId: message.channelId };
      
      await message.delete().catch(() => {});
    } catch (err) {
      console.error(err);
      try { await message.delete(); } catch {}
      try { await message.reply('Errore durante l\'invio della votazione.'); } catch {}
    }
  }

  if (cmd.toLowerCase() === 'votazionenulla') {
    try {
      if (!message.inGuild?.() && !message.guild) return;

      // Resetta il database
      db = { votes: {}, votedUsers: {} };
      writeDatabase(db);

      await message.reply('✅ Database votazioni resettato!');
      await message.react('✅');
    } catch (err) {
      console.error(err);
      try { await message.reply('Errore durante il reset del database.'); } catch {}
    }
  }
});

// Handle button -> open modal
client.on(Events.InteractionCreate, async (interaction) => {
  try {    if (interaction.isButton() && interaction.customId === 'open_tf2_form') {
      // Controllo che sia nel server prima di aprire il modal
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Questo comando può essere usato solo nel server.', ephemeral: true });
        return;
      }

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

    if (interaction.isButton() && interaction.customId === 'open_vote_modal') {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Questo comando può essere usato solo nel server.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('vote_modal')
        .setTitle('Vota il Prossimo Evento');

      const eventInput = new TextInputBuilder()
        .setCustomId('event_name')
        .setLabel('Nome dell\'Evento \ Gioco')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Es: TF2 buffed man gooning group')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(eventInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }    if (interaction.isModalSubmit() && interaction.customId === 'tf2_form_modal') {

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
        .setColor(0x2b2d31)
        .addFields(
          { name: 'Nome Steam', value: steamName, inline: false },
          { name: 'Ore giocate', value: hours, inline: false },
          { name: 'Main', value: mainClass, inline: false },
        )
        .setTimestamp(new Date());

      await submitChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

      await interaction.reply({ content: 'Iscrizione inviata! ✅', ephemeral: true });
      return;
    }    if (interaction.isModalSubmit() && interaction.customId === 'vote_modal') {
      const eventName = interaction.fields.getTextInputValue('event_name');
      const normalizedVote = normalizeVote(eventName);
      const userId = interaction.user.id;

      if (!normalizedVote) {
        await interaction.reply({ content: 'Per favore inserisci un nome valido.', ephemeral: true });
        return;
      }

      // Ricarica il database per avere i dati più recenti
      reloadDatabase();

      // Controlla se l'utente ha già votato
      if (db.votedUsers[userId]) {
        const previousVote = db.votedUsers[userId];
        await interaction.reply({ content: `❌ Hai già votato per: **${previousVote}**\nPuoi votare solo una volta!`, ephemeral: true });
        return;
      }

      // Registra il voto nel database
      db.votes[normalizedVote] = (db.votes[normalizedVote] || 0) + 1;
      db.votedUsers[userId] = eventName;
      writeDatabase(db);

      // Aggiorna tutti i messaggi di votazione
      for (const [messageId, messageInfo] of Object.entries(voteMessages)) {
        try {
          const channel = await client.channels.fetch(messageInfo.channelId);
          if (channel && channel.isTextBased()) {
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (msg) {
              const embed = generateVoteEmbed();
              const voteBtn = new ButtonBuilder()
                .setCustomId('open_vote_modal')
                .setStyle(ButtonStyle.Primary)
                .setLabel('🗳️ Vota');
              const row = new ActionRowBuilder().addComponents(voteBtn);
              await msg.edit({ embeds: [embed], components: [row] });
            }
          }
        } catch (err) {
          console.error('Errore nell\'aggiornamento del messaggio di votazione:', err);
        }
      }

      await interaction.reply({ content: `✅ Voto registrato per: **${eventName}**`, ephemeral: true });
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
