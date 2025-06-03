import { NextResponse } from 'next/server';
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { OpenAI } from 'openai';

// Constants for API key validation
const API_KEY_PATTERNS = {
  OPENAI: /^sk-[a-zA-Z0-9-_]+$/, // More lenient pattern to match actual OpenAI key format
  SMITHERY: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/ // UUID v4 pattern
};

// Initialize MCP client
let mcpClient = null;
let cachedServerDetails = null;
const CACHE_TTL = 300000; // 5 minutes
let cacheExpiration = 0;

// Add environment check with detailed validation
if (!process.env.OPENAI_API_KEY || !process.env.SMITHERY_API_KEY) {
  console.error('Missing required environment variables:', {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'PRESENT' : 'MISSING',
    SMITHERY_API_KEY: process.env.SMITHERY_API_KEY ? 'PRESENT' : 'MISSING'
  });
  throw new Error('Missing required environment variables');
}

// Validate environment variables
if (!API_KEY_PATTERNS.OPENAI.test(process.env.OPENAI_API_KEY)) {
  console.error('Invalid OPENAI_API_KEY format:', process.env.OPENAI_API_KEY);
  throw new Error('Invalid OpenAI API key format');
}

if (!API_KEY_PATTERNS.SMITHERY.test(process.env.SMITHERY_API_KEY)) {
  console.error('Invalid SMITHERY_API_KEY format:', process.env.SMITHERY_API_KEY);
  throw new Error('Invalid Smithery API key format');
}

// Initialize OpenAI client with validation
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Smithery configuration
const SMITHERY_CONFIG = {
  apiKey: process.env.SMITHERY_API_KEY,
  serverName: '@shinzo-labs/hubspot-mcp'
};

