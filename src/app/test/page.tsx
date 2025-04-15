import TestWebRTC from "../test-webrtc";

export default function TestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h1 className="text-3xl font-bold mb-2">WebRTC LiveStream Testing</h1>
        <p className="mb-4">
          This page tests the live video streaming capabilities using WebRTC and MediaSoup with the Bidpazar API.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded shadow">
            <h3 className="font-semibold text-gray-700">API Settings</h3>
            <p className="text-sm text-gray-600">
              Default Socket URL: ws://localhost:5001
            </p>
            <p className="text-sm text-gray-600">
              Connection Path: /rtc/v1
            </p>
          </div>
          <div className="bg-white p-3 rounded shadow">
            <h3 className="font-semibold text-gray-700">Media Settings</h3>
            <p className="text-sm text-gray-600">
              Video: 720p, 30fps (when available)
            </p>
            <p className="text-sm text-gray-600">
              Audio: Enabled
            </p>
          </div>
        </div>
      </div>
      <TestWebRTC />
    </div>
  );
} 