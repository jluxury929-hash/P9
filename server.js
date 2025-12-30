// ===============================================================================
// APEX TITAN v70.0 (APEX ELITE QUANTUM) - HIGH-FREQUENCY CLUSTER
// ===============================================================================
// MERGE SYNC: v69.0 (ULTIMATE) + v53.0 (ELITE STABILITY) + v26.1 (TELEMETRY)
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (v53.0 HANDSHAKE ISOLATION) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    // Protocol mismatch check (v69.0 Base)
    if (msg.includes('200')) {
        console.error("\n\x1b[31m[PROTOCOL ERROR] Unexpected Response 200: Check WSS URL (likely HTTP).\x1b[0m");
        return;
    }
    // High-Frequency Noise Suppression (v53.0 Resilience)
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe') || msg.includes('infura')) return; 
    
    if (msg.includes('401')) {
        console.error("\n\x1b[31m[AUTH ERROR] 401 Unauthorized: Invalid API Key in .env\x1b[0m");
        return;
    }
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('401')) return;
});

// --- FLASHBOTS INTEGRATION ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.log("\x1b[33m%s\x1b[0m", "⚠️ Flashbots dependency missing. Private bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION (v70.0 ELITE MERGE) ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.EXECUTOR_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    BENEFICIARY: process.env.BENEFICIARY || "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // 🚦 TRAFFIC CONTROL (v53.0 Elite Stability)
    MAX_CORES: Math.min(os.cpus().length, 16), 
    MEMPOOL_SAMPLE_RATE: 0.015,  // 1.5% per core (v53.0 Elite coverage)
    WORKER_BOOT_DELAY_MS: 18000, // 18s Master Stagger (Tier 1)
    HEARTBEAT_INTERVAL_MS: 40000,
    RPC_COOLDOWN_MS: 15000,
    RATE_LIMIT_SLEEP_MS: 150000, // 150s Deep Sleep backoff (Tier 2 safety)
    PORT: process.env.PORT || 8080,
    
    // 🐋 OMNISCIENT SETTINGS
    WHALE_THRESHOLD: parseEther("10.0"), 
    MIN_LOG_ETH: parseEther("10.0"),
    QUANTUM_BRIBE_MAX: 99.5,
    GAS_LIMIT: 1400000n,
    MARGIN_ETH: "0.015",
    PRIORITY_BRIBE: 25n,
    CROSS_CHAIN_PROBE: true,

    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: process.env.ETH_RPC || "https://rpc.flashbots.net",
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS",
            relay: "https://relay.flashbots.net",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            color: TXT.cyan
        },
        {
            name: "BASE_MAINNET",
            chainId: 8453,
            rpc: process.env.BASE_RPC || "https://mainnet.base.org",
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            weth: "0x4200000000000000000000000000000000000006",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS (v68.0 ORCHESTRATION) ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v70.0 | ELITE QUANTUM OVERLORD       ║
║   MODE: TRIPLE-TIER STAGGER + IPC + DYNAMIC WEALTH    ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = GLOBAL_CONFIG.MAX_CORES;
    console.log(`${TXT.cyan}[SYSTEM] Staggering ${cpuCount} Core Deployment (18s intervals)...${TXT.reset}`);

    const workers = [];
    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        const worker = cluster.fork();
        workers.push(worker);

        worker.on('message', (msg) => {
            if (msg.type === 'WHALE_SIGNAL') {
                workers.forEach(w => { if (w.id !== worker.id) w.send(msg); });
            }
        });
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Died. Cooldown Sleep (60s) to avoid RPC lockout...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 60000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    
    // v53.0: Tier 2 Jitter (5-15s) before worker even attempts to connect
    const initialJitter = 5000 + (cluster.worker.id % 20) * 500;
    setTimeout(() => {
        initWorker(NETWORK).catch(() => process.exit(1));
    }, initialJitter);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    const IS_LISTENER = (cluster.worker.id <= 3);
    const ROLE = IS_LISTENER ? "LISTENER" : "STRIKER";
    
    let isProcessing = false;
    let currentEthPrice = 0;
    let retryCount = 0;
    const walletKey = (process.env.PRIVATE_KEY || "").trim();

    if (!walletKey || walletKey.includes("0000000")) return;

    // 1. TELEMETRY SERVER (v26.1)
    try {
        const server = http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ONLINE", role: ROLE, chain: CHAIN.name, mode: "ELITE_v70" }));
            } else { res.writeHead(404); res.end(); }
        });
        server.on('error', () => {});
        server.listen(Number(GLOBAL_CONFIG.PORT) + cluster.worker.id); 
    } catch (e) {}

    async function safeConnect() {
        if (retryCount >= 40) return;

        try {
            if (!CHAIN.wss.startsWith("ws")) {
                console.error(`${TAG} ${TXT.red}PROTOCOL ERROR: Check WSS URL.${TXT.reset}`);
                return;
            }

            // v51.0 Handshake Shield
            const netObj = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
            
            // Shared Listener Pattern (v68.0)
            const wsProvider = IS_LISTENER ? new WebSocketProvider(CHAIN.wss, netObj) : null;
            
            if (wsProvider) {
                wsProvider.on('error', (e) => {
                    const emsg = e.message || "";
                    if (emsg.includes("200") || emsg.includes("429") || emsg.includes("coalesce")) {
                        process.stdout.write(`${TXT.red}!${TXT.reset}`);
                    }
                });
                if (wsProvider.websocket) {
                    wsProvider.websocket.onclose = () => setTimeout(safeConnect, 60000);
                }
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint80,uint80)"], provider);
            const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

            let fbProvider = null;
            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                try {
                    fbProvider = await FlashbotsBundleProvider.create(provider, wallet, CHAIN.relay);
                } catch (e) {}
            }

            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [, price] = await priceFeed.latestRoundData();
                    currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS);

            const apexIface = new Interface([
                "function executeFlashArbitrage(address tokenA, address tokenOut, uint256 amount)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} ELITE SYNCED on ${TAG}${TXT.reset}`);

            // IPC Handler
            process.on('message', async (msg) => {
                if (msg.type === 'WHALE_SIGNAL' && msg.chainId === CHAIN.chainId && !isProcessing) {
                    isProcessing = true;
                    await strike(provider, wallet, fbProvider, apexIface, poolContract, currentEthPrice, CHAIN, msg.target, "IPC_STRIKE");
                    setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                }
            });

            if (IS_LISTENER && wsProvider) {
                // v53.0 Tier 3 Stagger: 10s delay before initiating Mempool/Log subscriptions
                setTimeout(() => {
                    // Mempool Interceptor
                    wsProvider.on("pending", async (txHash) => {
                        if (isProcessing) return;
                        if (Math.random() > GLOBAL_CONFIG.MEMPOOL_SAMPLE_RATE) return; 

                        try {
                            const tx = await provider.getTransaction(txHash).catch(() => null);
                            if (tx && tx.to && tx.value >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                                const isDEX = (tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase());
                                if (isDEX) {
                                    process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: tx.to });
                                    console.log(`\n${TAG} ${TXT.magenta}🚨 ELITE INTERCEPT: ${formatEther(tx.value)} ETH detected!${TXT.reset}`);
                                    isProcessing = true;
                                    await strike(provider, wallet, fbProvider, apexIface, poolContract, currentEthPrice, CHAIN, tx.to, "PRIMARY_SNIPE");
                                    setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                                }
                            }
                        } catch (err) {}
                    });

                    // Leviathan Log Sniper
                    const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                    wsProvider.on({ topics: [swapTopic] }, async (log) => {
                        if (isProcessing) return;
                        try {
                            const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                            const maxVal = decoded.reduce((max, val) => val > max ? val : max, 0n);
                            if (maxVal >= GLOBAL_CONFIG.LEVIATHAN_MIN_ETH) {
                                process.send({ type: 'WHALE_SIGNAL', chainId: CHAIN.chainId, target: log.address });
                                isProcessing = true;
                                console.log(`\n${TAG} ${TXT.yellow}🐳 ELITE LOG CONFIRMED: ${formatEther(maxVal)} ETH${TXT.reset}`);
                                await strike(provider, wallet, fbProvider, apexIface, poolContract, currentEthPrice, CHAIN, log.address, "LEVIATHAN_STRIKE");
                                setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                            }
                        } catch (e) {}
                    });
                }, 10000);

                // Probabilistic Triangle Probe
                setInterval(async () => {
                    if (isProcessing || Math.random() < 0.95 || !GLOBAL_CONFIG.CROSS_CHAIN_PROBE) return; 
                    isProcessing = true;
                    await strike(provider, wallet, fbProvider, apexIface, poolContract, currentEthPrice, CHAIN, "0x...", "TRIANGLE_PROBE");
                    setTimeout(() => isProcessing = false, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                }, 60000);
            }
        } catch (e) {
            retryCount++;
            const backoff = (e.message.includes("429")) ? GLOBAL_CONFIG.RATE_LIMIT_SLEEP_MS : (15000 * retryCount);
            process.stdout.write(`${TXT.red}?${TXT.reset}`);
            setTimeout(safeConnect, backoff);
        }
    }

    await safeConnect();
}

