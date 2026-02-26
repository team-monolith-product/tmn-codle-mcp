import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTagTools } from "./tags.js";
import { registerMaterialTools } from "./materials.js";
import { registerActivityTools } from "./activities.js";

export function registerAllTools(server: McpServer): void {
  registerTagTools(server);
  registerMaterialTools(server);
  registerActivityTools(server);
}
