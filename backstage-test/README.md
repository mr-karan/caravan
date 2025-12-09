# Backstage Integration Testing Guide

This guide provides a simplified way to test the core features of the Caravan-Backstage integration without setting up a complete Backstage environment with OIDC authentication and managed Nomad cluster.

## Prerequisites

- Go development environment
- Python 3 or Node.js
- Valid Nomad configuration

## Testing Steps

### 1. Build the Caravan Embedded Binary

From the project root directory, run:

```bash
just build-embed
```

### 2. Run the Caravan Server

Execute the binary with the required parameters:

```bash
./backend/caravan --enable-dynamic-clusters
```

### 3. Serve the Frontend

Start a local web server to serve the `index.html` file. You can use either:

**Option A: Python HTTP Server**
```bash
python3 -m http.server -p 8000
```

**Option B: Node.js HTTP Server**
```bash
npx http-server -p 8000
```

### 4. Access the Application

Open your web browser and navigate to:
```
http://localhost:8000
```

## Testing the Integration

### Test 1: Backstage Token Authentication

1. Enter any random text in the Backstage authentication token field
2. Click "Share Backstage Token"
3. **Verification**: Check if the requests made include the `x-backstage-token` header

### Test 2: Nomad Configuration

1. Configure a valid Nomad cluster address
2. Click "Share Configuration"
3. **Verification**: A new cluster should appear in the interface

## Troubleshooting

- Ensure the Caravan server is running before accessing the test frontend
- Verify that the `--enable-dynamic-clusters` flag is set when starting the server