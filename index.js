const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys')
const axios = require('axios')
const fs = require('fs')

let db = {}
try { db = JSON.parse(fs.readFileSync('./database.json')) } catch { db = {} }
function salvar() { fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)) }

const MENU_BANNER_PATH = './menu_banner.jpg'
const RANK_BANNER_PATH = './rank_banner.jpg'
const BAG_BANNER_PATH = './bag_banner.jpg'
const MENU_BANNER_URL = 'https://i.ibb.co/6b0J0Xy/pokeball-grass.png' // fallback
function calcRankScore(u){
    try{
        const all = [...(u.pokemons||[]), ...((u.boxes||[]).flat())]
        const qtd = all.length
        const media = qtd ? Math.floor(all.reduce((a,p)=>a+(p.level||1),0)/qtd) : 0
        const dinheiro = Math.floor((u.money||0)/100)
        const pb = u.pb ?? u.rank ?? 0
        // Fórmula adaptada: qtd*20 + media*15 + dinheiro/10 + pb*10
        const score = (qtd*25) + (media*12) + Math.floor(dinheiro/2) + (pb*15)
        return { score, qtd, media, dinheiro: u.money||0, pb }
    }catch{ return {score:0,qtd:0,media:0,dinheiro:0,pb:0} }
}


const REGIOES = ['kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea']
const PSEUDOS = ['dragonite','tyranitar','salamence','metagross','garchomp','hydreigon','goodra','kommo-o','dragapult','archaludon','baxcalibur','ursaluna','annihilape','kingambit']
const NATURES = ['adamant','modest','jolly','timid','brave','hardy','lonely','naughty','bold','docile','relaxed','impish','lax','rash','calm']
const LEGENDARIES_POOL = ['mewtwo','lugia','ho-oh','rayquaza','dialga','palkia','giratina','xerneas','yveltal','zygarde','solgaleo','lunala','zacian','zamazenta','koraidon','miraidon']

const BERRIES = {
    oran: { nome:'Oran Berry', emoji:'🍓', raridade:'comum', valor:80, chance:35, desc:'Restaura um pouco de HP' },
    pecha: { nome:'Pecha Berry', emoji:'🍒', raridade:'comum', valor:60, chance:35, desc:'Cura veneno' },
    cheri: { nome:'Cheri Berry', emoji:'🍒', raridade:'comum', valor:60, chance:35, desc:'Cura paralisia' },
    chesto: { nome:'Chesto Berry', emoji:'🫐', raridade:'incomum', valor:150, chance:15, desc:'Acorda do sono' },
    sitrus: { nome:'Sitrus Berry', emoji:'🍓', raridade:'incomum', valor:200, chance:15, desc:'Restaura bastante HP' },
    lum: { nome:'Lum Berry', emoji:'🍇', raridade:'rara', valor:400, chance:7, desc:'Cura qualquer status' },
    leppa: { nome:'Leppa Berry', emoji:'🍈', raridade:'rara', valor:350, chance:7, desc:'Restaura PP' },
    enigma: { nome:'Enigma Berry', emoji:'✨🍓', raridade:'lendaria', valor:1000, chance:2, desc:'Berry misteriosa e rara' },
    starf: { nome:'Starf Berry', emoji:'⭐🍓', raridade:'lendaria', valor:1500, chance:1, desc:'Aumenta status aleatório - extremamente rara' }
}
const BERRY_POOL = [
    {id:'oran', weight:35}, {id:'pecha', weight:20}, {id:'cheri', weight:20},
    {id:'chesto', weight:15}, {id:'sitrus', weight:15},
    {id:'lum', weight:7}, {id:'leppa', weight:7},
    {id:'enigma', weight:2}, {id:'starf', weight:1}
]


const REGIAO_POKES = {
    kanto: [1,4,7,10,13,16,19,21,23,25,27,29,32,35,37,39,41,43,46,48,50,52,54,56,58,60,63,66,69,72,74,77,79,81,83,84,86,88,90,92,95,96,98,100,102,104,108,109,113,114,116,118,120,129,133],
    johto: [152,155,158,161,163,165,167,170,172,173,174,175,177,179,183,185,187,190,193,194,195,204,209,211,213,216,218,220,228,231,234,238,239,240],
    hoenn: [252,255,258,261,263,265,270,273,276,278,280,283,285,287,290,293,296,300,302,304,307,309,311,312,313,316,318,320,322,324,325,327,333,335,336,339,341,343,345,349,351,352,355,357,359],
    sinnoh: [387,390,393,396,399,401,403,406,408,410,412,415,417,420,422,425,427,431,433,436,438,440,443,447,449,451,453,456,459,461,464,495],
    unova: [495,498,501,504,506,509,511,513,515,517,519,522,524,527,529,531,535,540,543,546,548,551,554,557,559,561,564,566,568,570,572,575,577,580,582,584,587,590,592,594,595,597,599,602,605,607,610,613,616,619,621,623],
    kalos: [650,653,656,659,661,664,667,669,672,674,676,679,682,684,686,688,690,692,694,696,698,700,701,704,707,710,712,714],
    alola: [722,725,728,731,734,736,739,742,744,747,750,752,754,757,759,761,764,766,768,771,773,775,777,779,781,783],
    galar: [810,813,816,819,821,824,827,829,831,833,835,837,840,842,844,846,848,850,852,854,856,858,860,863,865,867,869,872,874,876,878,880,882,884],
    paldea: [906,909,912,915,917,920,922,924,926,928,930,932,934,936,938,940,942,944,946,948,950,952,954,956,958,960,962,964,966,968,970,972,974,976,978,980]
}

const AVENTURA_DATA = {
    kanto: [
        { rota: 'Rota 1 - Bosque Verde', treinador: 'Bug Catcher Sam', dialogo: 'Você não vai passar! Meus insetos vão te parar!', pokes: [{nome:'caterpie', level:5},{nome:'weedle', level:5}], recompensa: {money:300, exp: 50} },
        { rota: 'Rota 2 - Caverna Diglett', treinador: 'Hiker Brock', dialogo: 'Cuidado com as pedras!', pokes: [{nome:'geodude', level:8},{nome:'onix', level:9}], recompensa: {money:500, exp: 80} },
        { rota: 'Rota 3 - Ponte Nugget', treinador: 'Rival Blue', dialogo: 'Você de novo? Vou te mostrar quem é o melhor!', pokes: [{nome:'pidgey', level:10},{nome:'rattata', level:10},{nome:'eevee', level:11}], recompensa: {money:800, exp: 120} },
        { rota: 'Rota 4 - Saffron', treinador: 'Sabrina', dialogo: 'Eu previ sua chegada...', pokes: [{nome:'abra', level:14},{nome:'kadabra', level:15}], recompensa: {money:1000, exp: 150} },
        { rota: 'Rota 5 - Liga', treinador: 'Líder Koga', dialogo: 'Meus venenos vão te fazer desmaiar!', pokes: [{nome:'koffing', level:18},{nome:'muk', level:19},{nome:'weezing', level:20}], recompensa: {money:2000, exp: 300} },
    ],
    johto: [
        { rota: 'Rota 29', treinador: 'Youngster Joey', dialogo: 'Meu Rattata é top!', pokes: [{nome:'rattata', level:6}], recompensa: {money:300, exp:50} },
        { rota: 'Torre Sprout', treinador: 'Sage Li', dialogo: 'O poder de Bellsprout!', pokes: [{nome:'bellsprout', level:10},{nome:'hoppip', level:10}], recompensa: {money:600, exp:90} },
        { rota: 'Violet', treinador: 'Falkner', dialogo: 'Voe alto!', pokes: [{nome:'pidgey', level:12},{nome:'pidgeotto', level:14}], recompensa: {money:1200, exp:180} },
    ],
    kalos: [
        { rota: 'Rota 2', treinador: 'Viola', dialogo: 'Meus insetos são arte!', pokes: [{nome:'scatterbug', level:7},{nome:'spewpa', level:8}], recompensa: {money:400, exp:60} },
        { rota: 'Rota 8', treinador: 'Fisherman', dialogo: 'Pesquei agora!', pokes: [{nome:'binacle', level:15},{nome:'clauncher', level:16}], recompensa: {money:800, exp:130} },
        { rota: 'Torre', treinador: 'Korrina', dialogo: 'Vamos ver sua aura!', pokes: [{nome:'mienfoo', level:20},{nome:'hawlucha', level:22}], recompensa: {money:1500, exp:250} },
    ]
}

function genIV() { return { hp: Math.floor(Math.random()*32), atk: Math.floor(Math.random()*32), def: Math.floor(Math.random()*32), spa: Math.floor(Math.random()*32), spd: Math.floor(Math.random()*32), spe: Math.floor(Math.random()*32) } }
function sumIV(iv) { if(!iv) return 0; try{return Object.values(iv).reduce((a,b)=>a+b,0)}catch{return 0} }
function calcShiny() { return Math.random() < 1/4096 }
function randomNature() { return NATURES[Math.floor(Math.random()*NATURES.length)] }
function randomSex() { return Math.random() < 0.5 ? '♂' : '♀' }
function randomAbility() { return Math.random() < 0.1 ? 'hidden' : (Math.random()<0.5?'normal':'secundaria') }

function getNatureMultiplier(nature, stat) {
    const boosts = {
        adamant: { atk:1.1, spa:0.9 },
        modest: { spa:1.1, atk:0.9 },
        jolly: { spe:1.1, spa:0.9 },
        timid: { spe:1.1, atk:0.9 },
        brave: { atk:1.1, spe:0.9 },
        lonely: { atk:1.1, def:0.9 },
        naughty: { atk:1.1, spd:0.9 },
        bold: { def:1.1, atk:0.9 },
        relaxed: { def:1.1, spe:0.9 },
        impish: { def:1.1, spa:0.9 },
        lax: { def:1.1, spd:0.9 },
        rash: { spa:1.1, spd:0.9 },
        calm: { spd:1.1, atk:0.9 }
    }
    if (!boosts[nature]) return 1
    if (boosts[nature][stat] !== undefined) return boosts[nature][stat]
    return 1
}

function calcRealStats(base, iv, level, nature) {
    const ev = 0
    const hp = Math.floor(((2 * base.hp + iv.hp + ev/4) * level / 100) + level + 10)
    const atk = Math.floor((Math.floor(((2 * base.atk + iv.atk + ev/4) * level / 100) + 5) * getNatureMultiplier(nature, 'atk')))
    const def = Math.floor((Math.floor(((2 * base.def + iv.def + ev/4) * level / 100) + 5) * getNatureMultiplier(nature, 'def')))
    const spa = Math.floor((Math.floor(((2 * base.spa + iv.spa + ev/4) * level / 100) + 5) * getNatureMultiplier(nature, 'spa')))
    const spd = Math.floor((Math.floor(((2 * base.spd + iv.spd + ev/4) * level / 100) + 5) * getNatureMultiplier(nature, 'spd')))
    const spe = Math.floor((Math.floor(((2 * base.spe + iv.spe + ev/4) * level / 100) + 5) * getNatureMultiplier(nature, 'spe')))
    return { hp, atk, def, spa, spd, spe }
}

function getDisplayStats(pk) {
    return calcRealStats(pk.base, pk.iv, pk.level, pk.nature)
}

function getXPForLevel(level, growthRate) {
    const n = level
    let xp = 0
    switch(growthRate) {
        case 'slow': xp = Math.floor((5 * Math.pow(n,3)) / 4); break
        case 'medium-slow': xp = Math.floor((6/5)*Math.pow(n,3) - 15*Math.pow(n,2) + 100*n - 140); break
        case 'fast': xp = Math.floor((4 * Math.pow(n,3)) / 5); break
        default: xp = Math.pow(n,3); break
        case 'erratic':
            if (n <= 50) xp = Math.floor((Math.pow(n,3) * (100 - n)) / 50)
            else if (n <= 68) xp = Math.floor((Math.pow(n,3) * (150 - n)) / 100)
            else if (n <= 98) xp = Math.floor((Math.pow(n,3) * ((1911 - 10*n)/3)) / 500)
            else xp = Math.floor((Math.pow(n,3) * (160 - n)) / 100)
            break
        case 'fluctuating':
            if (n <= 15) xp = Math.floor(Math.pow(n,3) * (( (n+1)/3 + 24)/50))
            else if (n <= 36) xp = Math.floor(Math.pow(n,3) * ((n + 14)/50))
            else xp = Math.floor(Math.pow(n,3) * (( (n/2) + 32)/50))
            break
    }
    return xp * 2
}
function getXPNeeded(currentLevel, growthRate) {
    return getXPForLevel(currentLevel+1, growthRate) - getXPForLevel(currentLevel, growthRate)
}
function getGrowthRateName(speciesData) {
    try { return speciesData.growth_rate.name || 'medium-fast' } catch { return 'medium-fast' }
}

async function getPokeData(nome) {
    let n = nome.toString().toLowerCase().replace(/\s+/g,'-').replace('♀','-f').replace('♂','-m')
    const tries = [n, n+'-shield', n+'-default', n.split('-')[0], n.replace('aegislash','honedge')]
    for (let t of tries) {
        try {
            const poke = (await axios.get(`https://pokeapi.co/api/v2/pokemon/${t}`, {timeout: 8000})).data
            const species = (await axios.get(poke.species.url, {timeout: 8000})).data
            return { poke, species }
        } catch {}
    }
    return null
}
function getBallMultiplier(ball) {
    const rates = { poke:1, great:1.5, ultra:2, master:100, safari:1.5, net:3, dusk:2.5, premier:1 }
    return rates[ball] || 1
}
// Learnset estrito: Scarlet/Violet (geração 9). Ausência de dados retorna lista vazia,
// nunca uma lista arbitrária de moves de TM/tutor ou golpes inventados.
const MOVE_VERSION_GROUP = 'scarlet-violet'
function getMovesForLevel(pokeData, level) {
    if (!pokeData || !Array.isArray(pokeData.moves)) return []
    const maxLevel = Math.max(1, Math.min(100, Number(level) || 1))
    const byName = new Map()
    for (const entry of pokeData.moves) {
        const details = Array.isArray(entry.version_group_details) ? entry.version_group_details : []
        for (const vg of details) {
            if (vg?.version_group?.name !== MOVE_VERSION_GROUP) continue
            if (vg?.move_learn_method?.name !== 'level-up') continue
            const learnedAt = Number(vg.level_learned_at)
            if (!Number.isInteger(learnedAt) || learnedAt < 1 || learnedAt > maxLevel) continue
            const name = entry?.move?.name
            if (!name) continue
            const previous = byName.get(name)
            if (!previous || learnedAt < previous.level) byName.set(name, {name, level: learnedAt})
        }
    }
    return [...byName.values()].sort((a,b)=>a.level-b.level || a.name.localeCompare(b.name))
}
function getMovesLearnedAtLevel(pokeData, level) {
    return getMovesForLevel(pokeData, level).filter(m => m.level === level).map(m => m.name)
}
function normalizeMoves(moves) {
    const out = []
    const seen = new Set()
    for (const value of Array.isArray(moves) ? moves : []) {
        const name = typeof value === 'string' ? value.trim().toLowerCase() : ''
        if (!name || seen.has(name)) continue
        seen.add(name); out.push(name)
        if (out.length === 4) break
    }
    return out
}

