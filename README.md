# Chord DHT Visualization

This project implements a **Chord Distributed Hash Table (DHT)** using **TypeScript** for the backend 
and **React.js** with Vite for the frontend. The visualization shows nodes in a Chord ring, their 
finger tables, key-value maps, and key propagation across the network.

---

## **Requirements**

### **Prerequisites**

1. **Node.js**: Install Node.js version 16.x or above.
    - [Download Node.js](https://nodejs.org/)
2. **TypeScript**: Install globally if not already installed.
   ```bash
   npm install -g typescript
   ```
3. **NPM (Node Package Manager)**: Comes with Node.js.
4. **Git**: Ensure Git is installed to clone the repository.

### **Permissions for Scripts**

For the bash scripts to work (e.g., `start_nodes.sh`, `stop_nodes.sh`), you need to set executable permissions:

```bash
chmod +x start_nodes.sh stop_nodes.sh
```

---

## **Installation**

### 1. Clone the Repository

```bash
git clone https://github.com/qwazzarr/chord.git
cd chord
```

### 2. Install Backend Dependencies

Navigate to the backend directory and install dependencies:

```bash
npm install
```

### 3. Install Frontend Dependencies

Navigate to the frontend directory and install dependencies:

```bash
cd cd chord-ui
npm install
```

---

## **Running the Project**

### **Step 1: Start Backend Nodes**

The backend consists of multiple nodes running on different ports. You can use the provided scripts to start or stop the nodes.

#### Start Nodes

```bash
./start_nodes.sh
```

This script launches **10 nodes** on ports `3000` to `3009`. Modify the script to adjust the number of nodes if needed.

#### Stop Nodes

```bash
./stop_nodes.sh
```

This script stops all running backend nodes.

---

### **Step 2: Start the Frontend**

The frontend visualizes the Chord DHT ring.

1. Navigate to the frontend directory:

   ```bash
   cd chord-ui
   ```

2. Start the frontend using Vite:

   ```bash
   npm run dev
   ```

3. Open your browser and go to:

   ```
   http://localhost:5173
   ```

---

## **Features**

### **1. Backend Functionality**

- Implements the **Chord DHT Protocol**:
    - Node join.
    - Finger table stabilization.
    - Successor and predecessor management.
    - Distributed key-value storage.
    - Key lookups using the `findSuccessor` method.
- API Endpoints:
    - `/info`: Returns node information (successor, predecessor, finger table, etc.).
    - `/put`: Stores a key-value pair in the DHT.
    - `/get`: Retrieves a value by key from the DHT.
    - `/findSuccessor`: Determines which node is responsible for a given key.
    - `/keys`: Returns all key-value pairs stored on a node.

### **2. Frontend Visualization**

- Displays all active nodes in the Chord ring.
- Shows each node's:
    - URL and hashed ID.
    - Predecessor and successor.
    - Finger table.
    - Key-value map.
- Allows:
    - Adding a **new key-value pair** to the DHT.
    - Dynamically adding nodes to the network.

---

## **Scripts**

### **start\_nodes.sh**

Launches multiple backend nodes using `node server.js` with unique ports.

**Example:**

```bash
#!/bin/bash
for i in {3000..3009}; do
  PORT=$i node server.js --port=$i --m=5 --stabilize-interval=1000 &
done
```

### **stop\_nodes.sh**

Stops all backend nodes by killing processes running on the specified ports.

**Example:**

```bash
#!/bin/bash
for i in {3000..3009}; do
  lsof -t -i:$i | xargs kill -9
done
```

---

## **Development**

### **Backend**

The backend is written in **TypeScript** and uses **Express.js**.

#### Build and Run Backend

- Build:
  ```bash
  tsc
  ```
- Run a single backend node:
  ```bash
  node dist/server.js --port=3000 --m=5 --stabilize-interval=1000
  ```

### **Frontend**

The frontend is written in **React.js** using **Vite** for development.

#### Run Frontend

```bash
npm run dev
```
---

## **Troubleshooting**

### 1. **Permission Issues**

If `start_nodes.sh` or `stop_nodes.sh` doesn't execute, ensure you set executable permissions:

```bash
chmod +x start_nodes.sh stop_nodes.sh
```

### 2. **Port Conflicts**

Ensure no other processes are using the specified ports (`3000-3009` by default). You can check and kill processes on these ports using:

```bash
lsof -t -i:3000 | xargs kill -9
```

### 3. **CORS Errors**

Ensure the backend includes `cors` middleware:

```typescript
import cors from 'cors';
app.use(cors());
```

---

## **Contributing**

Feel free to submit pull requests or open issues for improvements and bug fixes.

---

## **License**

This project is licensed under the MIT License. See the `LICENSE` file for details.

```
```
