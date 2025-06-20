import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

export const data = new SlashCommandBuilder()
.setName("create-role-button")
.setDescription("Crée un ou plusieurs boutons pour que les utilisateurs choisissent un rôle")
.addStringOption(option =>
    option.setName("roles")
    .setDescription("Choisir un ou plusieurs rôles (séparés par une virgule)")
    .setRequired(true)
);

export async function execute(interaction) {
    const rolesInput = interaction.options.getString("roles"); // e.g. "wolf, bear"
    const roles = rolesInput.split(",").map(r => r.trim().toLowerCase());
    
    if (roles.length > 5) {
        return interaction.reply({
            content: "Tu ne peux créer que 5 boutons maximum à la fois.",
            ephemeral: true
        });
    }
    
    const buttons = roles.map(role =>
        new ButtonBuilder()
        .setCustomId(`role:${role}`)
        .setLabel(`Rejoindre ${role}`)
        .setStyle(ButtonStyle.Primary)
    );
    
    const row = new ActionRowBuilder().addComponents(...buttons);
    
    await interaction.reply({
        content: `Voici les boutons pour les rôles : ${roles.join(", ")}`,
        components: [row]
    });
}
