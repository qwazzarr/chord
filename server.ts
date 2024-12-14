import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import cors from 'cors'
import { argv } from 'process';

// Hash a string into a numeric ID in [0, 2^m-1]. This is used for consistent hashing.
function hashToID(str: string, m: number): bigint {
    const hash = crypto.createHash('sha1').update(str).digest();
    const bitsNeeded = m;
    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    const sliced = hash.slice(0, bytesNeeded);

    let id = BigInt(0);
    for (let i = 0; i < sliced.length; i++) {
        id = (id << BigInt(8)) + BigInt(sliced[i]);
    }

    // Remove any excess bits to fit within m bits
    const excessBits = (bytesNeeded * 8) - bitsNeeded;
    if (excessBits > 0) {
        id = id >> BigInt(excessBits);
    }

    return id;
}

// Check if key is in interval (start, end] on a circular ring of size 2^m.
function inInterval(key: bigint, start: bigint, end: bigint, ringSize: bigint): boolean {
    if (start < end) {
        return (key > start && key <= end);
    } else {
        return (key > start && key < ringSize) || (key >= BigInt(0) && key <= end);
    }
}

interface NodeEntry {
    id: bigint;
    url: string;
}
// Class representing a single node in the Chord ring
class Node {
    id: bigint;
    url: string;
    kvStore: Map<bigint, { originalKey: string, value: string }>;
    m: number;
    ringSize: bigint; //Size of the circular ring (2^m)
    fingerTable: (NodeEntry | null)[];
    predecessor: NodeEntry | null;
    successor: NodeEntry;
    stabilizeInterval: number;

    constructor(url: string, dummy: string, m: number, stabilizeInterval: number) {
        this.url = url;
        this.m = m;
        this.id = hashToID(url, m);
        this.ringSize = BigInt(1) << BigInt(m);
        this.fingerTable = new Array(m).fill(null);
        this.predecessor = null;
        this.successor = { id: this.id, url: this.url };
        this.stabilizeInterval = stabilizeInterval;
        this.kvStore = new Map();
    }

    // Find the successor node responsible for a given key
    async findSuccessor(keyStr: string): Promise<NodeEntry> {
        const key = hashToID(keyStr, this.m);
        let currentNode: Node = this;
        while (!inInterval(key, currentNode.id, currentNode.successor.id, currentNode.ringSize)) {
            const cpNode = currentNode.closestPrecedingNode(key);
            if (cpNode.id === currentNode.id) break;
            currentNode = await fetchNodeInfo(cpNode.url, this) as this;
        }
        return currentNode.successor;
    }
    // Find the predecessor node for a given key
    async findPredecessor(keyStr: string): Promise<Node> {
        const key = hashToID(keyStr, this.m);
        let currentNode: Node = this;
        while (!inInterval(key, currentNode.id, currentNode.successor.id, currentNode.ringSize)) {
            const cpNode = currentNode.closestPrecedingNode(key);
            if (cpNode.id === currentNode.id) break;
            currentNode = await fetchNodeInfo(cpNode.url, this) as this;
        }
        return currentNode;
    }

    closestPrecedingNode(key: bigint): NodeEntry {
        for (let i = this.fingerTable.length - 1; i >= 0; i--) {
            const ft = this.fingerTable[i];
            if (ft && inInterval(ft.id, this.id, key, this.ringSize)) {
                return ft;
            }
        }
        return { id: this.id, url: this.url };
    }

    // Join an existing Chord ring or form a new ring if none exists
    async join(existingNodeUrl: string | null) {
        if (existingNodeUrl !== null) {
            const succ = await (await fetchNodeInfo(existingNodeUrl, this)).findSuccessor(this.url);
            this.predecessor = null;
            this.successor = succ;
        } else {
            this.predecessor = { id: this.id, url: this.url };
            this.successor = { id: this.id, url: this.url };
        }
        this.fingerTable[0] = this.successor;
    }
    // Periodic function to stabilize the node's successor pointer and notify the successor
    async stabilize() {
        if (this.successor.id === this.id && this.predecessor === null) return;
        const successorNode = await fetchNodeInfo(this.successor.url, this);
        const x = successorNode.predecessor;
        if (x !== null && inInterval(x.id, this.id, this.successor.id, this.ringSize)) {
            this.successor = x;
        }
        await axios.post(`${this.successor.url}/notify`, { id: this.id.toString(), url: this.url, });
    }
    // Notify this node of a possible new predecessor
    notify(node: NodeEntry) {
        if (this.predecessor === null || inInterval(hashToID(node.url, this.m), hashToID(this.predecessor.url, this.m), this.id, this.ringSize)) {
            this.predecessor = node;
        }
    }
    // Fix a random finger table entry
    async fixFingers() {
        const randomIndex = Math.floor(Math.random() * this.fingerTable.length);
        const start = (this.id + (BigInt(1) << BigInt(randomIndex))) % this.ringSize;
        const startKeyStr = `${this.url}#finger${start.toString()}`;
        const successor = await this.findSuccessor(startKeyStr);
        this.fingerTable[randomIndex] = successor;
    }
    // Placeholder for checking if the predecessor is still active
    async checkPredecessor() {
        // Placeholder for real checks
    }
}

