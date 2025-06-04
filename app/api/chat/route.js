import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"



// Configuration de sécurité
const SECURITY_CONFIG = {
  // Masquage des clés API dans les logs
  maskKeys: ['api_key', 'hubspotApiKey', 'SMITHERY_API_KEY'],
  // Configuration des logs de sécurité
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  // Configuration de la confidentialité
  privacy: {
    maskSensitiveData: true,
    trackAnalytics: process.env.NODE_ENV === 'development'
  },
  // Configuration MCP
  mcpConfig: {
    name: process.env.SERVER_NAME || '@shinzo-labs/hubspot-mcp',
    type: 'http',
    url: `https://server.smithery.ai/${process.env.SERVER_NAME}/mcp`
  }
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize MCP client with detailed configuration
const client = new Client({
  name: "HubSpot Assistant",
  version: "1.0.0",
  configSchema: {
    type: 'object',
    required: ['serverUrl', 'profileId', 'apiKey'],
    properties: {
      serverUrl: {
        type: 'string',
        title: 'MCP Server URL',
        description: 'URL of the MCP server'
      },
      profileId: {
        type: 'string',
        title: 'Profile ID',
        description: 'ID of the saved configuration profile'
      },
      apiKey: {
        type: 'string',
        title: 'API Key',
        description: 'Smithery API key for authentication'
      }
    }
  }
});

// Create URL using profile-based connection with security
let url = `https://server.smithery.ai/${process.env.SERVER_NAME}/mcp?profile=${process.env.PROFILE_ID}&api_key=${process.env.SMITHERY_API_KEY}`;

// Create transport
let transport = new StreamableHTTPClientTransport(url);

// Connect to MCP with detailed retry logic
async function connectToMCP() {
  try {
    // Check if required environment variables are set
    if (!process.env.SERVER_NAME) {
      console.error('SERVER_NAME environment variable is not set');
      return false;
    }
    if (!process.env.PROFILE_ID) {
      console.error('PROFILE_ID environment variable is not set');
      return false;
    }
    if (!process.env.SMITHERY_API_KEY) {
      console.error('SMITHERY_API_KEY environment variable is not set');
      return false;
    }

    console.log('Attempting to connect to MCP server...');
    console.log('Connection URL:', url);
    console.log('Environment variables:', {
      SERVER_NAME: process.env.SERVER_NAME,
      PROFILE_ID: process.env.PROFILE_ID,
      hasApiKey: !!process.env.SMITHERY_API_KEY
    });

    // First try to connect
    await client.connect(transport);
    console.log('Connected to MCP server successfully');

    // Test the connection by fetching system info
    try {
      const systemInfo = await client.executeCommand({
        type: 'command',
        name: 'system.info'
      });
      console.log('MCP System Info:', systemInfo);
      return true;
    } catch (infoError) {
      console.error('Failed to fetch system info:', infoError);
      // Continue even if system info fails
      return true;
    }
  } catch (error) {
    console.error('Failed to connect to MCP:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return false;
  }
}

// Try to connect when the file loads
const connectionSuccess = await connectToMCP();

if (!connectionSuccess) {
  console.error('Failed to connect to MCP. Continuing with OpenAI integration only.');
  console.error('Connection URL:', url);
  console.error('Profile ID:', process.env.PROFILE_ID);
  console.error('Server Name:', process.env.SERVER_NAME);
  console.error('API Key present:', !!process.env.SMITHERY_API_KEY);
  console.warn('MCP connection failed. The application will continue with OpenAI integration only.');
}

// Function to mask sensitive data
function maskSensitiveData(data) {
  if (typeof data !== 'object') {
    return data;
  }

  const maskedData = { ...data };

  Object.keys(maskedData).forEach(key => {
    if (SECURITY_CONFIG.maskKeys.includes(key)) {
      maskedData[key] = '***';
    } else if (typeof maskedData[key] === 'object') {
      maskedData[key] = maskSensitiveData(maskedData[key]);
    }
  });

  return maskedData;
}

// POST handler with security measures and deep link integration
export async function POST(request) {
  try {
    const { userQuery, mcpConfig } = await request.json();

    if (!userQuery) {
      return NextResponse.json(
        { error: 'Requête invalide. Le champ "userQuery" est requis.' },
        { status: 400 }
      );
    }

    // Handle MCP configuration if provided via deep link
    if (mcpConfig) {
      try {
        const config = JSON.parse(decodeURIComponent(mcpConfig));
        SECURITY_CONFIG.mcpConfig = config;
        url = createSmitheryUrl(
          config.url,
          { 
            profile: process.env.PROFILE_ID,
            config: {
              privacy: {
                maskSensitiveData: true,
                trackAnalytics: SECURITY_CONFIG.privacy.trackAnalytics
              },
              debug: SECURITY_CONFIG.logLevel === 'debug'
            }
          },
          process.env.SMITHERY_API_KEY
        );
        // Update transport with new URL
        transport = new StreamableHTTPClientTransport(url);
        
        // Reconnect with new configuration
        await client.disconnect();
        await connectToMCP();
      } catch (error) {
        console.error('Error handling MCP configuration:', error);
        return NextResponse.json(
          { error: 'Erreur lors de la configuration du serveur MCP.' },
          { status: 500 }
        );
      }
    }

    // Generate OpenAI response with instructions for HubSpot actions
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'Vous êtes un assistant IA conversationnel pour la gestion client via HubSpot.\n\nInstructions:\n1. Répondez toujours en français de manière naturelle et conversationnelle.\n2. Si une action CRM est requise, retournez un objet JSON avec la structure suivante:\n{\n  "action": "create_contact" | "update_contact" | "search_contacts" | "create_company" | "update_company" | "search_companies" | "create_deal" | "search_deals",\n  "data": {\n    "command": {\n      "name": "hubspot.createContact" | "hubspot.updateContact" | "hubspot.searchContacts" | "hubspot.createCompany" | "hubspot.updateCompany" | "hubspot.searchCompanies" | "hubspot.createDeal" | "hubspot.searchDeals",\n      "args": {\n        // Pour les contacts:\n        "properties": {\n          "firstName": "string",\n          "lastName": "string",\n          "email": "string",\n          "jobTitle": "string",\n          "phone": "string",\n          "companyId": "string"\n        },\n        // Pour les entreprises:\n        "properties": {\n          "name": "string",\n          "domain": "string",\n          "industry": "string",\n          "numberOfEmployees": "number"\n        },\n        // Pour les deals:\n        "properties": {\n          "dealName": "string",\n          "amount": "number",\n          "dealstage": "string",\n          "pipeline": "string",\n          "closedate": "string",\n          "hubspot_owner_id": "string",\n          "associatedCompany": "string",\n          "associatedContact": "string"\n        },\n        // Pour les recherches:\n        "filters": {\n          "term": "string",\n          "properties": ["string"]\n        },\n        // Pour les recherches de deals:\n        "dealFilters": {\n          "pipeline": "string",\n          "stage": "string",\n          "period": {\n            "start": "string",\n            "end": "string"\n          },\n          "sort": {\n            "field": "string",\n            "order": "asc" | "desc"\n          }\n        }\n      }\n    }\n  }\n}\n\nIMPORTANT: Si une action CRM est requise, retournez uniquement l\'objet JSON avec la structure exacte spécifiée ci-dessus. Sinon, répondez simplement en français.'
        },
        { role: 'user', content: userQuery }
      ]
    });

    const content = response.choices[0].message.content;
    
    // Log with security measures
    if (SECURITY_CONFIG.logLevel === 'debug') {
      console.log('OpenAI response:', content);
    }
    // Try to parse the response as JSON
    let parsedResponse = null;
    try {
      // Try to find JSON object in the response
      const jsonMatch = content.match(/\{.*\}/s);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      }
      
      // Secure logging
      if (SECURITY_CONFIG.logLevel === 'debug' && parsedResponse) {
        console.log('Parsed response:', maskSensitiveData(parsedResponse));
      }

      // If there's a HubSpot action, execute it
      if (parsedResponse && parsedResponse.action && parsedResponse.data) {
        try {
          const { command, args } = parsedResponse.data.command;
          
          // Secure logging
          if (SECURITY_CONFIG.logLevel === 'debug') {
            console.log('Executing command:', maskSensitiveData({ command, args }));
          }
          
          // Execute the command through MCP
          const result = await client.send({
            type: 'command',
            name: command,
            payload: {
              ...args
            }
          });
          
          // Secure logging
          if (SECURITY_CONFIG.logLevel === 'debug') {
            console.log('Command executed successfully:', maskSensitiveData(result));
          }
          
          // Format the response based on the action type
          let responseContent;
          switch (parsedResponse.action) {
            case 'create_contact':
              responseContent = `Contact créé avec succès: ${args.properties.firstName} ${args.properties.lastName}`;
              break;
            case 'update_contact':
              responseContent = `Contact mis à jour avec succès: ${args.properties.firstName} ${args.properties.lastName}`;
              break;
            case 'create_company':
              responseContent = `Entreprise créée avec succès: ${args.properties.name}`;
              break;
            case 'update_company':
              responseContent = `Entreprise mise à jour avec succès: ${args.properties.name}`;
              break;
            case 'search_contacts':
              responseContent = `Résultats de recherche pour: ${args.filters.term}`;
              break;
            case 'search_companies':
              responseContent = `Résultats de recherche pour: ${args.filters.term}`;
              break;
            case 'create_deal':
              responseContent = `Deal créé avec succès: ${args.properties.dealName}`;
              break;
            case 'search_deals':
              responseContent = `Résultats de recherche des deals`;
              break;
            default:
              responseContent = `Action effectuée avec succès`;
          }

          return NextResponse.json({
            content: responseContent,
            command: parsedResponse.data.command,
            result: result
          });
        } catch (error) {
          // Secure error logging
          console.error('Error executing MCP command:', {
            command: command,
            error: error.message,
            stack: error.stack
          });
          
          // Check if error is related to deal stage
          if (error.message.includes('dealstage')) {
            return NextResponse.json({
              content: `Erreur: La valeur du dealstage n'est pas valide. Les valeurs valides sont: appointment_scheduled, qualified_to_buy, presentation_scheduled, contract_sent, closed_won, closed_lost`,
              command: parsedResponse.data.command,
              error: error.message
            });
          }

          return NextResponse.json({
            content: `Erreur lors de l'exécution de l'action: ${error.message}`,
            command: parsedResponse.data.command,
            error: error.message
          });
        }
      } else {
        // If no action, just return the AI's response
        return NextResponse.json({
          content: content,
          command: null
        });
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      // If not JSON, just return the content
      return NextResponse.json({
        content: content,
        command: null
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de la requête.' },
      { status: 500 }
    );
  }
}
