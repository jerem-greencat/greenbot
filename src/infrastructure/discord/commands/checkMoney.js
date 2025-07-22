// src/infrastructure/discord/commands/checkMoney.js
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('check-money')
    .setDescription('Afficher le solde d’un membre')
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le membre à vérifier (admins seulement)')
        .setRequired(false)
    ),
    
    async execute(interaction) {
        // Qui sommes‐nous ? Qui ciblons‐nous ?
        const requested = interaction.options.getUser('member');
        const me        = interaction.user;
        const isAdmin   = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        // On ne peut cibler un autre que soi‐même que si on est admin
        if (requested && requested.id !== me.id && !isAdmin) {
            return interaction.reply({
                content: '❌ Vous ne pouvez vérifier que votre propre solde.',
                ephemeral: true
            });
        }
        
        // Si pas de member fourni, on se cible soi‐même
        const targetUser = requested && requested.id ? requested : me;
        
        // Lecture en base
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${interaction.guildId}`);
        const doc  = await coll.findOne(
            { _id: 'playersList', 'players.userId': targetUser.id },
            { projection: { 'players.$': 1 } }
        );
        const player = doc?.players?.[0];
        
        if (!player) {
            return interaction.reply({
                content: `❌ <@${targetUser.id}> n'est pas enregistré.`,
                ephemeral: true
            });
        }
        
        // Construction du message
        const isSelf = targetUser.id === me.id;
        const content = isSelf
        ? `💰 Vous avez **${player.money}** crédits.`
        : `💰 <@${targetUser.id}> a **${player.money}** $.`;
        
        return interaction.reply({ content, ephemeral: true });
    },
};
