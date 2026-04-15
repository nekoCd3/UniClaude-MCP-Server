package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/cloudflare/cloudflare-go"
)

type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

type JSONRPCRequest struct {
	JSONRPC string                 `json:"jsonrpc"`
	ID      interface{}            `json:"id,omitempty"`
	Method  string                 `json:"method"`
	Params  map[string]interface{} `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      interface{}   `json:"id,omitempty"`
	Result  interface{}   `json:"result,omitempty"`
	Error   *JSONRPCError `json:"error,omitempty"`
}

type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type ToolResult struct {
	Content []Content `json:"content"`
}

type Content struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

var tools = []Tool{
	{
		Name:        "run_command",
		Description: "Run any shell command in the codespace",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"command": map[string]interface{}{
					"type":        "string",
					"description": "The shell command to execute",
				},
			},
			"required": []string{"command"},
		},
	},
	{
		Name:        "read_file",
		Description: "Read the contents of a file",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the file",
				},
			},
			"required": []string{"path"},
		},
	},
	{
		Name:        "write_file",
		Description: "Write or overwrite a file with content",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the file",
				},
				"content": map[string]interface{}{
					"type":        "string",
					"description": "The content to write to the file",
				},
			},
			"required": []string{"path", "content"},
		},
	},
	{
		Name:        "list_directory",
		Description: "List the contents of a directory",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the directory",
				},
			},
			"required": []string{"path"},
		},
	},
	{
		Name:        "delete_path",
		Description: "Delete a file or directory recursively",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to delete",
				},
			},
			"required": []string{"path"},
		},
	},
	{
		Name:        "create_directory",
		Description: "Create a directory and its parents if needed",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"path": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the directory",
				},
			},
			"required": []string{"path"},
		},
	},
	{
		Name:        "copy_file",
		Description: "Copy a file from source to destination",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"src": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the source file",
				},
				"dst": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the destination file",
				},
			},
			"required": []string{"src", "dst"},
		},
	},
	{
		Name:        "move_file",
		Description: "Move or rename a file or directory",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"src": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the source",
				},
				"dst": map[string]interface{}{
					"type":        "string",
					"description": "The absolute path to the destination",
				},
			},
			"required": []string{"src", "dst"},
		},
	},
	{
		Name:        "cf_list_zones",
		Description: "List all Cloudflare zones for the account",
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
	},
	{
		Name:        "cf_list_dns_records",
		Description: "List DNS records for a zone",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"zone_id": map[string]interface{}{
					"type":        "string",
					"description": "The Cloudflare zone ID",
				},
			},
			"required": []string{"zone_id"},
		},
	},
	{
		Name:        "cf_add_dns_record",
		Description: "Add a DNS record to a zone",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"zone_id": map[string]interface{}{
					"type":        "string",
					"description": "The Cloudflare zone ID",
				},
				"record_type": map[string]interface{}{
					"type":        "string",
					"description": "DNS record type (A, CNAME, etc.)",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Record name",
				},
				"content": map[string]interface{}{
					"type":        "string",
					"description": "Record content",
				},
				"ttl": map[string]interface{}{
					"type":        "number",
					"description": "TTL (optional)",
				},
				"proxied": map[string]interface{}{
					"type":        "boolean",
					"description": "Whether to proxy through Cloudflare",
				},
			},
			"required": []string{"zone_id", "record_type", "name", "content"},
		},
	},
	{
		Name:        "cf_update_dns_record",
		Description: "Update a DNS record",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"zone_id": map[string]interface{}{
					"type":        "string",
					"description": "The Cloudflare zone ID",
				},
				"record_id": map[string]interface{}{
					"type":        "string",
					"description": "The DNS record ID",
				},
				"record_type": map[string]interface{}{
					"type":        "string",
					"description": "DNS record type",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Record name",
				},
				"content": map[string]interface{}{
					"type":        "string",
					"description": "Record content",
				},
				"ttl": map[string]interface{}{
					"type":        "number",
					"description": "TTL",
				},
				"proxied": map[string]interface{}{
					"type":        "boolean",
					"description": "Whether to proxy",
				},
			},
			"required": []string{"zone_id", "record_id", "record_type", "name", "content"},
		},
	},
	{
		Name:        "cf_delete_dns_record",
		Description: "Delete a DNS record",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"zone_id": map[string]interface{}{
					"type":        "string",
					"description": "The Cloudflare zone ID",
				},
				"record_id": map[string]interface{}{
					"type":        "string",
					"description": "The DNS record ID",
				},
			},
			"required": []string{"zone_id", "record_id"},
		},
	},
	{
		Name:        "cf_api_call",
		Description: "Make a raw HTTPS call to the Cloudflare REST API. Universal escape hatch covering every Cloudflare endpoint that the dedicated cf_* tools don't already wrap: zones, workers, R2, KV, D1, Pages, WAF, Access, Gateway, Tunnels, SSL/TLS, custom hostnames, email routing, images, stream, analytics, account members, tokens, page rules, rulesets, rate limiting, load balancers, spectrum, magic transit, registrar, notifications, logpush, audit logs, etc. Auth is handled server-side via CF_API_TOKEN. The literal placeholder {account} in the path is substituted with the server's CF_ACCOUNT_ID env var, so you can write paths like 'accounts/{account}/workers/scripts' without hardcoding the ID.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"method": map[string]interface{}{
					"type":        "string",
					"description": "HTTP method: GET, POST, PUT, PATCH, or DELETE",
				},
				"path": map[string]interface{}{
					"type":        "string",
					"description": "API path, with or without the leading 'client/v4/'. May contain {account} as a placeholder for the account ID. Examples: 'zones', 'zones/{zone_id}/settings', 'accounts/{account}/workers/scripts', 'accounts/{account}/r2/buckets'",
				},
				"body": map[string]interface{}{
					"type":        "string",
					"description": "Optional JSON request body as a string (for POST/PUT/PATCH)",
				},
				"query": map[string]interface{}{
					"type":        "string",
					"description": "Optional raw query string to append, without the leading '?' (e.g. 'page=1&per_page=50')",
				},
			},
			"required": []string{"method", "path"},
		},
	},
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	http.HandleFunc("/", handleRequest)

	// Cert paths — override via env. Defaults match certbot's standard layout
	// when issued for mcp.zttmail.us.
	certFile := envOrDefault("TLS_CERT_FILE", "/etc/letsencrypt/live/mcp.zttmail.us/fullchain.pem")
	keyFile := envOrDefault("TLS_KEY_FILE", "/etc/letsencrypt/live/mcp.zttmail.us/privkey.pem")

	httpsPort := envOrDefault("HTTPS_PORT", "443")

	// Optional: also run an HTTP listener on :80 that redirects to HTTPS.
	// Set ENABLE_HTTP_REDIRECT=1 to enable. Useful if you want `http://...`
	// to bounce to `https://...`.
	if os.Getenv("ENABLE_HTTP_REDIRECT") == "1" {
		go func() {
			redirect := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				target := "https://" + r.Host + r.URL.RequestURI()
				http.Redirect(w, r, target, http.StatusMovedPermanently)
			})
			fmt.Println("Starting HTTP redirect listener on :80")
			if err := http.ListenAndServe(":80", redirect); err != nil {
				fmt.Printf("HTTP redirect listener error: %v\n", err)
			}
		}()
	}

	fmt.Printf("Starting HTTPS server on :%s\n", httpsPort)
	fmt.Printf("  cert: %s\n", certFile)
	fmt.Printf("  key:  %s\n", keyFile)
	if err := http.ListenAndServeTLS(":"+httpsPort, certFile, keyFile, nil); err != nil {
		fmt.Printf("HTTPS server error: %v\n", err)
		os.Exit(1)
	}
}

func handleRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}

	var req JSONRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, req.ID, -32700, "Parse error")
		return
	}

	if req.JSONRPC != "2.0" {
		sendError(w, req.ID, -32600, "Invalid Request")
		return
	}

	switch req.Method {
	case "initialize":
		handleInitialize(w, req)
	case "tools/list":
		handleToolsList(w, req)
	case "tools/call":
		handleToolsCall(w, req)
	default:
		sendError(w, req.ID, -32601, "Method not found")
	}
}

func handleInitialize(w http.ResponseWriter, req JSONRPCRequest) {
	result := map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{
				"listChanged": true,
			},
		},
		"serverInfo": map[string]interface{}{
			"name":    "Full Access MCP Server",
			"version": "1.0.0",
		},
	}
	sendResult(w, req.ID, result)
}

func handleToolsList(w http.ResponseWriter, req JSONRPCRequest) {
	result := map[string]interface{}{
		"tools": tools,
	}
	sendResult(w, req.ID, result)
}

func handleToolsCall(w http.ResponseWriter, req JSONRPCRequest) {
	params := req.Params

	name, ok := params["name"].(string)
	if !ok {
		sendError(w, req.ID, -32602, "Invalid params")
		return
	}

	arguments, ok := params["arguments"].(map[string]interface{})
	if !ok {
		sendError(w, req.ID, -32602, "Invalid params")
		return
	}

	var result string
	var err error

	switch name {
	case "run_command":
		result, err = runCommandHandler(arguments)
	case "read_file":
		result, err = readFileHandler(arguments)
	case "write_file":
		result, err = writeFileHandler(arguments)
	case "list_directory":
		result, err = listDirectoryHandler(arguments)
	case "delete_path":
		result, err = deletePathHandler(arguments)
	case "create_directory":
		result, err = createDirectoryHandler(arguments)
	case "copy_file":
		result, err = copyFileHandler(arguments)
	case "move_file":
		result, err = moveFileHandler(arguments)
	case "cf_list_zones":
		result, err = cfListZonesHandler(arguments)
	case "cf_list_dns_records":
		result, err = cfListDNSRecordsHandler(arguments)
	case "cf_add_dns_record":
		result, err = cfAddDNSRecordHandler(arguments)
	case "cf_update_dns_record":
		result, err = cfUpdateDNSRecordHandler(arguments)
	case "cf_delete_dns_record":
		result, err = cfDeleteDNSRecordHandler(arguments)
	case "cf_api_call":
		result, err = cfAPICallHandler(arguments)
	default:
		sendError(w, req.ID, -32601, "Tool not found")
		return
	}

	if err != nil {
		sendError(w, req.ID, -32603, err.Error())
		return
	}

	sendResult(w, req.ID, ToolResult{
		Content: []Content{
			{Type: "text", Text: result},
		},
	})
}