// Fetch server details from Smithery registry with caching
async function fetchServerDetails() {
  try {
    // Use cached details if they exist and are not expired
    if (cachedServerDetails && Date.now() < cacheExpiration) {
      console.log('Using cached server details');
      return cachedServerDetails;
    }

    console.log('Fetching server details from registry...');
    
    // First, search for the server
    const searchResponse = await fetch(
      `https://registry.smithery.ai/servers?q=${encodeURIComponent(SMITHERY_CONFIG.serverName)}&page=1&pageSize=1`,
      {
        headers: {
          'Authorization': `Bearer ${SMITHERY_CONFIG.apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Failed to search for server: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    if (!searchData.servers || searchData.servers.length === 0) {
      throw new Error('Server not found in registry');
    }

    const server = searchData.servers[0];
    
    // Get detailed server info
    const serverResponse = await fetch(
      `https://registry.smithery.ai/servers/${server.qualifiedName}`,
      {
        headers: {
          'Authorization': `Bearer ${SMITHERY_CONFIG.apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!serverResponse.ok) {
      throw new Error(`Failed to get server details: ${serverResponse.statusText}`);
    }

    const serverDetails = await serverResponse.json();
    
    // If no deployment URL is found, try to get it from the deployments endpoint
    if (!serverDetails.deploymentUrl) {
      console.log('No deployment URL found, trying deployments endpoint...');
      const deploymentsResponse = await fetch(
        `https://registry.smithery.ai/servers/${serverDetails.qualifiedName}/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${SMITHERY_CONFIG.apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!deploymentsResponse.ok) {
        throw new Error(`Failed to get deployments: ${deploymentsResponse.statusText}`);
      }

      const deployments = await deploymentsResponse.json();
      if (deployments && deployments.length > 0) {
        serverDetails.deploymentUrl = deployments[0].url;
      }
    }

    console.log('Server details retrieved:', {
      qualifiedName: serverDetails.qualifiedName,
      displayName: serverDetails.displayName,
      deploymentUrl: serverDetails.deploymentUrl
    });

    // Cache the details
    cachedServerDetails = serverDetails;
    cacheExpiration = Date.now() + CACHE_TTL;

    return serverDetails;
  } catch (error) {
    console.error('Error fetching server details:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Utility function to ensure MCP client is connected
async function ensureMCPClientConnected() {
  if (!mcpClient || !mcpClient.isConnected()) {
    console.log('Reconnecting MCP client...');
    try {
      mcpClient = await initializeMCPClient();
    } catch (error) {
      console.error('Failed to reconnect MCP client:', error);
      throw error;
    }
  }
  return mcpClient;
}

// Initialize MCP client with server config
async function initializeMCPClient() {
  try {
    console.log('Starting MCP client initialization...');

    if (!SMITHERY_CONFIG.apiKey) {
      throw new Error('Missing Smithery API key');
    }

    // First, get server details from registry
    const serverDetails = await fetchServerDetails();
    console.log('Server details:', {
      qualifiedName: serverDetails.qualifiedName,
      displayName: serverDetails.displayName,
      deploymentUrl: serverDetails.deploymentUrl
    });

    // Create transport with authentication and server details
    const transport = new StreamableHTTPClientTransport(
      serverDetails.deploymentUrl,
      {
        headers: {
          'Authorization': `Bearer ${SMITHERY_CONFIG.apiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    // Create and configure the client with session configuration
    console.log('Creating MCP client...');
    const client = new Client({
      name: "HubSpot Assistant",
      version: "1.0.0",
      configuration: {
        openaiApiKey: process.env.OPENAI_API_KEY,
        hubspotApiKey: process.env.HUBSPOT_API_KEY,
        modelName: "gpt-3.5-turbo",
        temperature: 0.0,
        maxTokens: 2048,
        debug: process.env.DEBUG_MODE === 'true'
      }
    });

    console.log('Connecting to MCP server...');
    try {
      // Connect to the server with transport
      await client.connect(transport);
      console.log('MCP client connected successfully');
      
      // Store and return the client
      mcpClient = client;
      return client;
    } catch (connectError) {
      console.error('Connection error:', {
        message: connectError.message,
        stack: connectError.stack,
        name: connectError.name
      });
      throw connectError;
    }
  } catch (error) {
    console.error('Detailed error in MCP client initialization:', {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'PRESENT' : 'MISSING',
        SMITHERY_API_KEY: SMITHERY_CONFIG.apiKey ? 'PRESENT' : 'MISSING',
        HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY ? 'PRESENT' : 'MISSING'
      }
    });
    throw new Error(`Failed to initialize MCP client: ${error.message}`);
  }
}

// Clean up MCP client when server shuts down
process.on('SIGINT', async () => {
  if (mcpClient) {
    try {
      console.log('Disconnecting MCP client...');
      await mcpClient.disconnect();
      console.log('MCP client disconnected');
    } catch (error) {
      console.error('Error disconnecting MCP client:', error);
    }
  }
  process.exit(0);
});

// Clean up MCP client when server shuts down
process.on('SIGTERM', async () => {
  if (mcpClient) {
    try {
      console.log('Disconnecting MCP client...');
      await mcpClient.disconnect();
      console.log('MCP client disconnected');
    } catch (error) {
      console.error('Error disconnecting MCP client:', error);
    }
  }
  process.exit(0);
});

// POST handler
export async function POST(request) {
  try {
    console.log('Request received:', request.method, request.url);
    const { userQuery } = await request.json();

    if (!userQuery) {
      return NextResponse.json(
        { error: 'Requête invalide. Le champ "userQuery" est requis.' },
        { status: 400 }
      );
    }

    console.log('Processing user query:', userQuery);

    // Ensure MCP client is connected
    const client = await ensureMCPClientConnected();
    
    console.log('MCP client initialized successfully');

    // Generate OpenAI response with enhanced error handling
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Vous êtes un assistant intelligent pour HubSpot. Votre rôle est de traiter les requêtes en français et de générer des actions HubSpot.
            Format de réponse:
            1. Réponse en français
            2. Commande HubSpot en JSON (dans un commentaire /* */)
            
            Exemple de format pour créer un contact:
            /*
            {
              "email": "adresse@email.com",
              "firstname": "Prénom",
              "lastname": "Nom"
            }
            */` },
          { role: 'user', content: userQuery }
        ],
        temperature: 0,
        max_tokens: 2048
      });
    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      throw new Error(`Erreur lors de la génération de la réponse: ${aiError.message}`);
    }

    const responseText = response.choices[0].message.content;
    console.log('AI Response:', responseText);

    // Enhanced command extraction with fallback
    let commandJson;
    try {
      // Try to find JSON in comment blocks
      const commandMatch = responseText.match(/\/\*([\s\S]*?)\*\//);
      if (commandMatch) {
        commandJson = commandMatch[1].trim();
      } else {
        // Fallback: Try to find JSON anywhere in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          commandJson = jsonMatch[0];
        } else {
          throw new Error('Pas de commande HubSpot trouvée dans la réponse AI');
        }
      }
    } catch (parseError) {
      console.error('Error extracting command:', {
        error: parseError,
        responseText: responseText.substring(0, 200) + '...' // Log first 200 chars
      });
      throw new Error('Erreur lors de l\'extraction de la commande');
    }

    console.log('Parsed Command:', commandJson);

    // Execute command via MCP
    // Validate and parse the command
    let command;
    try {
      command = JSON.parse(commandJson);
      if (!command.email || !command.firstname || !command.lastname) {
        throw new Error('Command is missing required fields');
      }
      console.log('Validated command:', {
        email: command.email,
        firstname: command.firstname,
        lastname: command.lastname
      });
    } catch (parseError) {
      console.error('Error parsing command:', {
        error: parseError,
        commandJson
      });
      throw new Error('Invalid command format');
    }

    // Execute the command with proper parameters
    console.log('Sending command to MCP server:', {
      serverUrl: cachedServerDetails?.deploymentUrl,
      commandType: 'hubspot.createContact',
      contactData: {
        email: command.email,
        firstname: command.firstname,
        lastname: command.lastname
      }
    });

    const result = await client.send({
      type: 'hubspot.createContact',
      payload: {
        properties: {
          email: command.email,
          firstname: command.firstname,
          lastname: command.lastname
        }
      }
    }).catch(error => {
      console.error('Detailed error sending command:', {
        timestamp: new Date().toISOString(),
        error,
        command,
        serverUrl: cachedServerDetails?.deploymentUrl,
        clientState: {
          isConnected: client?.isConnected(),
          transport: client?.transport
        }
      });
      throw new Error(`Command failed: ${error.message}`);
    });

    console.log('Command succeeded:', {
      result,
      contactId: result?.id,
      status: result?.status
    });

    // Format final response
    const responseMessage = `Contact créé avec succès !
    ID: ${result?.id}
    Email: ${command.email}
    Nom: ${command.firstname} ${command.lastname}`;

    return NextResponse.json({
      message: responseMessage,
      command,
      result
    }, { status: 200 });

  } catch (error) {
    const requestDetails = {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString()
    };

    console.error('Error processing request:', {
      error,
      request: requestDetails,
      stack: error.stack,
      type: error.constructor.name
    });

    return NextResponse.json(
      {
        error: `Erreur lors du traitement de la requête: ${error.message}`,
        timestamp: new Date().toISOString(),
        requestDetails
      },
      { status: error.status || 500 }
    );
  }
}