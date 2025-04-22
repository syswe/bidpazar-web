import { NextRequest, NextResponse } from 'next/server';
import { getToken } from "@/lib/auth";
import { env } from "@/lib/env"; // Import env config

export async function POST(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { conversationId, content, receiverId } = body;

    if (!conversationId || !content || !receiverId) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, content, receiverId' },
        { status: 400 }
      );
    }

    // Use the specific backend API URL from env
    const baseUrl = env.BACKEND_API_URL;
    const apiUrl = baseUrl.endsWith('/api') 
      ? `${baseUrl}/messages/messages`
      : `${baseUrl}/api/messages/messages`;
    
    console.log('Sending message to API:', apiUrl, {
      conversationId, content, receiverId
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, content, receiverId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Backend API error: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
} 