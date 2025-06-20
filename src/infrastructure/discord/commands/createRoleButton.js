import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";

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
    const selectedRole = interaction.options.getString("role");
    
    const button = new ButtonBuilder()
    .setCustomId(`role:${selectedRole}`)
    .setLabel(`Rejoindre ${selectedRole}`)
    .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await interaction.reply({ content: `Bouton créé pour le rôle ${selectedRole}`, components: [row] });
}
