// src/app/(streams)/live-streams/[id]/page.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getAuth } from "@/lib/frontend-auth";
import { toast } from "sonner";
import { useRuntimeConfig } from "@/context/RuntimeConfigContext";
import { Loader2, X, MessageCircle } from "lucide-react";
import { JitsiMeeting } from "@jitsi/react-sdk";

// Import components
import StreamChat from "./components/StreamChat";
import StreamHeader from "./components/StreamHeader";
import StreamActions from "./components/StreamActions";
import ProductSection from "./components/ProductSection";
import { StreamLoadingState, StreamErrorState, StreamNotFoundState } from "./components/StreamStates";

// Import custom hooks
import { useStreamDetails } from "./hooks/useStreamDetails";
import { useActiveBid } from "./hooks/useActiveBid";

// Import CSS
import "./styles/streamStyles.css";

export default function LiveStreamPage() {
  const router = useRouter();
  const params = useParams();
  const streamId = params.id as string;
  const { user } = useAuth();
  const { token } = getAuth();
  const userId = user?.id;
  const username = user?.username;
  const { config: runtimeConfig, isLoading: isConfigLoading } = useRuntimeConfig();
  
  // Local UI state
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [apiObj, setApiObj] = useState<any>(null);
  const [isCurrentUserStreamer, setIsCurrentUserStreamer] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);

  // Check sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      // Create a MutationObserver to watch for sidebar changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const sidebar = document.querySelector('aside');
            if (sidebar) {
              const width = window.getComputedStyle(sidebar).width;
              setIsSidebarExpanded(parseInt(width) > 70);
            }
          }
        });
      });

      // Start observing the sidebar element
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        observer.observe(sidebar, { attributes: true });
        // Initial check
        const width = window.getComputedStyle(sidebar).width;
        setIsSidebarExpanded(parseInt(width) > 70);
      }

      return () => observer.disconnect();
    };

    // Add a small delay to ensure sidebar is rendered
    const timer = setTimeout(checkSidebarState, 500);
    return () => clearTimeout(timer);
  }, []);

  // Initialize custom hooks
  const { 
    streamDetails, 
    isLoading: isStreamDetailsLoading, 
    error: streamDetailsError, 
    fetchStreamDetails 
  } = useStreamDetails({
    streamId,
    token: token || undefined,
    logMessage: console.log,
    runtimeConfig,
    isConfigLoading
  });

  const { 
    activeProductBid, 
    fetchActiveBid 
  } = useActiveBid({
    streamId,
    token: token || undefined,
    isStreamer: isCurrentUserStreamer,
    isConfigLoading,
    logMessage: console.log
  });

  // Update isCurrentUserStreamer when stream details are loaded
  useEffect(() => {
    if (streamDetails) {
      const isStreamer = userId === streamDetails.creatorId;
      setIsCurrentUserStreamer(isStreamer);
      console.log("Streamer status updated", { isStreamer, userId, creatorId: streamDetails.creatorId });
    }
  }, [streamDetails, userId]);

  // Handle like button
  const handleLike = useCallback(() => {
    setIsLiked(prevLiked => {
      if (!prevLiked) {
        setLikeCount((prev) => prev + 1);
      } else {
        setLikeCount((prev) => Math.max(0, prev - 1));
      }
      
      console.log(`User ${!prevLiked ? "liked" : "unliked"} the stream`);
      return !prevLiked;
    });
  }, []);

  // Handle share button
  const handleShare = useCallback(() => {
    console.log("User attempted to share stream");
    toast.info("Share functionality coming soon!");
  }, []);

  // Handle navigation back to home
  const handleBackToHome = useCallback(() => {
    console.log("User navigating back to home");
    router.push("/live-streams");
  }, [router]);

  // Handle Jitsi API ready event
  const handleApiReady = (apiObject: any) => {
    setApiObj(apiObject);
    setIsJoining(false);
    
    // Set up event listeners
    apiObject.addListener('videoConferenceJoined', () => {
      console.log('Local user joined the conference');
      toast.success('Yayına bağlandınız!');
      
      // If streamer, adjust interface
      if (isCurrentUserStreamer) {
        // Set display name
        apiObject.executeCommand('displayName', username || 'Yayıncı');
        
        // Make sure streamer starts with video on
        apiObject.executeCommand('toggleVideo');
        
        // Make sure toolbars are visible and clickable for streamers
        setTimeout(() => {
          try {
            // Jitsi React SDK doesn't support executeScript
            // Instead we need to rely on commands and configuration
            console.log("Making sure streamer controls are visible");
            
            // Toggle interface elements to ensure they're fully loaded
            apiObject.executeCommand('toggleToolbox'); // Show the toolbox
            setTimeout(() => apiObject.executeCommand('toggleToolbox'), 500); // Show it again
            
            // Make sure video is on
            apiObject.executeCommand('toggleVideo', true);
            
            // Make sure audio is on
            apiObject.executeCommand('toggleAudio', true);
            
            // Additional commands to enforce proper UI
            apiObject.executeCommand('overwriteConfig', {
              toolbarButtons: ['microphone', 'camera', 'desktop', 'settings'],
              toolbarConfig: {
                alwaysVisible: true
              }
            });
          } catch (error) {
            console.error("Error adjusting streamer interface:", error);
          }
        }, 1000);
      } else {
        // For viewers - enforce view-only mode
        apiObject.executeCommand('displayName', username || 'İzleyici');
        
        // Force viewers to start with video off
        apiObject.executeCommand('toggleVideo', false);
        
        // Force viewers to start with audio off
        apiObject.executeCommand('toggleAudio', false);
        
        // Additional viewer-specific commands
        setTimeout(() => {
          // Hide the filmstrip that shows all participants
          apiObject.executeCommand('toggleFilmStrip');
          
          // Ensure viewer stays muted by listening for audio mute state changes
          apiObject.addListener('audioMuteStatusChanged', (muted: boolean) => {
            if (!muted) {
              console.log('Viewer attempted to unmute, forcing mute');
              apiObject.executeCommand('toggleAudio');
            }
          });
          
          // Ensure viewer stays video off by listening for video mute state changes
          apiObject.addListener('videoMuteStatusChanged', (muted: boolean) => {
            if (!muted) {
              console.log('Viewer attempted to enable video, forcing video off');
              apiObject.executeCommand('toggleVideo');
            }
          });
        }, 1000);
      }
    });
    
    apiObject.addListener('participantJoined', (participant: any) => {
      console.log('A participant joined:', participant);
    });
    
    apiObject.addListener('videoConferenceLeft', () => {
      console.log('Local user left the conference');
      toast.info('Yayından ayrıldınız');
    });
    
    apiObject.addListener('readyToClose', () => {
      console.log('Jitsi Meet is ready to close');
      router.push('/live-streams');
    });
  };

  // Function to update stream status (for streamers only)
  const updateStreamStatus = async (newStatus: "SCHEDULED" | "STARTING" | "LIVE" | "ENDED") => {
    if (!isCurrentUserStreamer || !streamDetails || !token) {
      console.error("Cannot update stream status: missing required data", { 
        isCurrentUserStreamer, 
        hasStreamDetails: !!streamDetails, 
        hasToken: !!token 
      });
      return;
    }

    if (!runtimeConfig) {
      console.error("Cannot update stream status: runtime config not loaded");
      toast.error("Failed to update stream status: configuration not loaded");
      return;
    }

    setIsUpdatingStatus(true);
    
    try {
      console.log(`Attempting to update stream status to ${newStatus}`, {
        streamId,
        apiUrl: runtimeConfig.apiUrl
      });
      
      // Direct API call instead of relying on fetch
      const response = await fetch(`${runtimeConfig.apiUrl}/live-streams/${streamId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const responseText = await response.text();
      console.log(`Status update response: ${response.status}`, responseText);
      
      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.message || `Failed to update status: ${response.status}`);
        } catch (e) {
          throw new Error(`Failed to update status: ${response.status} ${responseText}`);
        }
      }

      // Refresh stream details
      await fetchStreamDetails();
      toast.success(`Stream status updated to ${newStatus}`);
      
      // If status becomes ENDED, stop any active product bidding
      if (newStatus === "ENDED" && activeProductBid) {
        try {
          await fetch(`${runtimeConfig.apiUrl}/live-streams/${streamId}/bids/${activeProductBid.id}/end`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          console.log("Active bidding ended");
          fetchActiveBid();
        } catch (error) {
          console.error("Failed to end active bidding", error);
        }
      }
    } catch (error) {
      console.error('Error updating stream status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update stream status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Get Jitsi configurations based on stream details and user role
  const getJitsiConfig = () => {
    if (!streamDetails || !streamDetails.roomName) {
      return null;
    }
    
    const roomName = streamDetails.roomName;
    
    // Base configuration for Jitsi
    const baseConfig = {
      startWithAudioMuted: !isCurrentUserStreamer,
      startWithVideoMuted: !isCurrentUserStreamer,
      disableModeratorIndicator: true,
      prejoinPageEnabled: false,  // Always set to false to skip the prejoin page
      disableDeepLinking: true,
      jwt: undefined, // Don't use JWT authentication which triggers login screen
      requireDisplayName: false, // Don't require display name
      hiddenDomain: 'meet.bidpazar.com', // Hide domain selection screen
      noSSL: false, // Use secure connection
      enableWelcomePage: false, // Disable welcome page
      enableClosePage: false, // Disable close page
    };
    
    // Viewer-specific configurations - minimal interface
    const viewerConfig = {
      ...baseConfig,
      startWithAudioMuted: true,
      startWithVideoMuted: true,
      // Remove almost all buttons for viewers
      toolbarButtons: [],
      // Hide the filmstrip that shows all participants
      filmStripOnly: false,
      hideFilmstrip: true,
      // Disable reactions
      disableReactions: true,
      // Disable chat from Jitsi (we use our own chat)
      disableChat: true,
      // Hide the participant pane
      hideParticipantsStats: true,
      // Disable tile view
      disableTileView: true,
      // Hide conference subject/title
      hideConferenceSubject: true,
      // Hide conference timer
      hideConferenceTimer: true,
    };
    
    // Streamer-specific configurations - more controls
    const streamerConfig = {
      ...baseConfig,
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      // Core functionality for streamers
      toolbarButtons: [
        'microphone', 'camera', 'desktop', 'settings'
      ],
      // Allow tile view for streamer
      disableTileView: false,
      // Allow reactions for streamer
      disableReactions: false,
      // Ensure settings are available
      enableInsecureRoomNameWarning: false,
    };
    
    return {
      roomName,
      configOverwrite: isCurrentUserStreamer ? streamerConfig : viewerConfig,
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        DEFAULT_REMOTE_DISPLAY_NAME: 'İzleyici',
        DEFAULT_LOCAL_DISPLAY_NAME: isCurrentUserStreamer ? 'Yayıncı' : 'İzleyici',
        // Toolbar buttons based on role
        TOOLBAR_BUTTONS: isCurrentUserStreamer 
          ? ['microphone', 'camera', 'desktop', 'settings'] 
          : [],
        // Additional UI customizations
        DISABLE_FOCUS_INDICATOR: true,
        DISABLE_VIDEO_BACKGROUND: false,
        VIDEO_QUALITY_LABEL_DISABLED: true,
        CONNECTION_INDICATOR_DISABLED: true,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: true,
        DISABLE_TRANSCRIPTION_SUBTITLES: true,
        TOOLBAR_ALWAYS_VISIBLE: isCurrentUserStreamer,
        TOOLBAR_TIMEOUT: 2000,
        DEFAULT_BACKGROUND: '#000000',
        JITSI_WATERMARK_LINK: '',
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        VERTICAL_FILMSTRIP: true,
        CLOSE_PAGE_GUEST_HINT: false,
        // Hide settings
        SETTINGS_SECTIONS: isCurrentUserStreamer 
          ? ['devices', 'language', 'moderator', 'profile', 'sounds']
          : [],
      },
      userInfo: {
        displayName: username || (isCurrentUserStreamer ? 'Yayıncı' : 'İzleyici'),
        email: user?.email || '',
      },
    };
  };

  // Render appropriate states
  if (isStreamDetailsLoading) {
    return <StreamLoadingState />;
  }

  if (streamDetailsError) {
    return <StreamErrorState errorMessage={streamDetailsError} onBackToHome={handleBackToHome} />;
  }

  if (!streamDetails) {
    return <StreamNotFoundState onBackToHome={handleBackToHome} />;
  }

  // Get Jitsi configuration
  const jitsiConfig = getJitsiConfig();
  
  if (!jitsiConfig) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="p-6 max-w-md">
          <h3 className="text-xl font-semibold mb-2">Yayın Bilgisi Bulunamadı</h3>
          <p className="text-[var(--foreground)]/70 mb-4">Bu yayın için gerekli oda bilgileri bulunamadı.</p>
          <button 
            onClick={handleBackToHome}
            className="bg-[var(--accent)] text-white px-4 py-2 rounded-md"
          >
            Yayın Listesine Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`vertical-stream-container ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
      <div className="stream-content-wrapper">
        {/* Stream header */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent">
          <StreamHeader 
            streamDetails={streamDetails} 
            onBackClick={handleBackToHome} 
            isStreamer={isCurrentUserStreamer}
            onStatusChange={updateStreamStatus}
            isUpdatingStatus={isUpdatingStatus}
          />
        </div>
        
        {/* Jitsi Meeting Component */}
        <div className={`h-full w-full relative ${isCurrentUserStreamer ? 'streamer-mode' : 'viewer-mode'}`}>
          <JitsiMeeting
            domain="meet.bidpazar.com"
            roomName={jitsiConfig.roomName}
            configOverwrite={jitsiConfig.configOverwrite}
            interfaceConfigOverwrite={jitsiConfig.interfaceConfigOverwrite}
            userInfo={jitsiConfig.userInfo}
            onApiReady={handleApiReady}
            getIFrameRef={(parentNode: HTMLDivElement) => {
              if (parentNode) {
                // Style the parent node that will contain the iframe
                parentNode.style.height = '100%';
                parentNode.style.width = '100%';
                // Find the iframe within the parent and style it if needed
                const iframe = parentNode.querySelector('iframe');
                if (iframe) {
                  iframe.style.border = 'none';
                  iframe.style.borderRadius = '8px';
                  // Custom styling needs to be handled via CSS and config options
                  // rather than script injection since executeScript is not available
                }
              }
            }}
          />
          
          {/* Joining overlay */}
          {isJoining && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
              <Loader2 className="h-12 w-12 animate-spin text-white" />
              <p className="text-white mt-4">Yayına bağlanılıyor...</p>
            </div>
          )}
        </div>

        {/* Product section - Repositioned to center-left */}
        <div className="product-section">
          <ProductSection 
            streamId={streamId}
            isStreamer={isCurrentUserStreamer}
            activeProductBid={activeProductBid}
            fetchActiveBid={fetchActiveBid}
            user={user}
          />
        </div>
        
        {/* Action buttons on the right */}
        <div className="stream-actions">
          {/* Like and share buttons */}
          <StreamActions 
            isLiked={isLiked}
            onLike={handleLike}
            onShare={handleShare}
            likeCount={likeCount}
          />
          
          {/* Chat toggle button */}
          <button 
            onClick={() => setShowChat(!showChat)}
            className="action-button"
          >
            <MessageCircle className={`w-5 h-5 ${showChat ? 'text-[var(--accent)]' : 'text-white'}`} />
          </button>
        </div>
        
        {/* Chat moved to bottom of screen */}
        {showChat && (
          <div className="chat-container">
            <div className="p-2 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-white text-sm font-medium">Sohbet</h3>
              <button onClick={() => setShowChat(false)}>
                <X className="w-4 h-4 text-white/70 hover:text-white" />
              </button>
            </div>
            
            <div className="h-[250px]">
              <StreamChat
                streamId={streamId}
                currentUserId={userId || "anonymous"}
                currentUsername={username || "Anonymous Viewer"}
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Show login prompt for anonymous users */}
        {!user && (
          <div className="absolute bottom-4 left-0 right-0 text-center z-40">
            <div className="bg-black/70 mx-auto max-w-md px-4 py-2 rounded-lg text-white">
              <p>Sign in to chat, bid, and interact with this stream</p>
              <button
                onClick={() => router.push("/login")}
                className="mt-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}