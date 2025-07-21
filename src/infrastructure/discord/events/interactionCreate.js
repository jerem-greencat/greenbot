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
        // 1️⃣ Slash-command routing (ex. /create-role-button)
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'create-role-button') {
                const { default: cmd } = await import('../commands/createRoleButton.js');
                return cmd.execute(interaction);
            }
            return;
        }
        
        // 2️⃣ Ne traiter que les boutons
        if (!interaction.isButton()) return;
        
        const btn    = interaction;
        const member = btn.member;
        const guild  = btn.guild;
        const db     = mongoose.connection.db;
        const coll   = db.collection(`server_${guild.id}`);
        
        // 3️⃣ Déterminer le rôle choisi
        const [, , roleKey] = btn.customId.split('_'); // Bear, Wolf ou Neutral
        const roleNameMap = {
            Bear:    process.env.BEAR_ROLE_NAME,
            Wolf:    process.env.WOLF_ROLE_NAME,
            Neutral: process.env.NEUTRAL_ROLE_NAME
        };
        const desiredName = roleNameMap[roleKey];
        const desiredRole = guild.roles.cache.find(r => r.name === desiredName);
        if (!desiredRole) {
            return btn.reply({ content: '❌ Rôle introuvable.', ephemeral: true });
        }
        
        // 4️⃣ Check admin pour bypass délai
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        
        // 5️⃣ Récupérer lastExclusiveChange en base
        const doc = await coll.findOne(
            { _id: 'playersList', 'players.userId': member.id },
            { projection: { 'players.$': 1 } }
        );
        const player = doc?.players?.[0] || {};
        const lastChange = player.lastExclusiveChange
        ? new Date(player.lastExclusiveChange)
        : new Date(0);
        
        // 6️⃣ Vérifier délai 48h si pas admin
        const now   = Date.now();
        const delay = 48 * 60 * 60 * 1000;
        if (!isAdmin && (now - lastChange) < delay) {
            return btn.reply({
                content: `🕒 Vous ne pouvez changer votre rôle exclusif qu'une fois toutes les 48 heures.\nDernière modif : ${lastChange.toLocaleString()}.`,
                ephemeral: true
            });
        }
        
        // 7️⃣ Retirer les autres rôles exclusifs
        const exclusive = Object.values(roleNameMap);
        const toRemove = guild.roles.cache
        .filter(r => exclusive.includes(r.name) && r.id !== desiredRole.id)
        .map(r => r.id);
        if (toRemove.length) await member.roles.remove(toRemove);
        
        // 8️⃣ Ajouter le rôle choisi
        if (!member.roles.cache.has(desiredRole.id)) {
            await member.roles.add(desiredRole.id);
        }
        
        // 9️⃣ Refetch + mise à jour en base
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
        
        // 🔟 Envoyer le message de confirmation
        let key = roleKey.toLowerCase();
        if (key === 'neutral') key = 'neutre';
        const tmpl   = roleMessages[key] ?? '✅ Votre rôle exclusif a été mis à jour.';
        const content = tmpl.replace('{{id}}', member.id);
        await btn.reply({ content, ephemeral: false });
        
    } catch (err) {
        console.error('Erreur dans interactionCreate:', err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: '❌ Une erreur est survenue.' });
        } else {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
}
