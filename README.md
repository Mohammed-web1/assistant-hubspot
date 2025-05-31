# HubSpot AI Assistant

Un assistant IA personnel connecté à HubSpot via MCP, permettant d'effectuer des actions CRM par conversation naturelle.

## Configuration

1. Créer un fichier `.env.local` à la racine du projet avec les variables suivantes :

```env
OPENAI_API_KEY=votre_clé_openai
HUBSPOT_API_KEY=votre_clé_hubspot
MCP_SERVER_URL=https://votre-serveur-mcp
```

2. Installer les dépendances :

```bash
npm install
```

3. Lancer le serveur de développement :

```bash
npm run dev
```

## Fonctionnalités

- Interface de chat moderne et responsive
- Intégration avec l'API OpenAI pour une conversation naturelle
- Actions HubSpot via MCP
- Historique des conversations
- Interface multilingue (Français) 