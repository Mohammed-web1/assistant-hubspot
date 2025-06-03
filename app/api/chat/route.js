import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST handler
export async function POST(request) {
  try {
    const { userQuery } = await request.json();

    if (!userQuery) {
      return NextResponse.json(
        { error: 'Requête invalide. Le champ "userQuery" est requis.' },
        { status: 400 }
      );
    }

    // Generate OpenAI response
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'Vous êtes un assistant IA conversationnel pour la gestion client via HubSpot. Toujours répondre en français de manière naturelle et conversationnelle.'
        },
        { role: 'user', content: userQuery }
      ]
    });

    const content = response.choices[0].message.content;
    console.log('OpenAI response:', content);

    // Return the response with proper structure
    return NextResponse.json({
      content: content,
      command: null // Add this field to match frontend expectations
    });

  } catch (error) {
    console.error('Error in request handler:', error);
    return NextResponse.json(
      { 
        error: 'Désolé, une erreur est survenue.',
        details: error.message
      },
      { status: 500 }
    );
  }
}
