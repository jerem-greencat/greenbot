// deploy-commands.js
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// 1️⃣ Recréer __filename et __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 2️⃣ Charger toutes les commandes du dossier
const commands = [];
const commandsPath = path.join(__dirname, 'src/infrastructure/discord/commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const { default: command } = await import(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
}

// 3️⃣ Initialiser le client REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🛠️  (Re)Déploiement de ${commands.length} commandes…`);
        
        // Pour chaque guild de test, on réécrit les commandes
        const guildIds = process.env.GUILD_IDS.split(',').map(id => id.trim());
        for (const guildId of guildIds) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            );
            console.log(`  • Déployé dans la guild ${guildId}`);
        }
        
        console.log('✅ Commandes (re)déployées.');
    } catch (err) {
        console.error('❌ Erreur lors du déploiement des commandes :', err);
    }
})();
