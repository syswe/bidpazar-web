import { prisma } from './prisma';

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: string;
}

interface UserDevices {
  videoDeviceId?: string;
  audioDeviceId?: string;
}

export async function saveUserDevices(userId: string, devices: UserDevices): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      videoDeviceId: devices.videoDeviceId,
      audioDeviceId: devices.audioDeviceId,
    },
  });
}

export async function getUserDevices(userId: string): Promise<UserDevices> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      videoDeviceId: true,
      audioDeviceId: true,
    },
  });

  return {
    videoDeviceId: user?.videoDeviceId || undefined,
    audioDeviceId: user?.audioDeviceId || undefined,
  };
}

export async function getAvailableDevices(): Promise<{
  videoDevices: DeviceInfo[];
  audioDevices: DeviceInfo[];
}> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    const videoDevices = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Camera',
        kind: device.kind,
      }));

    const audioDevices = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Microphone',
        kind: device.kind,
      }));

    return { videoDevices, audioDevices };
  } catch (error) {
    console.error('Failed to get available devices:', error);
    return { videoDevices: [], audioDevices: [] };
  }
} 