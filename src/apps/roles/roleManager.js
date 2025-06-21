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

export async function assignRole(interaction, selectedRole) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    
    const roleToAdd = guildRoles.find(r => r.name.toLowerCase().includes(selectedRole));
    const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
        guildRoles.find(r => r.name.toLowerCase().includes(roleName))
    );
    
    if (!roleToAdd) {
        console.warn(`❌ Aucun rôle trouvé pour "${selectedRole}"`);
        
        if (!interaction.deferred && !interaction.replied) {
            return interaction.reply({
                content: `Rôle "${selectedRole}" introuvable.`,
                ephemeral: true
            });
        } else {
            return interaction.followUp({
                content: `Rôle "${selectedRole}" introuvable.`,
                ephemeral: true
            });
        }
    }
    
    
    await member.roles.add(roleToAdd).catch(console.error);
    for (const r of rolesToRemove) {
        if (r) await member.roles.remove(r).catch(console.error);
    }
    
    // ✅ On signale à Discord qu’on gère l’interaction sans modifier le bouton
    await interaction.deferUpdate();
    
    const roleMessages = {
        bear: `👤 <@${member.id}>\n🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance. 
🔓 Accès débloqué au QG des Bears.`,
        wolf: `👤 <@${member.id}>\n🐺 Tu as prêté allégeance aux Wolfs.
Rusé, loyal et stratégique, tu défends l'équilibre et ton territoire sans vaciller. La meute veille... et riposte.
🔓 Accès débloqué au camp des Wolfs.`,
        neutre: `👤 <@${member.id}>\n🤝 Tu restes Neutre.
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.`
    };
    
    const message = roleMessages[selectedRole];
    
    if (message) {
        await interaction.channel.send({ content: message });
    }
}

