// src/infrastructure/discord/events/interactionCreate.js

import {
  Events,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder
} from 'discord.js';
import mongoose from 'mongoose';

// ── Messages de confirmation pour les rôles exclusifs ───────────
const roleMessages = {
  bear: `
👤 <@{{id}}>

🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance.

🔓 Accès débloqué au QG des Bears.
`,
  wolf: `
👤 <@{{id}}>

🐺 Tu as prêté allégeance aux Wolfs.
Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.

🔓 Accès débloqué au camp des Wolfs.
`,
  neutre: `
👤 <@{{id}}>

🤝 Tu restes Neutre.
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.
`
};

export default async function onInteractionCreate(interaction) {
  try {
    // ── 1) Slash-command routing ─────────────────────────────────
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'create-role-button': {
          const { default: cmd } = await import('../commands/createRoleButton.js');
          return cmd.execute(interaction);
        }
        case 'set-report-channel': {
          const { default: cmd } = await import('../commands/setReportChannel.js');
          return cmd.execute(interaction);
        }
        case 'add-money': {
          const { default: cmd } = await import('../commands/addMoney.js');
          return cmd.execute(interaction);
        }
        case 'check-money': {
          const { default: cmd } = await import('../commands/checkMoney.js');
          return cmd.execute(interaction);
        }
        case 'pay-user': {
          const { default: cmd } = await import('../commands/payUser.js');
          return cmd.execute(interaction);
        }
        case 'remove-money': {
          const { default: cmd } = await import('../commands/removeMoney.js');
          return cmd.execute(interaction);
        }
        default:
          return;
      }
    }

    // ── 2) Boutons Remove-Money ───────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('remove_')) {
      const [ , type, userId ] = interaction.customId.split('_');
      const db   = mongoose.connection.db;
      const coll = db.collection(`server_${interaction.guild.id}`);

      // Tout remettre à zéro
      if (type === 'all') {
        await coll.updateOne(
          { _id: 'playersList', 'players.userId': userId },
          { $set: { 'players.$.money': 0 } }
        );
        return interaction.reply({
          content: `✅ Solde de <@${userId}> remis à 0.`,
          ephemeral: true
        });
      }

      // Montant personnalisé : ouvrir un modal
      if (type === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId(`remove_modal_${userId}`)
          .setTitle('Montant à déduire');

        const input = new TextInputBuilder()
          .setCustomId('amount_input')
          .setLabel('Montant à déduire')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Entrez un nombre entier')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    // ── 3) ModalSubmit Remove-Money ───────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('remove_modal_')) {
      const userId = interaction.customId.split('_')[2];
      const raw    = interaction.fields.getTextInputValue('amount_input');
      const amount = parseInt(raw, 10);

      if (isNaN(amount) || amount < 1) {
        return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
      }

      const db   = mongoose.connection.db;
      const coll = db.collection(`server_${interaction.guild.id}`);
      const doc  = await coll.findOne(
        { _id: 'playersList', 'players.userId': userId },
        { projection: { 'players.$': 1 } }
      );
      const entry = doc?.players?.[0];
      if (!entry) {
        return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });
      }
      if (entry.money < amount) {
        return interaction.reply({
          content: `❌ Solde insuffisant (${entry.money}).`,
          ephemeral: true
        });
      }

      await coll.updateOne(
        { _id: 'playersList', 'players.userId': userId },
        { $inc: { 'players.$.money': -amount } }
      );
      return interaction.reply({
        content: `✅ ${amount} crédits retirés de <@${userId}>.`,
        ephemeral: true
      });
    }

    // ── 4) Gestion des boutons exclusifs ──────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('select_excl_')) {
      const member = interaction.member;
      const guild  = interaction.guild;
      const db     = mongoose.connection.db;
      const coll   = db.collection(`server_${guild.id}`);

      const [, , roleKey] = interaction.customId.split('_'); // Bear, Wolf, Neutral
      const roleNameMap = {
        Bear:    process.env.BEAR_ROLE_NAME,
        Wolf:    process.env.WOLF_ROLE_NAME,
        Neutral: process.env.NEUTRAL_ROLE_NAME
      };
      const desiredName = roleNameMap[roleKey];
      if (!desiredName) {
        return interaction.reply({ content: '❌ Clé de rôle invalide.', ephemeral: true });
      }
      const desiredRole = guild.roles.cache.find(r => r.name === desiredName);
      if (!desiredRole) {
        return interaction.reply({ content: `❌ Rôle "${desiredName}" introuvable.`, ephemeral: true });
      }

      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
      const doc     = await coll.findOne(
        { _id: 'playersList', 'players.userId': member.id },
        { projection: { 'players.$': 1 } }
      );
      const player      = doc?.players?.[0] || {};
      const lastChange  = player.lastExclusiveChange ? new Date(player.lastExclusiveChange) : new Date(0);
      const now         = Date.now();
      const delay       = 48 * 60 * 60 * 1000;
      if (!isAdmin && (now - lastChange) < delay) {
        return interaction.reply({
          content: `🕒 Vous ne pouvez changer votre rôle exclusif qu'une fois toutes les 48 h.\nDernière modif : ${lastChange.toLocaleString()}.`,
          ephemeral: true
        });
      }

      // Retirer les autres exclusifs
      const exclusiveNames = Object.values(roleNameMap);
      const toRemove = member.roles.cache
        .filter(r => exclusiveNames.includes(r.name) && r.id !== desiredRole.id)
        .map(r => r.id);
      if (toRemove.length) await member.roles.remove(toRemove);

      // Ajouter le rôle choisi
      if (!member.roles.cache.has(desiredRole.id)) {
        await member.roles.add(desiredRole.id);
      }

      // Mettre à jour en base
      const updated = await member.fetch();
      const roleIds = updated.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => r.id);
      await coll.updateOne(
        { _id: 'playersList', 'players.userId': member.id },
        {
          $set: {
            'players.$.roles':               roleIds,
            'players.$.lastExclusiveChange': new Date()
          }
        },
        { arrayFilters: [{ 'p.userId': member.id }] }
      );

      let key = roleKey.toLowerCase();
      if (key === 'neutral') key = 'neutre';
      const template = roleMessages[key] ?? '✅ Votre rôle a été mis à jour.';
      const content  = template.replace('{{id}}', member.id);
      return interaction.reply({ content, ephemeral: false });
    }

  } catch (err) {
    console.error('Erreur dans interactionCreate:', err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Une erreur est survenue.' });
    }
    return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
  }
}
