import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

/**
 * Typress MCP server (skeleton). Phase 0 establishes a working stdio server with
 * a single diagnostic tool. Scoped, authenticated, Zod-validated tools for
 * content, users, settings, and theme/plugin code arrive in Phase 10.
 */
const server = new McpServer({
  name: 'typress',
  version: '0.0.0',
});

server.tool(
  'ping',
  'Diagnostic tool. Returns "pong" with a server timestamp to confirm the Typress MCP server is reachable.',
  async () => ({
    content: [{ type: 'text', text: `pong @ ${new Date().toISOString()}` }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
  console.error('Typress MCP server running on stdio.');
}

main().catch((error) => {
  console.error('Typress MCP server failed to start:', error);
  process.exit(1);
});
