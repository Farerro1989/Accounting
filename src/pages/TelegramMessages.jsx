import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Send, Paperclip, Search, FileText, Image as ImageIcon, User, MessageSquare, Bot } from "lucide-react";
import { format } from "date-fns";

export default function TelegramMessages() {
  const [messages, setMessages] = useState([]);
  const [transactionMap, setTransactionMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sending, setSending] = useState(false);
  
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [initialTransferInfo, setInitialTransferInfo] = useState("");
  
  const scrollRef = useRef(null);

  useEffect(() => {
    loadMessages();
    // Set up a poller for new messages every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages update or chat changes
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedChatId]);

  const loadMessages = async () => {
    try {
      const [msgData, txnData] = await Promise.all([
        base44.entities.TelegramMessage.list("-created_date", 100),
        base44.entities.Transaction.list("-created_date", 100)
      ]);
      
      // Map transactions by telegram_message_id
      const txnMap = {};
      txnData.forEach(t => {
        if (t.telegram_message_id) {
          txnMap[t.telegram_message_id] = t;
        }
      });
      setTransactionMap(txnMap);

      // Sort by date asc for chat view
      const sorted = msgData.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setMessages(sorted);
      
      if (!selectedChatId && sorted.length > 0) {
        // Default select the most recent chat
        const lastMsg = sorted[sorted.length - 1];
        setSelectedChatId(lastMsg.chat_id);
      }
    } catch (error) {
      console.error("加载消息失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTransaction = (txn) => {
    setEditingTransaction(txn);
    setInitialTransferInfo("");
    setShowTransactionModal(true);
  };

  const handleCreateTransaction = (msg) => {
    setEditingTransaction({
        source: 'telegram',
        telegram_chat_id: msg.chat_id,
        telegram_message_id: msg.message_id,
        deposit_date: format(new Date(), "yyyy-MM-dd"),
        // Set other defaults if needed
    });
    setInitialTransferInfo(msg.content || "");
    setShowTransactionModal(true);
  };

  const handleTransactionSubmit = async (data) => {
    try {
        if (data.id) {
            await Transaction.update(data.id, data);
            toast.success("交易已更新");
        } else {
            await Transaction.create(data);
            toast.success("交易已创建");
        }
        setShowTransactionModal(false);
        setEditingTransaction(null);
        loadMessages(); // Reload to refresh links
    } catch (error) {
        console.error("保存交易失败:", error);
        toast.error("保存失败: " + error.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChatId) return;

    setSending(true);
    try {
        await base44.functions.invoke("sendTelegramMessage", {
            chat_id: selectedChatId,
            text: replyText,
            bot_type: 'settlement' // Default to settlement bot for now, could add selector
        });
        
        setReplyText("");
        loadMessages(); // Reload to show new message
    } catch (error) {
        console.error("发送失败:", error);
        alert("发送失败，请检查网络或Token");
    } finally {
        setSending(false);
    }
  };

  // Group messages by chat_id
  const chats = messages.reduce((acc, msg) => {
    if (!acc[msg.chat_id]) {
      acc[msg.chat_id] = {
        chat_id: msg.chat_id,
        sender_name: msg.sender_name,
        last_message: msg,
        messages: []
      };
    }
    acc[msg.chat_id].messages.push(msg);
    // Update last message if this one is newer
    if (new Date(msg.created_date) > new Date(acc[msg.chat_id].last_message.created_date)) {
        acc[msg.chat_id].last_message = msg;
    }
    // Update sender name if we have a better one (sometimes it might be missing)
    if (msg.sender_name && (!acc[msg.chat_id].sender_name || acc[msg.chat_id].sender_name === 'Unknown')) {
        acc[msg.chat_id].sender_name = msg.sender_name;
    }
    return acc;
  }, {});

  // Filter chats based on search
  const filteredChats = Object.values(chats).filter(chat => {
    const searchLower = searchTerm.toLowerCase();
    return (
      chat.sender_name?.toLowerCase().includes(searchLower) ||
      chat.chat_id.includes(searchLower) ||
      chat.messages.some(m => m.content?.toLowerCase().includes(searchLower)) ||
      chat.messages.some(m => m.tags?.some(t => t.toLowerCase().includes(searchLower)))
    );
  }).sort((a, b) => new Date(b.last_message.created_date) - new Date(a.last_message.created_date));

  const currentChat = chats[selectedChatId];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50">
      {/* Sidebar: Chat List */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-blue-600"/> 消息中心
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="搜索消息、标签、发送人..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-50"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <button
                key={chat.chat_id}
                onClick={() => setSelectedChatId(chat.chat_id)}
                className={`p-4 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  selectedChatId === chat.chat_id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-slate-900 truncate max-w-[140px]">
                    {chat.sender_name || `Chat ${chat.chat_id}`}
                  </span>
                  <span className="text-xs text-slate-400">
                    {format(new Date(chat.last_message.created_date), 'MM-dd HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate">
                  {chat.last_message.direction === 'outgoing' && <span className="text-blue-600 mr-1">我:</span>}
                  {chat.last_message.content}
                </p>
                <div className="flex gap-1 mt-2">
                    {chat.last_message.tags?.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0 h-5">
                            {tag}
                        </Badge>
                    ))}
                </div>
              </button>
            ))}
            {filteredChats.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                    暂无消息
                </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/50">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                    {currentChat.sender_name?.[0] || <User className="w-5 h-5"/>}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{currentChat.sender_name}</h3>
                  <p className="text-xs text-slate-500">ID: {currentChat.chat_id}</p>
                </div>
              </div>
              <Badge variant={currentChat.last_message.category === 'transaction' ? 'default' : 'secondary'}>
                {currentChat.last_message.category === 'transaction' ? '交易相关' : '咨询/其他'}
              </Badge>
            </div>

            {/* Chat Messages */}
            <div 
                className="flex-1 overflow-y-auto p-6 space-y-6"
                ref={scrollRef}
            >
              {currentChat.messages.map((msg) => (
                <div 
                    key={msg.id} 
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${msg.direction === 'outgoing' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    
                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                        msg.direction === 'outgoing' 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Attachments */}
                      {msg.file_urls && msg.file_urls.length > 0 && (
                        <div className="mt-3 space-y-2">
                           {msg.file_urls.map((url, idx) => (
                               <a 
                                 key={idx} 
                                 href={url} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                                     msg.direction === 'outgoing' 
                                        ? 'bg-blue-700 hover:bg-blue-800' 
                                        : 'bg-slate-100 hover:bg-slate-200'
                                 }`}
                               >
                                   {url.match(/\.(jpg|jpeg|png|gif)$/i) || msg.file_type === 'photo' ? (
                                       <ImageIcon className="w-4 h-4" />
                                   ) : (
                                       <FileText className="w-4 h-4" />
                                   )}
                                   <span className="text-xs underline truncate max-w-[200px]">查看附件 {idx + 1}</span>
                               </a>
                           ))}
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center justify-between gap-2 mt-1 px-1">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{format(new Date(msg.created_date), 'MM-dd HH:mm')}</span>
                            {msg.tags && msg.tags.length > 0 && (
                                <div className="flex gap-1">
                                    <span>•</span>
                                    {msg.tags.map(t => <span key={t}>#{t}</span>)}
                                </div>
                            )}
                        </div>
                        
                        {/* Transaction Actions */}
                        {msg.direction === 'incoming' && (
                            <div className="flex items-center gap-2">
                                {transactionMap[msg.message_id] ? (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 px-2 text-[10px] bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                                        onClick={() => handleEditTransaction(transactionMap[msg.message_id])}
                                    >
                                        <Edit className="w-3 h-3 mr-1" />
                                        已录入 {transactionMap[msg.message_id].deposit_amount}
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-5 px-2 text-[10px] text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                        onClick={() => handleCreateTransaction(msg)}
                                    >
                                        <PlusCircle className="w-3 h-3 mr-1" />
                                        录入交易
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                  </div>
                </div>
              ))}
              
              {/* Transaction Modal */}
              <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {showTransactionModal && (
                        <TransactionForm 
                            transaction={editingTransaction}
                            initialTransferInfo={initialTransferInfo}
                            onSubmit={handleTransactionSubmit}
                            onCancel={() => setShowTransactionModal(false)}
                        />
                    )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="输入回复消息..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !replyText.trim()} className="bg-blue-600 hover:bg-blue-700">
                  {sending ? '发送中...' : <Send className="w-4 h-4" />}
                </Button>
              </form>
              <p className="text-xs text-slate-400 mt-2 text-center">
                消息将通过 Telegram 机器人发送给用户
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Bot className="w-16 h-16 mb-4 opacity-20" />
            <p>选择一个对话开始查看</p>
          </div>
        )}
      </div>
    </div>
  );
}