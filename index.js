const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const axios = require('axios')
const fs = require('fs')

let db = {}
try { db = JSON.parse(fs.readFileSync('./database.json')) } catch { db = {} }
function salvar() { fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)) }

const REGIOES = ['kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea']
const PSEUDOS = ['dragonite','tyranitar','salamence','metagross','garchomp','hydreigon','goodra','kommo-o','dragapult','archaludon','baxcalibur']

async function getPokeData(nome) {
    try {
        const poke = (await axios.get(`https://pokeapi.co/api/v2/pokemon/${nome.toLowerCase()}`)).data
        const species = (await axios.get(poke.species.url)).data
        return { poke, species }
    } catch { return null }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, printQRInTerminal: true })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', u => { if(u.qr) qrcode.generate(u.qr, {small:true}) })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const sender = msg.key.participant || from
        const texto = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim()
        const lower = texto.toLowerCase()
        if (!db[sender]) db[sender] = { registrado: false, regiao: null, pokemons: [] }

        if (lower === '♱/start' || lower === '/start') {
            if (db[sender].registrado) return sock.sendMessage(from, { text: `Você já tem jornada! Use ♱/menupk` })
            return sock.sendMessage(from, { text: `╭┈⊰ 🌙 『 ECLIPSE 』\n┊ Escolha sua região:\n${REGIOES.map(r => `♱/regiao ${r}`).join('\n')}\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯` })
        }
        if (lower.startsWith('♱/regiao') || lower.startsWith('/regiao')) {
            const regiao = lower.split(' ')[1]
            if (!REGIOES.includes(regiao)) return sock.sendMessage(from, { text: `Região inválida!` })
            db[sender].regiao = regiao; salvar()
            return sock.sendMessage(from, { text: `Você escolheu ${regiao.toUpperCase()}! Agora use ♱/inicial <nome> \nEx: ♱/inicial pikachu \n❌ Não pode ser evolução tipo gyarados, pseudos ou lendários` })
        }
        if (lower.startsWith('♱/inicial') || lower.startsWith('/inicial')) {
            if (!db[sender].regiao) return sock.sendMessage(from, { text: `Use ♱/regiao primeiro` })
            if (db[sender].registrado) return sock.sendMessage(from, { text: `Já escolheu!` })
            const nomeEscolhido = lower.split(' ')[1]
            const data = await getPokeData(nomeEscolhido)
            if (!data) return sock.sendMessage(from, { text: `Pokémon não encontrado!` })
            const { poke, species } = data
            const nome = poke.name.toLowerCase()
            if (species.is_legendary) return sock.sendMessage(from, { text: `❌ ${poke.name} é lendário!` })
            if (species.is_mythical) return sock.sendMessage(from, { text: `❌ ${poke.name} é mítico!` })
            if (PSEUDOS.includes(nome)) return sock.sendMessage(from, { text: `❌ ${poke.name} é pseudo-lendário!` })
            if (species.evolves_from_species !== null) return sock.sendMessage(from, { text: `❌ ${poke.name} é evolução de ${species.evolves_from_species.name}! Use a forma base.` })

            const meuPoke = { nome: poke.name, foto: poke.sprites.other['official-artwork'].front_default, hp: poke.stats[0].base_stat, atk: poke.stats[1].base_stat }
            db[sender].pokemons.push(meuPoke); db[sender].registrado = true; salvar()
            await sock.sendMessage(from, { image: { url: meuPoke.foto }, caption: `✨ Você começou com ${meuPoke.nome.toUpperCase()}! Use ♱/menupk` })
            return
        }
        if (lower === '♱/menupk' || lower === '/menupk') {
            if (!db[sender].registrado) return sock.sendMessage(from, { text: `Use ♱/start primeiro` })
            return sock.sendMessage(from, { text: `╭┈⊰ 🌙 『 ECLIPSE 』\n┊ Região: ${db[sender].regiao}\n┊ Inicial: ${db[sender].pokemons[0].nome}\n╰─┈┈┈┈┈◜❁◞┈┈┈┈┈─╯\n♱/pokedex\n♱/capturar` })
        }
    })
}
startBot()
