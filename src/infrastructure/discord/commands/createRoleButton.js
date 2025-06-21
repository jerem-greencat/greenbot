import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";
import { roleNameMap } from "../../../domain/roles/roleMapping.js";

export const data = new SlashCommandBuilder()
.setName("create-role-button")
.setDescription("Crée un bouton pour que les utilisateurs choisissent un rôle")
.addStringOption(option =>
    option.setName("role")
    .setDescription("Choisir le rôle à associer")
    .setRequired(true)
    .addChoices(
        { name: "Wolf", value: "wolf" },
        { name: "Neutre", value: "neutre" },
        { name: "Bear", value: "bear" }
    )
);

export async function execute(interaction) {
    const selectedRoleKey = interaction.options.getString("role");
    const fullRoleName = roleNameMap[selectedRoleKey];
    
    if (!fullRoleName) {
        return interaction.reply({
            content: `Le rôle "${selectedRoleKey}" est inconnu.`,
            ephemeral: true
        });
    }
    
    const button = new ButtonBuilder()
    .setCustomId(`role:${selectedRoleKey}`) // identifiant simple
    .setLabel(`Rejoindre ${fullRoleName}`)  // label avec emoji
    .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.reply({
        content: `Bouton créé pour le rôle ${fullRoleName}`,
        components: [row]
    });
}
