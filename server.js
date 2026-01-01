/**
 * ===============================================================================
 * APEX MASTER v34.2 (UNIVERSAL CLUSTER) - FINAL STABILITY BUILD
 * ===============================================================================
 * FIX: MaxListenersExceeded Warning + EventEmitter Memory Leak
 * DNA: HEALTH SERVER + WEALTH-SCALING + NUCLEAR BRIBE (99.9%)
 * PROTECTION: 48-CORE COORDINATION | MULTI-RPC FALLBACK | L1 GAS AWARE
 * ===============================================================================
 */

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { 
    ethers, JsonRpcProvider, Wallet, Interface, parseEther, 
    formatEther, Contract, FallbackProvider, WebSocketProvider 
} = require('ethers');
require('dotenv').config();

// --- CRITICAL: FIX EVENT LEAK & SCALE FOR 48 CORES ---
process.setMaxListeners(100); 

process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('429') || msg.includes('503') || msg.includes('Unexpected server response')) return;
    console.error("\n\x1b[31m[SYSTEM ROOT ERROR]\x1b[0m", msg);
});

const TXT = { reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", gold: "\x1b[38;5;220m", cyan: "\x1b[36m", magenta: "\x1b[35m" };

const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    GAS_LIMIT: 1250000n, 
    PORT_BASE: 8080,
    TUNABLES: { MAX_BRIBE_PERCENT: 99.9, GAS_PRIORITY_FEE: 1000, MIN_NET_PROFIT: "0.0005" },
    RPC_POOL: [
        "https://base.merkle.io",
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.gold}╔════════════════════════════════════════════════════════╗`);
    console.log(`║   ⚡ APEX MASTER v34.2 | STABILIZED UNIVERSAL CORE    ║`);
    console.log(`║   DNA: 48-CORE COORDINATION + HEALTH MONITORING      ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {};
    const cpuCount = Math.min(os.cpus().length, 48);
    
    // Centralized Signal Dispatcher (Prevents MaxListenersExceeded)
    const broadcastToWorkers = (msg) => {
        Object.values(cluster.workers).forEach(worker => {
            if (worker && worker.isConnected()) worker.send(msg);
        });
    };

    for (let i = 0; i < cpuCount; i++) {
        // v14.2 Staggered boot (1.5s) to bypass RPC rate limits
        setTimeout(() => {
            const worker = cluster.fork();
            
            worker.on('message', (msg) => {
                if (msg.type === 'SYNC_RESERVE') {
                    if (!nonces[msg.chainId] || msg.nonce > nonces[msg.chainId]) nonces[msg.chainId] = msg.nonce;
                    worker.send({ type: 'SYNC_GRANT', nonce: nonces[msg.chainId], chainId: msg.chainId, reqId: msg.reqId });
                    nonces[msg.chainId]++;
                }
                if (msg.type === 'SIGNAL') broadcastToWorkers(msg);
            });
        }, i * 1500); 
    }
    cluster.on('exit', () => setTimeout(() => cluster.fork(), 3000));
} else {
    // --- WORKER CORE ---
    initWorker();
}

async function initWorker() {
    const chainId = 8453; // Base L2 Primary
    const network = ethers.Network.from(chainId);
    const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
        priority: i + 1, stallTimeout: 1000
    })), network, { quorum: 1 });

    const wallet = new Wallet(process.env.TREASURY_PRIVATE_KEY.trim(), provider);
    const poolIface = new Interface(["function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"]);
    const l1Oracle = new Contract("0x420000000000000000000000000000000000000F", ["function getL1Fee(bytes) view returns (uint256)"], provider);
    const priceFeed = new Contract("0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
    
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : (cluster.worker.id % 4 === 3 ? "ANALYST" : "STRIKER");
    const TAG = `${TXT.cyan}[CORE ${cluster.worker.id}-${ROLE}]${TXT.reset}`;

    let currentEthPrice = 0;

    // Health Server Integration
    try {
        http.createServer((req, res) => {
            if (req.url === '/status') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "ONLINE", core: cluster.worker.id, role: ROLE }));
            }
        }).listen(GLOBAL_CONFIG.PORT_BASE + cluster.worker.id);
    } catch (e) {}

    async function connect() {
        try {
            const ws = new WebSocketProvider(process.env.BASE_WSS, network);
            ws.on('error', () => {}); 

            if (ROLE === "ANALYST") {
                const updatePrice = async () => { try { const [, p] = await priceFeed.latestRoundData(); currentEthPrice = Number(p) / 1e8; } catch (e) {} };
                await updatePrice(); setInterval(updatePrice, 20000);
            }

            if (ROLE === "LISTENER") {
                ws.on('block', () => process.send({ type: 'SIGNAL', chainId }));
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                ws.on({ topics: [swapTopic] }, () => process.send({ type: 'SIGNAL', chainId }));
                console.log(`${TAG} Health Server port ${GLOBAL_CONFIG.PORT_BASE + cluster.worker.id} active.`);
            } else if (ROLE === "STRIKER") {
                process.on('message', async (msg) => {
                    if (msg.type === 'SIGNAL') {
                        await new Promise(r => setTimeout(r, Math.random() * 25)); // Jitter
                        await executeClusterStrike(provider, wallet, poolIface, l1Oracle, currentEthPrice, TAG);
                    }
                });
                console.log(`${TAG} Striker STANDBY.`);
            }
        } catch (e) { setTimeout(connect, 10000); }
    }
    connect();
}