func sendResult(w http.ResponseWriter, id interface{}, result interface{}) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func sendError(w http.ResponseWriter, id interface{}, code int, message string) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &JSONRPCError{Code: code, Message: message},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func runCommandHandler(args map[string]interface{}) (string, error) {
	command, ok := args["command"].(string)
	if !ok {
		return "", fmt.Errorf("command parameter is required and must be a string")
	}

	cmd := exec.Command("bash", "-c", command)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("Command failed: %v\nOutput: %s", err, string(output))
	}

	return string(output), nil
}

func readFileHandler(args map[string]interface{}) (string, error) {
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("Failed to read file: %v", err)
	}

	return string(content), nil
}

func writeFileHandler(args map[string]interface{}) (string, error) {
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	content, ok := args["content"].(string)
	if !ok {
		return "", fmt.Errorf("content parameter is required and must be a string")
	}

	err := os.WriteFile(path, []byte(content), 0644)
	if err != nil {
		return "", fmt.Errorf("Failed to write file: %v", err)
	}

	return "File written successfully", nil
}

func listDirectoryHandler(args map[string]interface{}) (string, error) {
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return "", fmt.Errorf("Failed to list directory: %v", err)
	}

	var result strings.Builder
	for _, entry := range entries {
		result.WriteString(entry.Name())
		if entry.IsDir() {
			result.WriteString("/")
		}
		result.WriteString("\n")
	}

	return result.String(), nil
}

func deletePathHandler(args map[string]interface{}) (string, error) {
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	err := os.RemoveAll(path)
	if err != nil {
		return "", fmt.Errorf("Failed to delete: %v", err)
	}

	return "Deleted successfully", nil
}

func createDirectoryHandler(args map[string]interface{}) (string, error) {
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	err := os.MkdirAll(path, 0755)
	if err != nil {
		return "", fmt.Errorf("Failed to create directory: %v", err)
	}

	return "Directory created successfully", nil
}

