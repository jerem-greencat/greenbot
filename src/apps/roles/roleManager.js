// import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

// const ROLE_NAMES = {
//     bear: "🐻🔴 Bear 🔴🐻",
//     wolf: "🐺🔵 Wolf 🔵🐺",
//     neutre: "⚪️ Neutre ⚪️"
// };

// const JOIN_MESSAGES = {
//     bear: `🐻 Tu as rejoint les Bears.
// La force brute, l'ordre et la domination sont ta voie.
// Organisé, implacable, tu avances avec ton clan pour écraser toute résistance.
    
// 🔓 Accès débloqué au QG des Bears. 
// Rassemble tes camarades.`,
    
//     wolf: `🐺 Tu as prêté allégeance aux Wolfs.
// Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.
    
// 🔓 Accès débloqué au camp des Wolfs. 
// Garde ta parole, protège les tiens.`,
    
//     neutre: `🤝 Tu restes Neutre.
// Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.`
// };

// export async function assignRole(interaction, selectedRole) {
//     const member = interaction.member;
//     const guildRoles = interaction.guild.roles.cache;
    
//     const roleToAdd = guildRoles.find(r => r.name.toLowerCase().includes(selectedRole));
//     const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
//         guildRoles.find(r => r.name.toLowerCase().includes(roleName))
//     );
    
//     if (!roleToAdd) {
//         console.warn(`❌ Aucun rôle trouvé pour "${selectedRole}"`);
        
//         if (!interaction.deferred && !interaction.replied) {
//             return interaction.reply({
//                 content: `Rôle "${selectedRole}" introuvable.`,
//                 ephemeral: true
//             });
//         } else {
//             return interaction.followUp({
//                 content: `Rôle "${selectedRole}" introuvable.`,
//                 ephemeral: true
//             });
//         }
//     }
    
    
//     await member.roles.add(roleToAdd).catch(console.error);
//     for (const r of rolesToRemove) {
//         if (r) await member.roles.remove(r).catch(console.error);
//     }
    
//     // ✅ On signale à Discord qu’on gère l’interaction sans modifier le bouton
//     await interaction.deferUpdate();
    
    const roleMessages = {
        bear:'\n' + `
        👤 <@${member.id}>
        
        🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance.


🔓 Accès débloqué au QG des Bears.

`,
        wolf:'\n' + `
        👤 <@${member.id}>
        
        🐺 Tu as prêté allégeance aux Wolfs.
Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.


🔓 Accès débloqué au camp des Wolfs.

`,
        neutre: '\n' +`
        👤 <@${member.id}>
        
        🤝 Tu restes Neutre.
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.

`
    };
    
//     const message = roleMessages[selectedRole];
    
//     if (message) {
//         await interaction.channel.send({ content: message });
//     }
    
//     // Mise à jour dynamique du message de répartition des rôles
//     const channel = interaction.channel;
    
//     // Récupère les derniers messages du canal pour trouver celui d'aperçu
//     const messages = await channel.messages.fetch({ limit: 10 });
//     const previewMessage = messages.find(msg =>
//         msg.author.id === interaction.client.user.id &&
//         msg.content.startsWith("**Répartition actuelle des rôles :**")
//     );
    
//     if (previewMessage) {
//         // Recompter les membres pour chaque rôle
//         const guild = interaction.guild;
//         await guild.members.fetch(); // Assure qu'on a tous les membres
        
//         const counts = {
//             bear: guild.members.cache.filter(m => m.roles.cache.some(r => r.name.toLowerCase().includes("bear"))).size,
//             wolf: guild.members.cache.filter(m => m.roles.cache.some(r => r.name.toLowerCase().includes("wolf"))).size,
//             neutre: guild.members.cache.filter(m => m.roles.cache.some(r => r.name.toLowerCase().includes("neutre"))).size,
//         };
        
//         const updatedContent = `**Répartition actuelle des rôles :**
        
//         🐻 Bear : ${counts.bear}
//         🐺 Wolf : ${counts.wolf}
//         ⚪️ Neutre : ${counts.neutre}
        
//         `;
        
//         await previewMessage.edit({ content: updatedContent });
//     } else {
//         console.warn("🔍 Aucun message de répartition trouvé à mettre à jour.");
//     }
    
// }

