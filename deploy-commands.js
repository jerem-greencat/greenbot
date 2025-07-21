import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const commands = [];
const commandsPath = path.join(__dirname, 'src/infrastructure/discord/commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const command = await import(path.join(commandsPath, file));
    commands.push(command.default.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🛠️  (Re)Déploiement de ${commands.length} commandes…`);
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                // pour du test rapide, on enregistre en guild :  
                process.env.GUILD_IDS.split(',')[0]
            ),
            { body: commands },
        );
        console.log('✅ Commandes (re)déployées.');
    } catch (err) {
        console.error(err);
    }
})();
