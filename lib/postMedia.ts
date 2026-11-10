export const MAX_VIDEO_SECONDS = 60;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

export function isVideo(file: File): boolean {
  return file.type.startsWith('video/');
}

/** Reads a video's length in seconds from its metadata. */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    video.src = url;
  });
}

/** Returns why Meta would reject the file, or null when it is acceptable. */
export async function checkMedia(
  file: File,
  getDuration: (file: File) => Promise<number> = readVideoDuration,
): Promise<string | null> {
  if (IMAGE_TYPES.includes(file.type)) {
    return file.size > MAX_IMAGE_BYTES
      ? 'This photo is larger than 8 MB, which Meta does not accept. Choose a smaller photo.'
      : null;
  }
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) {
      return 'This video is larger than 100 MB, which Meta does not accept. Choose a smaller video.';
    }
    try {
      const seconds = await getDuration(file);
      if (seconds > MAX_VIDEO_SECONDS) {
        return `This video is longer than ${MAX_VIDEO_SECONDS} seconds. Choose a shorter video.`;
      }
    } catch {
      return 'We could not read this video. Choose an MP4 or MOV file that plays.';
    }
    return null;
  }
  return 'This file type is not accepted. Choose a JPG or PNG photo, or an MP4 or MOV video.';
}
