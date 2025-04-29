import TestWebRTC from "../test-webrtc";

export default function TestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h1 className="text-3xl font-bold mb-2">WebRTC LiveStream Production Testing</h1>
        <p className="mb-4">
          This page tests the optimized live video streaming capabilities using WebRTC and MediaSoup with worker pool scaling.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded shadow">
            <h3 className="font-semibold text-gray-700">API Settings</h3>
            <p className="text-sm text-gray-600">
              Socket URL: {process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5001'}
            </p>
            <p className="text-sm text-gray-600">
              Connection Path: /rtc/v1
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Worker Pool: Automatically scaled based on CPU cores
            </p>
          </div>
          <div className="bg-white p-3 rounded shadow">
            <h3 className="font-semibold text-gray-700">Media Settings</h3>
            <p className="text-sm text-gray-600">
              Video: 720p, 30fps (optimized for low latency)
            </p>
            <p className="text-sm text-gray-600">
              Audio: Opus codec with echo cancellation enabled
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Fallback: HLS for browsers with limited WebRTC support
            </p>
          </div>
        </div>
        <div className="bg-white p-3 rounded shadow mt-4">
          <h3 className="font-semibold text-gray-700">TURN/STUN Configuration</h3>
          <p className="text-sm text-gray-600">
            Using custom TURN and STUN servers for reliable connectivity
          </p>
          <p className="text-sm text-gray-600">
            TURN Server: {process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:localhost:3478'}
          </p>
          <p className="text-sm text-gray-600">
            STUN Server: {process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:localhost:3478'}
          </p>
        </div>
      </div>
      <TestWebRTC />
    </div>
  );
} 