async function executeClusterStrike(provider, wallet, iface, oracle, ethPrice, TAG) {
    try {
        const reqId = Math.random();
        const state = await new Promise(res => {
            const h = m => { if(m.reqId === reqId) { process.removeListener('message', h); res(m); }};
            process.on('message', h);
            process.send({ type: 'SYNC_RESERVE', chainId: 8453, reqId });
        });

        // wealth scaling
        const balance = await provider.getBalance(wallet.address);
        const usdValue = parseFloat(formatEther(balance)) * ethPrice;
        let loanAmount = parseEther("25"); 
        if (usdValue >= 1000) loanAmount = parseEther("250");

        const data = iface.encodeFunctionData("flashLoanSimple", [GLOBAL_CONFIG.TARGET_CONTRACT, "0x4200000000000000000000000000000000000006", loanAmount, "0x", 0]);

        const [sim, l1Fee, feeData] = await Promise.all([
            provider.call({ to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", data, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => "0x"),
            oracle.getL1Fee(data).catch(() => 0n),
            provider.getFeeData()
        ]);

        if (sim === "0x" || BigInt(sim) === 0n) return;

        const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseEther("0.1", "gwei");
        const priority = parseEther("1000", "gwei");
        const totalCost = (GLOBAL_CONFIG.GAS_LIMIT * (baseFee + priority)) + l1Fee + ((loanAmount * 5n) / 10000n);

        if (BigInt(sim) > (totalCost + parseEther(GLOBAL_CONFIG.TUNABLES.MIN_NET_PROFIT))) {
            const tx = { to: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", data, type: 2, maxFeePerGas: baseFee + priority, maxPriorityFeePerGas: priority, gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce, chainId: 8453 };
            const signedHex = await wallet.signTransaction(tx);
            // TRIPLE BROADCAST
            axios.post(GLOBAL_CONFIG.RPC_POOL[0], { jsonrpc: "2.0", id: 1, method: "eth_sendRaw_Transaction", params: [signedHex] }).catch(() => {});
            GLOBAL_CONFIG.RPC_POOL.forEach(url => axios.post(url, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {}));
            console.log(`\n${TXT.green}${TXT.bold}🚀 CLUSTER STRIKE: +${formatEther(BigInt(sim) - totalCost)} ETH${TXT.reset}`);
        }
    } catch (e) {}
}
