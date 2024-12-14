import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';

interface NodeEntry {
    id: string;
    url: string;
    dummy: string;
}

interface NodeInfo {
    url: string;
    dummy: string;
    m: number;
    predecessor: NodeEntry | null;
    successor: NodeEntry;
    fingerTable: (NodeEntry | null)[];
    stabilizeInterval: number;
    keyValueMap: Record<string, string>;
}

interface NodeState {
    url: string;
    info: NodeInfo | null;
}

const POLL_INTERVAL = 2000; // 2 seconds

function App() {
    const [nodes, setNodes] = useState<NodeState[]>([
        { url: 'http://localhost:3000', info: null },
    ]);

    const [newNodePort, setNewNodePort] = useState<string>('3001');
    const [existingNodeUrlForJoin, setExistingNodeUrlForJoin] = useState<string>('http://localhost:3000');
    const [keyToAdd, setKeyToAdd] = useState<string>('');
    const [valueToAdd, setValueToAdd] = useState<string>('');

    // Use a ref to keep track of the latest nodes array without causing re-renders
    const nodesRef = useRef<NodeState[]>(nodes);

    // Update the ref whenever nodes change
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Polling effect to update node information
    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const updatedNodes = await Promise.all(
                    nodesRef.current.map(async (node) => {
                        try {
                            const [infoResp, keysResp] = await Promise.all([
                                axios.get(`${node.url}/info`),
                                axios.get(`${node.url}/keys`),
                            ]);
                            console.log(keysResp.data);
                            return { ...node, info: { ...infoResp.data, keyValueMap: keysResp.data } };
                        } catch (error) {
                            console.error(`Error fetching info or keys from ${node.url}`, error);
                            return node; // Keep the node as-is if fetching fails
                        }
                    })
                );

                // Update only the `info` of existing nodes
                setNodes((prevNodes) =>
                    prevNodes.map((node) => {
                        const updatedNode = updatedNodes.find((n) => n.url === node.url);
                        return updatedNode || node; // Use updated node info if available, else keep the original
                    })
                );
            } catch (error) {
                console.error("Error fetching node information:", error);
            }
        };

        const interval = setInterval(fetchInfo, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []); // No dependency on `nodes`

    // Add a key to the network
    const handleAddKey = useCallback(async () => {
        if (!keyToAdd || !valueToAdd) return;
        if (nodes.length === 0) return alert("No nodes available.");

        const nodeUrl = nodes[0].url;
        try {
            const resp = await axios.post(`${nodeUrl}/put`, {
                key: keyToAdd,
                value: valueToAdd,
            });
            alert(`Key added: ${resp.data.message}`);
        } catch (error) {
            console.error("Error adding key:", error);
            alert("Failed to add key");
        }
    }, [keyToAdd, valueToAdd, nodes]);

    // Add a new node to the network
    const handleAddNode = useCallback(async () => {
        const newUrl = `http://localhost:${newNodePort}`;
        if (nodes.some((node) => node.url === newUrl)) {
            return alert("Node already exists.");
        }

        if (nodes.length >= 8) {
            return alert("Node limit reached.");
        }

        try {
            await axios.post(`${newUrl}/join`, { existingNodeUrl: existingNodeUrlForJoin });
            // Add the new node to state without replacing existing nodes
            setNodes((prev) => [...prev, { url: newUrl, info: null }]);
            alert(`Node ${newUrl} joined via ${existingNodeUrlForJoin}`);
        } catch (error) {
            console.error("Error joining node:", error);
            alert("Failed to join node. Ensure the node server is running.");
        }
    }, [newNodePort, existingNodeUrlForJoin, nodes]);

    return (
        <div style={{ padding: '20px' }}>
            <h1>Chord Visualization</h1>

            <div style={{ marginBottom: '20px' }}>
                <h2>Current Nodes</h2>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {nodes.map((node, idx) => (
                        <div
                            key={node.url}
                            style={{
                                border: '1px solid black',
                                padding: '10px',
                                width: '200px',
                                marginBottom: '10px',
                            }}
                        >
                            <h3>Node {idx + 1}</h3>
                            <p>
                                <strong>URL:</strong> {node.url}
                            </p>
                            {node.info ? (
                                <>
                                    <p>
                                        <strong>ID (hashed):</strong> {String(node.info.url)}
                                    </p>
                                    <p>
                                        <strong>Predecessor:</strong>{' '}
                                        {node.info.predecessor ? node.info.predecessor.url : 'null'}
                                    </p>
                                    <p>
                                        <strong>Successor:</strong>{' '}
                                        {node.info.successor ? node.info.successor.url : 'null'}
                                    </p>
                                    <h4>Finger Table:</h4>
                                    <ul style={{ paddingLeft: '20px', maxHeight: '100px', overflow: 'auto' }}>
                                        {node.info.fingerTable.map((finger, i) => (
                                            <li key={i}>{finger ? finger.url : 'null'}</li>
                                        ))}
                                    </ul>
                                    <h4>Key-Value Map:</h4>
                                    {Object.keys(node.info.keyValueMap).length > 0 ? (
                                        <ul style={{ paddingLeft: '20px' }}>
                                            {(Object.entries(node.info.keyValueMap) as [string, { originalKey: string; value: string }][]).map(
                                                ([key, value]) => (
                                                    <li key={key}>
                                                        <strong>{value.originalKey}:</strong> {value.value}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    ) : (
                                        <p>No keys stored.</p>
                                    )}
                                </>
                            ) : (
                                <p>Loading info...</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h2>Add a Key</h2>
                <input
                    type="text"
                    placeholder="Key"
                    value={keyToAdd}
                    onChange={(e) => setKeyToAdd(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Value"
                    value={valueToAdd}
                    onChange={(e) => setValueToAdd(e.target.value)}
                />
                <button onClick={handleAddKey}>Add Key</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h2>Add a Node</h2>
                <p>Assuming you've started a node at http://localhost:XXXX</p>
                <input
                    type="text"
                    placeholder="New node port"
                    value={newNodePort}
                    onChange={(e) => setNewNodePort(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Existing Node URL to join"
                    value={existingNodeUrlForJoin}
                    onChange={(e) => setExistingNodeUrlForJoin(e.target.value)}
                />
                <button onClick={handleAddNode}>Add Node</button>
            </div>
        </div>
    );
}

export default App;