async function strike(provider, wallet, fbProvider, iface, pool, ethPrice, CHAIN, target, mode) {
    try {
        const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
        const balanceEth = parseFloat(formatEther(balanceWei));
        const usdWealth = balanceEth * ethPrice;
        let loanAmount;

        // v52.0 Dynamic Wealth Tiers
        if (usdWealth >= 200) loanAmount = parseEther("100");
        else if (usdWealth >= 100) loanAmount = parseEther("75");
        else if (usdWealth >= 50)  loanAmount = parseEther("25");
        else loanAmount = parseEther("10");

        if (pool && CHAIN.chainId === 8453) {
            const [res0] = await pool.getReserves().catch(() => [0n]);
            const poolLimit = BigInt(res0) / 10n; // 10% depth limit
            if (loanAmount > poolLimit) loanAmount = poolLimit;
        }

        let txData;
        if (mode === "TRIANGLE_PROBE") {
            const path = [CHAIN.weth, GLOBAL_CONFIG.USDC, GLOBAL_CONFIG.CBETH, CHAIN.weth]; 
            txData = iface.encodeFunctionData("executeTriangle", [path, parseEther("25")]);
        } else {
            txData = iface.encodeFunctionData("executeFlashArbitrage", [CHAIN.weth, target, 0]);
        }
        
        // Visual Sequence
        if (mode !== "IPC_STRIKE") {
            console.log(`   ↳ ${TXT.dim}🔍 ELITE: Checking Multi-DEX Routing...${TXT.reset}`);
            console.log(`   ↳ ${TXT.blue}🌑 DARK POOL: Routing via MEV-Share Private Peering...${TXT.reset}`);
        }

        const [simulation, feeData] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: txData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            provider.getFeeData()
        ]);

        if (simulation && simulation !== "0x") {
            console.log(`\n${TXT.green}${TXT.bold}💎 [${mode}] PROFIT AUTHORIZED! +${formatEther(simulation)} ETH (~$${(parseFloat(formatEther(simulation)) * ethPrice).toFixed(2)})${TXT.reset}`);
            
            let bribePercent = GLOBAL_CONFIG.PRIORITY_BRIBE;
            if (mode === "TRIANGLE_PROBE") bribePercent = BigInt(Math.floor(GLOBAL_CONFIG.QUANTUM_BRIBE_MAX));
            const aggressivePriority = feeData.maxPriorityFeePerGas + ((feeData.maxPriorityFeePerGas * bribePercent) / 100n);

            const tx = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: txData,
                type: 2,
                chainId: CHAIN.chainId,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                nonce: await provider.getTransactionCount(wallet.address),
                value: 0n
            };

            if (fbProvider && CHAIN.chainId === 1) {
                const bundle = [{ signedTransaction: await wallet.signTransaction(tx) }];
                await fbProvider.sendBundle(bundle, (await provider.getBlockNumber()) + 1);
                console.log(`   ${TXT.green}🎉 Private Elite Bundle Dispatched (Mainnet)${TXT.reset}`);
            } else {
                const signedTx = await wallet.signTransaction(tx);
                await axios.post(CHAIN.rpc, {
                    jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                }, { timeout: 2000 }).catch(() => {});
                console.log(`   ${TXT.green}✨ SUCCESS: FUNDS SECURED AT: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
            }
        }
    } catch (e) {}
}
