// src/infrastructure/discord/commands/removeMoney.js

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
    .setName('remove-money')
    .setDescription("Déduit tout ou partie de l’argent d’un utilisateur (admin only)")
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le membre ciblé')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const target = interaction.options.getUser('member', true);
        
        // 1️⃣ Affiche deux boutons : Tout / Personnalisé
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
            .setCustomId(`remove_all_${target.id}`)
            .setLabel('Tout retirer')
            .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
            .setCustomId(`remove_custom_${target.id}`)
            .setLabel('Montant précis')
            .setStyle(ButtonStyle.Primary),
        );
        
        return interaction.reply({
            content: `📤 Retrait pour <@${target.id}> : choisissez “Tout retirer” ou “Montant précis”.`,
            components: [row],
            ephemeral: true
        });
    },
};
