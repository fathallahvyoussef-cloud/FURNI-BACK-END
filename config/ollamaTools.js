/**
 * config/ollamaTools.js
 *
 * Ollama's /api/chat tool format follows the OpenAI function-calling
 * convention: { type: "function", function: { name, description, parameters } }.
 * `parameters` uses standard lowercase JSON Schema — unlike Gemini, no
 * type-casing transform is needed, just a reshape.
 *
 * Converts from config/tools.js at load time so there's one source of
 * truth for what the tools do, reshaped per provider.
 */

const baseTools = require("./tools");

const ollamaTools = baseTools.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema
  }
}));

module.exports = ollamaTools;