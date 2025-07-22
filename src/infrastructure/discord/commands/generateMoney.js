import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    UserSelectMenuBuilder
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
    .setName('generate-money')
    .setDescription('Ajoute de l’argent au compte d’un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // 1️⃣ Proposer la sélection d’un membre via un User Select Menu
        const row = new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
            .setCustomId('genmoney_select_user')
            .setPlaceholder('Sélectionnez un membre')
            .setMinValues(1)
            .setMaxValues(1)
        );
        await interaction.reply({
            content: '🏦 À quel membre souhaitez-vous ajouter de l’argent ?',
            components: [row],
            ephemeral: true
        });
    },
};
