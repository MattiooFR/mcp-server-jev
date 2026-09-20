#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.mjs';

if (process.argv.includes('--help')) {
  console.log('mcp-server-jev — TypeSafe Jev over MCP stdio\nEnvironment: TYPESAFE_API_KEY (required), JEV_MODEL (default: jev-1.13.0)\nSee README.md for Codex and Claude setup.');
} else if (process.argv.includes('--version')) {
  console.log('0.1.0');
} else {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
