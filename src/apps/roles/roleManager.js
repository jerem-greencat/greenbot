import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

const roleMessages = {
    bear: `🐻 Tu as rejoint les Bears.
La force brute, l'ordre et la domination sont ta voie.
Organisé, implacable, tu avances avec ton clan pour écraser toute résistance. 
Prépare toi à prendre ce qui te revient.
    
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
    
    const roleToAdd = guildRoles.find(r =>
        r.name.toLowerCase().includes(selectedRole)
    );
    
    if (!roleToAdd) {
        return interaction.reply({
            content: `❌ Rôle "${selectedRole}" introuvable.`,
            ephemeral: true,
        });
    }
    
    const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
        guildRoles.find(r => r.name.toLowerCase().includes(roleName))
    );
    
    try {
        await member.roles.add(roleToAdd);
        for (const r of rolesToRemove) {
            if (r) await member.roles.remove(r);
        }
        
        const message = `<@${interaction.user.id}>\n${roleMessages[selectedRole] || `✅ Tu es maintenant ${selectedRole}.`}`;
        
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: message, ephemeral: false });
        } else {
            await interaction.reply({ content: message, ephemeral: false });
        }
        
    } catch (err) {
        console.error("Erreur lors de l'attribution du rôle :", err);
        return interaction.reply({
            content: `❌ Une erreur est survenue lors de l'attribution du rôle.`,
            ephemeral: true,
        });
    }
}
