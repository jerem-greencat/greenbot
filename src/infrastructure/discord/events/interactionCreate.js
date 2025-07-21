// src/infrastructure/discord/events/interactionCreate.js

import { Events, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

// Messages de confirmation selon le rôle
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
        // ─── Slash-commands ────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'create-role-button') {
                const { default: cmd } = await import('../commands/createRoleButton.js');
                return cmd.execute(interaction);
            }
            return;
        }
        
        // ─── Seulement les clics de bouton ────────────────────────────
        if (!interaction.isButton()) return;
        const member = interaction.member;
        const guild  = interaction.guild;
        const db     = mongoose.connection.db;
        const coll   = db.collection(`server_${guild.id}`);
        
        // ─── Déterminer le rôle choisi via le customId ────────────────
        // customId = "select_excl_Bear" | "select_excl_Wolf" | "select_excl_Neutral"
        const [, , roleKey] = interaction.customId.split('_'); // Bear, Wolf ou Neutral
        const roleNameMap = {
            Bear:    process.env.BEAR_ROLE_NAME,
            Wolf:    process.env.WOLF_ROLE_NAME,
            Neutral: process.env.NEUTRAL_ROLE_NAME
        };
        const desiredName = roleNameMap[roleKey];
        const desiredRole = guild.roles.cache.find(r => r.name === desiredName);
        if (!desiredRole) {
            return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });
        }
        
        // ─── Check admin pour bypass délai 48 h ────────────────────────
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        
        // ─── Récupérer lastExclusiveChange en base ────────────────────
        const doc = await coll.findOne(
            { _id: 'playersList', 'players.userId': member.id },
            { projection: { 'players.$': 1 } }
        );
        const player = doc?.players?.[0] || {};
        const lastChange = player.lastExclusiveChange
        ? new Date(player.lastExclusiveChange)
        : new Date(0);
        
        // ─── Vérifier délai 48 h si pas admin ─────────────────────────
        const now   = Date.now();
        const delay = 48 * 60 * 60 * 1000;
        if (!isAdmin && (now - lastChange) < delay) {
            return interaction.reply({
                content: `🕒 Vous ne pouvez changer votre rôle exclusif qu'une fois toutes les 48 heures.\nDernière modif : ${lastChange.toLocaleString()}.`,
                ephemeral: true
            });
        }
        
        // ─── Retirer **uniquement** les deux autres rôles exclusifs ────
        const exclusiveNames = Object.values(roleNameMap);
        const toRemove = member.roles.cache
        .filter(r => exclusiveNames.includes(r.name) && r.id !== desiredRole.id)
        .map(r => r.id);
        if (toRemove.length) {
            await member.roles.remove(toRemove);
        }
        
        // ─── Ajouter le rôle choisi (s’il ne l’a pas déjà) ────────────
        if (!member.roles.cache.has(desiredRole.id)) {
            await member.roles.add(desiredRole.id);
        }
        
        // ─── Refetch et mise à jour en base ───────────────────────────
        const updated = await member.fetch();
        const updatedRoleIds = updated.roles.cache
        // retire @everyone si présent
        .filter(r => r.id !== guild.id)
        .map(r => r.id);
        
        await coll.updateOne(
            { _id: 'playersList' },
            {
                $set: {
                    'players.$[p].roles':               updatedRoleIds,
                    'players.$[p].lastExclusiveChange': new Date()
                }
            },
            { arrayFilters: [{ 'p.userId': member.id }] }
        );
        
        // ─── Envoyer le message de confirmation public ───────────────
        let key = roleKey.toLowerCase();
        if (key === 'neutral') key = 'neutre';
        const template = roleMessages[key] || '✅ Votre rôle exclusif a été mis à jour.';
        const content  = template.replace('{{id}}', member.id);
        
        await interaction.reply({ content, ephemeral: false });
    } catch (err) {
        console.error('Erreur dans interactionCreate:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Une erreur est survenue.' });
        } else {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
}
