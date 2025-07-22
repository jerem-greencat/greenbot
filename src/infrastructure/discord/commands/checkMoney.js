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
        // Qui cible-t-on ?
        const requested = interaction.options.getUser('member');
        const isAdmin   = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        
        let targetUser;
        if (requested) {
            if (!isAdmin) {
                return interaction.reply({
                    content: '❌ Vous ne pouvez vérifier que votre propre solde.',
                    ephemeral: true
                });
            }
            targetUser = requested;
        } else {
            // si pas d'option, cible toujours soi-même
            targetUser = interaction.user;
        }
        
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
        
        // Réponse
        const self = targetUser.id === interaction.user.id;
        return interaction.reply({
            content: self
            ? `💰 Vous avez **${player.money}** crédits.`
            : `💰 <@${targetUser.id}> a **${player.money}** $.`,
            ephemeral: true
        });
    },
};
