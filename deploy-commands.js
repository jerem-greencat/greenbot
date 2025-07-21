// deploy-commands.js
import { REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import { data as createRoleButtonData } from "./src/infrastructure/discord/commands/createRoleButton.js";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_IDS = process.env.GUILD_IDS.split(",");

const commands = [createRoleButtonData.toJSON()];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("🔄 Déploiement des commandes slash sur plusieurs serveurs...");
        
        for (const guildId of GUILD_IDS) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId.trim()),
                { body: commands }
            );
            console.log(`✅ Commandes déployées sur le serveur ${guildId}`);
        }
        
        console.log("🎉 Déploiement terminé !");
    } catch (error) {
        console.error("❌ Erreur lors du déploiement :", error);
    }
})();
