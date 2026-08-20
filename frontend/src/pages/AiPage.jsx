import { useState, useRef, useEffect } from 'react'
import { Bot, Send } from 'lucide-react'
import axios from 'axios'

function AiPage() {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'VORLAN Local-LLM Initialized. Edge node active. How can I assist?' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = input
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setIsTyping(true)

    try {
      const token = localStorage.getItem('vorlan_token')
      const res = await axios.post('http://localhost:5000/api/ai/ask', 
        { prompt: userMsg },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMessages(prev => [...prev, { role: 'system', content: res.data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: '[SYSTEM ERROR]: Edge AI offline.' }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
       <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
         <Bot className="text-green-400" /> VORLAN Local Matrix AI
       </h1>
       <div className="h-96 overflow-y-auto bg-gray-800 p-4 mb-4 rounded-lg border border-gray-700 shadow-inner">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-4 p-2 rounded max-w-[80%] ${msg.role === 'user' ? 'bg-blue-650 text-white ml-auto text-right' : 'bg-gray-700 text-green-400 text-left font-mono'}`}>
              {msg.role === 'system' && <span className="text-gray-400 mr-1">&gt;</span>}
              {msg.content}
            </div>
          ))}
          {isTyping && <div className="text-gray-500 font-mono animate-pulse">&gt; Processing on edge...</div>}
          <div ref={chatEndRef} />
       </div>
       <div className="flex gap-2">
         <input 
           type="text" 
           className="flex-1 p-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500" 
           placeholder="Ask VORLAN anything..."
           value={input} 
           onChange={e => setInput(e.target.value)} 
           onKeyDown={e => e.key === 'Enter' && handleSend()} 
         />
         <button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg text-white transition-colors">
           <Send size={20}/>
         </button>
       </div>
    </div>
  )
}

export default AiPage