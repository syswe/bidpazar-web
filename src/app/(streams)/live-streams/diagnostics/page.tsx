"use client";

import WebRTCDiagnosticTool from "../[id]/components/WebRTCDiagnosticTool";

export default function DiagnosticsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">WebRTC Connection Diagnostics</h1>
      <p className="mb-6 text-gray-700">
        This page helps you diagnose WebRTC connection issues with your
        MediaSoup implementation. Run the tests below to check each step of the
        connection process.
      </p>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold mb-2">Environment Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Socket.IO URL:{" "}
            <code>
              {process.env.NEXT_PUBLIC_SOCKET_URL || "Not configured"}
            </code>
          </li>
          <li>
            STUN Server:{" "}
            <code>
              {process.env.NEXT_PUBLIC_STUN_SERVER_URL || "Not configured"}
            </code>
          </li>
          <li>
            TURN Server:{" "}
            <code>
              {process.env.NEXT_PUBLIC_TURN_SERVER_URL || "Not configured"}
            </code>
          </li>
        </ul>
      </div>

      <WebRTCDiagnosticTool />

      <div className="mt-8 p-4 bg-gray-50 border rounded">
        <h2 className="text-lg font-semibold mb-2">
          Common Connection Problems
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Socket.IO Connection Failure</strong> - Check your CORS
            settings and make sure the Socket.IO URL is accessible from your
            network.
          </li>
          <li>
            <strong>MediaSoup Device Loading Failure</strong> - Ensure your
            server's router is correctly initialized and can return RTP
            capabilities.
          </li>
          <li>
            <strong>STUN/TURN Connectivity Failure</strong> - Verify your
            STUN/TURN server configuration and make sure the servers are
            reachable.
          </li>
          <li>
            <strong>Transport Creation Failure</strong> - Check MediaSoup
            configuration, especially <code>MEDIASOUP_ANNOUNCED_IP</code> which
            should be your server's actual IP address, not 127.0.0.1.
          </li>
          <li>
            <strong>ICE Connection Failure</strong> - Ensure your firewall
            allows UDP traffic on the configured MediaSoup port range (typically
            40000-40100).
          </li>
        </ul>
      </div>
    </div>
  );
}
