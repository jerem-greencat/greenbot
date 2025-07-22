import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('remove-money')
    .setDescription('Déduit de l’argent du compte d’un utilisateur (admin only)')
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le membre ciblé')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt
        .setName('amount')
        .setDescription('Le montant à déduire (entier positif)')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const guildId   = interaction.guildId;
        const target    = interaction.options.getUser('member', true);
        const amount    = interaction.options.getInteger('amount', true);
        
        // Récupère la collection
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${guildId}`);
        
        // 1️⃣ Vérifier que la cible existe et a assez de crédits
        const doc = await coll.findOne(
            { _id: 'playersList', 'players.userId': target.id },
            { projection: { 'players.$': 1 } }
        );
        const entry = doc?.players?.[0];
        if (!entry) {
            return interaction.reply({
                content: `❌ <@${target.id}> n'est pas enregistré.`,
                ephemeral: true
            });
        }
        if (entry.money < amount) {
            return interaction.reply({
                content: `❌ Solde insuffisant (il a ${entry.money} euros).`,
                ephemeral: true
            });
        }
        
        // 2️⃣ Déduction
        await coll.updateOne(
            { _id: 'playersList', 'players.userId': target.id },
            { $inc: { 'players.$.money': -amount } }
        );
        
        // 3️⃣ Confirmation
        return interaction.reply({
            content: `✅ ${amount} euros ont été retirés du compte de <@${target.id}>.`,
            ephemeral: true
        });
    },
};
