import { SlashCommandBuilder } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('check-money')
    .setDescription('Afficher le solde d’un membre')
    .addUserOption(opt =>
        opt
        .setName('member')
        .setDescription('Le membre à vérifier')
        .setRequired(true)
    ),
    
    async execute(interaction) {
        // Récupère l’utilisateur mentionné
        const user = interaction.options.getUser('member');
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${interaction.guildId}`);
        
        // Cherche son entrée dans playersList
        const doc = await coll.findOne(
            { _id: 'playersList', 'players.userId': user.id },
            { projection: { 'players.$': 1 } }
        );
        const player = doc?.players?.[0];
        if (!player) {
            return interaction.reply({
                content: `❌ <@${user.id}> n'est pas enregistré.`,
                ephemeral: true
            });
        }
        
        // Affiche son solde
        return interaction.reply({
            content: `💰 <@${user.id}> a **${player.money}** $.`,
            ephemeral: true
        });
    },
};
