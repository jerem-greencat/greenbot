// deploy-commands.js
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- util ---
const need = (k) => {
    const v = process.env[k];
    if (!v) throw new Error(`Variable d'env manquante: ${k}`);
    return v;
};

const DISCORD_TOKEN = need('DISCORD_TOKEN');
const CLIENT_ID     = need('CLIENT_ID');
const GUILD_IDS     = need('GUILD_IDS').split(',').map(s => s.trim()).filter(Boolean);

// Marqueur pour empêcher les effets de bord dans les modules importés
process.env.COMMANDS_DEPLOY = '1';

// --- charger les commandes (sans effets de bord) ---
const commandsDir = path.join(__dirname, 'src/infrastructure/discord/commands');
const commands = [];

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    const url = pathToFileURL(path.join(commandsDir, file)).href;
    try {
        const mod = await import(url);
        const cmd = mod?.default;
        if (!cmd?.data?.toJSON) {
            console.warn(`⚠️  ${file} ignoré (pas de export default.data).`);
            continue;
        }
        commands.push(cmd.data.toJSON());
    } catch (e) {
        console.error(`❌ Import raté pour ${file}:`, e);
        process.exitCode = 1;
    }
}

const rest = new REST({
    version: '10',
    timeout: 15_000,  // par défaut 15s, on l'indique explicitement
    retries: 3        // par défaut 3, idem
}).setToken(DISCORD_TOKEN);

// --- déploiement ---
(async () => {
    const t0 = Date.now();
    console.log(`🛠️  (Re)Déploiement de ${commands.length} commandes…`);
    
    for (const gid of GUILD_IDS) {
        console.log(`→ Déploiement sur ${gid}…`);
        try {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), { body: commands });
            console.log(`✓ OK ${gid}`);
        } catch (err) {
            console.error(`✗ Échec ${gid}:`, err?.status ?? '', err?.message ?? err);
            // on continue avec les autres guilds
            process.exitCode = 1;
        }
    }
    
    // Diagnostique rapide si ça traîne
    const handles = (process._getActiveHandles?.() ?? []).map(h => h?.constructor?.name ?? 'unknown');
    if (handles.length) console.warn('⚠️  Handles encore ouverts:', handles);
    
    console.log(`✅ Terminé en ${Math.round((Date.now() - t0)/1000)}s.`);
})()
.catch(e => { console.error('❌ Erreur fatale:', e); process.exitCode = 1; })
.finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 0));
