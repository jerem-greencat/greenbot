import { Events } from "discord.js";
import { assignRole } from "../../services/roleManager.js";
import { execute as createRoleButtonCommand } from "../commands/createRoleButton.js";

export const interactionCreate = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // ➤ Gestion des commandes slash
            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === "create-role-button") {
                    return await createRoleButtonCommand(interaction);
                }
            }
            
            // ➤ Gestion des boutons
            if (interaction.isButton()) {
                const [prefix, selectedRole] = interaction.customId.split(":");
                
                if (prefix === "role") {
                    return await assignRole(interaction, selectedRole);
                }
            }
            
        } catch (error) {
            console.error("❌ Erreur dans interactionCreate :", error);
            
            // Réponse de secours (si possible)
            if (interaction.deferred || interaction.replied) {
                return interaction.followUp({
                    content: "Une erreur est survenue.",
                    ephemeral: true
                });
            } else {
                return interaction.reply({
                    content: "Une erreur est survenue.",
                    ephemeral: true
                });
            }
        }
    }
};
