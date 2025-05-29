"use client";

import React, { useState } from "react";

export default function AssistantPage() {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      messages: [
        { user: "AI", text: "Bonjour ! Je suis votre assistant HubSpot. Comment puis-je vous aider ?" },
      ],
    },
  ]);
  const [currentConvId, setCurrentConvId] = useState(1);
  const [input, setInput] = useState("");

  const currentConversation = conversations.find((c) => c.id === currentConvId);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { user: "You", text: input };
    updateConversationMessages(currentConvId, (msgs) => [...msgs, userMessage]);
    setInput("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const data = await response.json();
      const aiMessage = { user: "AI", text: data.reply || "Désolé, une erreur est survenue." };
      updateConversationMessages(currentConvId, (msgs) => [...msgs, aiMessage]);
    } catch {
      const errorMsg = { user: "AI", text: "Je n'ai pas pu traiter votre demande. Veuillez réessayer." };
      updateConversationMessages(currentConvId, (msgs) => [...msgs, errorMsg]);
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
    const newId = conversations.length ? Math.max(...conversations.map(c => c.id)) + 1 : 1;
    const newConv = {
      id: newId,
      messages: [{ user: "AI", text: "Bonjour ! Je suis votre assistant HubSpot. Comment puis-je vous aider ?" }],
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConvId(newId);
    setInput("");
  };

  const getConversationPreview = (conv) => {
    const firstUserMsg = conv.messages.find(m => m.user === "You");
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
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 shadow-lg transform transition-transform duration-300 ease-in-out z-30
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-5 border-b border-gray-700 flex justify-between items-center text-gray-200">
          <h2 className="text-xl font-bold">Conversations</h2>
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
            className="w-full bg-purple-600 hover:bg-purple-700 rounded-md py-2 font-semibold text-white transition-colors"
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
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
        className="fixed top-1/2 left-0 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-r-full w-10 h-10 flex items-center justify-center shadow-lg z-40 select-none"
      >
        {sidebarOpen ? "❮" : "❯"}
      </button>

      {/* Main content */}
      <div
        className={`flex flex-col flex-grow transition-margin duration-300 ease-in-out bg-gradient-to-b from-slate-900 to-slate-800 text-gray-200
          ${sidebarOpen ? "ml-80" : "ml-0"}
        `}
      >
        {/* Header */}
        <header className="p-5 text-center shadow-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
          <h1 className="text-3xl font-bold">Assistant HubSpot</h1>
          <p className="mt-2 text-sm">Votre assistant IA personnel</p>
        </header>

        {/* Chat Area */}
        <main className="flex-grow p-6 overflow-y-auto bg-slate-900">
          <div className="max-w-3xl mx-auto">
            {currentConversation?.messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start my-4 ${
                  msg.user === "AI" ? "justify-start" : "justify-end"
                }`}
              >
                {msg.user === "AI" && (
                  <div className="flex-shrink-0 w-10 h-10 mr-3 rounded-full bg-blue-500 flex items-center justify-center select-none">
                    🤖
                  </div>
                )}
                <div
                  className={`p-4 rounded-2xl shadow-lg max-w-[75%] ${
                    msg.user === "AI"
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white"
                      : "bg-gradient-to-r from-purple-400 to-purple-500 text-white"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.user === "You" && (
                  <div className="flex-shrink-0 w-10 h-10 ml-3 rounded-full bg-purple-500 flex items-center justify-center select-none">
                    👤
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        {/* Input Area */}
        <footer className="p-4 bg-slate-800 border-t border-slate-700">
          <div className="max-w-3xl mx-auto flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tapez votre message ici..."
              className="flex-grow rounded-full p-3 text-sm shadow-md bg-slate-900 text-gray-200 border-none outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              className="ml-4 px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:from-blue-600 hover:to-indigo-700 transition-colors"
            >
              Envoyer
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
