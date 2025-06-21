import {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";

const roles = [
    { value: "bear", label: "🐻 Bear", style: ButtonStyle.Secondary },
    { value: "wolf", label: "🐺 Wolf", style: ButtonStyle.Secondary },
    { value: "neutre", label: "⚪️ Neutre", style: ButtonStyle.Secondary }
];

export const data = new SlashCommandBuilder()
.setName("create-role-button")
.setDescription("Crée des boutons pour que les utilisateurs choisissent un rôle");

export async function execute(interaction) {
    const buttons = roles.map(role =>
        new ButtonBuilder()
        .setCustomId(`role:${role.value}`)
        .setLabel(role.label)
        .setStyle(role.style)
    );
    
    const row = new ActionRowBuilder().addComponents(buttons);
    const message = await interaction.reply({
        content: "Choisissez votre rôle :",
        components: [row],
        fetchReply: true,
    });
    
    // Aperçu initial
    await interaction.channel.send({
        content: "**Répartition actuelle des rôles :**\n🐻 Bear : 0\n🐺 Wolf : 0\n⚪️ Neutre : 0"
    });
}
