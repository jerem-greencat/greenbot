import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";
import { roleNameMap } from "../../domain/roles/roleMapping.js";

export async function assignRole(interaction, selectedRoleKey) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    
    // Map le nom simplifié vers le vrai nom
    const fullRoleName = roleNameMap[selectedRoleKey];
    
    if (!fullRoleName) {
        return interaction.reply({
            content: `Le rôle "${selectedRoleKey}" n'est pas reconnu.`,
            ephemeral: true
        });
    }
    
    const roleToAdd = guildRoles.find(r => r.name === fullRoleName);
    const rolesToRemove = getIncompatibleRoles(selectedRoleKey)
    .map(key => roleNameMap[key])
    .map(name => guildRoles.find(r => r.name === name));
    
    if (!roleToAdd) {
        return interaction.reply({
            content: `Le rôle "${fullRoleName}" est introuvable sur le serveur.`,
            ephemeral: true
        });
    }
    
    await member.roles.add(roleToAdd).catch(console.error);
    for (const r of rolesToRemove) {
        if (r) await member.roles.remove(r).catch(console.error);
    }
    
    return interaction.reply({
        content: `Tu es maintenant ${selectedRoleKey} !`,
        ephemeral: true
    });
}