func copyFileHandler(args map[string]interface{}) (string, error) {
	src, ok := args["src"].(string)
	if !ok {
		return "", fmt.Errorf("src parameter is required and must be a string")
	}

	dst, ok := args["dst"].(string)
	if !ok {
		return "", fmt.Errorf("dst parameter is required and must be a string")
	}

	input, err := os.ReadFile(src)
	if err != nil {
		return "", fmt.Errorf("Failed to read source: %v", err)
	}

	err = os.WriteFile(dst, input, 0644)
	if err != nil {
		return "", fmt.Errorf("Failed to write destination: %v", err)
	}

	return "File copied successfully", nil
}

func moveFileHandler(args map[string]interface{}) (string, error) {
	src, ok := args["src"].(string)
	if !ok {
		return "", fmt.Errorf("src parameter is required and must be a string")
	}

	dst, ok := args["dst"].(string)
	if !ok {
		return "", fmt.Errorf("dst parameter is required and must be a string")
	}

	err := os.Rename(src, dst)
	if err != nil {
		return "", fmt.Errorf("Failed to move: %v", err)
	}

	return "File moved successfully", nil
}

func cfListZonesHandler(args map[string]interface{}) (string, error) {
	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	api, err := cloudflare.NewWithAPIToken(token)
	if err != nil {
		return "", fmt.Errorf("Failed to create Cloudflare client: %v", err)
	}

	zones, err := api.ListZones(context.Background())
	if err != nil {
		return "", fmt.Errorf("Failed to list zones: %v", err)
	}

	var result strings.Builder
	for _, zone := range zones {
		result.WriteString(fmt.Sprintf("ID: %s, Name: %s, Status: %s\n", zone.ID, zone.Name, zone.Status))
	}

	return result.String(), nil
}

func cfListDNSRecordsHandler(args map[string]interface{}) (string, error) {
	zoneID, ok := args["zone_id"].(string)
	if !ok {
		return "", fmt.Errorf("zone_id parameter is required and must be a string")
	}

	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	api, err := cloudflare.NewWithAPIToken(token)
	if err != nil {
		return "", fmt.Errorf("Failed to create Cloudflare client: %v", err)
	}

	records, _, err := api.ListDNSRecords(context.Background(), cloudflare.ZoneIdentifier(zoneID), cloudflare.ListDNSRecordsParams{})
	if err != nil {
		return "", fmt.Errorf("Failed to list DNS records: %v", err)
	}

	var result strings.Builder
	for _, record := range records {
		result.WriteString(fmt.Sprintf("ID: %s, Type: %s, Name: %s, Content: %s, Proxied: %t\n", record.ID, record.Type, record.Name, record.Content, record.Proxied))
	}

	return result.String(), nil
}

func cfAddDNSRecordHandler(args map[string]interface{}) (string, error) {
	zoneID, ok := args["zone_id"].(string)
	if !ok {
		return "", fmt.Errorf("zone_id parameter is required and must be a string")
	}
	recordType, ok := args["record_type"].(string)
	if !ok {
		return "", fmt.Errorf("record_type parameter is required and must be a string")
	}
	name, ok := args["name"].(string)
	if !ok {
		return "", fmt.Errorf("name parameter is required and must be a string")
	}
	content, ok := args["content"].(string)
	if !ok {
		return "", fmt.Errorf("content parameter is required and must be a string")
	}

	ttl := 1
	if t, ok := args["ttl"].(float64); ok {
		ttl = int(t)
	}
	proxied := false
	if p, ok := args["proxied"].(bool); ok {
		proxied = p
	}

	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	api, err := cloudflare.NewWithAPIToken(token)
	if err != nil {
		return "", fmt.Errorf("Failed to create Cloudflare client: %v", err)
	}

	record, err := api.CreateDNSRecord(context.Background(), cloudflare.ZoneIdentifier(zoneID), cloudflare.CreateDNSRecordParams{
		Type:    recordType,
		Name:    name,
		Content: content,
		TTL:     ttl,
		Proxied: &proxied,
	})
	if err != nil {
		return "", fmt.Errorf("Failed to add DNS record: %v", err)
	}

	return fmt.Sprintf("DNS record added: ID %s", record.ID), nil
}

