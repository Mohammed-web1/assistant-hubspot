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

// Utility function to mask sensitive data in logs
function maskSensitiveData(data) {
  if (!SECURITY_CONFIG.privacy.maskSensitiveData) return data;
  
  const maskedData = JSON.parse(JSON.stringify(data));
  SECURITY_CONFIG.maskKeys.forEach(key => {
    if (maskedData[key]) {
      maskedData[key] = '***MASKED***';
    }
    if (maskedData.args && maskedData.args[key]) {
      maskedData.args[key] = '***MASKED***';
    }
  });
  return maskedData;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create URL using profile-based connection with security
let url = `https://server.smithery.ai/${process.env.SERVER_NAME}/mcp?profile=${process.env.PROFILE_ID}&api_key=${process.env.SMITHERY_API_KEY}`;

// Create transport
let transport = new StreamableHTTPClientTransport(url);

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

// Connect client to transport
try {
  await client.connect(transport);
  console.log('MCP client connected successfully');
} catch (error) {
  console.error('Error connecting to MCP:', error);
  // Continue anyway since we can still use the AI without MCP
}

// Initialize message history
let messageHistory = [
  {
    role: 'system',
    content: `Vous êtes un assistant IA conversationnel pour HubSpot.

Instructions:
1. Répondez toujours en français naturel et conversationnel.
2. Répondez à toutes les questions posées, même si elles ne concernent pas le CRM.
3. Pour les questions CRM, fournissez des réponses directes avec les données demandées.
4. Ne donnez jamais d'exemples dans vos réponses.


IMPORTANT: 
- Pour les questions CRM, donnez des réponses directes avec les données demandées.
- Répondez toujours aux questions posées, même si elles ne sont pas directement liées au CRM.
- Répondez également aux requêtes d'action CRM avec des exemples de données.
- Générez des données d'exemple réalistes et formattez-les de manière claire et lisible.
- Restez naturel et conversationnel dans vos réponses.`
  }
];

// Function to manage message history
function updateMessageHistory(message) {
  messageHistory.push(message);
  // Keep only last 20 messages to prevent memory issues
  if (messageHistory.length > 20) {
    messageHistory = messageHistory.slice(-20);
  }
  return messageHistory;
}

// POST handler with message history
export async function POST(request) {
  try {
    const { userQuery } = await request.json();
    
    if (!userQuery) {
      return NextResponse.json(
        { error: 'Requête invalide. Le champ "userQuery" est requis.' },
        { status: 400 }
      );
    }

    // Add user message to history
    updateMessageHistory({
      role: 'user',
      content: userQuery
    });

    // Generate OpenAI response with context
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messageHistory,
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    
    // Add assistant message to history
    updateMessageHistory({
      role: 'assistant',
      content: content
    });

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
            args: args
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
