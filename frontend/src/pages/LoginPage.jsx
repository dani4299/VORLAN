import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Lock } from 'lucide-react'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault() // This absolutely stops the page reload flicker
    setError('')
    console.log("🟢 1. Initiating Edge Node Login for:", username)

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password
      })
      
      console.log("🟢 2. Backend response received:", response.data)
      
      // Fallback check in case your Node backend named the token something else
      const token = response.data.token || response.data.accessToken || response.data.jwt;
      
      if (!token) {
        console.error("🔴 ERROR: Backend didn't send a token back!")
        setError("System Error: No authorization token received.")
        return;
      }

      // Save the VIP pass!
      localStorage.setItem('vorlan_token', token)
      localStorage.setItem('vorlan_role', response.data.role || 'employee')
      
      console.log("🟢 3. Token secured in Matrix. Rerouting to Dashboard...")
      
      // Send them to the dashboard
      navigate('/dashboard')
    } catch (err) {
      console.error("🔴 4. Login Failed:", err)
      setError(err.response?.data?.error || 'System breach detected. Login failed.')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className="card p-8 bg-gray-800 rounded-lg shadow-xl w-96 border border-gray-700">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><Lock className="text-blue-400" /> VORLAN Secure Access</h1>
        
        {error && <p className="text-red-500 text-sm mb-4 bg-red-900/50 p-2 rounded">{error}</p>}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Username" 
            className="p-3 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="p-3 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 p-3 rounded font-bold transition-colors">Initialize</button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-400">
          Need clearance? <Link to="/signup" className="text-blue-400 hover:underline">Register here</Link>.
        </p>

      </div>
    </div>
  )
}

export default LoginPage