async function fetchNodeInfo(url: string, context: Node): Promise<Node> {
    const resp = await axios.get(`${url}/info`);
    const data = resp.data;
    const n = new Node(data.url, data.dummy, data.m, data.stabilizeInterval);
    n.predecessor = data.predecessor;
    n.successor = data.successor;
    n.fingerTable = data.fingerTable;
    return n as typeof context; // Explicitly return an instance compatible with the calling Node
}


// Parse command line arguments
const port = Number((argv.find(a => a.startsWith("--port=")) || "--port=3000").split("=")[1]);
const dummyData = (argv.find(a => a.startsWith("--dummy=")) || "--dummy=MyData").split("=")[1];
const stabilizeInterval = Number((argv.find(a => a.startsWith("--stabilize-interval=")) || "--stabilize-interval=1000").split("=")[1]);
const m = Number((argv.find(a => a.startsWith("--m=")) || "--m=5").split("=")[1]);

const url = `http://localhost:${port}`;
const node = new Node(url, dummyData, m, stabilizeInterval);

// By default, form a ring if no join is called.
node.join(null);

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get('/info', (req, res) => {
    const stringifyBigInt = (obj: any) => {
        return JSON.parse(JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
    };

    res.json(stringifyBigInt({
        url: node.url,
        m: node.m,
        predecessor: node.predecessor,
        successor: node.successor,
        fingerTable: node.fingerTable,
        stabilizeInterval: node.stabilizeInterval,
        keyValue: node.kvStore
    }));
});

app.post('/join', async (req, res) => {
    const { existingNodeUrl } = req.body;
    await node.join(existingNodeUrl);
    res.json({message: `Joined the ring via ${existingNodeUrl}`, successor: node.successor});
});

app.post('/notify', (req, res) => {
    const { id, url, dummy } = req.body;
    const nodeEntry: NodeEntry = { id: hashToID(url, node.m), url};
    node.notify(nodeEntry);
    res.json({message:"Notified"});
});

app.get('/findSuccessor', async (req, res) => {
    const key = String(req.query.key);
    const successor = await node.findSuccessor(key);
    res.json({key, successor});
});

app.post('/stabilize', async (req, res) => {
    await node.stabilize();
    res.json({message:"Stabilized"});
});

app.post('/fixFingers', async (req, res) => {
    await node.fixFingers();
    res.json({message:"Fingers fixed"});
});

app.post('/checkPredecessor', async (req, res) => {
    await node.checkPredecessor();
    res.json({message:"Checked predecessor"});
});

app.post('/put', async (req, res) => {
    const { key, value, ttl = 10 } = req.body;
    if (ttl <= 0) {
        res.status(400).json({ message: "TTL expired. Unable to store key." });
        return;
    }

    const keyID = hashToID(key, node.m);
    const successor = await node.findSuccessor(key);
    if (successor.url === node.url) {
        node.kvStore.set(keyID, { originalKey: key, value })
        console.log(node.kvStore);
        res.json({ message: `Key stored at node ${node.url}`, key, value });
    } else {
        try {
            const resp = await axios.post(`${successor.url}/put`, { key, value, ttl: ttl - 1 });
            res.json(resp.data);
        } catch (error: unknown) {
            let errorMessage = "Unknown error occurred";
            if (error instanceof Error) {
                errorMessage = error.message; // Safely access the message property
            }
            res.status(500).json({ message: "Failed to forward request to successor.", error: errorMessage });
        }
    }
});

app.get('/get', async (req, res) => {
    const key = String(req.query.key);
    const keyID = hashToID(key, node.m);
    const successor = await node.findSuccessor(key);
    if (successor.url === node.url) {
        const entry = node.kvStore.get(keyID);
        if (entry) {
            res.json({ key: entry.originalKey, value: entry.value });
        } else {
            res.json({ key, value: null, message: "Key not found on this node." });
        }
    } else {
        try {
            const resp = await axios.get(`${successor.url}/get?key=${encodeURIComponent(key)}`);
            res.json(resp.data);
        } catch (error) {
            res.status(500).json({ message: "Failed to forward request to successor."});
        }
    }
});

// Example in server.ts
app.get('/keys', (req, res) => {
    // Serialize Map to a plain object
    const serializedKVStore = Array.from(node.kvStore).reduce<Record<string, { originalKey: string; value: string }>>(
        (acc, [key, value]) => {
            acc[key.toString()] = value; // Convert BigInt keys to strings for JSON compatibility
            return acc;
        },
        {} // Initialize as an empty object
    );

    console.log("keys endpoint", JSON.stringify(serializedKVStore, null, 2));
    res.json(serializedKVStore);
});




app.listen(port, () => {
    console.log(`Node running at ${node.url}" and ID=${node.id}`);
});

// Periodic tasks
setInterval(async () => {
    await node.stabilize();
    await node.fixFingers();
    await node.checkPredecessor();
}, stabilizeInterval);
