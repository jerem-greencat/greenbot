import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

export async function assignRole(interaction, selectedRole) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    
    const roleToAdd = guildRoles.find(r => r.name.toLowerCase().includes(selectedRole));

    const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
        guildRoles.find(r => r.name.toLowerCase() === roleName)
    );
    
    if (!roleToAdd) {
        return interaction.reply({
            content: `❌ Rôle "${selectedRole}" introuvable sur ce serveur.`,
            ephemeral: true
        });
    }
    
    // Accuse réception rapidement (obligatoire si traitement >3s)
    await interaction.deferReply({ ephemeral: true });
    
    try {
        await member.roles.add(roleToAdd);
        for (const role of rolesToRemove) {
            if (role) await member.roles.remove(role);
        }
        
        await interaction.editReply({
            content: `✅ Tu es maintenant **${selectedRole}** !`
        });
    } catch (error) {
        console.error("Erreur lors de l’attribution de rôle :", error);
        await interaction.editReply({
            content: `❌ Une erreur est survenue. Merci de réessayer plus tard.`
        });
    }
}
