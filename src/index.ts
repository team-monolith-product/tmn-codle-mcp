import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./logger.js";
import { server } from "./server.js";
import { registerAllTools } from "./tools/register.js";

registerAllTools(server);

logger.info("codle-mcp 서버 시작");

const transport = new StdioServerTransport();
await server.connect(transport);
