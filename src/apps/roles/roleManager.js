import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

const ROLE_NAMES = {
    bear: "🐻🔴 Bear 🔴🐻",
    wolf: "🐺🔵 Wolf 🔵🐺",
    neutre: "⚪️ Neutre ⚪️"
};

const JOIN_MESSAGES = {
    bear: `🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance.
    
🔓 Accès débloqué au QG des Bears. 
Rassemble tes camarades.`,
    
    wolf: `🐺 Tu as prêté allégeance aux Wolfs.
Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.
    
🔓 Accès débloqué au camp des Wolfs. 
Garde ta parole, protège les tiens.`,
    
    neutre: `🤝 Tu restes Neutre.
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.`
};

export async function assignRole(interaction, selectedKey) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    const roleName = ROLE_NAMES[selectedKey];
    const roleToAdd = guildRoles.find(r => r.name === roleName);
    
    if (!roleToAdd) {
        return interaction.reply({ content: `Rôle "${selectedKey}" introuvable.`, ephemeral: true });
    }
    
    const incompatible = getIncompatibleRoles(selectedKey);
    const rolesToRemove = incompatible.map(key => {
        const name = ROLE_NAMES[key];
        return guildRoles.find(r => r.name === name);
    }).filter(Boolean);
    
    await member.roles.add(roleToAdd).catch(console.error);
    for (const r of rolesToRemove) {
        await member.roles.remove(r).catch(console.error);
    }
    
    // Supprime l'ancien message de l'utilisateur si possible
    const reply = `${interaction.user} ${JOIN_MESSAGES[selectedKey]}`;
    await interaction.channel.send(reply);
    
    // Met à jour le message d'aperçu
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const statsMessage = messages.find(m => m.author.id === interaction.client.user.id && m.content.startsWith("**Répartition actuelle des rôles :**"));
    if (statsMessage) {
        const counts = {
            bear: interaction.guild.members.cache.filter(m => m.roles.cache.some(r => r.name === ROLE_NAMES.bear)).size,
            wolf: interaction.guild.members.cache.filter(m => m.roles.cache.some(r => r.name === ROLE_NAMES.wolf)).size,
            neutre: interaction.guild.members.cache.filter(m => m.roles.cache.some(r => r.name === ROLE_NAMES.neutre)).size,
        };
        
        await statsMessage.edit(
            `**Répartition actuelle des rôles :**\n🐻 Bear : ${counts.bear}\n🐺 Wolf : ${counts.wolf}\n⚪️ Neutre : ${counts.neutre}`
        );
    }
}
