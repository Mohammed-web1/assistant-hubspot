"use client";

import React, { useState, useEffect } from "react";

export default function ChatInterface() {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      messages: [
        { user: "AI", text: "Bonjour ! Je suis votre assistant HubSpot." },
      ],
    },
  ]);
  const [currentConvId, setCurrentConvId] = useState(1);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const currentConversation = conversations.find((c) => c.id === currentConvId);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { user: "You", text: input };
    updateConversationMessages(currentConvId, (msgs) => [...msgs, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery: input
        }),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error('API error response:', errorData);
          throw new Error(`API request failed: ${errorData.error || 'Une erreur est survenue'}`);
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          throw new Error(`API request failed: Code ${response.status}`);
        }
      }

      const data = await response.json();
      let aiMessage;
      
      // Handle HubSpot commands
      if (data.command) {
        const commandResult = await fetch("/api/chat/hubspot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: data.command }),
        });
        
        if (!commandResult.ok) {
          throw new Error("Erreur lors de l'exécution de la commande HubSpot");
        }
        
        const commandData = await commandResult.json();
        aiMessage = { 
          user: "AI", 
          text: commandData.success 
            ? `Action effectuée avec succès: ${commandData.message}`
            : `Erreur: ${commandData.error}`
        };
      } else {
        aiMessage = { user: "AI", text: data.content || "Désolé, une erreur est survenue." };
      }
      
      updateConversationMessages(currentConvId, (msgs) => [...msgs, aiMessage]);
    } catch (error) {
      console.error(error);
      const errorMsg = { user: "AI", text: `Erreur: ${error.message}. Veuillez réessayer.` };
      updateConversationMessages(currentConvId, (msgs) => [...msgs, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConversationMessages = (convId, updateFn) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === convId ? { ...conv, messages: updateFn(conv.messages) } : conv
      )
    );
  };

  const newConversation = () => {
    const newId = conversations.length ? Math.max(...conversations.map((c) => c.id)) + 1 : 1;
    const newConv = {
      id: newId,
      messages: [{ user: "AI", text: "Bonjour ! Je suis votre assistant HubSpot. Comment puis-je vous aider ?" }],
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConvId(newId);
    setInput("");
  };

  const getConversationPreview = (conv) => {
    const firstUserMsg = conv.messages.find((m) => m.user === "You");
    const firstMsg = firstUserMsg || conv.messages[0];
    if (!firstMsg) return "Conversation vide";
    const text = firstMsg.text.length > 30 ? firstMsg.text.slice(0, 27) + "..." : firstMsg.text;
    return text;
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen font-inter overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gradient-to-br from-[#020818] to-[#0F172A] shadow-lg transform transition-transform duration-300 ease-in-out z-30
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-5 border-b border-[#0A1228] flex justify-between items-center text-gray-300">
          <h2 className="text-xl font-semibold">Conversations</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white focus:outline-none"
            aria-label="Fermer le panneau"
          >
            ✖️
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-64px)] flex flex-col gap-3">
          <button
            onClick={newConversation}
            className="w-full bg-gradient-to-r from-[#020818] to-[#0F172A] hover:from-[#0B0F1F] hover:to-[#1A263F] rounded-md py-2 font-medium text-white transition-colors border border-gray-600"
          >
            + Nouvelle conversation
          </button>

          {conversations.length === 0 && (
            <p className="text-gray-400 mt-4">Aucune conversation sauvegardée.</p>
          )}

          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setCurrentConvId(conv.id)}
              className={`text-left p-3 rounded-md truncate transition-colors
                ${
                  conv.id === currentConvId
                    ? "bg-gradient-to-r from-[#020818] to-[#0F172A] text-white font-bold border border-white"
                    : "bg-[#0F172A] text-gray-300 hover:bg-[#020818]"
                }
              `}
              title={getConversationPreview(conv)}
            >
              {getConversationPreview(conv)}
            </button>
          ))}
        </div>
      </aside>

      {/* Floating toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? "Masquer l'historique" : "Afficher l'historique"}
        className="fixed top-1/2 left-0 -translate-y-1/2 bg-gradient-to-br from-[#020818] to-[#0F172A] hover:from-[#0B0F1F] hover:to-[#1A263F] text-white rounded-r-full w-10 h-10 flex items-center justify-center shadow-lg z-40 select-none"
      >
        {sidebarOpen ? "❮" : "❯"}
      </button>

      {/* Main content */}
      <div
        className={`flex flex-col flex-grow transition-margin duration-300 ease-in-out bg-gradient-to-br from-[#020818] to-[#0F172A] text-gray-200
          ${sidebarOpen ? "ml-80" : "ml-0"}
        `}
      >
        {/* Header */}
        <header className="p-5 text-center shadow-lg bg-gradient-to-br from-[#020818] to-[#0F172A] text-white border-b border-[#0A1228]">
          <h1 className="text-3xl font-bold">Assistant HubSpot</h1>
          <p className="mt-2 text-sm">Votre assistant IA personnel</p>
        </header>

        {/* Chat Area */}
        <main className="flex-grow p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {currentConversation?.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start my-4 ${
                  msg.user === "AI" ? "justify-start" : "justify-end"
                }`}
              >
                {msg.user === "AI" && (
                  <div className="flex-shrink-0 w-10 h-10 mr-3 rounded-full bg-[#020818] flex items-center justify-center select-none shadow-inner border border-[#0F172A]">
                    🤖
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl shadow-md max-w-[75%] ${
                    msg.user === "AI"
                      ? "bg-gradient-to-r from-[#020818] to-[#0F172A] text-white border border-[#0A1228]"
                      : "bg-gradient-to-r from-[#0F172A] to-[#020818] text-white border border-[#0A1228]"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.user === "You" && (
                  <div className="flex-shrink-0 w-10 h-10 ml-3 rounded-full bg-[#0F172A] flex items-center justify-center select-none shadow-inner border border-[#020818]">
                    👤
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {/* Input Area */}
        <footer className="p-4 bg-gradient-to-t from-[#0F172A] to-[#020818] border-t border-[#0A1228]">
          <div className="max-w-3xl mx-auto flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tapez votre message ici..."
              className="flex-grow rounded-full p-3 text-sm shadow-inner bg-[#020818] text-gray-200 border border-[#0A1228] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              className="ml-4 px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#020818] to-[#0F172A] text-white shadow-md hover:from-[#0B0F1F] hover:to-[#1A263F] transition-colors border border-gray-700"
            >
              Envoyer
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}