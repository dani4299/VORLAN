import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Shield } from 'lucide-react'

function SignupPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSignup = async (e) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:5000/api/auth/signup', {
        username,
        password,
        role: 'admin' 
      })
      
      // Send them to login after successful registration
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || 'System error. Registration failed.')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white font-sans">
      <div className="card p-8 bg-gray-800 rounded-lg shadow-xl w-96 border border-gray-700">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Shield className="text-green-400" /> VORLAN Registration
        </h1>
        
        {error && <p className="text-red-500 text-sm mb-4 bg-red-900/50 p-2 rounded">{error}</p>}
        
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Choose Username" 
            className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-green-500"
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Create Password" 
            className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-green-500"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <button type="submit" className="bg-green-600 hover:bg-green-700 p-3 rounded-lg font-bold transition-colors">
            Register Node
          </button>
        </form>
        
        <p className="mt-6 text-sm text-center text-gray-400">
          Already have access? <Link to="/login" className="text-blue-400 hover:underline">Initialize here</Link>.
        </p>
      </div>
    </div>
  )
}

export default SignupPage