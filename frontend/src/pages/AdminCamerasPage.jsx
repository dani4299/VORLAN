import { Camera } from 'lucide-react'

function AdminCamerasPage() {
  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Camera /> Live Optics Feed
      </h1>
      <div className="relative border-4 border-red-900 rounded-lg overflow-hidden max-w-3xl">
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse z-10">
          LIVE - FRONT ENTRANCE
        </div>
        {/* Put a random fake_feed.mp4 in your public folder! */}
        <video src="/fake_feed.mp4" autoPlay loop muted className="w-full h-auto grayscale" />
      </div>
    </div>
  )
}

export default AdminCamerasPage