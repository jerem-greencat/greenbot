// src/infrastructure/discord/events/interactionCreate.js
import { Events, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

//  ── Les messages de confirmation pour chaque rôle ───────────────
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
    // ── 1) Slash-command routing (e.g. /create-role-button) ───────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'create-role-button') {
        const { default: cmd } = await import('../commands/createRoleButton.js');
        return cmd.execute(interaction);
      }

            // 2️⃣ /set-report-channel
      if (interaction.commandName === 'set-report-channel') {
        const { default: cmd } = await import('../commands/setReportChannel.js');
        return cmd.execute(interaction);
      }
      return;
    }

    // ── 2) Ne traiter que les clics de bouton ─────────────────────
    if (!interaction.isButton()) return;

    const member = interaction.member; // GuildMember qui a cliqué
    const guild  = interaction.guild;
    const db     = mongoose.connection.db;
    const coll   = db.collection(`server_${guild.id}`);

    // ── 3) Repérer quel bouton (et donc quel rôle) a été cliqué ────
    // customId doit être "select_excl_Bear" / "select_excl_Wolf" / "select_excl_Neutral"
    const [, , roleKey] = interaction.customId.split('_'); 
    // Mapping Key → nom exact du rôle Discord
    const roleNameMap = {
      Bear:    process.env.BEAR_ROLE_NAME,
      Wolf:    process.env.WOLF_ROLE_NAME,
      Neutral: process.env.NEUTRAL_ROLE_NAME
    };
    const desiredName = roleNameMap[roleKey];
    if (!desiredName) {
      return interaction.reply({ content: '❌ Clé de rôle invalide.', ephemeral: true });
    }
    // On récupère l'objet Role par son nom
    const desiredRole = guild.roles.cache.find(r => r.name === desiredName);
    if (!desiredRole) {
      return interaction.reply({ content: `❌ Le rôle "${desiredName}" est introuvable.`, ephemeral: true });
    }

    // ── 4) Check si c'est un admin (dans ce cas on BYPASSE le délai) ─
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    // ── 5) Récupérer la date du dernier changement exclusif en base ───
    const doc = await coll.findOne(
      { _id: 'playersList', 'players.userId': member.id },
      { projection: { 'players.$': 1 } }
    );
    const player = doc?.players?.[0] || {};
    const lastChange = player.lastExclusiveChange 
      ? new Date(player.lastExclusiveChange) 
      : new Date(0);

    // ── 6) Si pas admin ET délai < 48 h alors on refuse et on quitte ─
    const now   = Date.now();
    const delay = 48 * 60 * 60 * 1000;
    if (!isAdmin && (now - lastChange) < delay) {
      return interaction.reply({
        content: `🕒 Vous ne pouvez changer votre rôle exclusif qu'une fois toutes les 48 heures.\n` +
                 `Dernière modification : ${lastChange.toLocaleString()}.`,
        ephemeral: true
      });
    }

    // ── 7) Retirer **uniquement** les deux autres rôles exclusifs ────
    const exclusiveNames = Object.values(roleNameMap); // [ '🐻...','🐺...', '⚪️...' ]
    const rolesToRemove = member.roles.cache
      .filter(r => exclusiveNames.includes(r.name) && r.id !== desiredRole.id)
      .map(r => r.id);
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
    }

    // ── 8) Ajouter le rôle choisi (si pas déjà présent) ─────────────
    if (!member.roles.cache.has(desiredRole.id)) {
      await member.roles.add(desiredRole.id);
    }

    // ── 9) Refetch pour mettre à jour le cache, puis enregistrer en DB ─
    const updated   = await member.fetch();
    const roleIds   = updated.roles.cache
      .filter(r => r.id !== guild.id) // on retire @everyone
      .map(r => r.id);

    await coll.updateOne(
      { _id: 'playersList' },
      {
        $set: {
          'players.$[p].roles':               roleIds,
          'players.$[p].lastExclusiveChange': new Date()
        }
      },
      { arrayFilters: [{ 'p.userId': member.id }] }
    );

    // ── 🔟 Envoyer le message de confirmation adapté ───────────────
    let key = roleKey.toLowerCase();
    if (key === 'neutral') key = 'neutre';
    const template = roleMessages[key] ?? '✅ Votre rôle exclusif a été mis à jour.';
    const content  = template.replace('{{id}}', member.id);

    return interaction.reply({ content, ephemeral: false });

  } catch (err) {
    console.error('Erreur dans interactionCreate:', err);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Une erreur est survenue.' });
    } else {
      return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  }
}
