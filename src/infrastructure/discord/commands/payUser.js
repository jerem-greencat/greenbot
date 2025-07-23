import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('pay-user')
    .setDescription("Transférer de l'argent de votre compte vers celui d’un autre joueur.")
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le destinataire du paiement')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt
        .setName('amount')
        .setDescription('Le montant à transférer (entier positif)')
        .setRequired(true)
        .setMinValue(1)
    ),
    
    async execute(interaction) {
        const guildId   = interaction.guildId;
        const payer     = interaction.user;
        const recipient = interaction.options.getUser('member', true);
        const amount    = interaction.options.getInteger('amount', true);
        
        // Défense contre self‐paiement
        if (recipient.id === payer.id) {
            return interaction.reply({
                content: "❌ Vous ne pouvez pas vous payer vous-même espèce d'idiot.",
                ephemeral: true
            });
        }
        
        // Récupère la collection
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${guildId}`);
        
        // 1️⃣ Vérifier que le payeur existe et a assez d'argent
        const payerDoc = await coll.findOne(
            { _id: 'playersList', 'players.userId': payer.id },
            { projection: { 'players.$': 1 } }
        );
        const payerEntry = payerDoc?.players?.[0];
        if (!payerEntry) {
            return interaction.reply({
                content: `❌ Vous n'êtes pas enregistré dans la base.`,
                ephemeral: true
            });
        }
        if (payerEntry.money < amount) {
            return interaction.reply({
                content: `❌ Solde insuffisant, (${payerEntry.money} euros disponibles).`,
                ephemeral: true
            });
        }
        
        // 2️⃣ Vérifier que le destinataire existe
        const recDoc = await coll.findOne(
            { _id: 'playersList', 'players.userId': recipient.id },
            { projection: { 'players.$': 1 } }
        );
        if (!recDoc?.players?.[0]) {
            return interaction.reply({
                content: `❌ <@${recipient.id}> n'est pas enregistré.`,
                ephemeral: true
            });
        }
        
        // 3️⃣ Effectuer le transfert atomique
        await coll.updateOne(
            { _id: 'playersList', 'players.userId': payer.id },
            { $inc: { 'players.$.money': -amount } }
        );
        await coll.updateOne(
            { _id: 'playersList', 'players.userId': recipient.id },
            { $inc: { 'players.$.money': amount } }
        );
        
        // 4️⃣ Confirmation
        return interaction.reply({
            content: `✅ <@${payer.id}> a transféré **${amount}** euros à <@${recipient.id}>.`,
            ephemeral: true
        });
    },
};
