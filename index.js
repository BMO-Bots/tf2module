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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildMember]
});

// Simple command prefix
const PREFIX = '?';

// Configurazione campanellina
const NOTIFY_ROLE_ID = process.env.NOTIFY_ROLE_ID ?? '1436392414318301225';
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID?.trim();

// Oggetto per tracciare i messaggi di votazione attivi
const voteMessages = {};

// Cache per il messaggio "pinnato" della campanellina
const toggleMessageCache = new Map();

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
    .setTitle('🗳️ Votazione Categoria Prossimo Contest Arte')
    .setDescription(description)
    .setTimestamp(new Date());
}

// Nessun ruolo richiesto

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot loggato come ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  // Gestione campanellina: se qualcuno scrive nel canale notifiche
  if (NOTIFY_CHANNEL_ID && message.channel.id === NOTIFY_CHANNEL_ID) {
    // Ignora se è il messaggio della campanellina stessa
    if (toggleMessageCache.get(message.channel.id) === message.id) return;
    if (message.components?.some(row => 
      row.components?.some(c => c.customId === 'toggle_notify_role')
    )) return;

    try {
      // Elimina il vecchio messaggio campanellina
      const oldMessageId = toggleMessageCache.get(message.channel.id);
      if (oldMessageId) {
        try {
          const oldMessage = await message.channel.messages.fetch(oldMessageId);
          await oldMessage.delete();
        } catch (error) {
          if (error.code !== 10008) console.warn('⚠️ Impossibile eliminare vecchio messaggio');
        }
      }

      // Crea nuovo messaggio campanellina
      const embed = new EmbedBuilder()
        .setDescription('Vuoi essere pingato anche tu quando un gioco è gratis? Clicca qui sotto 👇');

      const button = new ButtonBuilder()
        .setCustomId('toggle_notify_role')
        .setLabel('LIKE, ISCRIZIONE E CAMPANELLA')
        .setEmoji('🔔')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(button);

      const sentMessage = await message.channel.send({
        embeds: [embed],
        components: [row]
      });

      toggleMessageCache.set(message.channel.id, sentMessage.id);
    } catch (error) {
      console.error('❌ Errore campanellina:', error);
    }
  }

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

      const deleteBtn = new ButtonBuilder()
        .setCustomId('delete_vote_confirm')
        .setStyle(ButtonStyle.Danger)
        .setLabel('Ho sbagliato')
        .setEmoji('🗑️');

      const row = new ActionRowBuilder().addComponents(voteBtn, deleteBtn);

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

  if (cmd.toLowerCase() === 'mostravotazioni') {
    try {
      if (!message.inGuild?.() && !message.guild) return;

      reloadDatabase();

      if (Object.keys(db.votedUsers).length === 0) {
        await message.reply('📭 Nessun voto registrato ancora.');
        return;
      }

      // Raggruppa gli utenti per voto normalizzato
      const voteGroups = {};
      for (const [userId, eventName] of Object.entries(db.votedUsers)) {
        const normalized = normalizeVote(eventName);
        if (!voteGroups[normalized]) {
          voteGroups[normalized] = {
            displayName: eventName,
            users: []
          };
        }
        voteGroups[normalized].users.push(userId);
      }

      // Ordina per numero di voti
      const sortedGroups = Object.entries(voteGroups)
        .sort((a, b) => b[1].users.length - a[1].users.length);

      // Costruisci l'embed
      let description = '**🗳️ Dettaglio Completo Votazioni:**\n\n';

      for (const [normalized, data] of sortedGroups) {
        const count = data.users.length;
        description += `**${data.displayName}** - ${count} ${count === 1 ? 'voto' : 'voti'}\n`;
        
        // Aggiungi i tag degli utenti
        const userTags = data.users.map(userId => `<@${userId}>`).join(', ');
        description += `└─ ${userTags}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📊 Dettaglio Votazioni')
        .setDescription(description)
        .setTimestamp(new Date());

      await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
    } catch (err) {
      console.error(err);
      try { await message.delete(); } catch {}
      try { await message.reply('Errore durante la visualizzazione delle votazioni.'); } catch {}
    }
  }
});

// Handle button -> open modal
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Gestione pulsante campanellina
    if (interaction.isButton() && interaction.customId === 'toggle_notify_role') {
      // Validazione
      if (!interaction.guild || !interaction.member?.roles) {
        return interaction.reply({
          content: '❌ Questo pulsante funziona solo nei server.',
          ephemeral: true
        });
      }

      // Defer immediato per evitare timeout
      await interaction.deferReply({ ephemeral: true });

      const role = interaction.guild.roles.cache.get(NOTIFY_ROLE_ID);
      if (!role) {
        return interaction.editReply({
          content: '❌ Ruolo notifiche non trovato. Contatta un admin.'
        });
      }

      const hasRole = interaction.member.roles.cache.has(NOTIFY_ROLE_ID);

      try {
        if (hasRole) {
          await interaction.member.roles.remove(NOTIFY_ROLE_ID);
          await interaction.editReply({
            content: '🔕 Campanellina disattivata. Vergogna!'
          });
        } else {
          await interaction.member.roles.add(NOTIFY_ROLE_ID);
          await interaction.editReply({
            content: '🔔 Campanellina attivata! Smash the like button.'
          });
        }
      } catch (error) {
        console.error('❌ Errore gestione ruolo:', error);
        await interaction.editReply({
          content: '❌ Errore durante l\'aggiornamento del ruolo.'
        });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId === 'open_tf2_form') {
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
        .setTitle('Vota la prossima Categoria');

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
    }

    // Pulsante "Ho sbagliato" - chiede conferma
    if (interaction.isButton() && interaction.customId === 'delete_vote_confirm') {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'Questo comando può essere usato solo nel server.', ephemeral: true });
        return;
      }

      const userId = interaction.user.id;
      reloadDatabase();

      // Controlla se l'utente ha votato
      if (!db.votedUsers[userId]) {
        await interaction.reply({ content: '❌ Non hai ancora votato!', ephemeral: true });
        return;
      }

      const votedFor = db.votedUsers[userId];

      // Crea i pulsanti di conferma
      const yesBtn = new ButtonBuilder()
        .setCustomId('delete_vote_yes')
        .setStyle(ButtonStyle.Danger)
        .setLabel('Sì, elimina');

      const noBtn = new ButtonBuilder()
        .setCustomId('delete_vote_no')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('No, annulla');

      const row = new ActionRowBuilder().addComponents(yesBtn, noBtn);

      await interaction.reply({
        content: `🗑️ Vuoi eliminare il tuo voto per **${votedFor}**?`,
        components: [row],
        ephemeral: true
      });
      return;
    }

    // Conferma eliminazione voto - SÌ
    if (interaction.isButton() && interaction.customId === 'delete_vote_yes') {
      const userId = interaction.user.id;
      reloadDatabase();

      if (!db.votedUsers[userId]) {
        await interaction.update({ content: '❌ Non hai votato!', components: [] });
        return;
      }

      const votedFor = db.votedUsers[userId];
      const normalizedVote = normalizeVote(votedFor);

      // Rimuovi il voto
      if (db.votes[normalizedVote]) {
        db.votes[normalizedVote]--;
        if (db.votes[normalizedVote] <= 0) {
          delete db.votes[normalizedVote];
        }
      }
      delete db.votedUsers[userId];
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
              const deleteBtn = new ButtonBuilder()
                .setCustomId('delete_vote_confirm')
                .setStyle(ButtonStyle.Danger)
                .setLabel('Ho sbagliato')
                .setEmoji('🗑️');
              const row = new ActionRowBuilder().addComponents(voteBtn, deleteBtn);
              await msg.edit({ embeds: [embed], components: [row] });
            }
          }
        } catch (err) {
          console.error('Errore nell\'aggiornamento del messaggio di votazione:', err);
        }
      }

      await interaction.update({
        content: `✅ Voto per **${votedFor}** eliminato con successo!`,
        components: []
      });
      return;
    }

    // Conferma eliminazione voto - NO
    if (interaction.isButton() && interaction.customId === 'delete_vote_no') {
      await interaction.update({
        content: '❌ Operazione annullata.',
        components: []
      });
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
              const deleteBtn = new ButtonBuilder()
                .setCustomId('delete_vote_confirm')
                .setStyle(ButtonStyle.Danger)
                .setLabel('Ho sbagliato')
                .setEmoji('🗑️');
              const row = new ActionRowBuilder().addComponents(voteBtn, deleteBtn);
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
