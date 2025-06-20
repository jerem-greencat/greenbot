import { Client, GatewayIntentBits, Events } from "discord.js";
import dotenv from "dotenv";
import { handleInteraction } from "./infrastructure/discord/events/interactionCreate.js";

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot prêt : ${client.user.tag}`);
});

client.on(Events.InteractionCreate, handleInteraction);

client.login(process.env.DISCORD_TOKEN);
