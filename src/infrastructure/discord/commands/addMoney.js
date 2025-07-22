import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('add-money')
    .setDescription("Ajoute de l'argent au compte d'un membre (admin only)")
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le membre destinataire')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt
        .setName('amount')
        .setDescription("Le montant à ajouter (entier positif)")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId   = interaction.guildId;
        const target    = interaction.options.getUser('member', true);
        const amount    = interaction.options.getInteger('amount', true);
        
        // Mise à jour en base
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${guildId}`);
        
        // Vérifier que le joueur existe
        const doc = await coll.findOne(
            { _id: 'playersList', 'players.userId': target.id },
            { projection: { 'players.$': 1 } }
        );
        if (!doc?.players?.[0]) {
            return interaction.reply({
                content: `❌ <@${target.id}> n'est pas enregistré.`,
                ephemeral: true
            });
        }
        
        // On incrémente
        await coll.updateOne(
            { _id: 'playersList', 'players.userId': target.id },
            { $inc: { 'players.$.money': amount } }
        );
        
        return interaction.reply({
            content: `✅ ${amount} 💶 ont été ajoutés à <@${target.id}>.`,
            ephemeral: true
        });
    },
};
