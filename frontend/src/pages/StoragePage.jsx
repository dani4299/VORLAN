import { useEffect, useState } from 'react'
import { HardDrive, File, Image as ImageIcon } from 'lucide-react'
import axios from 'axios'

function StoragePage() {
  const [files, setFiles] = useState([])

  useEffect(() => {
    const fetchVault = async () => {
      try {
        const token = localStorage.getItem('vorlan_token')
        const res = await axios.get('http://localhost:5000/api/vault/gallery', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setFiles(res.data.files)
      } catch (err) {
        console.error("Vault locked", err)
      }
    }
    fetchVault()
  }, [])

  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><HardDrive /> Encrypted Vault</h1>
      <div className="grid grid-cols-3 gap-4">
        {files.map((file, i) => {
          const isImage = file.match(/\.(jpeg|jpg|gif|png)$/) != null
          const fileUrl = `http://localhost:5000/media/${file}`
          
          return (
            <div key={i} className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col items-center">
              {isImage ? (
                <img src={fileUrl} alt={file} className="h-32 object-cover rounded mb-2" />
              ) : (
                <File size={48} className="text-blue-400 mb-2" />
              )}
              <p className="text-xs truncate w-full text-center">{file}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StoragePage