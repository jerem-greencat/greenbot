// src/infrastructure/discord/events/interactionCreate.js

import {
    Events,
    AuditLogEvent,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} from 'discord.js';
import mongoose from 'mongoose';

const roleMessages = {
    bear: `'\n' + 
👤 <@{{id}}>
    
🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance.
    
🔓 Accès débloqué au QG des Bears.
`,
    wolf: `'\n' + 
👤 <@{{id}}>
    
🐺 Tu as prêté allégeance aux Wolfs.
Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.
    
🔓 Accès débloqué au camp des Wolfs.
`,
    neutre: `'\n' + 
👤 <@{{id}}>
    
🤝 Tu restes Neutre.
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.
`
};

export default async function onInteractionCreate(interaction) {
    // ─── Slash command "/create-role-button" ────────────────────────
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'create-role-button') {
            // Seuls les admins peuvent l’exécuter
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ Vous devez être administrateur pour utiliser cette commande.',
                    ephemeral: true
                });
            }
            
            // Construire les trois boutons exclusifs
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId('select_excl_Bear')
                .setLabel(process.env.BEAR_ROLE_NAME)
                .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                .setCustomId('select_excl_Wolf')
                .setLabel(process.env.WOLF_ROLE_NAME)
                .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                .setCustomId('select_excl_Neutral')
                .setLabel(process.env.NEUTRAL_ROLE_NAME)
                .setStyle(ButtonStyle.Primary),
            );
            
            // Envoyer le message dans le salon
            return interaction.reply({
                content: 'Choisissez le rôle souhaité :',
                components: [row]
            });
        }
        
        // Tu peux router d'autres commandes ici...
        return;
    }
    
    // ─── Clic sur un bouton ─────────────────────────────────────────
    if (!interaction.isButton()) return;
    
    // customId = "select_excl_Bear" ou "select_excl_Wolf" ou "select_excl_Neutral"
    const [ , , roleKey ] = interaction.customId.split('_'); // "Bear", "Wolf" ou "Neutral"
    const guild  = interaction.guild;
    const member = interaction.member;
    const db     = mongoose.connection.db;
    const coll   = db.collection(`server_${guild.id}`);
    
    // Récupérer l'objet Role désiré
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
    
    // ─── Qui a déclenché ? (pour ignorer le délai si admin) ──────────
    const audit = await guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 5
    });
    const entry = audit.entries.find(e => e.targetId === member.id);
    let executorIsAdmin = false;
    if (entry) {
        const exec = await guild.members.fetch(entry.executor.id).catch(() => null);
        executorIsAdmin = exec?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    }
    
    // ─── Récupérer la date du dernier changement exclusif ────────────
    const playerDoc = await coll.findOne(
        { _id: 'playersList', 'players.userId': member.id },
        { projection: { 'players.$': 1 } }
    );
    const player = playerDoc?.players?.[0] ?? {};
    const lastChange = player.lastExclusiveChange
    ? new Date(player.lastExclusiveChange)
    : new Date(0);
    
    // ─── Vérifier le délai de 48h (sauf admin) ────────────────────
    const now   = Date.now();
    const delay = 48 * 60 * 60 * 1000;
    if (!executorIsAdmin && (now - lastChange) < delay) {
        return interaction.reply({
            content: `🕒 Vous ne pouvez changer votre rôle exclusif qu'une fois toutes les 48 heures.\n` +
            `Dernière modif : ${lastChange.toLocaleString()}.`,
            ephemeral: true
        });
    }
    
    // ─── Retirer les autres rôles exclusifs du membre ───────────────
    const exclusiveNames = [
        process.env.BEAR_ROLE_NAME,
        process.env.WOLF_ROLE_NAME,
        process.env.NEUTRAL_ROLE_NAME
    ];
    const toRemove = guild.roles.cache
    .filter(r => exclusiveNames.includes(r.name) && r.id !== desiredRole.id)
    .map(r => r.id);
    if (toRemove.length) {
        await member.roles.remove(toRemove);
    }
    
    // ─── Ajouter le rôle désiré (s’il ne l’a pas déjà) ─────────────
    if (!member.roles.cache.has(desiredRole.id)) {
        await member.roles.add(desiredRole.id);
    }
    
    // ─── Refetch et mise à jour en base de données ─────────────────
    const updated = await member.fetch();
    const updatedRoleIds = updated.roles.cache.map(r => r.id);
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
    
    // ─── Envoyer le message adapté selon le rôle choisi ────────────
    let key = roleKey.toLowerCase();
    if (key === 'neutral') key = 'neutre';
    const template = roleMessages[key] ?? '✅ Votre rôle exclusif a été mis à jour.';
    const content  = template.replace('{{id}}', member.id);
    
    await interaction.reply({ content, ephemeral: false });
}


// import { Events } from "discord.js";
// import { assignRole } from "../../../apps/roles/roleManager.js";
// import { execute as createRoleButtonCommand } from "../commands/createRoleButton.js";

// export const interactionCreate = {
//     name: Events.InteractionCreate,
//     async execute(interaction) {
//         try {
//             // ➤ Gestion des commandes slash
//             if (interaction.isChatInputCommand()) {
//                 if (interaction.commandName === "create-role-button") {
//                     return await createRoleButtonCommand(interaction);
//                 }
//             }

//             // ➤ Gestion des boutons
//             if (interaction.isButton()) {
//                 const [prefix, selectedRole] = interaction.customId.split(":");

//                 if (prefix === "role") {
//                     return await assignRole(interaction, selectedRole);
//                 }
//             }

//         } catch (error) {
//             console.error("❌ Erreur dans interactionCreate :", error);

//             // Réponse de secours (si possible)
//             if (interaction.deferred || interaction.replied) {
//                 return interaction.followUp({
//                     content: "Une erreur est survenue.",
//                     ephemeral: true
//                 });
//             } else {
//                 return interaction.reply({
//                     content: "Une erreur est survenue.",
//                     ephemeral: true
//                 });
//             }
//         }
//     }
// };
