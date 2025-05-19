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
import {
  StreamLoadingState,
  StreamErrorState,
  StreamNotFoundState,
} from "./components/StreamStates";

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
  const { config: runtimeConfig, isLoading: isConfigLoading } =
    useRuntimeConfig();

  // Local UI state
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [chatExpanded, setChatExpanded] = useState<boolean>(false);
  const [apiObj, setApiObj] = useState<any>(null);
  const [isCurrentUserStreamer, setIsCurrentUserStreamer] =
    useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);

  // Check sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      // Create a MutationObserver to watch for sidebar changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class"
          ) {
            const sidebar = document.querySelector("aside");
            if (sidebar) {
              const width = window.getComputedStyle(sidebar).width;
              setIsSidebarExpanded(parseInt(width) > 70);
            }
          }
        });
      });

      // Start observing the sidebar element
      const sidebar = document.querySelector("aside");
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
    fetchStreamDetails,
  } = useStreamDetails({
    streamId,
    token: token || undefined,
    logMessage: console.log,
    runtimeConfig,
    isConfigLoading,
  });

  const { activeProductBid, fetchActiveBid } = useActiveBid({
    streamId,
    token: token || undefined,
    isStreamer: isCurrentUserStreamer,
    isConfigLoading,
    logMessage: console.log,
    socket: apiObj,
  });

  // Update isCurrentUserStreamer when stream details are loaded
  useEffect(() => {
    if (streamDetails) {
      const isStreamer = userId === streamDetails.creatorId;
      setIsCurrentUserStreamer(isStreamer);
      console.log("Streamer status updated", {
        isStreamer,
        userId,
        creatorId: streamDetails.creatorId,
      });
    }
  }, [streamDetails, userId]);

  // Handle like button
  const handleLike = useCallback(() => {
    setIsLiked((prevLiked) => {
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

    // Register viewer when they join the stream
    const registerViewer = async () => {
      if (!streamId || !runtimeConfig?.apiUrl) return;

      try {
        const response = await fetch(
          `${runtimeConfig.apiUrl}/live-streams/${streamId}/viewers`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );

        if (response.ok) {
          console.log("Viewer registered for stream");
        }
      } catch (error) {
        console.error("Failed to register viewer:", error);
      }
    };

    // Unregister viewer when they leave
    const unregisterViewer = async () => {
      if (!streamId || !runtimeConfig?.apiUrl) return;

      try {
        await fetch(
          `${runtimeConfig.apiUrl}/live-streams/${streamId}/viewers`,
          {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        console.log("Viewer unregistered from stream");
      } catch (error) {
        console.error("Failed to unregister viewer:", error);
      }
    };

    // Register viewer when joining
    registerViewer();

    // Set up event to unregister on page unload
    window.addEventListener("beforeunload", unregisterViewer);

    // Set up event listeners
    apiObject.addListener("videoConferenceJoined", () => {
      console.log("Local user joined the conference");
      toast.success("Yayına bağlandınız!");

      // If streamer, adjust interface
      if (isCurrentUserStreamer) {
        // Set display name
        apiObject.executeCommand("displayName", username || "Yayıncı");

        // Make sure streamer starts with video on
        apiObject.executeCommand("toggleVideo", true);

        // Make sure streamer starts with audio on
        apiObject.executeCommand("toggleAudio", true);

        // Additional commands to enforce proper UI
        apiObject.executeCommand("overwriteConfig", {
          toolbarButtons: ["microphone", "camera", "desktop", "settings"],
          toolbarConfig: {
            alwaysVisible: true,
          },
        });
      } else {
        // For viewers - enforce view-only mode
        apiObject.executeCommand("displayName", username || "İzleyici");

        // Additional viewer-specific event listeners to ensure they remain in view-only mode
        setTimeout(() => {
          // Ensure viewer stays muted by listening for audio mute state changes
          apiObject.addListener("audioMuteStatusChanged", (muted: boolean) => {
            if (!muted) {
              console.log("Viewer attempted to unmute, forcing mute");
              apiObject.executeCommand("toggleAudio", true);
            }
          });

          // Ensure viewer stays video off by listening for video mute state changes
          apiObject.addListener("videoMuteStatusChanged", (muted: boolean) => {
            if (!muted) {
              console.log(
                "Viewer attempted to enable video, forcing video off"
              );
              apiObject.executeCommand("toggleVideo", true);
            }
          });

          // Handle when conference is joined to force correct settings for viewers
          apiObject.addListener("participantRoleChanged", (event: any) => {
            if (event.role === "participant") {
              console.log("Ensuring viewer settings are applied");
              apiObject.executeCommand("toggleAudio", true); // Ensure muted
              apiObject.executeCommand("toggleVideo", true); // Ensure video off
            }
          });
        }, 1000);
      }
    });

    apiObject.addListener("participantJoined", (participant: any) => {
      console.log("A participant joined:", participant);
    });

    apiObject.addListener("videoConferenceLeft", () => {
      console.log("Local user left the conference");
      toast.info("Yayından ayrıldınız");

      // Unregister viewer when leaving the conference
      unregisterViewer();
    });

    apiObject.addListener("readyToClose", () => {
      console.log("Jitsi Meet is ready to close");

      // Unregister viewer before redirecting
      unregisterViewer().then(() => {
        router.push("/live-streams");
      });
    });

    // Clean up function to remove event listener
    return () => {
      window.removeEventListener("beforeunload", unregisterViewer);
      unregisterViewer();
    };
  };

  // Function to update stream status (for streamers only)
  const updateStreamStatus = async (
    newStatus: "SCHEDULED" | "STARTING" | "LIVE" | "ENDED"
  ) => {
    if (!isCurrentUserStreamer || !streamDetails || !token) {
      console.error("Cannot update stream status: missing required data", {
        isCurrentUserStreamer,
        hasStreamDetails: !!streamDetails,
        hasToken: !!token,
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
        apiUrl: runtimeConfig.apiUrl,
      });

      // Direct API call instead of relying on fetch
      const response = await fetch(
        `${runtimeConfig.apiUrl}/live-streams/${streamId}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const responseText = await response.text();
      console.log(`Status update response: ${response.status}`, responseText);

      if (!response.ok) {
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(
            errorData.message || `Failed to update status: ${response.status}`
          );
        } catch (e) {
          throw new Error(
            `Failed to update status: ${response.status} ${responseText}`
          );
        }
      }

      // Refresh stream details
      await fetchStreamDetails();
      toast.success(`Stream status updated to ${newStatus}`);

      // If status becomes ENDED, stop any active product bidding
      if (newStatus === "ENDED" && activeProductBid) {
        try {
          await fetch(
            `${runtimeConfig.apiUrl}/live-streams/${streamId}/bids/${activeProductBid.id}/end`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          console.log("Active bidding ended");
          fetchActiveBid();
        } catch (error) {
          console.error("Failed to end active bidding", error);
        }
      }
    } catch (error) {
      console.error("Error updating stream status:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update stream status"
      );
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
      prejoinPageEnabled: false, // Always set to false to skip the prejoin page
      disableDeepLinking: true,
      jwt: undefined, // Don't use JWT authentication which triggers login screen
      requireDisplayName: false, // Don't require display name
      hiddenDomain: "meet.bidpazar.com", // Hide domain selection screen
      noSSL: false, // Use secure connection
      enableWelcomePage: false, // Disable welcome page
      enableClosePage: false, // Disable close page
    };

    // Viewer-specific configurations - minimal interface
    const viewerConfig = {
      ...baseConfig,
      startWithAudioMuted: true,
      startWithVideoMuted: true,
      // Critical: Disable permission prompts for audio/video for viewers
      disableInitialGUM: true, // Prevent getUserMedia call for viewers
      // Advanced prejoin configuration to completely disable the prejoin UI
      prejoinConfig: {
        enabled: false,
        hideDisplayName: true,
        hideExtraJoinButtons: true,
      },
      // Don't try to automatically get permissions when joining
      enableNoisyMicDetection: false,
      disableAudioLevels: true,
      // Hide permission dialog for screen sharing
      desktopSharingChromeDisabled: true,
      // Disable lobby functionality for viewers
      enableLobbyChat: false,
      // Ensure lobby is skipped for viewers
      lobby: {
        autoKnock: false,
        enableChat: false,
      },
      // Hide the watermark/logo - these work in configOverwrite
      disableBrandWatermark: true,
      watermark: {
        enabled: false,
        show: false,
        showWatermarkForGuests: false,
      },
      // Ensure filmstrip and user list are completely hidden
      filmstrip: {
        enabled: false,
        disableResizable: true,
        disableStageFilmstrip: true,
        disableSelfView: true,
        visible: false, // Explicit visible false
      },
      hideParticipantsList: true,
      disableFilmstripAutohiding: true,
      disableTileView: true,
      toolbarButtons: [],
      filmStripOnly: false, // Ensure filmstrip is not the only thing visible
      hideFilmstrip: true, // Actively hide the filmstrip
      disableReactions: true,
      disableChat: true, // We use our own chat
      hideParticipantsStats: true,
      hideConferenceSubject: true,
      hideConferenceTimer: true,
      // Aggressively hide more UI elements for viewers
      readOnlyName: true, // Prevent viewers from changing their display name in Jitsi
      disableRemoteMute: true, // Viewers cannot mute others
      disableSelfView: true, // Hide self-view if camera accidentally enabled
      disableSelfViewSettings: true,
      hideLobbyButton: true, // Hide lobby button if it were to appear
      disableProfile: true, // Disable profile features
      remoteVideoMenu: {
        // Disable context menu on remote participants' videos
        disabled: true,
        disableKick: true,
        disableGrantModerator: true,
        disablePrivateMessage: true,
      },
      participantsPane: {
        // Ensure participant pane is hidden and non-interactive
        hideModeratorSettingsTab: true,
        hideMoreActionsButton: true,
        hideMuteAllButton: true,
      },
      notifications: [], // Disable all Jitsi internal notifications
      disableScreensharing: true, // Viewers cannot share their screen
      disableRecordings: true, // Viewers cannot start/stop recordings
      disableRemoteControl: true, // Viewers cannot request remote control
      disableVideoQualityLabel: true, // Hide video quality label
      // Remove all UI-related settings that should be in interfaceConfigOverwrite
    };

    // Streamer-specific configurations - more controls
    const streamerConfig = {
      ...baseConfig,
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      // Core functionality for streamers
      toolbarButtons: ["microphone", "camera", "desktop", "settings"],
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
        DEFAULT_REMOTE_DISPLAY_NAME: "İzleyici",
        DEFAULT_LOCAL_DISPLAY_NAME: isCurrentUserStreamer
          ? "Yayıncı"
          : "İzleyici",
        // Toolbar buttons based on role
        TOOLBAR_BUTTONS: isCurrentUserStreamer
          ? ["microphone", "camera", "desktop", "settings"]
          : [], // Empty for viewers
        // Additional UI customizations
        DISABLE_FOCUS_INDICATOR: true,
        DISABLE_VIDEO_BACKGROUND: true, // Viewers should not see/change video background options
        VIDEO_QUALITY_LABEL_DISABLED: true, // Reinforce disabling video quality label
        CONNECTION_INDICATOR_DISABLED: true,
        DISABLE_DOMINANT_SPEAKER_INDICATOR: true,
        DISABLE_TRANSCRIPTION_SUBTITLES: true,
        TOOLBAR_ALWAYS_VISIBLE: isCurrentUserStreamer, // False for viewers, hiding toolbar
        TOOLBAR_TIMEOUT: isCurrentUserStreamer ? 2000 : 0, // Hide toolbar immediately for viewers if it ever appears
        DEFAULT_BACKGROUND: "#000000",
        JITSI_WATERMARK_LINK: "",
        // Aggressively hide the Jitsi watermark/logo
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        HIDE_DEEP_LINKING_LOGO: true,
        HIDE_LOGO_ON_LOBBY_SCREEN: true,
        HIDE_LOGO_ON_WELCOME_PAGE: true,
        HIDE_INVITE_MORE_HEADER: true,
        // Completely disable filmstrip
        VERTICAL_FILMSTRIP: false,
        FILMSTRIP_ENABLED: false,
        CLOSE_PAGE_GUEST_HINT: false,
        // Hide settings
        SETTINGS_SECTIONS: isCurrentUserStreamer
          ? ["devices", "language", "moderator", "profile", "sounds"]
          : [], // Empty for viewers
        // Further UI element hiding for viewers
        APP_NAME: "BidPazar",
        NATIVE_APP_NAME: "BidPazar",
        PROVIDER_NAME: "BidPazar",
        DISPLAY_WELCOME_PAGE_CONTENT: false,
        DISPLAY_WELCOME_FOOTER: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        RECENT_LIST_ENABLED: false,
        ENABLE_FEEDBACK_ANIMATION: false,
        DISABLE_RINGING: true,
        DISABLE_PROFILE_SETTINGS: true, // Disables access to profile settings for viewers
        HIDE_CARDS: true, // Hides info cards like speaker stats
        HIDE_PARTICIPANTS_BUTTON: true, // Ensure participants button is hidden
        HIDE_INVITE_FUNCTION: true, // Hide any invitation functionality
        HIDE_PREJOIN_DISPLAY_NAME: true, // Hide display name input on prejoin if it were enabled
        HIDE_SUBJECT: true, // Hide conference subject display
        // Manage filmstrip hiding for viewers
        HIDE_FILMSTRIP_BUTTON: true,
        TILE_VIEW_MAX_COLUMNS: 1, // If tile view were somehow activated, limit to 1 column
        DISABLE_PRESENCE_STATUS: true, // Disable presence status indicators
        HIDE_PARTICIPANT_NAME: true, // Hide participant names if they were to show
        HIDE_PARTICIPANT_PROFILE_BUTTON: true, // Hide profile buttons on participants
        DISABLE_REMOTE_VIDEO_MENU: true, // Reinforce disabling context menus on videos
        SHOW_PROMOTIONAL_CLOSE_PAGE: false, // No promotional content on close
        INVITATION_POWERED_BY: false, // No "powered by" in any potential invitation UI
      },
      userInfo: {
        displayName:
          username || (isCurrentUserStreamer ? "Yayıncı" : "İzleyici"),
        email: user?.email || "",
      },
    };
  };

  // Render appropriate states
  if (isStreamDetailsLoading) {
    return <StreamLoadingState />;
  }

  if (streamDetailsError) {
    return (
      <StreamErrorState
        errorMessage={streamDetailsError}
        onBackToHome={handleBackToHome}
      />
    );
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
          <h3 className="text-xl font-semibold mb-2">
            Yayın Bilgisi Bulunamadı
          </h3>
          <p className="text-[var(--foreground)]/70 mb-4">
            Bu yayın için gerekli oda bilgileri bulunamadı.
          </p>
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
    <div
      className={`vertical-stream-container ${
        isSidebarExpanded ? "sidebar-expanded" : ""
      }`}
    >
      <div
        className={`stream-content-wrapper ${
          isCurrentUserStreamer ? "streamer-content" : ""
        }`}
      >
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
        <div
          className={`h-full w-full relative ${
            isCurrentUserStreamer ? "streamer-mode" : "viewer-mode"
          }`}
        >
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
                parentNode.style.height = "100%";
                parentNode.style.width = "100%";
                // Find the iframe within the parent and style it if needed
                const iframe = parentNode.querySelector("iframe");
                if (iframe) {
                  iframe.style.border = "none";
                  iframe.style.borderRadius = "8px";

                  if (!isCurrentUserStreamer) {
                    // For viewers, inject CSS to forcibly hide logos and participant lists
                    setTimeout(() => {
                      try {
                        const iframeDocument =
                          iframe.contentDocument ||
                          iframe.contentWindow?.document;
                        if (iframeDocument) {
                          // Create a style element
                          const style = iframeDocument.createElement("style");
                          style.textContent = `
                            /* Hide Jitsi watermark and logo */
                            .watermark,
                            #largeVideoBackgroundContainer .watermark,
                            .jr-watermark,
                            .deep-linking-mobile-logo,
                            .welcome-logo,
                            .welcome-watermark,
                            .jitsi-logo {
                              display: none !important;
                              opacity: 0 !important;
                              visibility: hidden !important;
                            }
                            
                            /* Hide filmstrip and participant list */
                            #filmstripContainer,
                            .filmstrip,
                            .vertical-filmstrip,
                            #remoteVideos,
                            #filmstripRemoteVideos,
                            .filmstrip__videos,
                            #participantsPane,
                            .participants-pane {
                              display: none !important;
                              opacity: 0 !important;
                              visibility: hidden !important;
                              width: 0 !important;
                              height: 0 !important;
                            }
                            
                            /* Ensure the main video takes up the full space */
                            #videospace {
                              width: 100% !important;
                              height: 100% !important;
                            }
                          `;

                          // Append the style to the iframe document head
                          iframeDocument.head.appendChild(style);
                          console.log(
                            "Injected custom CSS to hide Jitsi UI elements"
                          );
                        }
                      } catch (error) {
                        console.error(
                          "Failed to inject CSS into Jitsi iframe:",
                          error
                        );
                      }
                    }, 2000); // Give the iframe content time to load
                  }
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
            socket={apiObj}
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

          {/* Chat toggle button - Now toggles between expanded and minimized */}
          <button
            onClick={() => setChatExpanded(!chatExpanded)}
            className="action-button"
          >
            <MessageCircle
              className={`w-5 h-5 ${
                chatExpanded ? "text-[var(--accent)]" : "text-white"
              }`}
            />
          </button>
        </div>

        {/* Always visible chat container at the bottom - TikTok/Instagram style */}
        <div
          className={`permanent-chat-container ${
            chatExpanded ? "expanded" : "minimized"
          } ${isCurrentUserStreamer ? "streamer-chat" : ""}`}
        >
          <div className="chat-header border-b border-white/10 flex justify-between items-center p-2">
            <h3 className="text-white text-sm font-medium">Canlı Sohbet</h3>
            <button onClick={() => setChatExpanded(!chatExpanded)}>
              {chatExpanded ? (
                <X className="w-4 h-4 text-white/70 hover:text-white" />
              ) : (
                <MessageCircle className="w-4 h-4 text-white/70 hover:text-white" />
              )}
            </button>
          </div>

          <div
            className={`chat-body ${chatExpanded ? "h-[250px]" : "h-[120px]"}`}
          >
            <StreamChat
              streamId={streamId}
              currentUserId={userId || "anonymous"}
              currentUsername={username || "Anonymous Viewer"}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Show login prompt for anonymous users */}
        {!user && (
          <div className="absolute bottom-4 left-0 right-0 text-center z-40">
            <div className="bg-black/70 mx-auto max-w-md px-4 py-2 rounded-lg text-white">
              <p>
                Açık arttırmalara katılmak ve sohbet etmek için giriş
                yapmalısınız
              </p>
              <button
                onClick={() => router.push("/login")}
                className="mt-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-md text-sm"
              >
                Giriş Yap
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
