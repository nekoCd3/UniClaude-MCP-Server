# Full Access MCP Server

This is a Model Context Protocol (MCP) server written in Go that provides Claude with full access to perform any operation in the codespace, plus Cloudflare DNS management.

## Features

The server exposes the following tools:

### Codespace Tools
- `run_command`: Execute any shell command in the codespace.
- `read_file`: Read the contents of a file.
- `write_file`: Create or overwrite a file with content.
- `list_directory`: List the contents of a directory.
- `delete_path`: Delete a file or directory recursively.
- `create_directory`: Create a directory and its parents if needed.
- `copy_file`: Copy a file from source to destination within the codespace.
- `move_file`: Move or rename a file or directory within the codespace.

### Cloudflare Tools
- `cf_list_zones`: List all Cloudflare zones for the account.
- `cf_list_dns_records`: List DNS records for a zone.
- `cf_add_dns_record`: Add a DNS record to a zone.
- `cf_update_dns_record`: Update a DNS record.
- `cf_delete_dns_record`: Delete a DNS record.

With these tools, Claude can:
- Run any command, start servers, manage resources
- Edit, create, delete files and folders
- Manage Cloudflare DNS records
- Perform any operation allowed by the system

## Setup

### 1. Build and Run the Server

```bash
go mod tidy
go build -o mcp-server main.go
./mcp-server
```

The server runs on port 8080 (or PORT env var).

### 2. Deploy to Railway

1. Sign up at [railway.app](https://railway.app)
2. Create new project from GitHub repo `Nexus-Dev`
3. Set environment variables:
   - `CF_API_TOKEN`: `cfk_aK5MMXV1G0whJ5jVXAgkl0hOneigB2pjCIwr4B5r28bd9d37`
   - `PORT`: `8080`
4. Add custom domain `mcp.zttmail.us` in Railway settings
5. Update DNS in Cloudflare:
   - Add the record as instructed by Railway (CNAME or A)
   - Enable proxy (orange cloud) for HTTPS

### 3. Use in Claude

- **Remote MCP server URL**: `https://mcp.zttmail.us`
- Name: `Uniclaude Management`