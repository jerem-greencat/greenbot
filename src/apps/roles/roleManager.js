import { getIncompatibleRoles } from "../../domain/roles/roleRules.js";

export async function assignRole(interaction, selectedRole) {
    const member = interaction.member;
    const guildRoles = interaction.guild.roles.cache;
    
    const roleToAdd = guildRoles.find(r => r.name.toLowerCase() === selectedRole);
    const rolesToRemove = getIncompatibleRoles(selectedRole).map(roleName =>
        guildRoles.find(r => r.name.toLowerCase() === roleName)
    );
    
    if (!roleToAdd) {
        return interaction.reply({ content: `Rôle "${selectedRole}" introuvable.`, ephemeral: true });
    }
    
    await member.roles.add(roleToAdd).catch(console.error);
    for (const r of rolesToRemove) {
        if (r) await member.roles.remove(r).catch(console.error);
    }
    
    return interaction.reply({ content: `Tu es maintenant ${selectedRole} !`, ephemeral: true });
}
