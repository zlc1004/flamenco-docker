# Flamenco Docker Setup

This Docker Compose setup provides a complete Flamenco render farm with a manager and configurable number of workers.

## Quick Start

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Scale workers (optional):**
   ```bash
   docker-compose up -d --scale flamenco-worker=3
   ```

3. **Access the Flamenco Manager:**
   Open your browser to http://localhost:8080

## Directory Structure

After running, the following directories will be created:
- `./flamenco-manager-storage/` - Manager's local storage
- `./shared-storage/` - Shared storage accessible by both manager and workers
- `./data/` - Database and other persistent manager data
- `./worker-cache/` - Worker cache directory

## Configuration

### Environment Variables

The Docker Compose file includes these configurable environment variables for the manager:

- `FLAMENCO_MANAGER_NAME` - Name of the manager (default: "Flamenco Manager")
- `FLAMENCO_DATABASE` - Database filename (default: "flamenco-manager.sqlite")
- `FLAMENCO_LISTEN` - Listen address (default: ":8080")
- `FLAMENCO_AUTODISCOVERABLE` - Enable autodiscovery (default: "true")
- `FLAMENCO_LOCAL_STORAGE_PATH` - Local storage path (default: "./flamenco-manager-storage")
- `FLAMENCO_SHARED_STORAGE_PATH` - Shared storage path (default: "/mnt/shared/flamenco")
- `FLAMENCO_SHAMAN_ENABLED` - Enable Shaman file sharing (default: "true")
- `FLAMENCO_TASK_TIMEOUT` - Task timeout (default: "10m0s")
- `FLAMENCO_WORKER_TIMEOUT` - Worker timeout (default: "1m0s")
- `FLAMENCO_BLOCKLIST_THRESHOLD` - Blocklist threshold (default: "3")
- `FLAMENCO_TASK_FAIL_AFTER_SOFTFAIL_COUNT` - Task fail count (default: "3")

For workers:
- `MANAGER_URL` - URL of the manager (default: "http://flamenco-manager:8080")
- `FLAMENCO_WORKER_NAME` - Name of the worker (default: "Flamenco Worker")

### Customizing Configuration

You can override any environment variable in the `docker-compose.yml` file or create a `.env` file:

```bash
# .env file example
FLAMENCO_MANAGER_NAME=My Render Farm
FLAMENCO_TASK_TIMEOUT=30m0s
```

## Commands

- **Start services:** `docker-compose up -d`
- **Stop services:** `docker-compose down`
- **View logs:** `docker-compose logs -f [service-name]`
- **Scale workers:** `docker-compose up -d --scale flamenco-worker=N`
- **Rebuild images:** `docker-compose build`

## Data Persistence

All important data is persisted in local directories:
- Manager database and settings in `./data/`
- Local storage in `./flamenco-manager-storage/`
- Shared storage in `./shared-storage/`

## Network

Services communicate through the `flamenco-network` bridge network. Workers automatically discover the manager using the service name `flamenco-manager`.

## Blender

Workers come with Blender 4.2.3 pre-installed via the LinuxServer.io Blender image.