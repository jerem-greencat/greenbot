import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

// Associe chaque rôle à son emoji
const roleEmojis = {
    bear: "🐻",
    wolf: "🐺",
    neutre: "🤝",
};

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
Libre de tes mouvements, libre de tes alliances... mais aussi seul face au chaos. Pas de clan, pas de protection. Juste toi, et ton instinct.`,
};

export async function assignRole(interaction, selectedRole) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    
    const roleToAdd = guildRoles.find(r => r.name.toLowerCase().includes(selectedRole));
    const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
        guildRoles.find(r => r.name.toLowerCase().includes(roleName))
    );
    
    if (!roleToAdd) {
        return interaction.reply({
            content: `Rôle "${selectedRole}" introuvable.`,
            ephemeral: true,
        });
    }
    
    // Ajoute et retire les rôles
    await member.roles.add(roleToAdd).catch(console.error);
    for (const r of rolesToRemove) {
        if (r) await member.roles.remove(r).catch(console.error);
    }
    
    // 📌 Ajouter la réaction correspondante au message du bouton
    const emoji = roleEmojis[selectedRole];
    const message = interaction.message;
    
    if (message && emoji) {
        try {
            // Ajoute la réaction
            await message.react(emoji);
            
            // Supprime les réactions des autres rôles incompatibles
            const incompatible = getIncompatibleRoles(selectedRole);
            for (const r of incompatible) {
                const wrongEmoji = roleEmojis[r];
                if (wrongEmoji) {
                    const userReactions = message.reactions.cache.get(wrongEmoji);
                    if (userReactions) {
                        await userReactions.users.remove(member.user.id).catch(() => {});
                    }
                }
            }
        } catch (err) {
            console.error("Erreur lors de l'ajout/retrait de réactions :", err);
        }
    }
    
    // 📣 Message visible à tous
    const user = interaction.user;
    return interaction.reply({
        content: `${user} ${roleMessages[selectedRole]}`,
        ephemeral: false,
    });
}
