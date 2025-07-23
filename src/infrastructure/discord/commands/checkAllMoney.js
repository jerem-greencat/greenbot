import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

export default {
    data: new SlashCommandBuilder()
    .setName('check-all-money')
    .setDescription('Liste tous les joueurs ayant un solde > 0')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const db   = mongoose.connection.db;
        const coll = db.collection(`server_${interaction.guildId}`);
        
        // Récupère la liste complète
        const doc = await coll.findOne({ _id: 'playersList' });
        const players = Array.isArray(doc?.players) ? doc.players : [];
        
        // Filtre ceux qui ont money > 0
        const rich = players
        .filter(p => typeof p.money === 'number' && p.money > 0)
        .map(p => `<@${p.userId}> : **${p.money}**`);
        
        if (rich.length === 0) {
            return interaction.reply({
                content: '💤 Aucun joueur n’a de compte en banque supérieur à 0€.',
                ephemeral: true
            });
        }
        
        // Construit le message (max 2000 caractères)
        const chunkSize = 50; // on peut ajuster si bcp de joueurs
        const lines = rich.join('\n');
        if (lines.length < 2000) {
            return interaction.reply({ content: `💶 **Solde des joueurs**\n${lines}`, ephemeral: true });
        }
        
        // Si trop long, on découpe
        const pages = [];
        for (let i = 0; i < rich.length; i += chunkSize) {
            pages.push(rich.slice(i, i + chunkSize).join('\n'));
        }
        for (const page of pages) {
            await interaction.channel.send({ content: `💶 **Solde (suite)**\n${page}`, ephemeral: true });
        }
        return interaction.reply({ content: '📑 Voici la liste en plusieurs parties…', ephemeral: true });
    }
};