async function startBot() {
    const USE_PAIRING_CODE = true // true = codigo, false = QR
    const PAIRING_NUMBER = "5511911844060"

    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, browser: Browsers.macOS('Safari'), printQRInTerminal: true })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', u => { if(u.qr) qrcode.generate(u.qr, {small:true}) })

    let raidAtiva = null
    let ultimaRaidTime = Date.now()
    let pendingBattles = {}
    let batalhaLock = {}
    let activeBattles = {}
    let pendingTrades = {}
    const pendingMoveChoices = {}
    let cooldownColheita = 5*60*1000 // 5 min

    function getRaidTier() {
        const tiers = [
            { nome: '⭐ Raid Normal', pool: [1,4,7,25,133,143,149,196,197,248,373,376,445,448,635,706,800], level: 25, hp: 800, reward: 500 },
            { nome: '⭐⭐ Raid Rara', pool: [150,151,249,250,251,380,381,382,383,384,385,386,480,481,482,483,484,487], level: 50, hp: 2500, reward: 1500 },
            { nome: '🔥 GIGANTAMAX Fenda', pool: ['charizard-gmax','blastoise-gmax','venusaur-gmax','pikachu-gmax','eevee-gmax','snorlax-gmax','gengar-gmax'], level: 100, hp: 10000, reward: 10000 },
            { nome: '⭐⭐⭐ Raid Lendária', pool: LEGENDARIES_POOL, level: 80, hp: 6000, reward: 5000 }
        ]
        const rand = Math.random()
        if (rand < 0.3) return tiers[0]
        if (rand < 0.6) return tiers[1]
        if (rand < 0.9) return tiers[2]
        return tiers[3]
    }

    setInterval(async () => {
        try {
            const tier = getRaidTier()
            const pokeNome = tier.pool[Math.floor(Math.random()*tier.pool.length)].toString().toString()
            const data = await getPokeData(pokeNome)
            if (!data) return
            const { poke } = data
            const foto = poke.sprites.other['official-artwork'].front_default || poke.sprites.other['official-artwork'].front_shiny
            raidAtiva = {
                tier: tier.nome,
                nome: poke.name,
                foto: foto,
                level: tier.level,
                hp: tier.hp,
                hpMax: tier.hp,
                tipos: poke.types.map(t=>t.type.name),
                reward: tier.reward,
                expira: Date.now() + 1000*60*30,
                criado: Date.now(),
                lobby: [],
                iniciado: false,
                danoTotal: {},
                ultimoGrupo: null
            }
            ultimaRaidTime = Date.now()
            console.log(`[RAID] Nova raid: ${tier.nome} - ${poke.name.toUpperCase()}`)
        } catch(e){ console.log('Raid error', e.message) }
    }, 1000*60*30)

    ;(async () => {
        try {
            const tier = getRaidTier()
            const pokeNome = tier.pool[Math.floor(Math.random()*tier.pool.length)].toString()
            console.log(`[RAID] Spawnando raid inicial: ${pokeNome}...`)
            const data = await getPokeData(pokeNome)
            if (!data) {
                console.log(`[RAID] Falha ao buscar ${pokeNome}, tentando pikachu`)
                const fallback = await getPokeData('pikachu')
                if (!fallback) return
                const { poke } = fallback
                raidAtiva = {
                    tier: '⭐ Raid Normal',
                    nome: poke.name,
                    foto: poke.sprites.other['official-artwork'].front_default,
                    level: 25,
                    hp: 800,
                    hpMax: 800,
                    tipos: poke.types.map(t=>t.type.name),
                    reward: 500,
                    expira: Date.now() + 1000*60*30,
                    criado: Date.now(),
                    lobby: [],
                    iniciado: false,
                    danoTotal: {},
                    ultimoGrupo: null
                }
            } else {
                const { poke } = data
                raidAtiva = {
                    tier: tier.nome,
                    nome: poke.name,
                    foto: poke.sprites.other['official-artwork'].front_default || poke.sprites.other['official-artwork'].front_shiny,
                    level: tier.level,
                    hp: tier.hp,
                    hpMax: tier.hp,
                    tipos: poke.types.map(t=>t.type.name),
                    reward: tier.reward,
                    expira: Date.now() + 1000*60*30,
                    criado: Date.now(),
                    lobby: [],
                    iniciado: false,
                    danoTotal: {},
                    ultimoGrupo: null
                }
            }
            ultimaRaidTime = Date.now()
            console.log(`[RAID] Raid inicial ativa: ${raidAtiva.tier} - ${raidAtiva.nome.toUpperCase()} LV${raidAtiva.level}`)
        } catch(e){ console.log('[RAID] Erro raid inicial', e.message) }
    })()

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const sender = msg.key.participant || from
        const textoRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim()
        const lower = textoRaw.toLowerCase()
        if (!db[sender]) db[sender] = { registrado:false, regiao:null, pokemons:[], box:[], money:1000, balls:{poke:15,great:5,ultra:2,master:0,safari:5}, itens:[], ultimoCaptura:[], ultimoCapturaTime:0, ultimoDiario:0, rank:0, pb:0, hm:{surf:false,strength:false,fly:false}, ultimoTrabalho:0, aventura:{} }

        const user = db[sender]
        if (!Array.isArray(user.pokemons)) user.pokemons = []
        if (!Array.isArray(user.boxes)) {
            const antigos = Array.isArray(user.box) ? user.box : []
            user.boxes = Array.from({length:10}, () => [])
            antigos.slice(0,300).forEach((pk,i) => user.boxes[Math.floor(i/30)].push(pk))
            delete user.box
        }
        while (user.boxes.length < 10) user.boxes.push([])
        user.boxes = user.boxes.slice(0,10).map(b => Array.isArray(b) ? b.slice(0,30) : [])
        if (!Number.isInteger(user.boxesUnlocked) || user.boxesUnlocked < 1) {
            const ultimaOcupada = user.boxes.reduce((ultima, b, i) => b.length ? i + 1 : ultima, 1)
            user.boxesUnlocked = Math.min(10, ultimaOcupada)
        }
        user.boxesUnlocked = Math.max(1, Math.min(10, user.boxesUnlocked))
        if (!Number.isInteger(user.boxAtiva) || user.boxAtiva < 1 || user.boxAtiva > user.boxesUnlocked) user.boxAtiva = 1
        if (user.pokemons.length > 6) {
            const extras = user.pokemons.splice(6)
            for (const pk of extras) {
                const destino = user.boxes.slice(0, user.boxesUnlocked).find(b => b.length < 30)
                if (destino) destino.push(pk)
            }
        }
        function garantirBoxes(alvo) {
            if (!Array.isArray(alvo.boxes)) {
                const antigas = Array.isArray(alvo.box) ? alvo.box : []
                alvo.boxes = Array.from({length:10},()=>[])
                antigas.slice(0,300).forEach((pk,i)=>alvo.boxes[Math.floor(i/30)].push(pk))
                delete alvo.box
            }
            while (alvo.boxes.length < 10) alvo.boxes.push([])
            alvo.boxes = alvo.boxes.slice(0,10).map(b => Array.isArray(b) ? b.slice(0,30) : [])
            if (!Number.isInteger(alvo.boxesUnlocked) || alvo.boxesUnlocked < 1) {
                alvo.boxesUnlocked = Math.min(10, alvo.boxes.reduce((ultima,b,i)=>b.length ? i+1 : ultima,1))
            }
            alvo.boxesUnlocked = Math.max(1,Math.min(10,alvo.boxesUnlocked))
            if (!Number.isInteger(alvo.boxAtiva) || alvo.boxAtiva < 1 || alvo.boxAtiva > alvo.boxesUnlocked) alvo.boxAtiva=1
        }
        function adicionarPokemon(mon, alvo=user) {
            if (!Array.isArray(alvo.pokemons)) alvo.pokemons = []
            garantirBoxes(alvo)
            if (alvo.pokemons.length > 6) {
                const extras = alvo.pokemons.splice(6)
                for (const pk of extras) { const b=alvo.boxes.slice(0,alvo.boxesUnlocked).find(x=>x.length<30); if (b) b.push(pk) }
            }
            if (alvo.pokemons.length < 6) { alvo.pokemons.push(mon); return 'time' }
            const boxLivre = alvo.boxes.slice(0,alvo.boxesUnlocked).findIndex(b=>b.length<30)
            if (boxLivre < 0) return 'cheio'
            alvo.boxes[boxLivre].push(mon)
            return `box${boxLivre+1}`
        }
        if (!user.balls) user.balls = {poke:15,great:5,ultra:2,master:0,safari:5}
        if (!user.money && user.money!==0) user.money=1000
        if (!user.itens) user.itens=[]
        if (!user.ultimoCaptura) user.ultimoCaptura=[]
        if (!user.ultimoCapturaTime) user.ultimoCapturaTime=0
        if (!user.ultimoDiario) user.ultimoDiario=0
        if (!user.rank && user.rank!==0) user.rank=0
        if (user.pb===undefined){ user.pb = user.rank||0 }
        if (!user.ultimoTrabalho) user.ultimoTrabalho=0
        if (!user.bag) user.bag = { berries:{}, itens:{}, tms:[], hms:[] }
        if (!user.bag.berries) user.bag.berries={}
        if (!user.bag.itens) user.bag.itens={}
        if (!user.bag.tms) user.bag.tms=[]
        if (!user.bag.hms) user.bag.hms=[]
        if (!user.ultimoColheita) user.ultimoColheita=0
        if (!user.diario) user.diario={ ultimo:0, streak:0, total:0 }
        if (!user.ultimoDiario) user.ultimoDiario=0

        if (!user.hm) user.hm={surf:false,strength:false,fly:false}
        if (!user.aventura) user.aventura={}
        if (!user.aventura[user.regiao]) user.aventura[user.regiao] = { etapa:0 }
        ;[...user.pokemons, ...user.boxes.flat()].forEach(pk=>{
            if (!pk.iv) pk.iv=genIV()
            if (!pk.nature) pk.nature=randomNature()
            if (!pk.sexo) pk.sexo=randomSex()
            if (pk.shiny===undefined) pk.shiny=false
            if (!pk.habilidade) pk.habilidade=randomAbility()
            if (!pk.level) pk.level=5
            if (!pk.exp) pk.exp=0
            if (!pk.expTotal) pk.expTotal=getXPForLevel(pk.level, pk.growthRate||'medium-fast')
            if (!pk.growthRate) pk.growthRate='medium-fast'
            if (!pk.base) pk.base={hp:50,atk:50,def:50,spa:50,spd:50,spe:50}
            if (!pk.base.spa) { pk.base.spa=pk.base.atk; pk.base.spd=pk.base.def; pk.base.spe=60 }
            pk.moves = normalizeMoves(pk.moves)
            if (!pk.fome && pk.fome!==0) pk.fome=100
            if (!pk.humor && pk.humor!==0) pk.humor=100
            if (pk.vitorias===undefined) pk.vitorias=0
            if (pk.derrotas===undefined) pk.derrotas=0
            if (!pk.lastUpar) pk.lastUpar=0
            if (!pk.lastTreinar) pk.lastTreinar=0
            if (!pk.foto) pk.foto='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png'
        })

        async function reply(text, imgUrl=null) {
            const opts = { quoted: msg }
            if (imgUrl) {
                try {
                    // Suporta arquivo local (menu_banner.jpg) ou URL
                    if (fs.existsSync(imgUrl)) {
                        const buff = fs.readFileSync(imgUrl)
                        return await sock.sendMessage(from, { image: buff, caption: text }, opts)
                    }
                    return await sock.sendMessage(from, { image: { url: imgUrl }, caption: text }, opts)
                } catch(e){ 
                    try{
                        if (fs.existsSync(MENU_BANNER_PATH)){
                            const buff = fs.readFileSync(MENU_BANNER_PATH)
                            return await sock.sendMessage(from, { image: buff, caption: text }, opts)
                        }
                    }catch{}
                    return await sock.sendMessage(from, { text }, opts) 
                }
            } else {
                return await sock.sendMessage(from, { text }, opts)
            }
        }
        async function replyWithMenuImage(text){
            try{
                if (fs.existsSync(MENU_BANNER_PATH)){
                    const buff = fs.readFileSync(MENU_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: text }, { quoted: msg })
                }
            }catch{}
            return await reply(text, null)
        }

        // Aplica XP sem ultrapassar o nível 100 e examina cada nível atravessado.
        // Moves novos são colocados em fila de escolha; não substituem golpes silenciosamente.
        async function grantExperience(pk, amount, context='') {
            if (!pk || !Number.isFinite(amount) || amount <= 0) return {levels:0, learned:[]}
            pk.level = Math.max(1, Math.min(100, Number(pk.level)||1))
            pk.exp = Math.max(0, Number(pk.exp)||0) + amount
            let levels = 0
            const learned = []
            while (pk.level < 100) {
                const need = getXPNeeded(pk.level, pk.growthRate||'medium-fast')
                if (!Number.isFinite(need) || need <= 0 || pk.exp < need) break
                pk.exp -= need
                pk.level++
                levels++
                pk.expTotal = getXPForLevel(pk.level, pk.growthRate||'medium-fast')
                try {
                    const data = await getPokeData(pk.nome)
                    if (data?.poke) {
                        for (const move of getMovesLearnedAtLevel(data.poke, pk.level)) {
                            if (!normalizeMoves(pk.moves).includes(move)) learned.push({move, level:pk.level})
                        }
                    }
                } catch (e) { console.warn('[MOVES] Não foi possível consultar learnset:', pk.nome, pk.level, e.message) }
            }
            pk.moves = normalizeMoves(pk.moves)
            if (pk.level >= 100) { pk.level = 100; pk.exp = 0; pk.expTotal = getXPForLevel(100, pk.growthRate||'medium-fast') }
            if (learned.length) {
                // Um Pokémon não recebe duas ofertas idênticas durante a mesma concessão de XP.
                const unique = [...new Map(learned.map(x=>[x.move,x])).values()]
                const prior = pendingMoveChoices[sender]
                pendingMoveChoices[sender] = { owner:sender, pokemonId:pk.id, pokemonName:pk.nome, queue:[...(prior?.queue||[]), ...unique], expires:Date.now()+5*60*1000, context }
            }
            return {levels, learned}
        }
        async function promptNextMoveChoice(jid, targetFrom=from) {
            const pending = pendingMoveChoices[jid]
            if (!pending || !pending.queue?.length) { delete pendingMoveChoices[jid]; return }
            if (Date.now() > pending.expires) { delete pendingMoveChoices[jid]; return }
            const item = pending.queue[0]
            const mon = (db[jid]?.pokemons||[]).find(p=>p.id===pending.pokemonId) || (db[jid]?.boxes||[]).flat().find(p=>p.id===pending.pokemonId)
            if (!mon) { delete pendingMoveChoices[jid]; return }
            mon.moves = normalizeMoves(mon.moves)
            const current = mon.moves.length ? mon.moves.map((m,i)=>`${i+1}. ${m}`).join('\n') : '(nenhum golpe equipado)'
            const text = `✨ *${mon.apelido||mon.nome}* chegou ao nível ${item.level} e pode aprender *${item.move.toUpperCase()}*.\n\nGolpes atuais:\n${current}\n\n${mon.moves.length<4 ? 'Responda *sim* para aprender ou *não* para recusar.' : 'Responda com 1-4 para esquecer o golpe correspondente, *sim* para aprender substituindo o golpe 1, ou *não* para recusar.'}\nA solicitação expira em 5 minutos.`
            await sock.sendMessage(targetFrom, {text})
        }

        // Respostas de aprendizado ficam vinculadas ao próprio remetente e ao Pokémon original.
        if (pendingMoveChoices[sender] && !lower.startsWith('/')) {
            const pending = pendingMoveChoices[sender]
            if (Date.now() > pending.expires) { delete pendingMoveChoices[sender]; return reply('⏰ A escolha de move expirou. O Pokémon não foi alterado.') }
            const mon = (user.pokemons||[]).find(p=>p.id===pending.pokemonId) || (user.boxes||[]).flat().find(p=>p.id===pending.pokemonId)
            if (!mon || pending.owner !== sender) { delete pendingMoveChoices[sender]; return reply('Não foi possível confirmar o Pokémon desta solicitação. Nenhum golpe foi alterado.') }
            const item = pending.queue[0]
            mon.moves = normalizeMoves(mon.moves)
            if (['não','nao','n','recusar','cancelar'].includes(lower)) {
                pending.queue.shift()
                if (!pending.queue.length) delete pendingMoveChoices[sender]
                else { pending.expires=Date.now()+5*60*1000; await promptNextMoveChoice(sender, from) }
                salvar(); return reply(`Você recusou aprender ${item.move.toUpperCase()}.`)
            }
            let replaceIndex = -1
            if (['sim','s','yes'].includes(lower)) replaceIndex = mon.moves.length < 4 ? -2 : 0
            else if (/^[1-4]$/.test(lower)) replaceIndex = Number(lower)-1
            else return reply('Resposta inválida. Responda sim/não ou o número do golpe a esquecer (1-4).')
            if (mon.moves.includes(item.move)) { pending.queue.shift() }
            else if (mon.moves.length < 4 && replaceIndex === -2) mon.moves.push(item.move)
            else if (replaceIndex >= 0 && replaceIndex < mon.moves.length && mon.moves.length === 4) mon.moves[replaceIndex] = item.move
            else return reply('Escolha inválida para a quantidade de golpes atual. Nenhum dado foi alterado.')
            pending.queue.shift()
            salvar()
            if (!pending.queue.length) delete pendingMoveChoices[sender]
            else { pending.expires=Date.now()+5*60*1000; await promptNextMoveChoice(sender, from) }
            return reply(`✅ Golpes atualizados de *${mon.apelido||mon.nome}*: ${mon.moves.join(', ')}.`)
        }

        if (['/start','†/start'].includes(lower)) {
            if (user.registrado) return reply(`╭━━━⊱ 🌙 ECLIPSE ⊱━━━╮\n│ Você já tem jornada em ${user.regiao.toUpperCase()}!\n│ Use /menupk\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            const regioesList = REGIOES.map(r=>`│  /regiao ${r}`).join('\n')
            return reply(`╭━━━⊱ 🌙 ECLIPSE ⊱━━━╮\n│ Olá, treinador! 👑\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🌍 REGIÕES ⪨─┓\n${regioesList}\n┗━─━─━─━─━─━─━─━┛`)
        }

        if (lower.startsWith('/regiao') || lower.startsWith('†/regiao')) {
            const regiao = lower.split(' ')[1]
            if (!REGIOES.includes(regiao)) return reply(`Região inválida!`)
            user.regiao=regiao; if (!user.aventura[regiao]) user.aventura[regiao]={etapa:0}; salvar()
            return reply(`╭━━━⊱ 🌑 ESCOLHA ⊱━━━╮\n│ Você escolheu *${regiao.toUpperCase()}*!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n/inicial <nome> Ex: honedge`)
        }

        if (lower.startsWith('/inicial') || lower.startsWith('†/inicial')) {
            if (!user.regiao) return reply(`Use /regiao primeiro`)
            if (user.registrado) return reply(`Já tem inicial!`)
            const nomeEscolhido = lower.split(' ').slice(1).join('-')
            const data = await getPokeData(nomeEscolhido)
            if (!data) return reply(`Pokémon '${nomeEscolhido}' não encontrado!`)
            const { poke, species } = data
            const n = poke.name.toLowerCase()
            if (species.is_legendary || species.is_mythical) return reply(`❌ Lendário bloqueado!`)
            if (PSEUDOS.includes(n)) return reply(`❌ Pseudo bloqueado!`)
            if (species.evolves_from_species !== null) return reply(`❌ ${poke.name} é evolução de ${species.evolves_from_species.name}!`)
            const isShiny = calcShiny()
            const initialMoves = getMovesForLevel(poke, 5).slice(-4).map(m=>m.name)
            const growthRate = getGrowthRateName(species)
            const totalXP = getXPForLevel(5, growthRate)
            const mon = { id: Date.now(), nome: poke.name, apelido: null, foto: poke.sprites.other['official-artwork'].front_default, fotoShiny: poke.sprites.other['official-artwork'].front_shiny, level:5, exp:0, expTotal: totalXP, growthRate, base:{hp:poke.stats[0].base_stat, atk:poke.stats[1].base_stat, def:poke.stats[2].base_stat, spa:poke.stats[3].base_stat, spd:poke.stats[4].base_stat, spe:poke.stats[5].base_stat}, iv: genIV(), nature: randomNature(), sexo: randomSex(), shiny: isShiny, habilidade: randomAbility(), mega:false, fome:100, humor:100, vitorias:0, derrotas:0, moves: normalizeMoves(initialMoves), lastUpar:0, lastTreinar:0 }
            adicionarPokemon(mon); user.registrado=true; if (!user.aventura[user.regiao]) user.aventura[user.regiao]={etapa:0}; salvar()
            const img = isShiny && mon.fotoShiny ? mon.fotoShiny : mon.foto
            const need = getXPNeeded(5, growthRate)
            return reply(`${isShiny?'✨ SHINY 1/4096!!! ✨\n':''}╭━━━⊱ 🌟 INICIAL ⊱━━━╮\n│ *${mon.nome.toUpperCase()}* ${mon.sexo}\n│ LV${mon.level} | XP p/ próximo: ${need}\n│ Moves: ${mon.moves.join(', ')}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n/menupk`, img)
        }

        if (['/menupk','†/menupk','/menu','†/menu','/perfil','†/perfil'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const media = Math.floor(user.pokemons.reduce((a,p)=>a+p.level,0)/user.pokemons.length) || 5
            const etapa = user.aventura[user.regiao]?.etapa || 0
            const historia = AVENTURA_DATA[user.regiao] || AVENTURA_DATA['kanto']
            const cap = `╭━━━⊱ 🌙 *ECLIPSE — MENU COMPLETO* ⊱━━━╮\n│ Região: *${(user.regiao||'???').toUpperCase()}* | Rank: *#${user.rank||0}*\n│ P$: *${user.money}* | Time: *${user.pokemons.length}/6* | LV Médio: *${media}*\n│ Boxes: *${user.boxesUnlocked}/10* | Guardados: *${user.boxes.slice(0,user.boxesUnlocked).reduce((n,b)=>n+b.length,0)}/${user.boxesUnlocked*30}*\n│ Aventura: *${etapa}/${historia.length}* rotas\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🚀 INÍCIO E PERFIL ⪨─┓\n│ /start - Começar jornada\n│ /regiao <nome> - Escolher região\n│ /inicial <nome> - Escolher Pokémon inicial\n│ /menu ou /menupk - Abrir este menu\n│ /perfil - Ver perfil e progresso\n│ /rank - Ranking dos treinadores\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 🐾 MEU TIME ⪨─┓\n│ /time - Ver Pokémon e atributos\n│ /moves <n> ou /golpes <n> - Ver golpes\n│ /renomear <n> <nome> - Mudar apelido\n│ /alimentar <n> - Alimentar Pokémon (P$100)\n│ /treinar <n> - Treinar (cooldown de 5 min)\n│ /upar <n> - Treino intenso (custo LV x P$80)\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 📦 BOXES DE POKÉMON ⪨─┓\n│ /box ou /pc - Ver resumo da box ativa\n│ /listarbox - Ver lista com posições da box ativa\n│ /box <n> - Trocar para box desbloqueada\n│ /comprarbox - Comprar a próxima box\n│ /guardar <n> - Guardar Pokémon do time\n│ /retirar <n> - Retirar Pokémon da box ativa\n│ /transferir <posição> <box> - Transferir Pokémon\n│ Cada box tem 30 vagas; até 10 boxes\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 🌍 EXPLORAÇÃO E CAPTURA ⪨─┓\n│ /explorar ou /mapa - Ver rotas e região\n│ /aventura - Ver progresso da história\n│ /aventura status - Consultar etapa atual\n│ /aventura avançar - Avançar na história\n│ /capturar - Encontrar Pokémon selvagem\n│ /jogarpk <poke/great/ultra/master> - Tentar captura\n│ /fugir - Encerrar encontro selvagem\n│ /safari - Safari (Pokébola Safari; LV30+)\n│ /barco <região> - Viajar (P$5000; LV médio 30+)\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ ⚔ BATALHAS E RAIDS ⪨─┓\n│ /batalha [n] @treinador - Desafiar jogador\n│ /aceitar [n] - Aceitar desafio\n│ /recusar - Recusar desafio\n│ /raid - Ver raid e comandos disponíveis\n│ /raid entrar - Entrar na raid\n│ /raid sair - Sair da raid\n│ /raidgo ou /raid iniciar - Iniciar raid (mín. 2)\n│ /raid atacar <n> - Atacar com Pokémon do time\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 🌿 COLETA E MOCHILA ⪨─┓\n│ /colherfruits - Vasculhar moitas (5min cd)\n│ /bag ou /mochila - Ver mochila completa\n│ /vender <berry> <qtd> - Vender berries\n│ /diario - Recompensa diária + streak\n│ /trocar @amigo <seu> <dele> - Trocar Pokémon\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 💰 ECONOMIA E LOJA ⪨─┓\n│ /loja - Ver preços das Pokébolas\n│ /comprar <poke/great/ultra/master/safari> - Comprar 1\n│ /trabalhar - Ganhar dinheiro (cooldown de 10 min)\n│ /comprarbox - Desbloquear a próxima box\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ ⚠ CONTA ⪨─┓\n│ /reset - Iniciar reset da conta\n│ /reset confirmar - Apagar o progresso permanentemente\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n💡 *Dica:* use os comandos exatamente como aparecem. Parâmetros entre < > devem ser substituídos pelos valores desejados.`
            try{
                if (fs.existsSync(MENU_BANNER_PATH)){
                    const buff = fs.readFileSync(MENU_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: cap }, { quoted: msg })
                }
            }catch{}
            return await reply(cap, null)
        }

        if (['/time','†/time'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const header = `╭━━━⊱ 🌙 *MEU TIME* ⊱━━━╮\n│ Região: *${user.regiao.toUpperCase()}*\n│ Total: *${user.pokemons.length}/6*\n│ P$: *${user.money}* | Rank: *#${user.rank||0}*\n╰━━━━━━━━━━━━━━━━━━━━╯\n`
            let corpo=''
            user.pokemons.forEach((pk,i)=>{
                const nomeExib = (pk.apelido||pk.nome)
                const need = getXPNeeded(pk.level, pk.growthRate||'medium-fast')
                const ivTotal = sumIV(pk.iv)
                const real = getDisplayStats(pk)
                corpo+=`\n┏─⪩ ${i+1}. *${nomeExib.toUpperCase()}*${pk.shiny?' ✨ SHINY':''}${pk.mega?' 🔥MEGA':''} ⪨─┓\n`
                corpo+=`│ 🆔 ${pk.nome.toUpperCase()} | ${pk.sexo} | ${pk.nature}\n`
                corpo+=`│ 📊 Level: ${pk.level} | EXP: ${pk.exp||0}/${need}\n`
                corpo+=`│ ❤ HP: ${real.hp} (base ${pk.base.hp}) | 🗡 ATK: ${real.atk} (base ${pk.base.atk})\n`
                corpo+=`│ 🛡 DEF: ${real.def} (base ${pk.base.def}) | 🔮 SPA: ${real.spa} (base ${pk.base.spa})\n`
                corpo+=`│ 🔰 SPD: ${real.spd} (base ${pk.base.spd}) | ⚡ SPE: ${real.spe} (base ${pk.base.spe})\n`
                corpo+=`│ 💎 IV: ${ivTotal}/186 | 💫 Habilidade: ${pk.habilidade}\n`
                corpo+=`│ 🎯 Moves:\n`
                pk.moves.forEach((m,j)=>{ corpo+=`│   ${j+1}. ${m.toUpperCase()}\n` })
                corpo+=`│ 🍖 Fome: ${pk.fome||100}% | 😊 Humor: ${pk.humor||100}%\n`
                corpo+=`│ 🏆 V:${pk.vitorias||0} D:${pk.derrotas||0}\n`
                corpo+=`┗━─━─━─━─━─━─━─━─━─━┛\n`
            })
            const footer = `\n🎮 AÇÕES:\n│ /alimentar <n> P$100\n│ /treinar <n> 5min cd\n│ /upar <n> LVx80 15min cd\n│ /moves <n> | /renomear <n> <nome>`
            const timeImg = user.pokemons[0]?.foto || (fs.existsSync(MENU_BANNER_PATH) ? MENU_BANNER_PATH : null)
            return reply(header+corpo+footer, timeImg)
        }

        if (['/comprarbox','†/comprarbox','/comprar box','†/comprar box'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const precosBoxes = [0,4000,8000,14000,22000,32000,44000,60000,80000,110000]
            if (user.boxesUnlocked >= 10) return reply(`🎉 Você já desbloqueou todas as 10 boxes! Capacidade total: 300 Pokémon.`)
            const proxima = user.boxesUnlocked + 1
            const preco = precosBoxes[proxima-1]
            if (user.money < preco) return reply(`💰 *BOX ${proxima} BLOQUEADA*\nPreço: P$${preco.toLocaleString('pt-BR')}\nSeu saldo: P$${user.money.toLocaleString('pt-BR')}\nFaltam: P$${(preco-user.money).toLocaleString('pt-BR')}\n\nGanhe dinheiro com /trabalhar, aventuras e raids.`)
            user.money -= preco
            user.boxesUnlocked = proxima
            user.boxAtiva = proxima
            salvar()
            return reply(`🎉 *BOX ${proxima} DESBLOQUEADA!*\nVocê pagou P$${preco.toLocaleString('pt-BR')}.\nSaldo restante: P$${user.money.toLocaleString('pt-BR')}\nCapacidade disponível: ${user.boxesUnlocked*30} Pokémon.\n\nUse /box para ver sua nova box.`)
        }

        if (['/listarbox','†/listarbox','/listabox','†/listabox','/boxlista','†/boxlista'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const box = user.boxes[user.boxAtiva-1]
            if (!box || box.length === 0) {
                return reply(`📦 *LISTA DA BOX ${user.boxAtiva}*\n\nEsta box está vazia.\nUse /guardar <n> para guardar um Pokémon do seu time.`)
            }
            const linhas = box.map((pk,i) => `│ Posição *${i+1}*: ${(pk.apelido||pk.nome).toUpperCase()}${pk.apelido ? ` (${pk.nome.toUpperCase()})` : ''}${pk.shiny ? ' ✨ SHINY' : ''} — LV${pk.level}`).join('\n')
            return reply(`╭━━━⊱ 📋 *POKÉMON DA BOX ${user.boxAtiva}* ⊱━━━╮\n│ Pokémon listados: *${box.length}/30*\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n${linhas}\n\nUse /retirar <posição> para trazer um Pokémon ao time.\nUse /box <n> para trocar a box ativa.`)
        }

        if (lower === '/box' || lower === '†/box' || lower === '/pc' || lower === '†/pc' || lower.startsWith('/box ') || lower.startsWith('†/box ') || lower.startsWith('/pc ') || lower.startsWith('†/pc ')) {
            if (!user.registrado) return reply(`Use /start`)
            const partes = lower.split(/\s+/)
            const pedido = parseInt(partes[1],10)
            if (partes.length > 1) {
                if (!Number.isInteger(pedido) || pedido < 1 || pedido > 10) return reply(`Use /box <1-10>. Para desbloquear a próxima box, use /comprarbox.`)
                if (pedido > user.boxesUnlocked) {
                    const precosBoxes = [0,4000,8000,14000,22000,32000,44000,60000,80000,110000]
                    const preco = precosBoxes[pedido-1]
                    return reply(`🔒 A Box ${pedido} está bloqueada.\nBoxes desbloqueadas: ${user.boxesUnlocked}/10\nPara comprar a próxima box, use /comprarbox (P$${preco.toLocaleString('pt-BR')}).`)
                }
                user.boxAtiva = pedido
                salvar()
            }
            const box = user.boxes[user.boxAtiva-1]
            const totalGuardados = user.boxes.slice(0,user.boxesUnlocked).reduce((n,b)=>n+b.length,0)
            const proxima = user.boxesUnlocked < 10 ? `\nPróxima Box ${user.boxesUnlocked+1}: P$${[0,4000,8000,14000,22000,32000,44000,60000,80000,110000][user.boxesUnlocked].toLocaleString('pt-BR')} — use /comprarbox` : '\nTodas as boxes estão desbloqueadas!'
            return reply(`╭━━━⊱ 📦 *BOX ${user.boxAtiva}/${user.boxesUnlocked}* ⊱━━━╮\n│ Espaços usados: *${box.length}/30*\n│ Time: *${user.pokemons.length}/6*\n│ Boxes desbloqueadas: *${user.boxesUnlocked}/10*\n│ Total nas boxes: *${totalGuardados}/${user.boxesUnlocked*30}*\n╰━━━━━━━━━━━━━━━━━━━━╯\n\nUse /listarbox para ver os Pokémon desta box.\n\nComandos:\n/box <1-${user.boxesUnlocked}> - Trocar de box desbloqueada\n/listarbox - Listar Pokémon da box ativa\n/comprarbox - Comprar a próxima box\n/guardar <1-6> - Guardar Pokémon do time nesta box\n/retirar <1-30> - Retirar desta box para o time\n/transferir <1-30> <box> - Enviar para outra box desbloqueada${proxima}`)
        }

        if (lower.startsWith('/guardar') || lower.startsWith('†/guardar')) {
            if (!user.registrado) return reply(`Use /start`)
            const box = user.boxes[user.boxAtiva-1]
            if (box.length >= 30) return reply(`❌ A Box ${user.boxAtiva} está cheia (30/30). Troque de box desbloqueada com /box <n> ou compre outra com /comprarbox.`)
            const idx = parseInt(lower.split(/\s+/)[1],10)-1
            if (!Number.isInteger(idx) || idx<0 || idx>=user.pokemons.length || idx>=6) return reply(`Use: /guardar <1-6>\nExemplo: /guardar 2\nVeja seu time com /time.`)
            if (user.pokemons.length<=1) return reply(`❌ Você precisa manter pelo menos 1 Pokémon no time.`)
            const [pk] = user.pokemons.splice(idx,1)
            box.push(pk)
            salvar()
            return reply(`📦 *${(pk.apelido||pk.nome).toUpperCase()}* foi guardado na Box ${user.boxAtiva}!\nTime: ${user.pokemons.length}/6 | Box ${user.boxAtiva}: ${box.length}/30`)
        }

        if (lower.startsWith('/retirar') || lower.startsWith('†/retirar')) {
            if (!user.registrado) return reply(`Use /start`)
            if (user.pokemons.length>=6) return reply(`❌ Seu time já está cheio (6/6). Use /guardar <n> antes de retirar outro Pokémon.`)
            const box = user.boxes[user.boxAtiva-1]
            const idx = parseInt(lower.split(/\s+/)[1],10)-1
            if (!Number.isInteger(idx) || idx<0 || idx>=30 || idx>=box.length) return reply(`Use: /retirar <1-30>\nO número é a posição do Pokémon na Box ${user.boxAtiva}. Veja com /box.`)
            const [pk] = box.splice(idx,1)
            user.pokemons.push(pk)
            salvar()
            return reply(`🐾 *${(pk.apelido||pk.nome).toUpperCase()}* voltou da Box ${user.boxAtiva} para seu time!\nTime: ${user.pokemons.length}/6 | Box ${user.boxAtiva}: ${box.length}/30`, pk.foto)
        }

        if (lower.startsWith('/transferir') || lower.startsWith('†/transferir')) {
            if (!user.registrado) return reply(`Use /start`)
            const args = lower.split(/\s+/)
            const pos = parseInt(args[1],10)
            const destinoNum = parseInt(args[2],10)
            if (!Number.isInteger(pos) || pos < 1 || pos > 30 || !Number.isInteger(destinoNum) || destinoNum < 1 || destinoNum > user.boxesUnlocked) return reply(`Use: /transferir <posição 1-30> <box desbloqueada>\nExemplo: /transferir 4 2\nO Pokémon sai da Box ativa (${user.boxAtiva}) e vai para a box indicada.`)
            const origem = user.boxes[user.boxAtiva-1]
            if (pos > origem.length) return reply(`❌ Não existe Pokémon na posição ${pos} da Box ${user.boxAtiva}.`)
            if (destinoNum === user.boxAtiva) return reply(`❌ Escolha uma box diferente da box ativa (${user.boxAtiva}).`)
            const destino = user.boxes[destinoNum-1]
            if (destino.length >= 30) return reply(`❌ A Box ${destinoNum} está cheia (30/30). Nenhum Pokémon foi movido.`)
            const [pk] = origem.splice(pos-1,1)
            destino.push(pk)
            salvar()
            return reply(`🔁 *${(pk.apelido||pk.nome).toUpperCase()}* foi transferido da Box ${user.boxAtiva} para a Box ${destinoNum}.\nBox ${user.boxAtiva}: ${origem.length}/30 | Box ${destinoNum}: ${destino.length}/30`)
        }

        if (lower.startsWith('/moves') || lower.startsWith('†/moves') || lower.startsWith('/golpes')) {
            const idx = parseInt(lower.split(' ')[1])-1
            const pk = user.pokemons[idx]
            if (!pk) return reply(`Use: /moves 1`)
            const need = getXPNeeded(pk.level, pk.growthRate)
            return reply(`╭━━━⊱ 🎯 MOVES - ${(pk.apelido||pk.nome).toUpperCase()} ⊱━━━╮\n│ LV${pk.level} | ${pk.moves.length}/4 | ${pk.exp||0}/${need} EXP\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n${pk.moves.map((m,i)=>`${i+1}. ${m.toUpperCase()}`).join('\n')}`, pk.foto)
        }

        if (lower.startsWith('/renomear') || lower.startsWith('†/renomear')) {
            const parts = textoRaw.split(' ')
            const idx = parseInt(parts[1])-1
            const novoNome = parts.slice(2).join(' ')
            const pk = user.pokemons[idx]
            if (!pk || !novoNome) return reply(`Use: /renomear 1 Pikachu Forte`)
            if (novoNome.length>20) return reply(`Nome muito grande! Máx 20`)
            pk.apelido = novoNome
            salvar()
            return reply(`✏ ${(pk.nome).toUpperCase()} agora se chama *${novoNome.toUpperCase()}*!`, pk.foto)
        }

        const moveCache = new Map()
        async function getMoveInfo(moveName) {
            const key = String(moveName||'').trim().toLowerCase()
            if (!key) return null
            if (moveCache.has(key)) return moveCache.get(key)
            try {
                const res = (await axios.get(`https://pokeapi.co/api/v2/move/${encodeURIComponent(key)}`, {timeout:5000})).data
                if (!res?.name || !res?.type?.name || !res?.damage_class?.name) return null
                const info = { name:res.name, id:res.id, power:Number.isFinite(res.power)?res.power:null, type:res.type.name, damage_class:res.damage_class.name, accuracy:Number.isFinite(res.accuracy)?res.accuracy:null, priority:Number.isFinite(res.priority)?res.priority:0, pp:res.pp||1, ailment:res.meta?.ailment?.name||'none', ailmentChance:res.meta?.ailment_chance||0, drain:res.meta?.drain||0, healing:res.meta?.healing||0, minHits:res.meta?.min_hits||1, maxHits:res.meta?.max_hits||1, minTurns:res.meta?.min_turns||null, maxTurns:res.meta?.max_turns||null, critRate:res.meta?.crit_rate||0, flinchChance:res.meta?.flinch_chance||0, recoil:res.meta?.recoil||0, statChance:res.meta?.stat_chance||0, effectChance:res.effect_chance||0, metaCategory:res.meta?.category?.name||'damage', effectText:(res.effect_entries||[]).find(e=>e.language?.name==='en')?.short_effect||'', target:res.target?.name||'selected-pokemon', statChanges:(res.stat_changes||[]).map(x=>({stat:x.stat?.name,change:x.change})) }
                moveCache.set(key, info)
                return info
            } catch (e) {
                console.warn('[MOVES] Dados indisponíveis para move:', key, e.message)
                return null
            }
        }
        const TYPE_CHART = {
            normal: { rock:0.5, ghost:0, steel:0.5 },
            fire: { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5, steel:2 },
            water: { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
            electric: { water:2, electric:0.5, grass:0.5, ground:0, flying:2, dragon:0.5 },
            grass: { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5, steel:0.5 },
            ice: { fire:0.5, water:0.5, grass:2, ice:0.5, ground:2, flying:2, dragon:2, steel:0.5 },
            fighting: { normal:2, ice:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, rock:2, ghost:0, dark:2, steel:2, fairy:0.5 },
            poison: { grass:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0, fairy:2 },
            ground: { fire:2, electric:2, grass:0.5, poison:2, flying:0, bug:0.5, rock:2, steel:2 },
            flying: { electric:0.5, grass:2, fighting:2, bug:2, rock:0.5, steel:0.5 },
            psychic: { fighting:2, poison:2, psychic:0.5, dark:0, steel:0.5 },
            bug: { fire:0.5, grass:2, fighting:0.5, poison:0.5, flying:0.5, psychic:2, ghost:0.5, dark:2, steel:0.5, fairy:0.5 },
            rock: { fire:2, ice:2, fighting:0.5, ground:0.5, flying:2, bug:2, steel:0.5 },
            ghost: { normal:0, psychic:2, ghost:2, dark:0.5 },
            dragon: { dragon:2, steel:0.5, fairy:0 },
            dark: { fighting:0.5, psychic:2, ghost:2, dark:0.5, fairy:0.5 },
            steel: { fire:0.5, water:0.5, electric:0.5, ice:2, rock:2, steel:0.5, fairy:2 },
            fairy: { fire:0.5, fighting:2, poison:0.5, dragon:2, dark:2, steel:0.5 }
        }
        function getEffectiveness(atkType, defTypes) {
            let eff = 1
            for (const def of defTypes) {
                const chart = TYPE_CHART[atkType] || {}
                if (chart[def] !== undefined) eff *= chart[def]
            }
            return eff
        }
        async function getPokeTypes(pokeName) {
            try {
                const data = await getPokeData(pokeName)
                if (!data) return ['normal']
                return data.poke.types.map(t=>t.type.name)
            } catch { return ['normal'] }
        }

        function battleName(pk) { return String(pk?.apelido||pk?.nome||'Pokémon').toUpperCase() }
        function battleStage(stage) { return stage>=0?(2+stage)/2:2/(2-stage) }
        function battleState(mon,types) {
            if(!mon.base)mon.base={hp:50,atk:50,def:50,spa:50,spd:50,spe:50}
            if(!mon.iv)mon.iv=genIV()
            for(const k of ['hp','atk','def','spa','spd','spe']) { if(!Number.isFinite(mon.base[k])||mon.base[k]<=0)mon.base[k]=50; if(!Number.isFinite(mon.iv[k]))mon.iv[k]=15 }
            if(!mon.nature)mon.nature='hardy'; if(!mon.level)mon.level=5
            const stats=getDisplayStats(mon)
            return {hp:stats.hp,maxHp:stats.hp,stats,types,pp:(mon.moves||[]).map(()=>0),stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},status:null,statusTurns:0,toxic:1,volatile:{}}
        }
        function battleStat(st,key) { let n=Math.floor((st.stats[key]||1)*battleStage(st.stages[key]||0)); if(key==='spe'&&st.status==='paralysis')n=Math.floor(n*.5); return Math.max(1,n) }
        function battleStatusText(s) { return ({burn:'Queimado',poison:'Envenenado',toxic:'Envenenamento grave',paralysis:'Paralisado',sleep:'Dormindo',freeze:'Congelado'})[s]||'Normal' }
        function livingBattle(side) { return side.team.map((_,i)=>i).filter(i=>side.states[i].hp>0) }
        function battleMenu(session,idx) {
            const side=session.sides[idx], foe=session.sides[1-idx], mon=side.team[side.active], st=side.states[side.active], fm=foe.team[foe.active], fs=foe.states[foe.active]
            let out=`⚔️ *BATALHA POKÉMON — TURNO ${session.turn}*\n🐾 *${battleName(mon)}* Nv.${mon.level}: ${Math.max(0,st.hp)}/${st.maxHp} HP${st.status?' | '+battleStatusText(st.status):''}\n🆚 *${battleName(fm)}* Nv.${fm.level}: ${Math.max(0,fs.hp)}/${fs.maxHp} HP${fs.status?' | '+battleStatusText(fs.status):''}\n\n`
            if(st.hp<=0)return out+`⚠️ Pokémon desmaiado. Escolha um substituto:\n${side.team.map((p,i)=>`${i+1}. ${battleName(p)} — ${Math.max(0,side.states[i].hp)}/${side.states[i].maxHp} HP`).join('\n')}\nUse /pokemon <número>`
            return out+`1. ⚔️ Lutar — /lutar\n2. 🔄 Pokémon — /pokemon\n3. 🎒 Mochila — /mochila batalha\n4. 🏃 Fugir — /fugir${session.mode==='wild'?'\n5. 🎾 Capturar — /jogarpk poke|great|ultra|master':''}`
        }
        async function initBattleSide(team,owner) {
            const valid=team.filter(Boolean), types=await Promise.all(valid.map(p=>getPokeTypes(p.nome))), states=valid.map((p,i)=>battleState(p,types[i]))
            await Promise.all(valid.map(async(p,i)=>{ if(!Array.isArray(p.moves)||!p.moves.length)p.moves=['tackle','growl']; await Promise.all(p.moves.map(async(m,j)=>{const info=await getMoveInfo(m);states[i].pp[j]=info?.pp||1})) }))
            return {team:valid,states,active:0,user:owner||null,hazards:{stealthRock:false,spikes:0,toxicSpikes:0,stickyWeb:false},screens:{reflect:0,lightScreen:0,auroraVeil:0,tailwind:0}}
        }
        async function startBattle({key=from,teamA,teamB,players=[sender],labels=['VOCÊ','ADVERSÁRIO'],mode='npc',meta={}}) {
            if(activeBattles[key]&&!activeBattles[key].finished)return {ok:false,error:'Já existe uma batalha ativa neste chat.'}
            if(!teamA?.length||!teamB?.length)return {ok:false,error:'Uma das equipes está vazia.'}
            const sides=[await initBattleSide(teamA,db[players[0]]||user),await initBattleSide(teamB,players[1]?db[players[1]]:null)]
            const session={key,mode,players,labels,sides,meta,field:{weather:null,terrain:null,trickRoom:0},turn:1,actions:{},resolving:false,finished:false,seen:{},last:{}}
            activeBattles[key]=session
            await sock.sendMessage(key,{text:`⚔️ *BATALHA INICIADA!*\n\n${players.map((jid,i)=>`${labels[i]}:\n${battleMenu(session,i)}`).join('\n\n')}`,mentions:players})
            return {ok:true,session}
        }
        function sessionFor(jid,chat) { const s=activeBattles[chat]; return s&&!s.finished&&s.players.includes(jid)?s:null }
        async function moveMenu(session,idx) {
            const side=session.sides[idx],mon=side.team[side.active],st=side.states[side.active], rows=[]
            for(let i=0;i<mon.moves.length;i++){const m=await getMoveInfo(mon.moves[i]);rows.push(`${i+1}. ${(m?.name||mon.moves[i]).toUpperCase()} — ${(m?.type||'?').toUpperCase()} | ${m?.damage_class||'?'} | Poder ${m?.power??'—'} | Precisão ${m?.accuracy??'—'} | PP ${st.pp[i]}/${m?.pp||st.pp[i]}`)}
            return `🎯 *MOVES DE ${battleName(mon)}*\n${rows.join('\n')}\nUse /lutar <número>`
        }
        async function battleAI(session,idx) {
            const side=session.sides[idx], foe=session.sides[1-idx],st=side.states[side.active]
            if(st.hp<=0){const n=livingBattle(side)[0];return n===undefined?{type:'none'}:{type:'switch',index:n}}
            let best=null,score=-1
            for(let i=0;i<side.team[side.active].moves.length;i++){if(st.pp[i]<=0)continue;const m=await getMoveInfo(side.team[side.active].moves[i]);if(!m)continue;const eff=getEffectiveness(m.type,foe.states[foe.active].types);const val=m.power?m.power*eff*(m.accuracy==null?0.8:m.accuracy/100):m.statChanges?.length?15:1;if(eff>0&&val>score){score=val;best={type:'move',index:i}}}
            return best||{type:'struggle'}
        }
        function inflictStatus(mon,st,status) {
            if(st.status)return false
            if(status==='burn'&&st.types.includes('fire'))return false
            if(['poison','toxic'].includes(status)&&(st.types.includes('poison')||st.types.includes('steel')))return false
            if(status==='paralysis'&&st.types.includes('electric'))return false
            if(status==='freeze'&&st.types.includes('ice'))return false
            if(!['burn','poison','toxic','paralysis','sleep','freeze'].includes(status))return false
            st.status=status;st.statusTurns=status==='sleep'?2+Math.floor(Math.random()*3):0;st.toxic=1;return true
        }
        // Regras específicas para golpes cujo efeito não pode ser inferido apenas por poder/tipo.
        // A PokéAPI é usada como fonte dos metadados; a execução fica no motor local.
        function applyMoveSpecialEffect(session,idx,key,log) {
            const side=session.sides[idx],foe=session.sides[1-idx],mon=side.team[side.active],target=foe.team[foe.active],a=side.states[side.active],d=foe.states[foe.active];
            const heal=(f=.5)=>{const n=Math.min(a.maxHp-a.hp,Math.max(1,Math.floor(a.maxHp*f)));a.hp+=n;return log+`💚 ${battleName(mon)} recuperou ${n} HP!\n`};
            const weatherMoves={'sunny-day':'sun','rain-dance':'rain','sandstorm':'sandstorm','snowscape':'snow','hail':'snow'};
            const terrainMoves={'electric-terrain':'electric','grassy-terrain':'grassy','psychic-terrain':'psychic','misty-terrain':'misty'};
            if(weatherMoves[key]){session.field.weather={name:weatherMoves[key],turns:5};return log+`🌦️ Clima alterado para ${weatherMoves[key]} por 5 turnos.\n`}
            if(terrainMoves[key]){session.field.terrain={name:terrainMoves[key],turns:5};return log+`🌱 Terreno ${terrainMoves[key]} ativo por 5 turnos.\n`}
            if(key==='stealth-rock'){foe.hazards.stealthRock=true;return log+'🪨 Stealth Rock espalhado no lado adversário.\n'}
            if(key==='spikes'){foe.hazards.spikes=Math.min(3,foe.hazards.spikes+1);return log+`📌 Spikes: ${foe.hazards.spikes}/3 camadas.\n`}
            if(key==='toxic-spikes'){foe.hazards.toxicSpikes=Math.min(2,foe.hazards.toxicSpikes+1);return log+`☠️ Toxic Spikes: ${foe.hazards.toxicSpikes}/2 camadas.\n`}
            if(key==='sticky-web'){foe.hazards.stickyWeb=true;return log+'🕸️ Sticky Web espalhada no lado adversário.\n'}
            if(['reflect','light-screen','aurora-veil','tailwind'].includes(key)){const k=key==='light-screen'?'lightScreen':key==='aurora-veil'?'auroraVeil':key;side.screens[k]=5;return log+`🛡️ ${key.toUpperCase()} ativo por 5 turnos.\n`}
            if(['protect','detect','kings-shield','spiky-shield','baneful-bunker','silk-trap'].includes(key)){a.volatile.protect=true;return log+`🛡️ ${battleName(mon)} se protegeu!\n`}
            if(key==='substitute'){const cost=Math.floor(a.maxHp/4);if(a.hp<=cost)return log+'⛔ HP insuficiente para Substitute.\n';a.hp-=cost;a.volatile.substitute=cost;return log+'👤 Substitute criado!\n'}
            if(key==='trick-room'){session.field.trickRoom=session.field.trickRoom?0:5;return log+`🌀 Trick Room ${session.field.trickRoom?'ativado':'desativado'}.\n`}
            if(['defog','rapid-spin'].includes(key)){foe.hazards={stealthRock:false,spikes:0,toxicSpikes:0,stickyWeb:false};side.hazards={stealthRock:false,spikes:0,toxicSpikes:0,stickyWeb:false};if(key==='rapid-spin')a.stages.spe=Math.min(6,a.stages.spe+1);return log+'💨 Armadilhas removidas do campo.\n'}

            const set=(st,k,n)=>{const v=st.ability==='contrary'?-n:n;st.stages[k]=Math.max(-6,Math.min(6,(st.stages[k]||0)+v))};
            const boosts={'swords-dance':[['atk',2]],'nasty-plot':[['spa',2]],agility:[['spe',2]],'iron-defense':[['def',2]],amnesia:[['spd',2]],'calm-mind':[['spa',1],['spd',1]],'bulk-up':[['atk',1],['def',1]],'dragon-dance':[['atk',1],['spe',1]],'quiver-dance':[['spa',1],['spd',1],['spe',1]],coil:[['atk',1],['def',1],['accuracy',1]],'shell-smash':[['atk',2],['spa',2],['spe',2],['def',-1],['spd',-1]],'shift-gear':[['atk',1],['spe',2]],growth:[['atk',1],['spa',1]],'hone-claws':[['atk',1],['accuracy',1]],'work-up':[['atk',1],['spa',1]],'rock-polish':[['spe',2]],autotomize:[['spe',2]],'tail-glow':[['spa',3]]};
            const drops={'growl':[['atk',-1]],charm:[['atk',-2]],'feather-dance':[['atk',-2]],'string-shot':[['spe',-2]],'scary-face':[['spe',-2]],screech:[['def',-2]],'metal-sound':[['spd',-2]],'fake-tears':[['spd',-2]],leer:[['def',-1]],'tail-whip':[['def',-1]],'sand-attack':[['accuracy',-1]],smokescreen:[['accuracy',-1]],flash:[['accuracy',-1]],kinesis:[['accuracy',-1]],'cotton-spore':[['spe',-2]],tickle:[['atk',-1],['def',-1]],'baby-doll-eyes':[['atk',-1]]};
            if(['recover','roost','soft-boiled','slack-off','milk-drink','shore-up','lunar-blessing'].includes(key))return heal(.5);
            if(['synthesis','morning-sun','moonlight'].includes(key)){const w=session.field?.weather?.name;return heal(w==='sun'?2/3:['rain','sandstorm','snow'].includes(w)?0.25:0.5)}
            if(key==='rest'){a.hp=a.maxHp;a.status='sleep';a.statusTurns=2;a.toxic=1;return log+`😴 ${battleName(mon)} recuperou todo o HP e adormeceu!\n`}
            if(boosts[key]){for(const [k,n] of boosts[key])set(a,k,n);return log+`✨ ${battleName(mon)} usou ${key.toUpperCase()} e alterou seus atributos!\n`}
            if(drops[key]){for(const [k,n] of drops[key])set(d,k,n);return log+`⬇️ ${battleName(target)} teve seus atributos reduzidos por ${key.toUpperCase()}!\n`}
            if(['haze','clear-smog'].includes(key)){for(const st of [a,d])for(const k of Object.keys(st.stages))st.stages[k]=0;return log+'🌫️ Todas as alterações de atributos foram zeradas!\n'}
            if(key==='topsy-turvy'){for(const k of Object.keys(d.stages))d.stages[k]=-d.stages[k];return log+'🔄 As alterações de atributos do alvo foram invertidas!\n'}
            if(key==='psych-up'){a.stages={...d.stages};return log+'🧠 Copiou as alterações de atributos do alvo!\n'}
            if(key==='pain-split'){const avg=Math.floor((a.hp+d.hp)/2);a.hp=Math.min(a.maxHp,avg);d.hp=Math.min(d.maxHp,avg);return log+`💔 Pain Split igualou o HP atual: ${a.hp} / ${d.hp}.\n`}
            if(key==='perish-song'){a.volatile.perish=3;d.volatile.perish=3;return log+'🎵 Perish Song: ambos os Pokémon têm 3 turnos restantes.\n'}
            if(key==='destiny-bond'){a.volatile.destinyBond=true;return log+'☠️ Destiny Bond está ativo.\n'}
            if(key==='ingrain'){a.volatile.ingrain=true;return log+'🌿 Ingrain começou a recuperar HP por turno.\n'}
            if(key==='aqua-ring'){a.volatile.aquaRing=true;return log+'💧 Aqua Ring começou a recuperar HP por turno.\n'}
            if(key==='magnet-rise'){a.volatile.grounded=false;a.volatile.magnetRise=5;return log+'🧲 Magnet Rise suspendeu o Pokémon por 5 turnos.\n'}
            if(['mean-look','block','spider-web','wrap','bind','fire-spin','whirlpool','sand-tomb','magma-storm','infestation','thunder-cage'].includes(key)){d.volatile.trapped=4;return log+`🕸️ ${battleName(target)} ficou preso por alguns turnos.\n`}
            if(key==='yawn'){d.volatile.yawn=2;return log+`🥱 ${battleName(target)} está sonolento.\n`}
            if(['will-o-wisp','toxic','thunder-wave','stun-spore','spore','sleep-powder','hypnosis','poison-powder','glare','nuzzle','dark-void','sing','lovely-kiss','grass-whistle'].includes(key)){const status={'will-o-wisp':'burn',toxic:'toxic','thunder-wave':'paralysis','stun-spore':'paralysis',spore:'sleep','sleep-powder':'sleep',hypnosis:'sleep','poison-powder':'poison',glare:'paralysis',nuzzle:'paralysis','dark-void':'sleep',sing:'sleep','lovely-kiss':'sleep','grass-whistle':'sleep'}[key];if(d.types.includes('grass')&&['spore','sleep-powder','stun-spore','poison-powder'].includes(key))return log+'🌿 O tipo Grama é imune a este pó/esporo.\n';if(inflictStatus(target,d,status))return log+`✨ ${battleName(target)} ficou ${battleStatusText(status).toLowerCase()}!\n`;return log+`⛔ O status não afetou ${battleName(target)}.\n`}
            if(['confuse-ray','swagger','teeter-dance','supersonic','sweet-kiss','flatter'].includes(key)){d.volatile.confusion=3;if(key==='swagger')set(d,'atk',2);if(key==='flatter')set(d,'spa',1);return log+`💫 ${battleName(target)} ficou confuso!\n`}
            if(key==='leech-seed'){if(d.types.includes('grass'))return log+'🌿 Pokémon do tipo Grama não pode ser afetado por Leech Seed.\n';d.volatile.leechSeed=true;return log+'🌱 Leech Seed foi aplicado!\n'}
            if(['taunt','torment','encore','disable','heal-block','embargo'].includes(key)){d.volatile[key.replace(/-/g,'')]=3;return log+`⛔ ${key.toUpperCase()} aplicado por 3 turnos.\n`}
            if(['gravity','magic-room','wonder-room'].includes(key)){session.field[key]={turns:5};return log+`🌀 ${key.toUpperCase()} ativado por 5 turnos.\n`}
            if(['foresight','miracle-eye','odor-sleuth'].includes(key)){d.volatile.identified=true;return log+'👁️ O alvo foi identificado.\n'}
            if(['trick','switcheroo','knock-off','thief','covet'].includes(key))return log+`👜 ${key.toUpperCase()} precisa de sistema de itens equipados para concluir seu efeito completo.\n`;
            return null;
        }
        async function performMove(session,idx,moveIndex,log) {
            const side=session.sides[idx],foe=session.sides[1-idx],mon=side.team[side.active],target=foe.team[foe.active],a=side.states[side.active],d=foe.states[foe.active]
            const name=moveIndex==='struggle'?'struggle':mon.moves[moveIndex],m=moveIndex==='struggle'?{name:'struggle',power:50,type:'normal',damage_class:'physical',accuracy:null,priority:0,pp:1,ailment:'none',ailmentChance:0,drain:0,healing:0,minHits:1,maxHits:1,statChanges:[]}:await getMoveInfo(name)
            if(!m)return log+`⚠️ Dados de ${name} indisponíveis; move cancelado.\n`
            if(moveIndex!=='struggle'){if((a.pp[moveIndex]||0)<=0)return log+'⛔ Sem PP para esse move.\n';a.pp[moveIndex]--}
            if(a.status==='sleep'){a.statusTurns--;if(a.statusTurns>0)return log+`💤 ${battleName(mon)} está dormindo!\n`;a.status=null;log+=`💤 ${battleName(mon)} acordou!\n`}
            if(a.status==='freeze'){if(Math.random()>=.2)return log+`🧊 ${battleName(mon)} está congelado!\n`;a.status=null;log+=`☀️ Descongelou!\n`}
            if(a.status==='paralysis'&&Math.random()<.25)return log+`⚡ ${battleName(mon)} não conseguiu agir por causa da paralisia.\n`
            if(a.volatile.confusion>0){a.volatile.confusion--;if(Math.random()<1/3){const x=Math.max(1,Math.floor(mon.level/3+5));a.hp=Math.max(0,a.hp-x);return log+`💫 ${battleName(mon)} se feriu na confusão (${x} HP).\n`}}
            if(!m.power||m.damage_class==='status'){
                const specialLog=applyMoveSpecialEffect(session,idx,m.name.replace(/_/g,'-'),log);if(specialLog!==null)return specialLog
                let effect=false
                if(m.ailment!=='none'&&m.ailmentChance>0&&Math.random()*100<m.ailmentChance){if(m.ailment==='confusion'){d.volatile.confusion=3;effect=true;log+=`${battleName(target)} ficou confuso! `}else if(inflictStatus(target,d,m.ailment)){effect=true;log+=`${battleName(target)} ficou ${battleStatusText(d.status).toLowerCase()}! `}}
                const smap={attack:'atk',defense:'def','special-attack':'spa','special-defense':'spd',speed:'spe',accuracy:'accuracy',evasion:'evasion'}
                for(const c of m.statChanges||[]){const stat=smap[c.stat];if(!stat)continue;const dest=c.change<0?d:a,before=dest.stages[stat];dest.stages[stat]=Math.max(-6,Math.min(6,before+c.change));if(dest.stages[stat]!==before){effect=true;log+=`${stat.toUpperCase()} ${c.change>0?'subiu':'caiu'}! `}}
                if(m.healing>0){const old=a.hp;a.hp=Math.min(a.maxHp,a.hp+Math.max(1,Math.floor(a.maxHp*m.healing/100)));log+=`Recuperou ${a.hp-old} HP! `;effect=true}
                return log+(effect?'\n':'Não houve efeito adicional reconhecido.\n')
            }
            if(m.accuracy!=null&&Math.random()*100>=m.accuracy)return log+`💨 ${m.name.toUpperCase()} errou!\n`
            const eff=getEffectiveness(m.type,d.types);if(eff===0)return log+`🛡️ Não afetou ${battleName(target)}!\n`
            const special=m.damage_class==='special',atk=battleStat(a,special?'spa':'atk'),def=battleStat(d,special?'spd':'def')
            const base=Math.floor((((2*mon.level/5+2)*m.power*(atk/Math.max(1,def)))/50)+2),stab=a.types.includes(m.type)?1.5:1,crit=Math.random()<(m.critRate>0?1/8:1/24),rand=(Math.floor(Math.random()*16)+85)/100,burn=(a.status==='burn'&&!special)?0.5:1,weather=session.field.weather?.name,terrain=session.field.terrain?.name;let weatherMult=1,terrainMult=1;if(weather==='sun'){if(m.type==='fire')weatherMult=1.5;if(m.type==='water')weatherMult=.5}if(weather==='rain'){if(m.type==='water')weatherMult=1.5;if(m.type==='fire')weatherMult=.5}if(terrain==='electric'&&a.types&&!a.types.includes('flying')&&m.type==='electric')terrainMult=1.3;if(terrain==='grassy'&&m.type==='grass')terrainMult=1.3;if(terrain==='psychic'&&m.type==='psychic')terrainMult=1.3;
            let hits=m.maxHits>1?m.minHits+Math.floor(Math.random()*(m.maxHits-m.minHits+1)):1,damage=Math.max(1,Math.floor(base*eff*stab*(crit?1.5:1)*rand*burn*weatherMult*terrainMult))*hits;const screen=foe.screens;if((special&&screen.lightScreen>0)||(!special&&screen.reflect>0)||screen.auroraVeil>0)damage=Math.max(1,Math.floor(damage*.5))
            d.hp=Math.max(0,d.hp-damage);if(m.drain>0)a.hp=Math.min(a.maxHp,a.hp+Math.floor(damage*m.drain/100));if(m.recoil>0&&a.ability!=='rock-head')a.hp=Math.max(0,a.hp-Math.max(1,Math.floor(damage*m.recoil/100)))
            const moveKey=m.name.replace(/_/g,'-')
            if(m.healing>0)a.hp=Math.min(a.maxHp,a.hp+Math.max(1,Math.floor(a.maxHp*m.healing/100)))
            if(m.ailment!=='none'&&m.ailmentChance>0&&Math.random()*100<m.ailmentChance){if(m.ailment==='confusion')d.volatile.confusion=3;else inflictStatus(target,d,m.ailment)}
            if(m.flinchChance>0&&Math.random()*100<m.flinchChance)d.volatile.flinch=true
            if(m.statChanges?.length&&Math.random()*100<(m.statChance||100)){const smap={attack:'atk',defense:'def','special-attack':'spa','special-defense':'spd',speed:'spe',accuracy:'accuracy',evasion:'evasion'};for(const c of m.statChanges){const k=smap[c.stat];if(!k)continue;const selfDrop=['close-combat','overheat','leaf-storm','draco-meteor','superpower','hammer-arm','v-create','make-it-rain'].includes(moveKey);const st=c.change<0&&!selfDrop?d:a;st.stages[k]=Math.max(-6,Math.min(6,st.stages[k]+(st.ability==='contrary'?-c.change:c.change)))}}
            if(moveKey==='rapid-spin'){a.stages.spe=Math.min(6,a.stages.spe+1);side.hazards={stealthRock:false,spikes:0,toxicSpikes:0,stickyWeb:false}}
            if(moveKey==='flame-charge')a.stages.spe=Math.min(6,a.stages.spe+1)
            if(['u-turn','volt-switch','flip-turn','parting-shot'].includes(moveKey))a.volatile.forceSwitch=true
            if(['dragon-tail','circle-throw'].includes(moveKey)&&d.hp>0)d.volatile.forceSwitch=true
            if(['super-fang','natures-madness','ruination'].includes(moveKey)){damage=Math.min(d.hp,Math.max(1,Math.floor(d.hp/2)));d.hp=Math.max(0,d.hp-damage)}
            if(moveKey==='endeavor'&&d.hp>a.hp){damage=d.hp-a.hp;d.hp=a.hp}
            if(['seismic-toss','night-shade'].includes(moveKey)){damage=Math.min(d.hp,mon.level);d.hp=Math.max(0,d.hp-damage)}
            if(moveKey==='dragon-rage'){damage=Math.min(d.hp,40);d.hp=Math.max(0,d.hp-damage)}
            if(moveKey==='sonic-boom'){damage=Math.min(d.hp,20);d.hp=Math.max(0,d.hp-damage)}
            if(['self-destruct','explosion','misty-explosion'].includes(moveKey))a.hp=0
            if(['hyper-beam','giga-impact','blast-burn','frenzy-plant','hydro-cannon','roar-of-time','prismatic-laser'].includes(moveKey))a.volatile.recharge=true
            if(d.hp<=0&&d.volatile.destinyBond){a.hp=0;delete d.volatile.destinyBond}
            return log+`⚔️ ${battleName(mon)} usou *${m.name.toUpperCase()}*! 💥 ${damage} de dano${hits>1?` (${hits} golpes)`:''}. ${eff>1?'Super efetivo! 🔥':eff<1?'Pouco efetivo... 💧':''}${crit?' ✨ CRÍTICO!':''}${stab>1?' STAB!':''}\n❤ ${battleName(target)}: ${d.hp}/${d.maxHp} HP\n`
        }
        async function useBattleItem(session,idx,name,targetIndex) {
            const side=session.sides[idx],owner=side.user,mon=side.team[targetIndex],st=side.states[targetIndex]
            if(!owner)return {ok:false,text:'Inventário indisponível.'}
            const key=String(name||'').toLowerCase().replace(/_/g,'-')
            const defs={potion:{heal:20},'super-potion':{heal:60},'hyper-potion':{heal:120},'max-potion':{full:true},'full-restore':{full:true,status:true},antidote:{status:['poison','toxic']},'paralyze-heal':{status:['paralysis']},awakening:{status:['sleep']},'burn-heal':{status:['burn']},'ice-heal':{status:['freeze']},'full-heal':{status:['burn','poison','toxic','paralysis','sleep','freeze']},revive:{revive:true}}
            const berries={oran:{heal:10},sitrus:{percent:25},pecha:{status:['poison','toxic']},cheri:{status:['paralysis']},chesto:{status:['sleep']},lum:{status:['burn','poison','toxic','paralysis','sleep','freeze']},leppa:{pp:true}}
            const def=defs[key]||berries[key], inv=defs[key]?owner.bag?.itens:owner.bag?.berries
            const invKey=Object.keys(inv||{}).find(k=>k.toLowerCase().replace(/_/g,'-')===key)
            if(!def||!invKey||(inv[invKey]||0)<1)return {ok:false,text:`Você não possui ou não pode usar ${key}.`}
            if(def.revive&&st.hp>0)return {ok:false,text:'Revive só pode ser usado em Pokémon desmaiado.'}
            if(!def.revive&&st.hp<=0)return {ok:false,text:'Esse item não pode ser usado em Pokémon desmaiado.'}
            if((def.heal||def.percent||def.full)&&st.hp>=st.maxHp&&!def.status)return {ok:false,text:'Esse Pokémon já está com HP cheio.'}
            if(def.status&&!def.full&&!def.status.includes(st.status))return {ok:false,text:'O item não corresponde ao status atual.'}
            inv[invKey]--;if(inv[invKey]<=0)delete inv[invKey]
            if(def.heal)st.hp=Math.min(st.maxHp,st.hp+def.heal);if(def.percent)st.hp=Math.min(st.maxHp,st.hp+Math.max(1,Math.floor(st.maxHp*def.percent/100)));if(def.full)st.hp=st.maxHp;if(def.revive)st.hp=Math.max(1,Math.floor(st.maxHp/2));if(def.status){if(def.status===true||def.status.includes(st.status))st.status=null}
            if(def.pp){let j=-1;for(let i=0;i<mon.moves.length;i++){const m=await getMoveInfo(mon.moves[i]);if(st.pp[i]<(m?.pp||st.pp[i])){j=i;break}}if(j<0){inv[invKey]=(inv[invKey]||0)+1;return {ok:false,text:'Todos os moves já têm PP máximo.'}}const m=await getMoveInfo(mon.moves[j]);st.pp[j]=Math.min(m.pp,st.pp[j]+10)}
            salvar();return {ok:true,text:`🎒 ${key} usado em ${battleName(mon)}.`}
        }
        async function finishBattle(session,winner,log) {
            if(session.finished)return;session.finished=true
            const [a,b]=session.sides;let final=log
            if(session.mode==='adventure'){
                const {reg,etapa,recomp,historiaLength}=session.meta
                if(winner==='A'){user.aventura[reg].etapa=etapa+1;user.money+=recomp.money;for(const pk of user.pokemons){const need=getXPNeeded(pk.level,pk.growthRate);await grantExperience(pk,Math.floor(need*recomp.exp/100),'aventura')}if(pendingMoveChoices[sender]?.queue?.length)await promptNextMoveChoice(sender,sender);final+=`\n🏆 VITÓRIA! +P$${recomp.money}. Progresso ${etapa+2}/${historiaLength}.`}else final+='\n💀 Derrota. Treine e tente novamente.'
            }else if(session.mode==='pvp'){
                const wi=winner==='A'?0:1,li=1-wi,wu=db[session.players[wi]],lu=db[session.players[li]]
                for(let i=0;i<2;i++)for(const pk of session.sides[i].team){const need=getXPNeeded(pk.level,pk.growthRate);await grantExperience(pk,Math.floor(need*(i===wi?.8:.2)),'pvp')}
                for(const jid of session.players)if(pendingMoveChoices[jid]?.queue?.length)await promptNextMoveChoice(jid,jid)
                if(wu){wu.money=(wu.money||0)+500;wu.pb=(wu.pb||wu.rank||0)+10;wu.rank=wu.pb}if(lu)lu.money=(lu.money||0)+100
                final+=`\n🏆 ${session.labels[wi]} venceu! Vencedor +P$500/PB+10; perdedor +P$100.`
            }else if(session.mode==='wild'){
                if(winner==='A'){if(!session.meta.captured){const mon=a.team[a.active],wild=b.team[b.active];await grantExperience(mon,Math.max(10,(wild.level||1)*5),'selvagem');final+=`\n🏆 Vitória! ${battleName(mon)} recebeu EXP.`}else final+='\n🎉 Captura concluída!'}else final+='\n💨 Encontro encerrado.'
                if(a.user)a.user._wild=null
            }
            salvar();delete activeBattles[session.key];await sock.sendMessage(session.key,{text:final,mentions:session.players})
        }
        async function resolveBattle(session) {
            if(session.resolving||session.finished)return;session.resolving=true
            let log=`\n━━ *TURNO ${session.turn}* ━━\n`
            try{
                const acts=[session.actions[0],session.actions[1]];if(session.mode!=='pvp')acts[1]=await battleAI(session,1)
                const order=[]
                for(let i=0;i<2;i++){const ac=acts[i]||{type:'none'},side=session.sides[i];let pr=ac.type==='switch'||ac.type==='item'||ac.type==='capture'?6:ac.type==='flee'?7:0;if(ac.type==='move'){const m=await getMoveInfo(side.team[side.active].moves[ac.index]);pr=m?.priority||0}order.push({i,ac,pr,sp:battleStat(side.states[side.active],'spe')+Math.random()*.01})}
                order.sort((x,y)=>y.pr-x.pr||y.sp-x.sp)
                for(const ent of order){const i=ent.i,ac=ent.ac,side=session.sides[i],foe=session.sides[1-i];if(ac.type==='none')continue;if(side.states[side.active].hp<=0&&ac.type!=='switch'&&ac.type!=='item')continue
                    if(ac.type==='switch'){if(!side.team[ac.index]||ac.index===side.active||side.states[ac.index].hp<=0)continue;const old=side.team[side.active];side.active=ac.index;side.states[ac.index].stages={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};side.states[ac.index].volatile={};log+=`🔄 ${session.labels[i]} trocou ${battleName(old)} por ${battleName(side.team[side.active])}.\n`;const incoming=side.states[side.active],incomingMon=side.team[side.active],haz=side.hazards;if(haz.stealthRock){const rockEff=getEffectiveness('rock',incoming.types);const dmg=Math.max(1,Math.floor(incoming.maxHp/8*rockEff));incoming.hp=Math.max(0,incoming.hp-dmg);log+=`🪨 Stealth Rock causou ${dmg} de dano.\n`}if(incoming.hp>0&&haz.spikes>0&&!incoming.types.includes('flying')){const dmg=Math.max(1,Math.floor(incoming.maxHp*({1:1/8,2:1/6,3:1/4}[haz.spikes]||1/4)));incoming.hp=Math.max(0,incoming.hp-dmg);log+=`📌 Spikes causou ${dmg} de dano.\n`}if(incoming.hp>0&&haz.toxicSpikes>0&&!incoming.types.includes('flying')){if(incoming.types.includes('poison'))haz.toxicSpikes=0;else if(!incoming.types.includes('steel'))inflictStatus(incomingMon,incoming,haz.toxicSpikes>1?'toxic':'poison')}if(haz.stickyWeb&&!incoming.types.includes('flying'))incoming.stages.spe=Math.max(-6,incoming.stages.spe-1);continue}
                    if(ac.type==='item'){const r=await useBattleItem(session,i,ac.name,ac.target);log+=r.text+'\n';continue}
                    if(ac.type==='flee'){if(session.mode==='pvp'||session.mode==='adventure'){log+='⛔ Não é possível fugir desta batalha.\n';continue}const chance=Math.max(.1,Math.min(.95,.5+(battleStat(side.states[side.active],'spe')-battleStat(foe.states[foe.active],'spe'))/200));if(Math.random()<chance){await finishBattle(session,'B',log+'🏃 Fuga bem-sucedida!');return}log+='🏃 A fuga falhou!\n';continue}
                    if(ac.type==='capture'){const owner=side.user,ball=ac.ball;if(session.mode!=='wild'||!(owner?.balls?.[ball]>0)){log+='⛔ Poké Bola indisponível.\n';continue}owner.balls[ball]--;const mult={poke:1,great:1.5,ultra:2,master:255},foeSt=foe.states[foe.active],chance=ball==='master'?1:Math.min(.95,Math.max(.03,((3*foeSt.maxHp-2*foeSt.hp)/(3*foeSt.maxHp))*mult[ball]*(foeSt.status?1.5:1)*.35));if(Math.random()<chance){session.meta.captured=true;const w=owner._wild,pd=w?.pokeData;if(pd){const growthRate=getGrowthRateName(w.species),moves=getMovesForLevel(pd,w.level).slice(-4).map(m=>m.name),mon={id:Date.now(),nome:w.nome,apelido:null,foto:w.foto,fotoShiny:w.fotoShiny,level:w.level,exp:0,expTotal:getXPForLevel(w.level,growthRate),growthRate,base:{hp:w.stats[0].base_stat,atk:w.stats[1].base_stat,def:w.stats[2].base_stat,spa:w.stats[3].base_stat,spd:w.stats[4].base_stat,spe:w.stats[5].base_stat},iv:genIV(),nature:randomNature(),sexo:randomSex(),shiny:w.isShiny,habilidade:randomAbility(),mega:false,fome:100,humor:100,vitorias:0,derrotas:0,moves:moves.length?moves:['tackle'],lastUpar:0,lastTreinar:0};const dest=adicionarPokemon(mon);owner.rank=(owner.rank||0)+(mon.shiny?25:2);log+=`🎉 Capturou ${mon.nome.toUpperCase()}! ${dest==='time'?'Adicionado ao time.':dest==='cheio'?'Armazenamento cheio.':`Enviado para Box ${dest.replace('box','')}.`}\n`}await finishBattle(session,'A',log);return}else log+=`🎾 ${ball} ball: o Pokémon escapou (${Math.floor(chance*100)}%).\n`;continue}
                    if(ac.type==='struggle')log=await performMove(session,i,'struggle',log);else if(ac.type==='move')log=await performMove(session,i,ac.index,log)
                    if(foe.states[foe.active].hp<=0){log+=`💀 ${battleName(foe.team[foe.active])} desmaiou.\n`;if(!livingBattle(foe).length){await finishBattle(session,i===0?'A':'B',log);return}}
                }
                // Efeitos de campo e efeitos persistentes que duram vários turnos.
                for(const fieldKey of ['weather','terrain']){const f=session.field[fieldKey];if(f&&typeof f==='object'&&Number.isFinite(f.turns)){f.turns--;if(f.turns<=0){session.field[fieldKey]=null;log+=`⌛ O efeito de ${fieldKey==='weather'?'clima':'terreno'} terminou.\n`}}}
                for(const side of session.sides){for(const key of ['reflect','lightScreen','auroraVeil','tailwind'])if(side.screens[key]>0)side.screens[key]--;const st=side.states[side.active],mon=side.team[side.active];if(st.hp>0){if(st.volatile.ingrain||st.volatile.aquaRing){const heal=Math.max(1,Math.floor(st.maxHp/16));st.hp=Math.min(st.maxHp,st.hp+heal);log+=`💚 ${battleName(mon)} recuperou ${heal} HP por efeito persistente.\n`}if(st.volatile.yawn>0){st.volatile.yawn--;if(st.volatile.yawn===0&&!st.status&&inflictStatus(mon,st,'sleep'))log+=`💤 ${battleName(mon)} adormeceu por Yawn.\n`}if(st.volatile.perish>0){st.volatile.perish--;if(st.volatile.perish===0){st.hp=0;log+=`☠️ ${battleName(mon)} caiu por Perish Song.\n`}}if(st.volatile.magnetRise>0&&--st.volatile.magnetRise===0){st.volatile.grounded=true;log+=`🧲 Magnet Rise terminou em ${battleName(mon)}.\n`}}}
                for(const side of session.sides){const mon=side.team[side.active],st=side.states[side.active];if(st.hp>0&&['burn','poison','toxic'].includes(st.status)){const n=st.status==='toxic'?Math.min(15,st.toxic++):1,dmg=Math.max(1,Math.floor(st.maxHp*(st.status==='burn'?1/16:st.status==='toxic'?n/16:1/8)));st.hp=Math.max(0,st.hp-dmg);log+=`☠️ ${battleName(mon)} sofreu ${dmg} de dano residual.\n`}}
                for(let i=0;i<2;i++){const side=session.sides[i];if(side.states[side.active].hp<=0){const next=livingBattle(side).find(n=>n!==side.active);if(next===undefined){await finishBattle(session,i===0?'B':'A',log);return}if(i===1&&session.mode!=='pvp'){side.active=next;log+=`🔄 ${session.labels[i]} enviou ${battleName(side.team[next])}.\n`}}}
                session.turn++;session.actions={};const menu=session.players.map((jid,i)=>`${session.labels[i]}:\n${battleMenu(session,i)}`).join('\n\n');await sock.sendMessage(session.key,{text:log+'\n'+menu,mentions:session.players})
            }finally{session.resolving=false}
        }
        async function handleBattleCommand(session,command,messageId) {
            if(!session||session.finished)return false;if(session.seen[messageId])return true;session.seen[messageId]=true
            const idx=session.players.indexOf(sender);if(idx<0)return false;const side=session.sides[idx],st=side.states[side.active],mon=side.team[side.active],parts=command.trim().split(/\s+/),cmd=parts[0].toLowerCase().replace(/^†/,'')
            if(session.resolving)return true;if(session.actions[idx])return reply('⏳ Sua ação já foi registrada neste turno.'),true
            if(st.hp<=0&&!['/pokemon','/mochila','/itempk'].includes(cmd))return reply('⚠️ Pokémon desmaiado. Use /pokemon <número>.'),true
            let action
            if(['/lutar','/golpe','/move'].includes(cmd)){if(parts.length<2){if(st.pp.every(x=>x<=0))action={type:'struggle'};else return reply(await moveMenu(session,idx)),true}else{const n=Number(parts[1])-1;if(!Number.isInteger(n)||n<0||n>=mon.moves.length)return reply('Move inválido. Use /lutar 1.'),true;if(st.pp[n]<=0)return reply('Esse move está sem PP.'),true;action={type:'move',index:n}}}
            else if(['/pokemon','/trocarpk'].includes(cmd)){if(parts.length<2)return reply(`🔄 Sua equipe:\n${side.team.map((p,i)=>`${i+1}. ${battleName(p)} — ${side.states[i].hp}/${side.states[i].maxHp} HP${i===side.active?' (ATIVO)':''}`).join('\n')}\nUse /pokemon <número>`),true;const n=Number(parts[1])-1;if(!Number.isInteger(n)||!side.team[n]||n===side.active||side.states[n].hp<=0)return reply('Escolha um Pokémon vivo e diferente do ativo.'),true;if(st.hp<=0){side.active=n;side.states[n].stages={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};session.actions[idx]={type:'none'};if(session.mode!=='pvp')await resolveBattle(session);else if(session.actions[1-idx])await resolveBattle(session);else return reply('Substituição feita. Aguardando o outro treinador.'),true;return true}action={type:'switch',index:n}}
            else if(['/mochila','/itempk'].includes(cmd)){if(parts.length<2||parts[1]==='batalha'){const list=[...Object.entries(user.bag?.itens||{}),...Object.entries(user.bag?.berries||{})].filter(x=>x[1]>0);return reply(`🎒 ITENS:\n${list.map(([k,v])=>`${k} x${v}`).join('\n')||'Nenhum item cadastrado.'}\nUse /mochila <item> [número do Pokémon]`),true}if(session.mode==='pvp')return reply('Itens de mochila não são permitidos em PvP.'),true;const target=parts[2]?Number(parts[2])-1:side.active;if(!side.team[target])return reply('Alvo inválido.'),true;const k=parts[1].toLowerCase(),isBerry=['oran','sitrus','pecha','cheri','chesto','lum','leppa'].includes(k),inventory=isBerry?(user.bag?.berries?.[k]||0):(user.bag?.itens?.[k]||0);if(!inventory)return reply('Você não possui esse item.'),true;action={type:'item',name:k,target}}
            else if(cmd==='/fugir'){if(['pvp','adventure'].includes(session.mode))return reply('Não é possível fugir desta batalha.'),true;action={type:'flee'}}
            else if(cmd==='/jogarpk'&&session.mode==='wild'){const ball=(parts[1]||'poke').toLowerCase();if(!['poke','great','ultra','master'].includes(ball)||!(user.balls?.[ball]>0))return reply('Poké Bola inválida ou indisponível.'),true;action={type:'capture',ball}}
            else return false
            session.actions[idx]=action;if(session.mode==='pvp'){if(session.actions[1-idx])await resolveBattle(session);else await reply('✅ Ação registrada. Aguardando o outro treinador.')}else await resolveBattle(session);return true
        }
        async function startWildBattle(wild) {
            const moves=getMovesForLevel(wild.pokeData,wild.level).slice(-4).map(m=>m.name),pd=wild.pokeData
            const mon={nome:wild.nome,level:wild.level,base:{hp:wild.stats[0].base_stat,atk:wild.stats[1].base_stat,def:wild.stats[2].base_stat,spa:wild.stats[3].base_stat,spd:wild.stats[4].base_stat,spe:wild.stats[5].base_stat},iv:genIV(),nature:randomNature(),moves:moves.length?moves:['tackle'],foto:wild.foto}
            return startBattle({key:from,teamA:user.pokemons,teamB:[mon],players:[sender],labels:['VOCÊ',`${wild.nome.toUpperCase()} SELVAGEM`],mode:'wild'})
        }
        const currentBattle=sessionFor(sender,from)
        if(currentBattle&&await handleBattleCommand(currentBattle,textoRaw,msg.key.id||`${sender}-${Date.now()}`))return

        if (lower.startsWith('/aventura') || lower.startsWith('†/aventura')) {
            if (!user.registrado) return reply(`Use /start`)
            const reg = user.regiao || 'kanto'
            const historia = AVENTURA_DATA[reg] || AVENTURA_DATA['kanto']
            if (!user.aventura[reg]) user.aventura[reg] = { etapa:0 }
            const etapa = user.aventura[reg].etapa || 0

            if (etapa >= historia.length) {
                return reply(`╭━━━⊱ 🌟 AVENTURA - ${reg.toUpperCase()} ⊱━━━╮\n│ Você completou toda aventura de ${reg.toUpperCase()}!\n│ 🏆 Campeão!\n│ Use /barco para outra região!\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }

            const atual = historia[etapa]

            if (lower === '/aventura' || lower === '†/aventura' || lower.includes('status')) {
                const progresso = `${etapa+1}/${historia.length}`
                let txt = `╭━━━⊱ 🗺 AVENTURA - ${reg.toUpperCase()} ⊱━━━╮\n│ Progresso: ${progresso}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n`
                txt+=`┏─⪩ 📍 PRÓXIMA ROTA ⪨─┓\n│ Rota: ${atual.rota}\n│ Treinador: *${atual.treinador}*\n│ Time: ${atual.pokes.map(p=>p.nome+' LV'+p.level).join(', ')}\n│ Fala: "${atual.dialogo}"\n┗━─━─━─━─━─━─━─━─━┛\n\n`
                txt+=`┏─⪩ 🎮 AÇÃO ⪨─┓\n│ /aventura avançar - Enfrentar\n┗━─━─━─━─━─━─━─━─━┛\n\n`
                txt+=`Seu time: ${user.pokemons.map((p,i)=>`${i+1}.${(p.apelido||p.nome).toUpperCase()} LV${p.level}`).join(', ')}`
                return reply(txt)
            }

            if (lower.includes('avançar') || lower.includes('avancar')) {
                const treinadorPokes = []
                for (const tp of atual.pokes) {
                    const data = await getPokeData(tp.nome)
                    if (!data) continue
                    const { poke } = data
                    const moves = getMovesForLevel(poke, tp.level).slice(-4).map(m=>m.name)
                    const mon = {
                        nome: poke.name,
                        apelido: null,
                        level: tp.level,
                        base: {hp:poke.stats[0].base_stat, atk:poke.stats[1].base_stat, def:poke.stats[2].base_stat, spa:poke.stats[3].base_stat, spd:poke.stats[4].base_stat, spe:poke.stats[5].base_stat},
                        iv: {hp:15,atk:15,def:15,spa:15,spd:15,spe:15},
                        moves: normalizeMoves(moves),
                        foto: poke.sprites.other['official-artwork'].front_default
                    }
                    treinadorPokes.push(mon)
                }

                if (treinadorPokes.length===0) return reply(`Erro ao carregar treinador!`)

                const started=await startBattle({key:from,teamA:user.pokemons,teamB:treinadorPokes,players:[sender],labels:['VOCÊ',atual.treinador],mode:'adventure',meta:{reg,etapa,recomp:atual.recompensa,historiaLength:historia.length}})
                if(!started.ok)return reply(`⚠️ ${started.error}`)
                return
            }
        }

        if (['/explorar','†/explorar','/mapa','†/mapa'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const media = Math.floor(user.pokemons.reduce((a,p)=>a+p.level,0)/user.pokemons.length) || 5
            const reg = user.regiao || 'kanto'
            const historia = AVENTURA_DATA[reg] || AVENTURA_DATA['kanto']
            const etapa = user.aventura[reg]?.etapa || 0
            return reply(`╭━━━⊱ 🗺 EXPLORAR - ${reg.toUpperCase()} ⊱━━━╮\n│ LV Médio: ${media} | Aventura: ${etapa}/${historia.length}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🌿 AÇÕES ⪨─┓\n│ /aventura - Modo história\n│ /capturar - Pokémon selvagem 15min cd\n│ /safari - Zona Safari LV30+\n│ /barco <região> - Viajar P$5000 LV30+\n│ /raid - Ver raid ativa\n┗━─━─━─━─━─━─━─━─━┛`)
        }

        if (['/capturar','†/capturar'].includes(lower) && lower.split(' ').length === 1) {
            if (!user.registrado) return reply(`Use /start`)
            if (!user.pokemons.length) return reply('Escolha um Pokémon inicial antes de iniciar batalhas selvagens.')
            const now = Date.now()
            const cooldown = 15*60*1000
            if (!user.ultimoCapturaTime) user.ultimoCapturaTime = 0
            if (now - user.ultimoCapturaTime < cooldown) {
                const rest = Math.ceil((cooldown - (now - user.ultimoCapturaTime))/1000/60)
                return reply(`╭━━━⊱ ⏳ COOLDOWN ⊱━━━╮\n│ Você está cansado!\n│ Descanse *${rest} min* antes de capturar de novo!\n│ Cooldown: 15min\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            if (user._wild && user._wild.expira && user._wild.expira > now) {
                const started=await startWildBattle(user._wild)
                if(!started.ok)return reply(`⚠️ ${started.error}`)
                return
            }
            const reg = user.regiao || 'kanto'
            const pool = REGIAO_POKES[reg] || REGIAO_POKES['kanto']
            let data = null
            let tent=0
            while (!data && tent<20) {
                const randomId = pool[Math.floor(Math.random()*pool.length)]
                try {
                    const poke = (await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`,{timeout:5000})).data
                    const species = (await axios.get(poke.species.url,{timeout:5000})).data
                    if (species.is_legendary || species.is_mythical) {tent++; continue}
                    if (user.ultimoCaptura && user.ultimoCaptura.includes(poke.name)) {tent++; continue}
                    data = {poke, species}
                } catch {tent++}
            }
            if (!data) data = await getPokeData('pikachu')
            const {poke, species} = data
            const isShiny = calcShiny()
            const foto = isShiny && poke.sprites.other['official-artwork'].front_shiny ? poke.sprites.other['official-artwork'].front_shiny : poke.sprites.other['official-artwork'].front_default
            const lvl = Math.max(3, Math.min(35, Math.floor(Math.random()*10)+ (user.pokemons.reduce((a,p)=>a+p.level,0)/user.pokemons.length||5)))
            const movesList = getMovesForLevel(poke, lvl).slice(-3).map(m=>m.name)
            const tipos = poke.types.map(t=>t.type.name)
            user._wild = { nome:poke.name, foto:poke.sprites.other['official-artwork'].front_default, fotoShiny:poke.sprites.other['official-artwork'].front_shiny, stats:poke.stats, isShiny, level:lvl, tipos, movesPreview:movesList.join(','), pokeData:poke, species, expira: now+1000*60*10, tentativas:0 }
            user.ultimoCapturaTime=now
            user.ultimoCaptura.push(poke.name)
            if (user.ultimoCaptura.length>15) user.ultimoCaptura.shift()
            salvar()
            const started=await startWildBattle(user._wild)
            if(!started.ok)return reply(`⚠️ ${started.error}`)
            return
        }

        if (lower.startsWith('/jogarpk') || lower.startsWith('†/jogarpk') || (lower.startsWith('/capturar ') && lower.split(' ').length>=2)) {
            if (!user._wild || !user._wild.expira || Date.now() > user._wild.expira) return reply(`❌ Nenhum selvagem! /capturar`)
            let ball = 'poke'
            if (lower.startsWith('/jogarpk')) ball = lower.split(' ')[1] || 'poke'
            else {
                const parts = lower.split(' ')
                if (['poke','great','ultra','master'].includes(parts[2])) ball = parts[2]
                else if (['poke','great','ultra','master'].includes(parts[1])) ball = parts[1]
            }
            ball = ball.toLowerCase()
            if (!user.balls[ball] || user.balls[ball]<=0) return reply(`Sem ${ball} ball!`)
            user.balls[ball]--
            user._wild.tentativas++
            const rate = getBallMultiplier(ball) * (user._wild.isShiny?1.3:1)
            const baseChance = 0.25 + (user._wild.tentativas*0.05)
            const chance = Math.min(0.95, baseChance*rate)
            const fugaChance = 0.1 + (user._wild.tentativas*0.15)
            if (Math.random() < chance) {
                const initialMoves = getMovesForLevel(user._wild.pokeData, user._wild.level).slice(-4).map(m=>m.name)
                const growthRate = getGrowthRateName(user._wild.species)
                const novo = { id: Date.now(), nome: user._wild.nome, apelido:null, foto:user._wild.foto, fotoShiny:user._wild.fotoShiny, level: user._wild.level, exp:0, expTotal: getXPForLevel(user._wild.level, growthRate), growthRate, base:{hp:user._wild.stats[0].base_stat, atk:user._wild.stats[1].base_stat, def:user._wild.stats[2].base_stat, spa:user._wild.stats[3].base_stat, spd:user._wild.stats[4].base_stat, spe:user._wild.stats[5].base_stat}, iv: genIV(), nature: randomNature(), sexo: randomSex(), shiny: user._wild.isShiny, habilidade: randomAbility(), mega:false, fome:100, humor:100, vitorias:0, derrotas:0, moves: normalizeMoves(initialMoves), lastUpar:0, lastTreinar:0 }
                const destino = adicionarPokemon(novo)
                user._wild=null; user.rank+= novo.shiny?25:2; salvar()
                return reply(`✅ CAPTURADO *${novo.nome.toUpperCase()}* LV${novo.level}!\n${destino==='time'?'🐾 Foi adicionado ao seu time.':destino==='cheio'?'❌ Seu time e todas as boxes desbloqueadas estão cheios; não foi possível armazenar.':`📦 Seu time está cheio; foi enviado para a Box ${destino.replace('box','')}.`}\nTime: ${user.pokemons.length}/6 | Boxes: ${user.boxes.slice(0,user.boxesUnlocked).reduce((n,b)=>n+b.length,0)}/${user.boxesUnlocked*30}`, novo.foto)
            } else {
                if (Math.random() < fugaChance && user._wild.tentativas>=2) {
                    const nomeF = user._wild.nome.toUpperCase()
                    user._wild=null; salvar()
                    return reply(`💨 ${nomeF} fugiu!`)
                } else {
                    salvar()
                    return reply(`💨 ${user._wild.nome.toUpperCase()} escapou! Tentativa ${user._wild.tentativas}x - Chance ${Math.floor(chance*100)}%\n/jogarpk ${ball} ou /fugir`)
                }
            }
        }

        if (['/fugir','†/fugir'].includes(lower)) {
            if (!user._wild) return reply(`Nenhum selvagem!`)
            user._wild=null; salvar()
            return reply(`🏃 Fugiu!`)
        }

        if (lower.startsWith('/batalha') || lower.startsWith('†/batalha')) {
            const men = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            const alvoJid = men && men[0] ? men[0] : null
            if (!alvoJid) return reply(`╭━━━⊱ ⚔ BATALHA ⊱━━━╮\n│ Use: /batalha [n] @amigo\n│ Ex: /batalha 1 @joao\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            if (alvoJid === sender) return reply(`Não pode batalhar contra si mesmo!`)
            const alvo = db[alvoJid]
            if (!alvo || !alvo.registrado) return reply(`Alvo sem jornada!`)
            if (alvo.pokemons.length===0 || user.pokemons.length===0) return reply(`Time vazio!`)

            const parts = lower.split(' ')
            let meuIdx = 0
            const numPart = parts[1]
            if (numPart && !isNaN(parseInt(numPart))) meuIdx = parseInt(numPart)-1
            if (meuIdx <0 || meuIdx >= user.pokemons.length) return reply(`Você só tem ${user.pokemons.length} pokémons!`)

            const lockKey = [sender, alvoJid].sort().join('-')
            if (batalhaLock[lockKey] && Date.now() - batalhaLock[lockKey] < 10000) return reply(`⚔ Já tem batalha rolando! Aguarde 10s`)
            if (pendingBattles[alvoJid] && Date.now() - pendingBattles[alvoJid].time < 120000) return reply(`⚔ Esse treinador já tem convite pendente!`)

            pendingBattles[alvoJid] = { fromJid: sender, fromIdx: meuIdx, time: Date.now(), fromGroup: from, alvoJid }

            const meuPoke = user.pokemons[meuIdx]
            const conviteTexto = `╭━━━⊱ ⚔ DESAFIO! ⊱━━━╮\n│ @${alvoJid.split('@')[0]} você foi desafiado!\n│ @${sender.split('@')[0]} te desafiou!\n│\n│ ${meuPoke.nome.toUpperCase()} LV${meuPoke.level} vs seu time\n│\n│ Aceitar: /aceitar [n] | /recusar\n│ Expira em 2 min!\n╰━━━━━━━━━━━━━━━━━━━━╯`
            try {
                await sock.sendMessage(from, { text: conviteTexto, mentions: [alvoJid, sender] })
            } catch {
                await sock.sendMessage(from, { text: conviteTexto })
            }
            return reply(`╭━━━⊱ ⚔ CONVITE ENVIADO ⊱━━━╮\n│ Você desafiou @${alvoJid.split('@')[0]} com *${meuPoke.nome.toUpperCase()}* LV${meuPoke.level}!\n╰━━━━━━━━━━━━━━━━━━━━╯`, meuPoke.foto)
        }

        if (lower.startsWith('/aceitar') || lower.startsWith('†/aceitar')) {
            const pend = pendingBattles[sender]
            if (!pend) return reply(`❌ Sem convite pendente!`)
            if (Date.now() - pend.time > 120000) { delete pendingBattles[sender]; return reply(`⏰ Convite expirou!`) }

            const desafianteJid = pend.fromJid
            const desafiante = db[desafianteJid]
            if (!desafiante || !desafiante.registrado) { delete pendingBattles[sender]; return reply(`Desafiante sem jornada!`) }

            let meuIdx = 0
            const parts = lower.split(' ')
            if (parts[1] && !isNaN(parseInt(parts[1]))) meuIdx = parseInt(parts[1])-1
            if (meuIdx <0 || meuIdx >= user.pokemons.length) return reply(`Você só tem ${user.pokemons.length} pokémons!`)

            const meuTeamCompleto = [user.pokemons[meuIdx], ...user.pokemons.filter((_,i)=>i!==meuIdx)].slice(0,3)
            const deleTeamCompleto = [desafiante.pokemons[pend.fromIdx], ...desafiante.pokemons.filter((_,i)=>i!==pend.fromIdx)].slice(0,3)

            delete pendingBattles[sender]
            const lockKey=[sender,desafianteJid].sort().join('-')
            batalhaLock[lockKey]=Date.now()
            const started=await startBattle({key:pend.fromGroup,teamA:meuTeamCompleto,teamB:deleTeamCompleto,players:[sender,desafianteJid],labels:[(user.pokemons[meuIdx].apelido||user.pokemons[meuIdx].nome).toUpperCase(),(desafiante.pokemons[pend.fromIdx].apelido||desafiante.pokemons[pend.fromIdx].nome).toUpperCase()],mode:'pvp',meta:{lockKey}})
            if(!started.ok)return reply(`⚠️ ${started.error}`)
            return
        }

        if (['/recusar','†/recusar'].includes(lower)) {
            const pend = pendingBattles[sender]
            if (!pend) return reply(`Você não tem convite pendente!`)
            delete pendingBattles[sender]
            try {
                await sock.sendMessage(pend.fromGroup, { text: `╭━━━⊱ ❌ BATALHA ⊱━━━╮\n│ @${sender.split('@')[0]} recusou!\n╰━━━━━━━━━━━━━━━━━━━━╯`, mentions: [sender, pend.fromJid] })
            } catch {}
            return reply(`Você recusou o desafio!`)
        }

        if (lower.startsWith('/raid') || lower.startsWith('†/raid')) {
            if (!user.registrado) return reply(`Use /start`)
            const now = Date.now()

            if (!raidAtiva || now > raidAtiva.expira) {
                const falta = Math.max(0, (1000*60*30) - (now - ultimaRaidTime))
                const min = Math.floor(falta/1000/60)
                const sec = Math.floor((falta/1000)%60)
                return reply(`╭━━━⊱ 💤 SEM RAID ⊱━━━╮\n│ Nenhuma raid ativa!\n│ Próxima raid em: *${min}m ${sec}s*\n│ Raids a cada 30min!\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }

            const partes = textoRaw.split(' ')
            const acao = partes[1] ? partes[1].toLowerCase() : null

            if (!acao) {
                const tempoRest = Math.ceil((raidAtiva.expira - now)/1000/60)
                const hpPercent = Math.floor((raidAtiva.hp / raidAtiva.hpMax)*100)
                const barra = '█'.repeat(Math.floor(hpPercent/10)) + '░'.repeat(10-Math.floor(hpPercent/10))
                const lobbyTxt = raidAtiva.lobby.length>0 ? raidAtiva.lobby.map((jid,i)=>`│ ${i+1}. @${jid.split('@')[0]}`).join('\n') : '│ Ninguém ainda! /raid entrar'
                const statusTxt = raidAtiva.iniciado ? `🔴 EM BATALHA!` : `🟢 LOBBY ABERTO (${raidAtiva.lobby.length}/8)`

                return reply(`╭━━━⊱ ${raidAtiva.tier} ⊱━━━╮\n│ *${raidAtiva.nome.toUpperCase()}* LV${raidAtiva.level} [${raidAtiva.tipos.join('/')}]\n│ ${statusTxt}\n│ HP: ${barra} ${hpPercent}%\n│ ${raidAtiva.hp}/${raidAtiva.hpMax} HP\n│ Expira em ${tempoRest} min\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 👥 LOBBY (${raidAtiva.lobby.length}/8) ⪨─┓\n${lobbyTxt}\n┗━─━─━─━─━─━─━─━─━┛\n\n┏─⪩ 🎮 COMANDOS ⪨─┓\n│ /raid entrar - Entrar na sala (até 8)\n│ /raid sair - Sair da sala\n│ /raidgo ou /raid iniciar - Iniciar batalha (mín 2)\n│ /raid atacar <n> - Atacar após iniciar\n│ Recompensa: P$${raidAtiva.reward}\n┗━─━─━─━─━─━─━─━─━┛`, raidAtiva.foto)
            }

            if (acao === 'entrar' || acao === 'join') {
                if (raidAtiva.iniciado) return reply(`❌ Raid já iniciou! Use /raid atacar <n> para atacar!`)
                if (raidAtiva.lobby.includes(sender)) return reply(`✅ Você já está no lobby! (${raidAtiva.lobby.length}/8)\nAguardando mais jogadores... /raid para ver`)
                if (raidAtiva.lobby.length >= 8) return reply(`❌ Lobby lotado! (8/8)\nAguarde a próxima raid!`)
                
                raidAtiva.lobby.push(sender)
                raidAtiva.ultimoGrupo = from
                salvar()

                let txt = `╭━━━⊱ ✅ ENTROU! ⊱━━━╮\n│ Você entrou na raid de *${raidAtiva.nome.toUpperCase()}*!\n│ Lobby: ${raidAtiva.lobby.length}/8\n│ Mínimo: 2 para iniciar\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n`
                if (raidAtiva.lobby.length >= 2) txt+=`🎮 Pronto para começar? Qualquer um pode usar /raidgo para iniciar a batalha!\n\n`
                txt+=`┏─⪩ 👥 LOBBY ⪨─┓\n${raidAtiva.lobby.map((jid,i)=>`│ ${i+1}. @${jid.split('@')[0]}`).join('\n')}\n┗━─━─━─━─━─━─━─━─━┛`

                try {
                    await sock.sendMessage(from, { text: txt, mentions: raidAtiva.lobby }, { quoted: msg })
                } catch {
                    await reply(txt)
                }
                return
            }

            if (acao === 'sair' || acao === 'leave') {
                if (!raidAtiva.lobby.includes(sender)) return reply(`❌ Você não está no lobby!`)
                raidAtiva.lobby = raidAtiva.lobby.filter(j=>j!==sender)
                salvar()
                return reply(`👋 Você saiu do lobby da raid! Lobby agora: ${raidAtiva.lobby.length}/8`)
            }

            if (acao === 'atacar' || acao === 'batalhar' || acao === 'attack') {
                if (!raidAtiva.iniciado) return reply(`❌ Raid ainda não iniciou! Entre com /raid entrar e use /raidgo para começar! (Mín 2 players)`)
                if (!raidAtiva.lobby.includes(sender)) return reply(`❌ Você não está no lobby! Use /raid entrar primeiro!`)

                const idx = parseInt(partes[2])-1
                const pk = user.pokemons[idx]
                if (!pk) return reply(`Use: /raid atacar 1`)

                if (raidAtiva.danoTotal[sender] && (now - (raidAtiva.danoTotal[sender].ultimoAtaque||0)) < 30*1000) {
                    const falta = Math.ceil((30*1000 - (now - raidAtiva.danoTotal[sender].ultimoAtaque))/1000)
                    return reply(`╭━━━⊱ ⏳ COOLDOWN RAID ⊱━━━╮\n│ Seu ${(pk.apelido||pk.nome).toUpperCase()} está recuperando!\n│ Aguarde *${falta}s* para atacar de novo!\n│ Cooldown: 30s\n╰━━━━━━━━━━━━━━━━━━━━╯`)
                }

                const danoBase = pk.base.atk + pk.base.spa + pk.level*3 + Math.floor(sumIV(pk.iv)/3) + Math.floor(Math.random()*40)
                const efetividade = Math.random() > 0.3 ? 1 : (Math.random() > 0.5 ? 2 : 0.5)
                const danoFinal = Math.floor(danoBase * efetividade)

                raidAtiva.hp -= danoFinal
                if (!raidAtiva.danoTotal[sender]) raidAtiva.danoTotal[sender] = { dano:0, nome: pk.nome, ultimoAtaque:0 }
                raidAtiva.danoTotal[sender].dano += danoFinal
                raidAtiva.danoTotal[sender].ultimoAtaque = now

                let log = `⚔ ${(pk.apelido||pk.nome).toUpperCase()} de @${sender.split('@')[0]} atacou *${raidAtiva.nome.toUpperCase()}*!\n💥 ${danoFinal} de dano! ${efetividade>=2?'Super efetivo! 🔥':efetividade<=0.5?'Não muito efetivo... 💧':''}\n❤ Raid HP: ${Math.max(0,raidAtiva.hp)}/${raidAtiva.hpMax}\n\n`

                if (raidAtiva.hp <= 0) {
                    const totalDano = Object.values(raidAtiva.danoTotal).reduce((a,b)=>a+b.dano,0)
                    const ranking = Object.entries(raidAtiva.danoTotal).sort((a,b)=>b[1].dano - a[1].dano)
                    const seuDano = raidAtiva.danoTotal[sender].dano
                    const porcentagem = Math.floor((seuDano/totalDano)*100)
                    const isTop1 = ranking[0] && ranking[0][0] === sender

                    for (const jid of raidAtiva.lobby) {
                        const u = db[jid]
                        if (!u) continue
                        const danoP = u && raidAtiva.danoTotal[jid] ? raidAtiva.danoTotal[jid].dano : 0
                        const perc = totalDano>0 ? Math.floor((danoP/totalDano)*100) : 0
                        const premio = Math.floor(raidAtiva.reward * (0.3 + (perc/100)))
                        u.money += premio
                        if (u.pb===undefined) u.pb = u.rank||0
                        u.pb += raidAtiva.tier.includes('⭐⭐⭐') || raidAtiva.tier.includes('GIGANTAMAX') ? 5 : raidAtiva.tier.includes('⭐⭐') ? 3 : 1
                        u.rank = u.pb
                        if (u.pokemons[0]) {
                            await grantExperience(u.pokemons[0], Math.floor(getXPNeeded(u.pokemons[0].level, u.pokemons[0].growthRate)*0.5), 'raid')
                            if (pendingMoveChoices[jid]?.queue?.length) await sock.sendMessage(jid, {text:'Seu Pokémon pode aprender um novo move. Responda nesta conversa para escolher.'})
                        }
                    }

                    let capturas = []
                    for (let i=0; i<Math.min(3, ranking.length); i++) {
                        const [jid, info] = ranking[i]
                        const chance = i===0 ? 1 : 0.4
                        if (Math.random() < chance) {
                            const u = db[jid]
                            if (u) {
                                try {
                                    const data = await getPokeData(raidAtiva.nome)
                                    if (data) {
                                        const { poke, species } = data
                                        const isShiny = calcShiny()
                                        const growthRate = getGrowthRateName(species)
                                        const mon = { id: Date.now()+i, nome: poke.name, apelido: null, foto: poke.sprites.other['official-artwork'].front_default, fotoShiny: poke.sprites.other['official-artwork'].front_shiny, level: raidAtiva.level, exp:0, expTotal: getXPForLevel(raidAtiva.level, growthRate), growthRate, base:{hp:poke.stats[0].base_stat, atk:poke.stats[1].base_stat, def:poke.stats[2].base_stat, spa:poke.stats[3].base_stat, spd:poke.stats[4].base_stat, spe:poke.stats[5].base_stat}, iv: {hp:25+Math.floor(Math.random()*7), atk:25+Math.floor(Math.random()*7), def:25+Math.floor(Math.random()*7), spa:25+Math.floor(Math.random()*7), spd:25+Math.floor(Math.random()*7), spe:25+Math.floor(Math.random()*7)}, nature: randomNature(), sexo: randomSex(), shiny: isShiny, habilidade: randomAbility(), mega:false, fome:100, humor:100, vitorias:0, derrotas:0, moves: getMovesForLevel(poke, raidAtiva.level).slice(-4).map(m=>m.name), lastUpar:0, lastTreinar:0 }
                                        const destino = adicionarPokemon(mon, u)
                                        capturas.push({jid, nome: poke.name, shiny: isShiny, destino})
                                    }
                                } catch {}
                            }
                        }
                    }

                    const topTxt = ranking.map(([jid,info],i)=>`│ ${i+1}. @${jid.split('@')[0]} - ${info.dano} dano (${Math.floor((info.dano/totalDano)*100)}%) ${i===0?'👑':''}`).join('\n')
                    const capturaTxt = capturas.length>0 ? capturas.map(c=>`│ 🎉 @${c.jid.split('@')[0]} capturou ${c.nome.toUpperCase()}${c.shiny?' ✨ SHINY!':''}${c.destino==='box'?' 📦 (Box)':''}`).join('\n') : '│ Ninguém capturou dessa vez...'

                    log += `╭━━━⊱ 🏆 RAID VENCIDA! ⊱━━━╮\n│ *${raidAtiva.nome.toUpperCase()}* derrotado!\n│\n│ Recompensa distribuída para ${raidAtiva.lobby.length} treinadores!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 📊 RANKING DE DANO ⪨─┓\n${topTxt}\n┗━─━─━─━─━─━─━─━─━┛\n\n┏─⪩ 🎁 CAPTURAS ⪨─┓\n${capturaTxt}\n┗━─━─━─━─━─━─━─━─━┛\n\nPróxima raid em 30min!`

                    const fotoPremio = raidAtiva.foto
                    raidAtiva = null
                    salvar()

                    try {
                        await sock.sendMessage(from, { text: log, mentions: ranking.map(r=>r[0]) }, { quoted: msg })
                    } catch {
                        await reply(log, fotoPremio)
                    }
                    return
                } else {
                    salvar()
                    const barra = '█'.repeat(Math.floor((raidAtiva.hp/raidAtiva.hpMax)*10)) + '░'.repeat(10-Math.floor((raidAtiva.hp/raidAtiva.hpMax)*10))
                    log += `HP: ${barra} ${Math.floor((raidAtiva.hp/raidAtiva.hpMax)*100)}%\n/raid atacar <n> para atacar de novo! (30s cd)`
                    try {
                        await sock.sendMessage(from, { text: log, mentions: [sender] }, { quoted: msg })
                    } catch {
                        await reply(log)
                    }
                    return
                }
            }
        }

        if (lower === '/raidgo' || lower === '†/raidgo' || lower === '/raid iniciar' || lower === '†/raid iniciar' || lower === '/raid start') {
            if (!raidAtiva) return reply(`❌ Sem raid ativa!`)
            if (!raidAtiva.lobby.includes(sender)) return reply(`❌ Você não está no lobby! Use /raid entrar`)
            if (raidAtiva.lobby.length < 2) return reply(`╭━━━⊱ ❌ RAID ⊱━━━╮\n│ Precisa de no mínimo *2* jogadores!\n│ Lobby atual: ${raidAtiva.lobby.length}/8\n│ Chame mais gente! @todos\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            if (raidAtiva.iniciado) return reply(`✅ Raid já iniciou! Use /raid atacar <n>`)

            raidAtiva.iniciado = true
            salvar()

            const txt = `╭━━━⊱ 🔥 RAID INICIADA! ⊱━━━╮\n│ *${raidAtiva.nome.toUpperCase()}* LV${raidAtiva.level} apareceu!\n│ ${raidAtiva.tier}\n│\n│ ${raidAtiva.lobby.length} treinadores vs ${raidAtiva.nome.toUpperCase()}!\n│ HP: ${raidAtiva.hpMax} | Expira em 30min\n╰━━━━━━━━━━━━━━━━━━━━╯\n\nTodos podem atacar agora com /raid atacar <n>!\nCooldown: 30s entre ataques!\n\n┏─⪩ 👥 LOBBY ⪨─┓\n${raidAtiva.lobby.map((jid,i)=>`│ ${i+1}. @${jid.split('@')[0]}`).join('\n')}\n┗━─━─━─━─━─━─━─━─━┛`

            try {
                await sock.sendMessage(from, { text: txt, mentions: raidAtiva.lobby }, { quoted: msg })
            } catch {
                await reply(txt, raidAtiva.foto)
            }
            return
        }

        if (['/safari','†/safari'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const media = Math.floor(user.pokemons.reduce((a,p)=>a+p.level,0)/user.pokemons.length) || 5
            if (media < 30) return reply(`╭━━━⊱ 🏖 SAFARI ⊱━━━╮\n│ Precisa LV médio 30+!\n│ Seu LV médio: ${media}\n│ Treine com /treinar e /upar!\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            if (!user.balls.safari || user.balls.safari<=0) return reply(`❌ Sem Safari Balls!\n/comprar safari P$200 na /loja\nVocê tem ${user.balls.safari||0} safari balls`)
            user.balls.safari--
            const rarosPool = [133,134,135,136,143,147,148,149,179,180,196,197,246,247,249,280,281,302,303,304,371,372,373,374,375,376,406,407,443,444,445,447,448,610,611,612,633,634,635,704,705,706,714,715,722,723,725,726,728,729,810,811,813,814,816,817,819,820]
            const randomId = rarosPool[Math.floor(Math.random()*rarosPool.length)]
            try {
                const poke = (await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`,{timeout:5000})).data
                const species = (await axios.get(poke.species.url,{timeout:5000})).data
                const isShiny = calcShiny()
                const foto = isShiny && poke.sprites.other['official-artwork'].front_shiny ? poke.sprites.other['official-artwork'].front_shiny : poke.sprites.other['official-artwork'].front_default
                const moves = getMovesForLevel(poke, 30).slice(-4).map(m=>m.name)
                const growthRate = getGrowthRateName(species)
                const mon = { id: Date.now(), nome:poke.name, apelido:null, foto:poke.sprites.other['official-artwork'].front_default, fotoShiny:poke.sprites.other['official-artwork'].front_shiny, level: Math.floor(Math.random()*15)+25, base:{hp:poke.stats[0].base_stat, atk:poke.stats[1].base_stat, def:poke.stats[2].base_stat, spa:poke.stats[3].base_stat, spd:poke.stats[4].base_stat, spe:poke.stats[5].base_stat}, iv: {hp:20+Math.floor(Math.random()*12), atk:20+Math.floor(Math.random()*12), def:20+Math.floor(Math.random()*12), spa:20+Math.floor(Math.random()*12), spd:20+Math.floor(Math.random()*12), spe:20+Math.floor(Math.random()*12)}, nature: randomNature(), sexo: randomSex(), shiny: isShiny, habilidade: randomAbility(), mega:false, fome:100, humor:100, vitorias:0, derrotas:0, moves: normalizeMoves(moves), lastUpar:0, lastTreinar:0, exp:0, expTotal: getXPForLevel(30, growthRate), growthRate }
                const destino = adicionarPokemon(mon)
                salvar()
                return reply(`${isShiny?'✨ SHINY RARO! ✨\n':''}╭━━━⊱ 🏖 SAFARI - CAPTURADO! ⊱━━━╮\n│ *${mon.nome.toUpperCase()}* LV${mon.level} - RARO!\n│ ${destino==='time'?'Adicionado ao time':destino==='cheio'?'Time e boxes desbloqueadas cheios: não foi armazenado':`Enviado para a ${destino.replace('box','Box ')}`}\n│ Moves: ${moves.join(', ')}\n│ IVs: ${sumIV(mon.iv)}/186\n│ Safari Balls: ${user.balls.safari}\n╰━━━━━━━━━━━━━━━━━━━━╯\nTime: ${user.pokemons.length}/6 | Boxes: ${user.boxes.slice(0,user.boxesUnlocked).reduce((n,b)=>n+b.length,0)}/${user.boxesUnlocked*30}`, foto)
            } catch {
                return reply(`🏖 Nada raro dessa vez! Safari Balls: ${user.balls.safari}`)
            }
        }

        if (lower.startsWith('/barco') || lower.startsWith('†/barco')) {
            if (!user.registrado) return reply(`Use /start`)
            const media = Math.floor(user.pokemons.reduce((a,p)=>a+p.level,0)/user.pokemons.length) || 5
            if (media < 30) return reply(`╭━━━⊱ 🚢 BARCO ⊱━━━╮\n│ Precisa LV médio 30+!\n│ Seu: ${media}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            const dest = lower.split(' ')[1]
            if (!dest) return reply(`╭━━━⊱ 🚢 BARCO ⊱━━━╮\n│ Para onde? Custa P$5000!\n${REGIOES.map(r=>`│  /barco ${r} ${r===user.regiao?'(atual)':''}`).join('\\n')}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            if (!REGIOES.includes(dest)) return reply(`Região inválida!`)
            if (dest === user.regiao) return reply(`Já está em ${dest.toUpperCase()}!`)
            if (user.money < 5000) return reply(`💰 Barco P$5000! Tem P$${user.money}`)
            user.money -= 5000
            user.regiao = dest
            if (!user.aventura[dest]) user.aventura[dest]={etapa:0}
            user.ultimoCaptura=[]
            salvar()
            return reply(`╭━━━⊱ 🚢 VIAGEM! ⊱━━━╮\n│ Você viajou para *${dest.toUpperCase()}*! 🌊\n│ P$ restantes: ${user.money}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
        }

        if (['/trabalhar','†/trabalhar'].includes(lower)) {
            const now = Date.now()
            const cd = 10*60*1000
            if (now - user.ultimoTrabalho < cd) {
                const falta = cd - (now - user.ultimoTrabalho)
                const min = Math.floor(falta/1000/60)
                const sec = Math.floor((falta/1000)%60)
                return reply(`╭━━━⊱ ⏳ TRABALHO ⊱━━━╮\n│ Você já trabalhou!\n│ Volta em *${min}m ${sec}s*\n│ Cooldown: 10min\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            const ganho = 200 + Math.floor(Math.random()*300)
            user.money += ganho; user.ultimoTrabalho = now; salvar()
            return reply(`╭━━━⊱ 💼 TRABALHOU ⊱━━━╮\n│ +P$${ganho}!\n│ P$ total: ${user.money}\n│ Próximo em 10min\n╰━━━━━━━━━━━━━━━━━━━━╯`)
        }

        if (lower.startsWith('/alimentar') || lower.startsWith('†/alimentar')) {
            const idx = parseInt(lower.split(' ')[1])-1
            const pk = user.pokemons[idx]
            if (!pk) return reply(`Use: /alimentar 1`)
            if (user.money < 100) return reply(`💰 Precisa P$100! Tem P$${user.money}`)
            user.money -= 100
            pk.fome = Math.min(100, (pk.fome||0)+30)
            salvar()
            return reply(`╭━━━⊱ 🍖 ALIMENTOU ⊱━━━╮\n│ ${(pk.apelido||pk.nome).toUpperCase()} comeu!\n│ Fome: ${pk.fome}%\n│ P$: ${user.money}\n╰━━━━━━━━━━━━━━━━━━━━╯`, pk.foto)
        }
        if (lower.startsWith('/treinar') || lower.startsWith('†/treinar')) {
            const idx = parseInt(lower.split(' ')[1])-1
            const pk = user.pokemons[idx]
            if (!pk) return reply(`Use: /treinar 1`)
            const now = Date.now()
            const cd = 5*60*1000
            if (now - (pk.lastTreinar||0) < cd) {
                const falta = cd - (now - (pk.lastTreinar||0))
                const min = Math.floor(falta/1000/60)
                const sec = Math.floor((falta/1000)%60)
                return reply(`╭━━━⊱ ⏳ EXAUSTO! ⊱━━━╮\n│ ${(pk.apelido||pk.nome).toUpperCase()} está cansado!\n│ Descanse *${min}m ${sec}s*\n│ Cooldown: 5min\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            pk.lastTreinar=now
            const need = getXPNeeded(pk.level, pk.growthRate)
            const ganho = Math.floor(need*0.15)
            const resultadoLevel = await grantExperience(pk, ganho, 'treinar')
            let upou = resultadoLevel.levels > 0
            salvar()
            if (pendingMoveChoices[sender]?.queue?.length) await promptNextMoveChoice(sender, from)
            return reply(`╭━━━⊱ 💪 TREINOU! ⊱━━━╮\n│ ${(pk.apelido||pk.nome).toUpperCase()} treinou!\n│ +${ganho} EXP (${pk.exp}/${need}) LV${pk.level} ${upou?'⬆ SUBIU!':''}\n│ Próximo treino em 5min\n╰━━━━━━━━━━━━━━━━━━━━╯`, pk.foto)
        }
        if (lower.startsWith('/upar') || lower.startsWith('†/upar')) {
            const idx = parseInt(lower.split(' ')[1])-1
            const pk = user.pokemons[idx]
            if (!pk) return reply(`Use: /upar 1`)
            const now = Date.now()
            const cd = 15*60*1000
            if (now - (pk.lastUpar||0) < cd) {
                const falta = cd - (now - (pk.lastUpar||0))
                const min = Math.floor(falta/1000/60)
                const sec = Math.floor((falta/1000)%60)
                return reply(`╭━━━⊱ ⏳ RECUPERANDO! ⊱━━━╮\n│ ${(pk.apelido||pk.nome).toUpperCase()} está se recuperando!\n│ Volta em *${min}m ${sec}s*\n│ Cooldown: 15min\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            const custo = pk.level*80
            if (user.money < custo) return reply(`╭━━━⊱ 💰 SEM GRANA ⊱━━━╮\n│ Precisa P$${custo} para treino intenso!\n│ Você tem P$${user.money}\n│ Use /trabalhar!\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            user.money-=custo
            pk.lastUpar=now
            const need = getXPNeeded(pk.level, pk.growthRate)
            const ganho = Math.floor(need*0.25)
            const resultadoLevel = await grantExperience(pk, ganho, 'upar')
            let upou = resultadoLevel.levels > 0
            salvar()
            if (pendingMoveChoices[sender]?.queue?.length) await promptNextMoveChoice(sender, from)
            return reply(`╭━━━⊱ 🏋 TREINO INTENSO! ⊱━━━╮\n│ ${(pk.apelido||pk.nome).toUpperCase()} treinou pesado!\n│ +${ganho} EXP LV${pk.level} ${upou?'⬆ SUBIU DE NÍVEL!':''}\n│ Custo: P$${custo} | P$ restantes: ${user.money}\n│ Próximo em 15min\n╰━━━━━━━━━━━━━━━━━━━━╯`, pk.foto)
        }


        // ==================== BERRIES / COLHERFRUITS ====================
        if (['/colherfruits','†/colherfruits','/colher','†/colher','/berry','†/berry','/moita','†/moita'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const now = Date.now()
            if (now - user.ultimoColheita < cooldownColheita) {
                const falta = cooldownColheita - (now - user.ultimoColheita)
                const min = Math.floor(falta/1000/60)
                const sec = Math.floor((falta/1000)%60)
                return reply(`╭━━━⊱ 🌿 MOITA VAZIA ⊱━━━╮\n│ Você já vasculhou aqui!\n│ As frutas precisam crescer...\n│ Volta em *${min}m ${sec}s*\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            user.ultimoColheita = now
            const roll = Math.random()*100
            let msg = ''
            let imgBerry = null
            if (roll < 40) {
                // 40% nada
                const frasesNada = [
                    'Você vasculhou a moita com cuidado... mas só achou folhas secas 🍂',
                    'Você mexeu nos arbustos e um Pidgey selvagem fugiu assustado! Nada aqui...',
                    'A moita estava vazia, parece que outro treinador já passou por aqui!',
                    'Você procurou por 10 minutos... só achou gravetos e terra 😅'
                ]
                msg = `╭━━━⊱ 🌿 COLHEITA ⊱━━━╮\n│ ${frasesNada[Math.floor(Math.random()*frasesNada.length)]}\n│\n│ Tente de novo em 5 min!\n╰━━━━━━━━━━━━━━━━━━━━╯`
            } else {
                // escolhe berry por peso
                let totalWeight = BERRY_POOL.reduce((a,b)=>a+b.weight,0)
                let r = Math.random()*totalWeight
                let escolhido = 'oran'
                for (let b of BERRY_POOL) { r-=b.weight; if (r<=0){ escolhido=b.id; break } }
                const berryInfo = BERRIES[escolhido]
                const qtd = (berryInfo.raridade==='comum' && Math.random()<0.4) ? 2 : 1
                user.bag.berries[escolhido] = (user.bag.berries[escolhido]||0)+qtd
                const raridadeEmoji = berryInfo.raridade==='comum'?'🌱' : berryInfo.raridade==='incomum'?'🌿' : berryInfo.raridade==='rara'?'✨' : '💫'
                msg = `╭━━━⊱ ${raridadeEmoji} BERRY ENCONTRADA! ⊱━━━╮\n│ Você vasculhou a moita e achou!\n│\n│ ${berryInfo.emoji} *${berryInfo.nome}* x${qtd}\n│ Raridade: *${berryInfo.raridade.toUpperCase()}*\n│ Valor: P$${berryInfo.valor} cada\n│ ${berryInfo.desc}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n/bag para ver sua mochila\n/vender ${escolhido} para vender por P$${berryInfo.valor*qtd}`
                if (berryInfo.raridade==='lendaria') msg+=`\n\n🎉 *LENDÁRIA!* Você teve MUITA sorte! (3% chance)`
            }
            salvar()
            return reply(msg)
        }

        if (lower.startsWith('/vender') || lower.startsWith('†/vender')) {
            if (!user.registrado) return reply(`Use /start`)
            const parts = textoRaw.split(' ')
            const berryId = (parts[1]||'').toLowerCase()
            let qtd = parseInt(parts[2])||1
            if (!berryId) {
                // lista berries vendáveis
                const lista = Object.entries(user.bag.berries||{}).filter(([k,v])=>v>0).map(([k,v])=>`│ ${BERRIES[k]?.emoji||'🍓'} ${k} x${v} - P$${(BERRIES[k]?.valor||50)*v}`).join('\n')
                if (!lista) return reply(`╭━━━⊱ 💰 VENDER ⊱━━━╮\n│ Você não tem berries!\n│ Use /colherfruits\n╰━━━━━━━━━━━━━━━━━━━━╯`)
                return reply(`╭━━━⊱ 💰 SUAS BERRIES ⊱━━━╮\n${lista}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n/vender <nome> <qtd>\nEx: /vender oran 2`)
            }
            if (!BERRIES[berryId]) return reply(`Berry inválida! Use: ${Object.keys(BERRIES).join(', ')}`)
            const tem = user.bag.berries[berryId]||0
            if (tem < qtd) return reply(`Você só tem ${tem}x ${berryId}!`)
            qtd = Math.min(qtd, tem)
            const valorTotal = BERRIES[berryId].valor * qtd
            user.bag.berries[berryId]-=qtd
            if (user.bag.berries[berryId]<=0) delete user.bag.berries[berryId]
            user.money+=valorTotal
            salvar()
            return reply(`╭━━━⊱ 💰 VENDIDO! ⊱━━━╮\n│ ${BERRIES[berryId].emoji} ${BERRIES[berryId].nome} x${qtd}\n│ +P$${valorTotal}\n│ Saldo: P$${user.money}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
        }

        if (['/bag','†/bag','/inv','†/inv','/mochila','†/mochila','/inventario','†/inventario'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const ballsTxt = Object.entries(user.balls||{}).filter(([k,v])=>v>0).map(([k,v])=>`│ 🎾 ${k} Ball x${v}`).join('\n') || '│ Nenhuma Pokébola'
            const berriesEntries = Object.entries(user.bag.berries||{}).filter(([k,v])=>v>0)
            const berriesTxt = berriesEntries.length ? berriesEntries.map(([k,v])=>`│ ${BERRIES[k]?.emoji||'🍓'} ${BERRIES[k]?.nome||k} x${v} (P$${BERRIES[k]?.valor||50}/un)`).join('\n') : '│ Nenhuma berry - use /colherfruits'
            const totalBerries = berriesEntries.reduce((a,[k,v])=>a+v,0)
            const valorBerries = berriesEntries.reduce((a,[k,v])=>a+ (BERRIES[k]?.valor||0)*v,0)
            const cap = `╭━━━⊱ 🎒 *MOCHILA* ⊱━━━╮\n│ P$: *${user.money}* | PB: *${user.pb||0}*\n│ Berries: *${totalBerries}* (P$${valorBerries} total)\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🎾 POKÉBOLAS ⪨─┓\n${ballsTxt}\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 🍓 BERRIES / FRUITS ⪨─┓\n${berriesTxt}\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n┏─⪩ 🎒 OUTROS ⪨─┓\n│ Itens: ${(user.bag.itens && Object.keys(user.bag.itens).length) ? Object.entries(user.bag.itens).map(([k,v])=>k+' x'+v).join(', ') : 'Nenhum'}\n│ TMs: ${(user.bag.tms||[]).length||'Nenhum'}\n│ HMs: surf:${user.hm?.surf?'✅':'❌'} | strength:${user.hm?.strength?'✅':'❌'} | fly:${user.hm?.fly?'✅':'❌'}\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n💡 /colherfruits - achar berries\n💰 /vender <berry> <qtd> - vender\n🏦 /loja - comprar balls`
            try{
                if (fs.existsSync(BAG_BANNER_PATH)){
                    const buff = fs.readFileSync(BAG_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: cap }, { quoted: msg })
                }
                if (fs.existsSync(MENU_BANNER_PATH)){
                    const buff = fs.readFileSync(MENU_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: cap }, { quoted: msg })
                }
            }catch{}
            return reply(cap)
        }

        if (['/diario','†/diario','/daily','†/daily','/recompensa','†/recompensa'].includes(lower)) {
            if (!user.registrado) return reply(`Use /start`)
            const now = Date.now()
            const hoje = new Date().toDateString()
            const ultimoDia = user.diario?.ultimoDiaStr || ''
            const ultimoTime = user.diario?.ultimo || 0
            const diffMs = now - ultimoTime
            const umDia = 24*60*60*1000
            if (ultimoDia===hoje) {
                const falta = umDia - (now - ultimoTime)
                const h = Math.floor(falta/1000/60/60)
                const m = Math.floor((falta/1000/60)%60)
                return reply(`╭━━━⊱ 📅 DIÁRIO ⊱━━━╮\n│ Você já pegou hoje!\n│ Streak: *${user.diario.streak||0} dias*\n│ Volta em ${h}h ${m}m\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            }
            let streak = user.diario.streak||0
            if (diffMs > umDia*2) {
                streak = 0 // quebrou streak
            }
            streak++
            user.diario.streak = streak
            user.diario.ultimo = now
            user.diario.ultimoDiaStr = hoje
            user.diario.total = (user.diario.total||0)+1

            const recompensas = {
                1: { money:500, balls:{poke:2}, msg:'Dia 1' },
                2: { money:700, balls:{poke:2, great:1}, msg:'Dia 2' },
                3: { money:1000, balls:{great:2}, msg:'Dia 3' },
                4: { money:1500, balls:{great:2, ultra:1}, msg:'Dia 4' },
                5: { money:2000, balls:{ultra:2}, msg:'Dia 5' },
                6: { money:3000, balls:{ultra:2, safari:2}, msg:'Dia 6' },
                7: { money:5000, balls:{master:1, ultra:2}, berry:{id:'lum', qtd:2}, msg:'Dia 7 - SEMANAL!' }
            }
            const dia = streak>7 ? 7 : streak
            const rew = recompensas[dia]
            user.money+=rew.money
            for (let b in rew.balls){ user.balls[b]=(user.balls[b]||0)+rew.balls[b] }
            if (rew.berry){
                user.bag.berries[rew.berry.id]=(user.bag.berries[rew.berry.id]||0)+rew.berry.qtd
            }
            // bonus berry aleatória 20% chance
            if (Math.random()<0.2){
                const comum = ['oran','pecha','cheri'][Math.floor(Math.random()*3)]
                user.bag.berries[comum]=(user.bag.berries[comum]||0)+1
            }
            salvar()
            let txt = `╭━━━⊱ 📅 *DIÁRIO - ${rew.msg}* ⊱━━━╮\n│ Streak: *${streak} dias* 🔥\n│ Total pegos: ${user.diario.total}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🎁 RECOMPENSA ⪨─┓\n│ 💰 P$${rew.money}\n`
            for (let b in rew.balls) txt+=`│ 🎾 ${b} x${rew.balls[b]}\n`
            if (rew.berry) txt+=`│ ${BERRIES[rew.berry.id].emoji} ${BERRIES[rew.berry.id].nome} x${rew.berry.qtd}\n`
            txt+=`┗━━━━━━━━━━━━━━━━━━━━┛\n\nVolte amanhã para manter o streak! Dia 7 tem Master Ball!`
            try{
                if (fs.existsSync(MENU_BANNER_PATH)){
                    const buff = fs.readFileSync(MENU_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: txt }, { quoted: msg })
                }
            }catch{}
            return reply(txt)
        }

        if (lower.startsWith('/trocar') || lower.startsWith('†/trocar') || lower.startsWith('/trade')) {
            if (!user.registrado) return reply(`Use /start`)
            const partes = textoRaw.split(' ')
            const sub = (partes[1]||'').toLowerCase()

            if (['aceitar','aceito','accept'].includes(sub)) {
                const pend = pendingTrades[sender]
                if (!pend) return reply(`❌ Você não tem nenhuma troca pendente!`)
                if (Date.now()-pend.time > 2*60*1000){ delete pendingTrades[sender]; return reply(`⏰ Troca expirou! (2 min)`) }
                const fromUser = db[pend.fromJid]
                if (!fromUser) { delete pendingTrades[sender]; return reply(`Usuário saiu!`) }
                const meuPokeIdx = pend.toIdx
                const delePokeIdx = pend.fromIdx
                if (!user.pokemons[meuPokeIdx] || !fromUser.pokemons[delePokeIdx]) { delete pendingTrades[sender]; return reply(`Um dos Pokémon não existe mais!`) }
                if (user.pokemons.length<=1 || fromUser.pokemons.length<=1) return reply(`Ambos precisam ter pelo menos 2 Pokémon no time para trocar!`)
                const meuPk = user.pokemons[meuPokeIdx]
                const delePk = fromUser.pokemons[delePokeIdx]
                user.pokemons[meuPokeIdx]=delePk
                fromUser.pokemons[delePokeIdx]=meuPk
                delete pendingTrades[sender]
                salvar()
                const txt = `╭━━━⊱ 🔄 *TROCA REALIZADA!* ⊱━━━╮\n│ @${pend.fromJid.split('@')[0]} ↔ @${sender.split('@')[0]}\n│\n│ @${pend.fromJid.split('@')[0]} entregou *${(delePk.apelido||delePk.nome).toUpperCase()}* LV${delePk.level}\n│ @${sender.split('@')[0]} entregou *${(meuPk.apelido||meuPk.nome).toUpperCase()}* LV${meuPk.level}\n╰━━━━━━━━━━━━━━━━━━━━╯`
                try{
                    await sock.sendMessage(from, { text: txt, mentions:[pend.fromJid, sender] }, { quoted: msg })
                    await sock.sendMessage(pend.fromGroup, { text: txt, mentions:[pend.fromJid, sender] })
                }catch{ await reply(txt) }
                return
            }
            if (['recusar','recuso','negar','cancelar'].includes(sub)) {
                const pend = pendingTrades[sender]
                if (!pend) return reply(`Nenhuma troca pendente!`)
                delete pendingTrades[sender]
                try{
                    await sock.sendMessage(pend.fromGroup, { text:`❌ @${sender.split('@')[0]} recusou a troca com @${pend.fromJid.split('@')[0]}`, mentions:[sender, pend.fromJid] })
                }catch{}
                return reply(`❌ Troca recusada!`)
            }

            // criar troca: /trocar @user 1 2
            const men = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            const alvoJid = men && men[0] ? men[0] : null
            if (!alvoJid) return reply(`╭━━━⊱ 🔄 TROCAR ⊱━━━╮\n│ Use: /trocar @amigo <seuPoke> <pokeDele>\n│ Ex: /trocar @joao 1 2\n│ Seus pokes: /time\n│ Depois: /trocar aceitar ou /trocar recusar\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            if (alvoJid===sender) return reply(`Não pode trocar consigo mesmo!`)
            const alvo = db[alvoJid]
            if (!alvo || !alvo.registrado) return reply(`Alvo sem jornada!`)
            const meuIdx = parseInt(partes[2])-1
            const deleIdx = parseInt(partes[3])-1
            if (isNaN(meuIdx) || isNaN(deleIdx)) return reply(`Use: /trocar @amigo <seu poke 1-6> <poke dele 1-6>\nEx: /trocar @joao 1 2`)
            if (!user.pokemons[meuIdx] || !alvo.pokemons[deleIdx]) return reply(`Pokémon inválido! Você tem ${user.pokemons.length}, ele tem ${alvo.pokemons.length}`)
            if (user.pokemons.length<=1) return reply(`Você precisa ter pelo menos 2 Pokémon no time para trocar!`)
            if (alvo.pokemons.length<=1) return reply(`Ele precisa ter pelo menos 2 Pokémon!`)
            if (pendingTrades[alvoJid] && Date.now()-pendingTrades[alvoJid].time < 2*60*1000) return reply(`Esse treinador já tem troca pendente!`)

            pendingTrades[alvoJid] = { fromJid: sender, fromIdx: meuIdx, toIdx: deleIdx, toJid: alvoJid, time: Date.now(), fromGroup: from }
            const meuPk = user.pokemons[meuIdx]
            const delePk = alvo.pokemons[deleIdx]
            const convite = `╭━━━⊱ 🔄 TROCA! ⊱━━━╮\n│ @${sender.split('@')[0]} quer trocar!\n│\n│ Ele oferece: *${(meuPk.apelido||meuPk.nome).toUpperCase()}* LV${meuPk.level}${meuPk.shiny?' ✨':''}\n│ Quer: *${(delePk.apelido||delePk.nome).toUpperCase()}* LV${delePk.level}${delePk.shiny?' ✨':''} seu\n│\n│ /trocar aceitar - Aceita\n│ /trocar recusar - Recusa\n│ Expira em 2 min\n╰━━━━━━━━━━━━━━━━━━━━╯`
            try{
                await sock.sendMessage(from, { text: convite, mentions:[alvoJid, sender] }, { quoted: msg })
            }catch{ await reply(convite) }
            return reply(`🔄 Convite enviado para @${alvoJid.split('@')[0]}! Oferecendo ${(meuPk.apelido||meuPk.nome).toUpperCase()} por ${(delePk.apelido||delePk.nome).toUpperCase()}`, meuPk.foto)
        }

        if (['/loja','†/loja'].includes(lower)) {
            return reply(`╭━━━⊱ 🛒 *LOJA ECLIPSE* ⊱━━━╮\n│ P$ ${user.money}\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n┏─⪩ 🎾 POKÉBOLAS ⪨─┓\n│ /comprar poke P$100 (1x)\n│ /comprar great P$300 (1.5x)\n│ /comprar ultra P$600 (2x)\n│ /comprar master P$10000 (100%)\n│ /comprar safari P$200 (Safari)\n┗━─━─━─━─━─━─━─━─━┛\n\n┏─⪩ 🍓 BERRIES ⪨─┓\n│ /colherfruits - Achar berries grátis (5min)\n│ /vender <berry> <qtd> - Vender berries\n│ Valor: comum P$60-80 | rara P$400 | lendária P$1000+\n┗━─━─━─━─━─━─━─━─━┛`)
        }
        if (lower.startsWith('/comprar')) {
            const item = lower.split(' ')[1]
            const precos = { poke:100, great:300, ultra:600, master:10000, safari:200 }
            if (!precos[item]) return reply(`Item inválido! Use: poke, great, ultra, master, safari`)
            if (user.money < precos[item]) return reply(`╭━━━⊱ 💰 SEM GRANA ⊱━━━╮\n│ ${item} custa P$${precos[item]}!\n│ Você tem P$${user.money}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
            user.money -= precos[item]
            user.balls[item] = (user.balls[item]||0)+1
            salvar()
            return reply(`╭━━━⊱ ✅ COMPROU! ⊱━━━╮\n│ ${item} ball x1\n│ P$ restantes: ${user.money}\n│ Total ${item}: ${user.balls[item]}\n╰━━━━━━━━━━━━━━━━━━━━╯`)
        }

        if (['/rank','†/rank'].includes(lower)) {
            const allUsers = Object.entries(db).filter(([jid,u])=>u.registrado).map(([jid,u])=>{ const s=calcRankScore(u); return {jid, u, ...s} }).sort((a,b)=> b.score - a.score).slice(0,10)
            let rankTxt = ''
            allUsers.forEach((entry,i)=>{
                const nome = (entry.u.pokemons[0]?.apelido||entry.u.pokemons[0]?.nome||'???').toUpperCase()
                const medal = i===0?'👑' : i===1?'🥈' : i===2?'🥉' : '│'
                rankTxt+=`${medal} ${i+1}. ${nome} - Score ${entry.score}\n│   └ ${entry.qtd} pokes | LVmed ${entry.media} | PB ${entry.pb} | P$${entry.dinheiro}\n`
            })
            const finalTxt = `╭━━━⊱ 🏆 RANK TOP 10 ⊱━━━╮\n│ Score = Qtd*25 + LVmédio*12 + P$/200 + PB*15\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n${rankTxt}\n┏─⪩ 📊 SEU RANK ⪨─┓\n${(()=>{ const s=calcRankScore(user); return `│ Qtd: ${s.qtd} | LVmédio: ${s.media} | P$: ${s.dinheiro} | PB: ${s.pb}\n│ Score: ${s.score}` })()}\n┗━━━━━━━━━━━━━━━━━━━━┛`
            try{
                if (fs.existsSync(RANK_BANNER_PATH)){
                    const buff = fs.readFileSync(RANK_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: finalTxt }, { quoted: msg })
                }
                if (fs.existsSync(MENU_BANNER_PATH)){
                    const buff = fs.readFileSync(MENU_BANNER_PATH)
                    return await sock.sendMessage(from, { image: buff, caption: finalTxt }, { quoted: msg })
                }
            }catch{}
            return reply(finalTxt)
        }

        if (['/reset','†/reset'].includes(lower)) {
            return reply(`╭━━━⊱ ⚠ RESETAR ⊱━━━╮\n│ Tem certeza? Perde TUDO!\n╰━━━━━━━━━━━━━━━━━━━━╯\n\n/reset confirmar`)
        }
        if (['/reset confirmar','†/reset confirmar'].includes(lower)) {
            db[sender] = { registrado:false, regiao:null, pokemons:[], box:[], boxes:[], boxesUnlocked:1, boxAtiva:1, money:1000, balls:{poke:15,great:5,ultra:2,master:0,safari:5}, bag:{berries:{}, itens:{}, tms:[], hms:[]}, itens:[], ultimoCaptura:[], ultimoCapturaTime:0, ultimoDiario:0, ultimoColheita:0, rank:0, pb:0, hm:{surf:false,strength:false,fly:false}, ultimoTrabalho:0, diario:{ultimo:0,streak:0,total:0,ultimoDiaStr:''}, aventura:{} }
            salvar()
            return reply(`🗑 RESETADO! Use /start`)
        }
    })
}
startBot()
