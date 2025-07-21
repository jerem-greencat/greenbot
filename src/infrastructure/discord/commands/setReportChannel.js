import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('set-report-channel')
    .setDescription('Définit le salon où le bot publiera le rapport quotidien.')
    .addChannelOption(opt =>
        opt
        .setName('channel')
        .setDescription('Le salon de rapport (texte)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        if (!channel.isTextBased()) {
            return interaction.reply({
                content: '❌ Merci de choisir un salon texte.',
                ephemeral: true
            });
        }
        
        // Stocke en base dans la collection de la guilde
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${interaction.guildId}`);
        await coll.updateOne(
            { _id: 'config' },
            { $set: { reportChannelId: channel.id } },
            { upsert: true }
        );
        
        return interaction.reply({
            content: `✅ Salon de rapport quotidien défini sur ${channel}.`,
            ephemeral: true
        });
    },
};