func cfUpdateDNSRecordHandler(args map[string]interface{}) (string, error) {
	zoneID, ok := args["zone_id"].(string)
	if !ok {
		return "", fmt.Errorf("zone_id parameter is required and must be a string")
	}
	recordID, ok := args["record_id"].(string)
	if !ok {
		return "", fmt.Errorf("record_id parameter is required and must be a string")
	}
	recordType, ok := args["record_type"].(string)
	if !ok {
		return "", fmt.Errorf("record_type parameter is required and must be a string")
	}
	name, ok := args["name"].(string)
	if !ok {
		return "", fmt.Errorf("name parameter is required and must be a string")
	}
	content, ok := args["content"].(string)
	if !ok {
		return "", fmt.Errorf("content parameter is required and must be a string")
	}

	ttl := 1
	if t, ok := args["ttl"].(float64); ok {
		ttl = int(t)
	}
	proxied := false
	if p, ok := args["proxied"].(bool); ok {
		proxied = p
	}

	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	api, err := cloudflare.NewWithAPIToken(token)
	if err != nil {
		return "", fmt.Errorf("Failed to create Cloudflare client: %v", err)
	}

	_, err = api.UpdateDNSRecord(context.Background(), cloudflare.ZoneIdentifier(zoneID), cloudflare.UpdateDNSRecordParams{
		ID:      recordID,
		Type:    recordType,
		Name:    name,
		Content: content,
		TTL:     ttl,
		Proxied: &proxied,
	})
	if err != nil {
		return "", fmt.Errorf("Failed to update DNS record: %v", err)
	}

	return "DNS record updated successfully", nil
}

func cfDeleteDNSRecordHandler(args map[string]interface{}) (string, error) {
	zoneID, ok := args["zone_id"].(string)
	if !ok {
		return "", fmt.Errorf("zone_id parameter is required and must be a string")
	}
	recordID, ok := args["record_id"].(string)
	if !ok {
		return "", fmt.Errorf("record_id parameter is required and must be a string")
	}

	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	api, err := cloudflare.NewWithAPIToken(token)
	if err != nil {
		return "", fmt.Errorf("Failed to create Cloudflare client: %v", err)
	}

	err = api.DeleteDNSRecord(context.Background(), cloudflare.ZoneIdentifier(zoneID), recordID)
	if err != nil {
		return "", fmt.Errorf("Failed to delete DNS record: %v", err)
	}

	return "DNS record deleted successfully", nil
}

// cfAPICallHandler is a generic passthrough to the Cloudflare REST API.
// It covers every endpoint Cloudflare exposes, including ones not wrapped by
// the dedicated cf_* tools and ones Cloudflare adds in the future. The
// CF_API_TOKEN env var is injected as a Bearer token server-side so the
// client never has to handle credentials.
func cfAPICallHandler(args map[string]interface{}) (string, error) {
	method, ok := args["method"].(string)
	if !ok {
		return "", fmt.Errorf("method parameter is required and must be a string")
	}
	path, ok := args["path"].(string)
	if !ok {
		return "", fmt.Errorf("path parameter is required and must be a string")
	}

	token := os.Getenv("CF_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("CF_API_TOKEN environment variable not set")
	}

	// Substitute {account} with CF_ACCOUNT_ID if the path references it.
	if strings.Contains(path, "{account}") {
		accountID := os.Getenv("CF_ACCOUNT_ID")
		if accountID == "" {
			return "", fmt.Errorf("path contains {account} but CF_ACCOUNT_ID environment variable is not set")
		}
		path = strings.ReplaceAll(path, "{account}", accountID)
	}

	// Normalize: accept paths with or without leading slash and with or
	// without the 'client/v4/' prefix.
	path = strings.TrimPrefix(path, "/")
	if !strings.HasPrefix(path, "client/v4/") {
		path = "client/v4/" + path
	}
	url := "https://api.cloudflare.com/" + path
	if q, ok := args["query"].(string); ok && q != "" {
		url += "?" + strings.TrimPrefix(q, "?")
	}

	var body io.Reader
	if b, ok := args["body"].(string); ok && b != "" {
		body = strings.NewReader(b)
	}

	req, err := http.NewRequest(strings.ToUpper(method), url, body)
	if err != nil {
		return "", fmt.Errorf("Failed to build request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("Failed to read response: %v", err)
	}

	return fmt.Sprintf("HTTP %d %s\n%s", resp.StatusCode, resp.Status, string(respBody)), nil
}